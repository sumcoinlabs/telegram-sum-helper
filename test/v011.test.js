import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHandler} from '../src/bot.js';
import {isMoreRequest,isContextualFollowup} from '../src/offline.js';
import {Knowledge} from '../src/knowledge.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {Escalations} from '../src/escalations.js';
import {ConversationAI} from '../src/ai.js';

function fixture(mode='reply') {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v011-'));
  const sent=[],rates=[];
  const roles=new Map([[1,'administrator'],[21,'member'],[22,'member'],[23,'member']]);
  const client={
    sendMessage:async(m,t)=>{const result={message_id:100+sent.length};sent.push({m,t,id:result.message_id});return result;},
    getChatMember:async(_chat,id)=>({status:roles.get(id)||'member'})
  };
  const handler=createHandler({client,state:new State(path.join(dir,'state.json'),mode),
    config:{allowedChatUsername:'sumcoins',learningEnabled:false,allowPrivateChats:false,userCooldownHours:6,topicCooldownSeconds:120},
    botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),
    ai:new ConversationAI(),escalations:new Escalations(path.join(dir,'escalations.json')),
    liveOps:{price:async opts=>{rates.push(opts);return 'SUM reference ' + (opts.currency||'USD');},tx:async()=>'',address:async()=>''}});
  let msgid=0;
  const message=(text,user=21,lang='en',replyTo=null)=>({message_id:++msgid,chat:{id:-1000123,username:'sumcoins',type:'supergroup'},
    from:{id:user,language_code:lang,username:'member'},date:Math.floor(Date.now()/1000),text,
    ...(replyTo?{reply_to_message:{message_id:replyTo.id,from:{is_bot:true,username:'SumcoinHelperBot'}}}:{})});
  return {sent,rates,roles,handler,message,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}

