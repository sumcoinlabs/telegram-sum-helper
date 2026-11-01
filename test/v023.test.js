import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {marketIntent,marketFollowupCandidate,MarketHistory} from '../src/market-insights.js';
import {cleanModelAnswer,ConversationAI} from '../src/ai.js';
import {State} from '../src/state.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {createHandler} from '../src/bot.js';
import {VERSION} from '../src/version.js';
const response=(range='1d')=>({ok:true,headers:{get:k=>k==='content-type'?'application/json':null},text:async()=>JSON.stringify({
  success:true,pair:'usd',range,count:2,period:{high:1230,low:1170,change_percent:2.50,start_time:1793491200,end_time:1793577600},
  data:[{time:1793491200,high:1220},{time:1793577600,high:1230}]
})});
function fixture(autoAI=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v023-')),sent=[],urls=[];
 let seq=300,mid=0,modelCalls=0;
 const state=new State(path.join(dir,'state.json'),'reply');
 const ai=new ConversationAI({apiKey:'TEST_ONLY',provider:'groq'});
 ai.interpretMarketIntent=async()=>{modelCalls++;return {kind:'performance',range:'1w',pair:'usd'};};
 const client={sendMessage:async(m,t)=>{const message_id=++seq;sent.push({text:t,message_id});return {message_id};},getChatMember:async(_chat,id)=>({status:id===1?'creator':'member'})};
 const marketHistory=new MarketHistory({fetchImpl:async url=>{urls.push(url);return response(new URL(url).searchParams.get('range'))}});
 const bot=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI,learningEnabled:false,aiHourlyLimit:4,aiDailyLimit:12,aiMonthlyLimit:60},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),ai,marketHistory,
  liveOps:{price:async()=> 'Sumcoin peer-to-peer reference rate\n1 SUM ≈ 1,207.77 USD',tx:async()=>'',address:async()=>''}});
 const msg=(text,user=1)=>({message_id:++mid,chat:{id:-1001,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:user,language_code:'en'},text});
 return {bot,sent,urls,state,ai,msg,get modelCalls(){return modelCalls;},cleanup(){fs.rmSync(dir,{recursive:true,force:true})}};
}
test('v023 release and deterministic natural 24-hour aliases',()=>{
 assert.equal(VERSION,'0.0.23');
 for(const q of ['whats the change over the last day','what was the change over the past day','what changed over the previous day'])
   assert.deepEqual(marketIntent(q,{active:true}),{kind:'performance',range:'1d',pair:'usd'},q);
 assert.equal(marketIntent('whats the change over the last day'),null,'unrelated members have no market context');
});
test('v023 real member flow: live quote then last-day change with no Groq',async()=>{
 const t=fixture();try{
   await t.bot(t.msg('whats the price of sumcoin',1));
   assert.match(t.sent.at(-1).text,/1,207\.77/);
   await t.bot(t.msg('whats the change over the last day',1));
   assert.match(t.sent.at(-1).text,/2\.50%/);
   assert.ok(t.urls.some(url=>url.includes('range=1d&pair=usd')));
   assert.equal(t.modelCalls,0);
   assert.equal(t.state.data.aiRequests[new Date().toISOString().slice(0,10)]||0,0);
 }finally{t.cleanup()}
});
test('v023 this-week follow-up uses validated trailing week without Groq',async()=>{
 const t=fixture();try{
   await t.bot(t.msg('whats the price of sumcoin',1));
   await t.bot(t.msg('what about this week',1));
   assert.match(t.sent.at(-1).text,/2\.50%/);
   assert.ok(t.urls.some(url=>url.includes('range=1w')));
   assert.equal(t.modelCalls,0);
 }finally{t.cleanup()}
});
test('v023 unrelated member cannot steal follow-up context; unrelated chat is quiet',async()=>{
 const t=fixture();try{
   await t.bot(t.msg('whats the price of sumcoin',1));const before=t.sent.length;
   await t.bot(t.msg('whats the change over the last day',2));
   await t.bot(t.msg('Hello everybody how are you?',3));
   assert.equal(t.sent.length,before);
   assert.equal(t.modelCalls,0);
 }finally{t.cleanup()}
});
test('v023 optional Groq only classifies unclear market intent; live API still provides figures',async()=>{
 const t=fixture();try{
   assert.equal(marketFollowupCandidate('what was the momentum over the previous seven days',{active:true}),true);
   await t.bot(t.msg('whats the price of sumcoin',1));
   await t.bot(t.msg('what was the momentum over the previous seven days',1));
   assert.match(t.sent.at(-1).text,/2\.50%/);
   assert.ok(t.urls.some(x=>x.includes('range=1w')));
   assert.equal(t.modelCalls,1);
   assert.equal(t.state.data.aiRequests[new Date().toISOString().slice(0,10)],1);
 }finally{t.cleanup()}
});
test('v023 uncertain or disabled Groq produces safe clarification without inventing numbers',async()=>{
 const t=fixture(false);try{
   await t.bot(t.msg('whats the price of sumcoin',1));
   await t.bot(t.msg('what was the momentum over the previous seven days',1));
   assert.match(t.sent.at(-1).text,/Which period/);
   assert.equal(t.modelCalls,0);
 }finally{t.cleanup()}
});
test('v023 admin diagnostics and routing reason are text-free and explicit',async()=>{
 const t=fixture();try{
   const input=t.msg('ordinary unrelated message',1);await t.bot(input);
   const why=t.msg('/why',1);why.reply_to_message={message_id:input.message_id,from:{id:1,is_bot:false}};
   await t.bot(why);assert.match(t.sent.at(-1).text,/Ignored/);
   await t.bot(t.msg('/diagnostics',1));assert.match(t.sent.at(-1).text,/Automatic Groq explanations \+ market intent: true/);
   assert.doesNotMatch(t.sent.at(-1).text,/ordinary unrelated message/);
 }finally{t.cleanup()}
});
test('v023 Groq answer cleanup strips markdown emphasis and fake numbered Sources',()=>{
 const result=cleanModelAnswer('The rate is a **reference valuation**.\n\nSources: 1, 3.');
 assert.equal(result,'The rate is a reference valuation.');
});
test('v023 model classifier enforces allowlisted structured output and does not use Groq as a quote source',async()=>{
 const calls=[];
 const ai=new ConversationAI({apiKey:'FAKE',provider:'groq',fetchImpl:async(url,opts)=>{
   calls.push({url,opts});return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'{"kind":"performance","range":"1d","value":9999999}'}]}]})};
 }});
 assert.deepEqual(await ai.interpretMarketIntent('what changed over yesterday',{active:true}),{kind:'performance',range:'1d',pair:'usd'});
 assert.equal(calls[0].url,'https://api.groq.com/openai/v1/responses');
 assert.ok(!('store' in JSON.parse(calls[0].opts.body)));
});
