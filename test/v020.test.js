import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {marketIntent, marketAnswer, MarketHistory, historyUrl, MARKET_CHART} from '../src/market-insights.js';
import {detectLanguage,LANGUAGE_NAMES} from '../src/languages.js';
import {State} from '../src/state.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {VERSION} from '../src/version.js';

const historical={success:true,symbol:'SUM',pair:'usd',range:'all',count:3,period:{high:1450,low:111,change_percent:120,start_time:1522540800,end_time:1793400000},data:[
 {time:1522540800,high:150.5,low:100,close:120},
 {time:1704067200,high:1450.25,low:1300,close:1420},
 {time:1722470400,high:1190,low:1011,close:1120}
]};
const response=(d)=>({ok:true,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify(d)});

// These are language-routing smoke tests on user-style questions, not a claim
// that every idiom in every language is understood without AI.
const conversations=[
 ['en',"Where can I see Sumcoin's historical price chart?","What was the all-time high?"],
 ['es','¿Dónde puedo ver el gráfico histórico de Sumcoin?','¿Cuál fue su precio más alto?'],
 ['pt','Mostra o gráfico histórico de Sumcoin','E qual foi o maior valor?'],
 ['fr','Montre-moi un graphique historique de Sumcoin','Et son prix le plus élevé ?'],
 ['de','Wo finde ich den Sumcoin Preisverlauf?','Und was war das Allzeithoch?'],
 ['it','Dove posso vedere lo storico di Sumcoin?','E quale è stato il massimo storico?'],
 ['ru','Где посмотреть историю цены Sumcoin?','А какой был исторический максимум?'],
 ['ar','أين أرى تاريخ سعر Sumcoin؟','وما أعلى سعر؟'],
 ['hi','Sumcoin की कीमत का इतिहास कहाँ देखें?','सबसे ऊँचा भाव क्या था?'],
 ['zh','在哪里查看 Sumcoin 的历史价格？','历史最高价是多少？'],
 ['ja','Sumcoin の価格履歴はどこで見られますか？','史上最高値はいくらでしたか？'],
 ['ko','Sumcoin의 가격 기록을 어디서 볼 수 있나요?','역대 최고가는 얼마였나요?'],
 ['tr','Sumcoin fiyat geçmişini nerede görebilirim?','Peki en yüksek fiyat neydi?'],
 ['id','Di mana saya bisa melihat riwayat harga Sumcoin?','Berapa harga tertingginya?']
];

test('v020: public full-history API is parsed, independently validated, cached and never invents ATH',async()=>{
 assert.equal(VERSION,'0.0.24');
 assert.equal(historyUrl('all','usd'),'https://sumcoinprice.com/api/history.php?range=all&pair=usd');
 assert.throws(()=>historyUrl('all','evil'));
 let calls=0;
 const history=new MarketHistory({fetchImpl:async(url,init)=>{calls++;assert.equal(url,historyUrl('all','usd'));assert.equal(init.redirect,'error');return response(historical);}});
 const a=await marketAnswer({kind:'ath',pair:'usd'},'en',{history});
 assert.equal(a.verified,true);assert.match(a.text,/1,450\.25/);assert.match(a.text,/2024-01-01/);assert.match(a.text,/index value/);
 const b=await marketAnswer({kind:'ath',pair:'usd'},'fr',{history});
 assert.equal(b.verified,true);assert.match(b.text,/1[\s\u202f]450,25/);assert.equal(calls,1);
 const brokenHistory=new MarketHistory({fetchImpl:async()=>response({...historical,data:[{time:1704067200,high:'a made up number'}]})});
 const broken=await marketAnswer({kind:'ath',pair:'usd'},'en',{history:brokenHistory});
 assert.equal(broken.verified,false);assert.doesNotMatch(broken.text,/1,450/);assert.match(broken.text,/couldn.t verify/);
 const missing=new MarketHistory({fetchImpl:async()=>{throw Error('network down');}});
 assert.equal((await marketAnswer({kind:'ath',pair:'usd'},'fr',{history:missing})).verified,false);
});