test('v011 narrow follow-ups in 14 languages and no false unrelated chatter',()=>{
  for(const q of ['Can you tell me more?','Tell me more','please explain that','more details?','Cuéntame más','Pode explicar melhor?',
    'Plus de détails','Erzähl mir mehr','Dimmi di più','Расскажи подробнее','اشرح أكثر','और बताओ','详细说说','もっと詳しく教えて','좀 더 자세히 알려줘','Daha fazla anlat','Jelaskan lebih lanjut']){
    assert.equal(isMoreRequest(q),true,q);assert.equal(isContextualFollowup(q),true,q);
  }
  for(const q of ['this is just a test','can you tell me more about my truck?','more people are joining','Sumcoin is awesome','what is the Sumcoin price in yen?'])assert.equal(isMoreRequest(q),false,q);
});
test('v011 screenshot: ignores benign text, answers PoW, then expands an unmentioned follow-up',async()=>{
  const x=fixture();try{
    await x.handler(x.message('this is just a test'));
    assert.equal(x.sent.length,0);
    await x.handler(x.message('is sumcoin proof of work?'));
    assert.equal(x.sent.length,1);
    assert.match(x.sent[0].t,/current.*proof-of-stake/i);
    await x.handler(x.message('can you tell me more?'));
    assert.equal(x.sent.length,2);
    assert.match(x.sent[1].t,/started with proof-of-work|began with proof-of-work/i);
    assert.match(x.sent[1].t,/Related context/i);
    assert.match(x.sent[1].t,/https:\/\/www\.sumcoin\.org\/about\//);
  }finally{x.clean();}
});
test('v011 context is scoped to member and group, never replies to a stranger bare follow-up',async()=>{
  const x=fixture();try{
    await x.handler(x.message('is sumcoin proof of work?',21));
    await x.handler(x.message('can you tell me more?',22));
    assert.equal(x.sent.length,1);
  }finally{x.clean();}
});
test('v011 a reply to a particular bot message supports cross-member follow-up without needing a prior question',async()=>{
  const x=fixture();try{
    await x.handler(x.message('is sumcoin proof of work?',21));
    const prior=x.sent[0];
    await x.handler(x.message('Tell me more',22,'en',prior));
    assert.equal(x.sent.length,2);
    assert.match(x.sent[1].t,/Related context/);
    assert.match(x.sent[1].t,/proof-of-work/i);
  }finally{x.clean();}
});
test('v011 non-admin auto wallet FAQ stores topic for a longer questionless follow-up',async()=>{
  const x=fixture();try{
    await x.handler(x.message('How can I restore my Sumcoin wallet?',21));
    assert.equal(x.sent.length,1);
    await x.handler(x.message('Tell me more',21));
    assert.equal(x.sent.length,2);
    assert.match(x.sent[1].t,/wallet|recovery/i);
    assert.match(x.sent[1].t,/Related context/);
  }finally{x.clean();}
});
test('v011 natural price answer stores index context and follow-up gives explanation, not invented second rate',async()=>{
  const x=fixture();try{
    await x.handler(x.message('What is the current Sumcoin price in yen?',21));
    assert.equal(x.rates.length,1);
    await x.handler(x.message('Can you tell me more?',21));
    assert.equal(x.rates.length,1);
    assert.equal(x.sent.length,2);
    assert.match(x.sent[1].t,/reference|index/i);
    assert.match(x.sent[1].t,/Related context/i);
  }finally{x.clean();}
});
test('v011 no unsolicited follow-ups to admins, muted users or in observe mode',async()=>{
  const x=fixture();try{
    await x.handler(x.message('Is Sumcoin proof of work?',21));
    x.roles.set(21,'administrator');
    await x.handler(x.message('tell me more',21));
    assert.equal(x.sent.length,1);
  }finally{x.clean();}
  const o=fixture('observe');try{
    await o.handler(o.message('Is Sumcoin proof of work?',21));
    await o.handler(o.message('tell me more',21));
    assert.equal(o.sent.length,0);
  }finally{o.clean();}
});
test('v011 /more and direct mention still work, and explicit new topic overrides stale follow-up context',async()=>{
  const x=fixture();try{
    await x.handler(x.message('Is Sumcoin proof of work?',21));
    await x.handler(x.message('/more@SumcoinHelperBot',21));
    assert.equal(x.sent.length,2);
    assert.match(x.sent.at(-1).t,/Related context/);
    await x.handler(x.message('@SumcoinHelperBot What are the transaction fees?',21));
    assert.equal(x.sent.length,3);
    assert.match(x.sent.at(-1).t,/fee/i);
  }finally{x.clean();}
});

test('v011 replying to another member bot answer uses the responder language',async()=>{
  const x=fixture();try{
    await x.handler(x.message('Is Sumcoin proof of work?',21,'en'));
    const earlier=x.sent[0];
    await x.handler(x.message('もっと詳しく教えて',22,'ja',earlier));
    assert.equal(x.sent.length,2);
    assert.match(x.sent[1].t,/Sumcoin|PoS|マイニング/);
    assert.match(x.sent[1].t,/当初|現在|ネットワーク|詳しく|PoW/);
  }finally{x.clean();}
});

test('v011 opted-out member receives no unmentioned follow-up',async()=>{
  const x=fixture();try{
    await x.handler(x.message('Is Sumcoin proof of work?',21));
    await x.handler(x.message('/stop',21));
    const count=x.sent.length;
    await x.handler(x.message('Can you tell me more?',21));
    assert.equal(x.sent.length,count);
  }finally{x.clean();}
});

test('v011 README uses exact official Sumcoin logo, real project badges and stays concise',()=>{
  const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
  assert.match(readme,/https:\/\/sumcoin\.org\/wp-content\/uploads\/2019\/07\/sumcoin_400x400\.png/);
  assert.match(readme,/actions\/workflows\/test\.yml\/badge\.svg/);
  assert.match(readme,/version-0\.0\.\d+/);
  assert.match(readme,/license-MIT/);
  assert.ok(readme.split('\n').length<100);
  assert.ok(readme.length<7000);
  assert.match(readme,/docs\/OPERATIONS\.md/);
});
