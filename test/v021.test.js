import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {marketIntent, MarketHistory} from '../src/market-insights.js';
import {State} from '../src/state.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {VERSION} from '../src/version.js';

const historical={success:true,symbol:'SUM',pair:'usd',range:'all',count:3,
  period:{high:1955.53,low:120,change_percent:120,start_time:1522540800,end_time:1793400000},
  data:[{time:1522540800,high:150.5},{time:1759622400,high:1955.53},{time:1761868800,high:1205}]};
const response=data=>({ok:true,headers:{get:n=>n==='content-type'?'application/json':null},text:async()=>JSON.stringify(data)});
const setup=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v021-'));
 const sent=[];let seq=800,apiCalls=0,groqCalls=0;
 const state=new State(path.join(dir,'state.json'),'reply');
 const client={sendMessage:async(m,text)=>{const id=++seq;sent.push({id,m,text});return {message_id:id};},
   getChatMember:async(_chat,id)=>({status:id===1?'creator':'member'})};
 const ai=new ConversationAI({apiKey:'TEST_ONLY',provider:'groq'});
 ai.answer=async()=>{groqCalls++;return {text:'Groq response',usedAI:true};};
 const marketHistory=new MarketHistory({fetchImpl:async()=>{apiCalls++;return response(historical);}});
 const handle=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:true,learningEnabled:false,
   aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),
   learning:new Learning(path.join(dir,'learning.json')),ai,marketHistory,
   liveOps:{price:async()=> 'Sumcoin peer-to-peer reference rate\n1 SUM ≈ 1,205.00 USD',tx:async()=>'',address:async()=>''}});
 let msgId=0;
 const message=(text,uid=3)=>({message_id:++msgId,chat:{id:-10013,username:'sumcoins',type:'supergroup'},
   date:Math.floor(Date.now()/1000),from:{id:uid,language_code:'en'},text});
 return {handle,sent,state,message,get apiCalls(){return apiCalls;},get groqCalls(){return groqCalls;},cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
};

test('v021: standalone ATH phrasing works with no prior context, while unrelated assets do not hijack SUM',()=>{
 assert.equal(VERSION,'0.0.21');
 for(const q of ['what was the all time high','What was the all-time high?','what is the ATH?',
   'whats the all time high', 'What was the peak price?'])assert.equal(marketIntent(q)?.kind,'ath',q);
 for(const q of ['What was Bitcoin’s all-time high?', 'What was the all time high for bitcoin?',
   'What was the dogecoin ATH?', 'My portfolio hit an all time high','Record profits!'])
   assert.equal(marketIntent(q,{active:true}),null,q);
 assert.equal(marketIntent('Was that higher than Bitcoin?',{active:true})?.kind,'compare');
});

test('v021: exact Telegram sequence price then unhyphenated ATH works without chart or /ask',async()=>{
 const s=setup();try{
  await s.handle(s.message('whats the price of sum',1));
  assert.match(s.sent.at(-1).text,/1,205\.00 USD/);
  await s.handle(s.message('what was the all time high',1));
  assert.match(s.sent.at(-1).text,/1,955\.53/);
  assert.match(s.sent.at(-1).text,/2025-10-05/);
  assert.equal(s.apiCalls,1);
  assert.equal(s.groqCalls,0);
  assert.equal(s.state.data.aiRequests[new Date().toISOString().slice(0,10)]||0,0);
 }finally{s.cleanup();}
});

test('v021: a new member can ask standalone ATH independently; vague followups remain member-specific',async()=>{
 const s=setup();try{
  await s.handle(s.message('whats the price of sum',3));
  const before=s.sent.length;
  await s.handle(s.message('What about last year?',4));
  assert.equal(s.sent.length,before,'vague follow-up must not borrow another member context');
  await s.handle(s.message('What was the all-time high?',4));
  assert.match(s.sent.at(-1).text,/1,955\.53/);
  const n=s.sent.length;
  await s.handle(s.message('What was Bitcoin’s all-time high?',4));
  assert.equal(s.sent.length,n,'do not mislabel another asset as Sumcoin ATH');
 }finally{s.cleanup();}
});

test('v021: market context is not established if Telegram delivery fails',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v021-fail-'));
 try{
  const sent=[];
  const client={sendMessage:async(m,text)=>{if(text.includes('reference rate'))throw Error('send failed');sent.push(text);return {message_id:sent.length+100};},getChatMember:async()=>({status:'member'})};
  const state=new State(path.join(dir,'state.json'),'reply');
  const handle=createHandler({client,state,config:{allowedChatUsername:'sumcoins',learningEnabled:false},
    botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),
    ai:new ConversationAI(),liveOps:{price:async()=> 'reference rate',tx:async()=>'',address:async()=>''}});
  const m=(text,id)=>({message_id:id,chat:{id:-10013,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:10,language_code:'en'},text});
  await assert.rejects(handle(m('whats the price of sum',1)),/send failed/);
  const n=sent.length;
  await handle(m('What about last year?',2));
  assert.equal(sent.length,n);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