test('v020: 14 supported languages have a real natural market conversation and localized answer',async()=>{
 assert.equal(conversations.length,Object.keys(LANGUAGE_NAMES).length);
 const h=new MarketHistory({fetchImpl:async()=>response(historical)});
 for(const [lang,chart,follow] of conversations){
   assert.equal(detectLanguage(chart,'en'),lang,'first message language: '+lang);
   assert.equal(marketIntent(chart)?.kind,'chart','chart intent: '+lang);
   assert.equal(marketIntent(follow,{active:true})?.kind,'ath','follow-up ATH intent: '+lang);
   assert.equal(marketIntent(follow,{active:false})?.kind||null,lang==='en'?'ath':null,'standalone English ATH is clear; other follow-ups need context: '+lang);
   const output=await marketAnswer({kind:'ath',pair:'usd'},lang,{history:h});
   assert.equal(output.verified,true);
   assert.match(output.text,/2024-01-01/);
   assert.match(output.text,/sumcoinprice\.com\/history\//);
   if(lang!=='en')assert.notEqual(output.text,(await marketAnswer({kind:'ath',pair:'usd'},'en',{history:h})).text,'translation missing: '+lang);
 }
});

test('v020: conversational Telegram route, group/admin separation, sourced ATH, no API cost or distracting slash commands',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v020-'));
 try{
  const sent=[];let seq=300,groqCalls=0,apiCalls=0;
  const state=new State(path.join(dir,'state.json'),'reply');
  const client={sendMessage:async(m,text)=>{const id=++seq;sent.push({m,text,id});return {message_id:id};},getChatMember:async(_c,id)=>({status:id===1?'creator':'member'})};
  const ai=new ConversationAI({apiKey:'TEST_ONLY',provider:'groq'});ai.answer=async()=>{groqCalls++;return {text:'AI answer',usedAI:true};};
  const history=new MarketHistory({fetchImpl:async()=>{apiCalls++;return response(historical);}});
  const handle=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:true,learningEnabled:false,aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),ai,marketHistory:history,liveOps:{price:async()=>'',tx:async()=>'',address:async()=>''}});
  let inId=0;const m=(text,uid=3,language_code='en')=>({message_id:++inId,chat:{id:-10013,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:uid,language_code},text});
  await handle(m("Where can I see Sumcoin's historical price chart?"));
  assert.match(sent.at(-1).text,/sumcoinprice\.com\/history\//);assert.doesNotMatch(sent.at(-1).text,/history\.php|guaranteed selling price|\/chart/);
  const n=sent.length;
  await handle(m('What about last year?',4));assert.equal(sent.length,n,'another user must not steal context');
  await handle(m('what was the all time high?'));assert.match(sent.at(-1).text,/1,450\.25/);assert.match(sent.at(-1).text,/2024-01-01/);assert.equal(apiCalls,1);
  await handle(m('What about last year?')); // period uses same fixed API but mock must return matching period
  assert.match(sent.at(-1).text,/couldn.t verify|recorded SUM/); // safe fallback if schema differs
  await handle(m('Was that higher than Bitcoin?'));assert.match(sent.at(-1).text,/relative to Bitcoin/);
  await handle(m('Montre-moi un graphique historique de Sumcoin',5));assert.match(sent.at(-1).text,/Tu peux/);
  await handle(m('Et son prix le plus élevé ?',5));assert.match(sent.at(-1).text,/plus haut/);assert.doesNotMatch(sent.at(-1).text,/Sumcoin.s highest/);
  assert.equal(groqCalls,0);assert.equal(state.data.aiRequests[new Date().toISOString().slice(0,10)]||0,0);
  const userReply=m('What was the all-time high?',6);userReply.reply_to_message={message_id:sent[n-1].id,from:{is_bot:true,username:'SumcoinHelperBot'}};
  await handle(userReply);assert.match(sent.at(-1).text,/1,450\.25/);
  await handle(m('Can you show me the SUM price chart?',1));assert.match(sent.at(-1).text,/history\//);
  const before=sent.length;await handle(m('Sumcoin price chart looks great',1));assert.equal(sent.length,before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('v020: verified 12-month performance includes measured change and high/low; no market-data leakage into AI quota',async()=>{
 let url;
 const year={...historical,range:'1y',period:{high:850,low:600,change_percent:-17.25,start_time:1730000000,end_time:1790000000}};
 const h=new MarketHistory({fetchImpl:async(u)=>{url=u;return response(year);}});
 const a=await marketAnswer({kind:'performance',range:'1y',pair:'usd'},'en',{history:h});
 assert.equal(a.verified,true);assert.match(url,/range=1y&pair=usd/);
 assert.match(a.text,/12 months/);assert.match(a.text,/-17\.25%/);assert.match(a.text,/850\.00/);assert.match(a.text,/600\.00/);
 assert.doesNotMatch(a.text,/history\.php|guaranteed selling price/);
});
