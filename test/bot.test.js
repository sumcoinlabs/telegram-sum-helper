import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,commandFrom,inAllowedGroup} from '../src/bot.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import {State} from '../src/state.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
function setup(initialMode='reply'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sumhelper-'));
  const state=new State(path.join(dir,'state.json'),initialMode);
  const learning=new Learning(path.join(dir,'learn.json'));
  const knowledge=new Knowledge({learned:learning.data.approved});
  const sent=[];const client={sendMessage:async(m,text)=>sent.push({m,text}),getChatMember:async(_,id)=>({status:id===5?'administrator':'member'})};
  const config={allowedChatUsername:'sumcoins',allowedChatId:'',userCooldownHours:6,topicCooldownSeconds:120,learningEnabled:true,autoAI:false};
  const ai=new ConversationAI();
  const handler=createHandler({client,state,config,learning,knowledge,ai,botUsername:'SumCoinTestBot'});
  const message=(id,text,overrides={})=>({message_id:id,date:Math.floor(Date.now()/1000),text,from:{id:7,is_bot:false},chat:{id:-100123,type:'supergroup',username:'sumcoins'},...overrides});
  return {handler,message,config,state,sent,learning,knowledge,dir,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('authorized group, and accurate Spanish cashout',async()=>{const x=setup();try{
 await x.handler(x.message(1,'Como puedo retirar 100 dolares de mi wallet sumcoin?',{chat:{type:'supergroup',username:'other',id:-5}}));assert.equal(x.sent.length,0);
 await x.handler(x.message(2,'Como puedo retirar 100 dolares de mi wallet sumcoin?'));assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/no dólares depositados/i);
 assert.match(x.sent[0].text,/índice/i);
}finally{x.clean()}});
test('zero wallet balance routes to specific troubleshooting not generic wallet',async()=>{const x=setup();try{
 await x.handler(x.message(1,'My Sumcoin wallet balance is zero. Where did my SUM go?'));assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/empty wallet screen/i);
}finally{x.clean()}});
test('bot ignores old, DM chatter and other bot messages',async()=>{const x=setup();try{
 await x.handler(x.message(1,'How do I withdraw SUM?',{date:100}));
 await x.handler(x.message(2,'How do I withdraw SUM?',{from:{id:4,is_bot:true}}));
 await x.handler(x.message(3,'How do I withdraw SUM?',{chat:{id:9,type:'private'}}));assert.equal(x.sent.length,0);
}finally{x.clean()}});
test('observe mode records questions and sends no unsolicited answer',async()=>{const x=setup('observe');try{
 await x.handler(x.message(1,'How can I cash out Sumcoin?'));assert.equal(x.sent.length,0);assert.ok(x.learning.stats().includes('1'));
}finally{x.clean()}});
test('only real admins can set mode or approve knowledge',async()=>{const x=setup();try{
 await x.handler(x.message(1,'/mode observe'));assert.equal(x.state.data.mode,'reply');
 await x.handler(x.message(2,'/mode observe',{from:{id:5}}));assert.equal(x.state.data.mode,'observe');
 await x.handler(x.message(3,'/teach Can I mine SUM? | Use Core staking. | https://sumcoin.org/',{from:{id:5}}));
 assert.equal(x.learning.data.pending.length,1);
 await x.handler(x.message(4,'/approve 1'));assert.equal(x.learning.data.approved.length,0);
 await x.handler(x.message(5,'/approve 1',{from:{id:5}}));assert.equal(x.learning.data.approved.length,1);
}finally{x.clean()}});
test('explicit /ask returns grounded answer without an AI API key',async()=>{const x=setup('observe');try{
 await x.handler(x.message(1,'/ask Why is my Sumcoin balance missing?'));assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/Source:/);assert.match(x.sent[0].text,/zero|empty/i);
}finally{x.clean()}});
test('chat mentions route to conversation flow',async()=>{const x=setup('observe');try{
 await x.handler(x.message(1,'@SumCoinTestBot how can I restore my old Slice wallet?'));
 assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/Slice/i);
}finally{x.clean()}});
test('never post or store a message containing a declared seed phrase',async()=>{const x=setup();try{
 await x.handler(x.message(1,'my seed phrase is word1 word2 word3, how to restore sumcoin?'));assert.equal(x.sent.length,0);assert.equal(Object.keys(x.learning.data.patterns).length,0);
}finally{x.clean()}});
test('bot commands routed to other bots ignored',()=>{assert.equal(commandFrom('/ask@anotherBot testing','SumCoinTestBot'),null);assert.deepEqual(commandFrom('/ask@SumCoinTestBot abc','SumCoinTestBot'),{name:'ask',arg:'abc'});assert.equal(inAllowedGroup({type:'group',username:'SUMCOINS',id:1},{allowedChatUsername:'sumcoins'}),true);});
test('automatic answers have cooldown, not group spam',async()=>{const x=setup();try{
 await x.handler(x.message(1,'How do I withdraw SUM?'));await x.handler(x.message(2,'How do I withdraw SUM?'));
 assert.equal(x.sent.length,1);
}finally{x.clean()}});
