import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {marketIntent,marketAnswer,MarketHistory} from '../src/market-insights.js';
import {detectLanguage,LANGUAGE_NAMES} from '../src/languages.js';
import {createHandler,isFriendlyCheckin} from '../src/bot.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {Knowledge} from '../src/knowledge.js';
import {ConversationAI} from '../src/ai.js';
import {VERSION} from '../src/version.js';

const response=data=>({ok:true,headers:{get:k=>k==='content-type'?'application/json':null},text:async()=>JSON.stringify(data)});
const base={success:true,symbol:'SUM',pair:'usd',range:'1d',count:2,
  period:{high:1230,low:1170,change_percent:-2.50,start_time:1793491200,end_time:1793577600},
  data:[{time:1793491200,open:1220,close:1205,high:1230,low:1200},
    {time:1793577600,open:1205,close:1190,high:1210,low:1170}]};
const full={...base,range:'all',period:{...base.period,high:1955.53},data:[{time:1759622400,high:1955.53},{time:1761868800,high:1205}]};
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v022-'));
 const sent=[];let mid=0,sendId=990,groqCalls=0;const urls=[];
 const state=new State(path.join(dir,'state.json'),'reply');
 const client={sendMessage:async(m,text)=>{const id=++sendId;sent.push({id,m,text});return {message_id:id};},
   getChatMember:async(_,id)=>({status:id===1?'creator':'member'})};
 const ai=new ConversationAI({apiKey:'TEST_SECRET',provider:'groq'});
 ai.answer=async()=>{groqCalls++;return {text:'AI result',usedAI:true};};
 const marketHistory=new MarketHistory({fetchImpl:async url=>{urls.push(url);return response(url.includes('range=all')?full:base);}});
 const handle=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:true,learningEnabled:false,
   aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),
   learning:new Learning(path.join(dir,'learning.json')),ai,marketHistory,
   liveOps:{price:async()=> 'Sumcoin peer-to-peer reference rate\n1 SUM ≈ 1,204.96 USD',tx:async()=>'',address:async()=>''}});
 const m=(text,id=3,lang='en')=>({message_id:++mid,chat:{id:-10013,username:'sumcoins',type:'supergroup'},
   date:Math.floor(Date.now()/1000),from:{id,language_code:lang},text});
 return {handle,state,sent,urls,m,get groqCalls(){return groqCalls;},cleanup(){fs.rmSync(dir,{recursive:true,force:true});}};
}

test('v022: today/performance and friendly check-in intent are distinct and do not hijack chatter',()=>{
 assert.equal(VERSION,'0.0.24');
 for(const q of ['hows sumcoin doing today','How’s Sumcoin doing today?','How is Sumcoin doing today?',
   'How is SUM performing today?','Is Sumcoin up or down today?','What is Sumcoin performance today?'])
   assert.deepEqual(marketIntent(q),{kind:'overview',range:'1d',pair:'usd'},q);
 for(const q of ['hows your day going','how’s your day going?','how is your day going','how are you?'])
   assert.equal(isFriendlyCheckin(q),true,q);
 for(const q of ['hows your day going','Sumcoin is doing amazing today!','sumcoin doing great today',
   'Hey everyone, how is your day going?', 'How is Bitcoin doing today?', 'how are prices set?'])
   assert.equal(marketIntent(q),null,q);
 for(const q of ['Hello Sumcoin folks','good morning', 'how are all of you doing?',
   'We were wondering how your day was going'])assert.equal(isFriendlyCheckin(q),false,q);
});

