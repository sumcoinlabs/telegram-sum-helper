import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ConversationAI} from '../src/ai.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {State} from '../src/state.js';
import {createHandler} from '../src/bot.js';
import {priceIntent,ambiguousPesoPrice,pesoClarificationCurrency} from '../src/intent.js';
import {VERSION} from '../src/version.js';
const kb=new Knowledge();
const setup=({ai=new ConversationAI(),mode='reply'}={})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v015-'));
  const sent=[],prices=[];
  const client={sendMessage:async (m,text)=>{sent.push({m,text});return {message_id:100+sent.length};},getChatMember:async (_chat,id)=>({status:id===999?'administrator':'member'})};
  const state=new State(path.join(dir,'state.json'),mode);
  const bot=createHandler({client,state,config:{allowedChatUsername:'sumcoins',groupIndexEnabled:false,learningEnabled:false,aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:kb,learning:new Learning(path.join(dir,'learning.json')),ai,liveOps:{price:async opts=>{prices.push(opts);return 'LIVE '+opts.currency;},tx:async()=>'',address:async()=>''}});
  let next=0;
  const msg=(text,id=21)=>({chat:{id:-1001234,type:'supergroup',username:'sumcoins'},from:{id,username:id===999?'admin':'user'+id,language_code:'en'},date:Math.floor(Date.now()/1000),message_id:++next,text});
  return {bot,sent,prices,msg,state,close:()=>fs.rmSync(dir,{force:true,recursive:true})};
};
test('v015 protected publisher builds from known v014 release and no secrets',()=>{
  assert.equal(VERSION,'0.0.19');
  const script=fs.readFileSync(new URL('../scripts/push-update.sh',import.meta.url),'utf8');
  assert.match(script,/84f6fbca2d112bf30e7dd5134e8a06a4a77d344e/);
  assert.match(script,/0\.0\.18/);assert.match(script,/0\.0\.19/);
  assert.doesNotMatch(script,/git push --force/);
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8');
  for(const setting of ['AI_ENABLED=false','AI_PROVIDER=groq','AI_MODEL=openai/gpt-oss-120b','GROQ_API_KEY=','AI_HOURLY_LIMIT=4','AI_DAILY_LIMIT=12','AI_MONTHLY_LIMIT=60'])assert.ok(env.includes(setting));
});
test('v015 Groq API sends correct Responses request and omits store entirely',async()=>{
  let call;
  const ai=new ConversationAI({provider:'groq',apiKey:'test-only-secret',fetchImpl:async(url,options)=>{call={url,options};return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Sumcoin now uses proof of stake.'}]}]})};}});
  const r=await ai.answer({question:'Explain Sumcoin consensus',context:kb.search('proof of stake Sumcoin'),historyKey:'test-groq'});
  assert.equal(r.usedAI,true);assert.match(r.text,/Sumcoin now uses proof of stake/);
  assert.match(r.text,/Sources:/);assert.equal(call.url,'https://api.groq.com/openai/v1/responses');
  assert.equal(call.options.headers.authorization,'Bearer test-only-secret');
  const body=JSON.parse(call.options.body);
  assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.max_output_tokens,500);
  assert.deepEqual(body.reasoning,{effort:'low'});assert.equal(Object.hasOwn(body,'store'),false);
  assert.equal(Object.hasOwn(body,'tools'),false);
});
test('v015 direct OpenAI remains supported and provider hosts are fixed',()=>{
  assert.throws(()=>new ConversationAI({provider:'https://evil.example',apiKey:'x'}),/Unsupported AI provider/);
  assert.equal(new ConversationAI({provider:'openai'}).model,'gpt-6-luna');
  assert.equal(new ConversationAI({provider:'groq'}).model,'openai/gpt-oss-120b');
});
test('v015 ambiguous peso question is identified without changing quoted precise currencies',()=>{
  for(const q of ['whats sumcoin in pesos','whats the sumcoin price in pesos','Sumcoin price in pesos?'])assert.equal(ambiguousPesoPrice(q),true,q);
  for(const q of ['Sumcoin price in Mexican pesos','Sumcoin price in Philippine pesos?','My Sumcoin migration fee in pesos?','Sumcoin price in JPY'])assert.equal(ambiguousPesoPrice(q),false,q);
  for(const [q,code] of [['Mexican','MXN'],['MXN','MXN'],['i meant Colombian','COP'],['Chilean pesos','CLP'],['Argentine','ARS'],['Philippine','PHP']])assert.equal(pesoClarificationCurrency(q),code,q);
  assert.equal(pesoClarificationCurrency('What about fees?'),null);
  assert.equal(priceIntent('whats sumcoin in pesos'),null);
});
test('v015 real group: ask pesos, clarify Mexican, live price without AI',async()=>{
 const x=setup();try{
  await x.bot(x.msg('whats sumcoin in pesos'));
  assert.equal(x.prices.length,0);assert.match(x.sent[0].text,/Which pesos.*Mexican.*Colombian/i);
  await x.bot(x.msg('Mexican',22));assert.equal(x.prices.length,0,'other member cannot hijack a clarification');
  await x.bot(x.msg('Mexican'));
  assert.equal(x.prices.length,1);assert.equal(x.prices[0].currency,'MXN');assert.equal(x.sent[1].text,'LIVE MXN');
  await x.bot(x.msg('whats sumcoin in pesos'));await x.bot(x.msg('Colombian'));
  assert.equal(x.prices.length,2);assert.equal(x.prices[1].currency,'COP');
 }finally{x.close();}
});
test('v015 direct /ask also clarifies without consuming an AI quota',async()=>{
 const x=setup();try{
  await x.bot(x.msg('/ask whats sumcoin in pesos'));
  await x.bot(x.msg('/ask Jupiter'));
  assert.equal(x.prices.length,0,'unrecognized response not fabricated');
  await x.bot(x.msg('Philippine'));
  assert.equal(x.prices.length,1);assert.equal(x.prices[0].currency,'PHP');
  assert.equal(x.state.data.aiRequests[new Date().toISOString().slice(0,10)]||0,0);
 }finally{x.close();}
});
test('v015 observe mode blocks a pending currency followup',async()=>{
 const x=setup();try{await x.bot(x.msg('whats sumcoin in pesos'));x.state.setMode('observe');await x.bot(x.msg('Mexican'));assert.equal(x.prices.length,0);}finally{x.close();}
});
test('v015 provider outage falls back to documented offline answer, does not expose secret',async()=>{
 let calls=0;
 const ai=new ConversationAI({provider:'groq',apiKey:'sensitive-key',fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
 const x=setup({ai});try{
  await x.bot(x.msg('/ask Why does Sumcoin use an index?'));
  assert.equal(calls,1);assert.ok(x.sent.some(x=>/sumcoin|index/i.test(x.text)));
  assert.doesNotMatch(x.sent.map(x=>x.text).join(''),/sensitive-key/);
 }finally{x.close();}
});