test('v022: exact real Telegram messages work in sequence for a group admin, with zero Groq calls',async()=>{
 const t=fixture();try{
   await t.handle(t.m('whats the price of sum',1));
   assert.match(t.sent.at(-1).text,/1,204\.96 USD/);
   await t.handle(t.m('what was the all time high',1));
   assert.match(t.sent.at(-1).text,/1,955\.53/);
   await t.handle(t.m('hows your day going',1));
   assert.match(t.sent.at(-1).text,/thanks for asking/i);
   await t.handle(t.m('hows sumcoin doing today',1));
   assert.match(t.sent.at(-1).text,/past 24 hours/i);
   assert.match(t.sent.at(-1).text,/fell 2\.50%/);
   assert.match(t.sent.at(-1).text,/1,170\.00/);
   assert.match(t.sent.at(-1).text,/1,230\.00/);
   assert.match(t.sent.at(-1).text,/sumcoinprice\.com\/history\//);
   assert.ok(t.urls.some(url=>url.includes('range=1d&pair=usd')));
   assert.equal(t.groqCalls,0);
   assert.equal(t.state.data.aiRequests[new Date().toISOString().slice(0,10)]||0,0);
 }finally{t.cleanup();}
});

test('v022: no greeting intrusion or cross-member borrowing; any member can ask a market question',async()=>{
 const t=fixture();try{
   await t.handle(t.m('hows your day going',3));
   assert.equal(t.sent.length,0,'no unsolicited reply without prior interaction');
   await t.handle(t.m('whats the price of sum',3));
   const before=t.sent.length;
   const someoneElse=t.m('hows your day going',3);
   someoneElse.reply_to_message={message_id:13,from:{id:88,is_bot:false}};
   await t.handle(someoneElse);
   assert.equal(t.sent.length,before,'a reply to another human must remain human chat');
   await t.handle(t.m('hows your day going',4));
   assert.equal(t.sent.length,before,'another member cannot borrow chat context');
   await t.handle(t.m('hows sumcoin doing today',4));
   assert.match(t.sent.at(-1).text,/fell 2\.50%/);
   const after=t.sent.length;
   await t.handle(t.m('Sumcoin is doing amazing today!',1));
   assert.equal(t.sent.length,after,'admin announcement remains quiet');
   await t.handle(t.m('Hey everybody, how is your day going?',3));
   assert.equal(t.sent.length,after,'normal group chat remains quiet');
 }finally{t.cleanup();}
});

test('v022: mentioning/replying to the bot allows a check-in without a previous interaction',async()=>{
 const t=fixture();try{
   await t.handle(t.m('@SumcoinHelperBot hows your day going',3));
   assert.match(t.sent.at(-1).text,/How about you/);
   const r=t.m('how are you',4);
   r.reply_to_message={message_id:t.sent.at(-1).id,from:{is_bot:true,username:'SumcoinHelperBot'}};
   await t.handle(r);
   assert.match(t.sent.at(-1).text,/How about you/);
 }finally{t.cleanup();}
});

test('v022: unavailable or invalid historical data cannot become invented performance',async()=>{
 const invalid={...base,period:{...base.period,change_percent:'I MADE THIS UP'}};
 const answer=await marketAnswer({kind:'overview',range:'1d',pair:'usd'},'en',{
   history:new MarketHistory({fetchImpl:async()=>response(invalid)})});
 assert.equal(answer.verified,false);
 assert.doesNotMatch(answer.text,/2\.50|1,230|MADE THIS UP/);
 assert.match(answer.text,/couldn.t verify/i);
});

test('v022: daily Sumcoin questions have localized routing and responses in all 14 supported languages',async()=>{
 const questions={
   en:'How is Sumcoin doing today?',
   es:'¿Cómo va Sumcoin hoy?',
   pt:'Como vai Sumcoin hoje?',
   fr:'Comment se porte Sumcoin aujourd’hui ?',
   de:'Wie läuft Sumcoin heute?',
   it:'Come sta andando Sumcoin oggi?',
   ru:'Как дела у Sumcoin сегодня?',
   ar:'كيف حال Sumcoin اليوم؟',
   hi:'आज Sumcoin कैसा चल रहा है?',
   zh:'Sumcoin 今天表现如何？',
   ja:'Sumcoin は今日どうですか',
   ko:'Sumcoin 오늘 어때요?',
   tr:'Sumcoin bugün nasıl?',
   id:'Bagaimana kinerja Sumcoin hari ini?'
 };
 assert.equal(Object.keys(questions).length,Object.keys(LANGUAGE_NAMES).length);
 const history=new MarketHistory({fetchImpl:async()=>response(base)});
 const en=(await marketAnswer({kind:'overview',pair:'usd'},'en',{history})).text;
 for(const [lang,q] of Object.entries(questions)){
   assert.equal(detectLanguage(q,'en'),lang,'language: '+lang);
   assert.equal(marketIntent(q)?.kind,'overview','intent: '+lang);
   const reply=await marketAnswer({kind:'overview',pair:'usd'},lang,{history});
   assert.equal(reply.verified,true,'verified: '+lang);
   assert.match(reply.text,/sumcoinprice\.com\/history\//);
   if(lang!=='en')assert.notEqual(reply.text,en,'translation: '+lang);
 }
});
