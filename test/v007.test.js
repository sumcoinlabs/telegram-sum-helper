import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {parseCurrency,parseUsd,livePrice,liveTransaction,liveAddress} from '../src/live.js';
import {ui,preferredCurrency,supportedLanguageCodes} from '../src/locale-ui.js';
import {GUIDES,guideReply} from '../src/guides.js';
import {Knowledge} from '../src/knowledge.js';
import {offlineAnswer} from '../src/offline.js';
import {createHandler} from '../src/bot.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
const rows=[{code:'USD',price:'$1258.06',n:1258.06,name:'US Dollar'},
  {code:'EUR',price:'€1130.33',n:1130.33,name:'Euro'},
  {code:'BRL',price:'R$6888.11',n:6888.11,name:'Brazilian Real'},
  {code:'MXN',price:'$22999.50',n:22999.5,name:'Mexican Peso'}];
const response=json=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},text:async()=>JSON.stringify(json)});
test('v0.0.7 selects only exact published currency records and preserves USD compatibility',()=>{
 assert.equal(parseUsd(rows),1258.06);
 assert.equal(parseCurrency(rows,'BRL'),6888.11);
 assert.equal(parseCurrency({data:{rates:rows}},'EUR'),1130.33);
 assert.equal(parseCurrency(rows,'MXN'),22999.5);
 assert.equal(parseCurrency(rows,'CAD'),null);
 assert.equal(parseCurrency([{code:'EUR',n:1000},{code:'EUR',n:1100}],'EUR'),null);
 assert.equal(parseCurrency([{code:'EUR',price:'€1130.33'}],'EUR'),null);
 assert.equal(parseCurrency({BTC:500,marketCap:200},'USD'),null);
 assert.equal(parseCurrency(rows,'../../etc/passwd'),null);
});
test('v0.0.7 chooses a helpful currency by language or unambiguous regional locale',()=>{
 assert.equal(preferredCurrency('pt'), 'BRL');
 assert.equal(preferredCurrency('es'),'USD');
 assert.equal(preferredCurrency('pt','pt-PT'),'EUR');
 assert.equal(preferredCurrency('es','es-MX'),'MXN');
 assert.equal(preferredCurrency('fr','fr-CA'),'CAD');
 assert.equal(preferredCurrency('en','en-GB'),'GBP');
 assert.equal(preferredCurrency('ja'),'JPY');
 assert.equal(preferredCurrency('ar'),'USD');
});
test('v0.0.7 localized price shows live direct rate and only one plain-English trade clarification',async()=>{
 const fetchImpl=async(url,opts)=>{assert.equal(url,'https://rate.slicewallet.org/api/rates');assert.equal(opts.redirect,'error');return response(rows)};
 const pt=await livePrice({fetchImpl,lang:'pt',currency:'BRL'});
 assert.match(pt,/1 SUM ≈ 6\.888,11 BRL/);
 assert.match(pt,/negociações entre pessoas/);
 assert.doesNotMatch(pt,/guarantee|withdraw|bank|fiat|dólares|depósito/i);
 const es=await livePrice({fetchImpl,lang:'es',currency:'EUR'});
 assert.match(es,/1 SUM ≈ 1130,33 EUR|1 SUM ≈ 1\.130,33 EUR/);
 assert.match(es,/intercambios entre personas/);
 const usd=await livePrice({fetchImpl,lang:'en',currency:'USD'});
 assert.match(usd,/1 SUM ≈ 1,258\.06 USD/);
 assert.match(usd,/Source:/);
});
test('v0.0.7 auto currency uses quoted USD fallback only when enabled',async()=>{
 const justUsd=[rows[0]];const fetchImpl=async()=>response(justUsd);
 const auto=await livePrice({fetchImpl,lang:'pt',currency:'BRL',fallbackToUsd:true});
 assert.match(auto,/1 SUM ≈ 1\.258,06 USD/);
 assert.doesNotMatch(auto,/BRL/);
 const explicit=await livePrice({fetchImpl,lang:'pt',currency:'BRL',fallbackToUsd:false});
 assert.match(explicit,/não está disponível/i);
 assert.doesNotMatch(explicit,/1 SUM ≈/);
});
test('v0.0.7 prices and price-related interface copy are localized in 14 languages',async()=>{
 assert.equal(supportedLanguageCodes.length,14);
 for(const lang of supportedLanguageCodes){
  assert.ok(ui(lang,'rate').length>=14,lang);
  assert.ok(ui(lang,'trades').length>=10,lang);
  assert.ok(ui(lang,'usage').includes('/price'),lang);
  const text=await livePrice({fetchImpl:async()=>response(rows),lang,currency:'USD'});
  assert.ok(text.includes(ui(lang,'rate')),lang);
  assert.ok(text.includes(ui(lang,'source')),lang);
 }
});
test('v0.0.7 each of eight troubleshooting guides supports all 14 languages',()=>{
 assert.equal(Object.keys(GUIDES).length,8);
 for(const lang of supportedLanguageCodes)for(const id of Object.keys(GUIDES)){
  const g=guideReply(id,lang);
  assert.match(g,/1\./);
  assert.match(g,/2\./);
  assert.match(g,/https:\/\//);
  assert.ok(g.length>70,`${lang}/${id}`);
  if(!['en','es','pt'].includes(lang))assert.doesNotMatch(g,/Suggested steps/i);
 }
});
test('v0.0.7 14 languages have reviewed index and cashout explanations',()=>{
 const k=new Knowledge();
 for(const lang of supportedLanguageCodes)for(const id of ['index','cashout','wallet','staking','seed','pending','missing-balance','fees','legacy']){
  const txt=offlineAnswer({docs:[k.find(id)],knowledge:k,lang});
  assert.ok(txt.length>60,`${lang}/${id}`);
  if(!['en','es','pt'].includes(lang))assert.doesNotMatch(txt,/currently in English|verified detailed article below/i,`${lang}/${id}`);
 }
});
test('v0.0.7 index response concise by default, expands on /more, no warnings stuffed into unrelated topics',()=>{
 const k=new Knowledge(), docs=k.search('How does Sumcoin calculate its value?',{limit:12});
 const short=offlineAnswer({docs,knowledge:k,lang:'en'});
 const long=offlineAnswer({docs,knowledge:k,lang:'en',expanded:true});
 assert.ok(short.length<long.length);
 assert.match(short,/100 largest cryptocurrencies/i);
 assert.match(short,/peer-to-peer|directly/i);
 assert.doesNotMatch(short,/scam|unlock fee|recovery phrase|guaranteed withdrawal/i);
});
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v007-')),sent=[],calls=[];
 const client={sendMessage:async(m,text)=>{sent.push(text);return {message_id:sent.length}},getChatMember:async()=>({status:'member'})};
 const liveOps={price:async opts=>{calls.push(opts);return `RATE ${opts.currency} ${opts.lang}`},tx:async()=>'',address:async()=>''};
 const handler=createHandler({client,state:new State(path.join(dir,'state.json'),'observe'),config:{allowedChatUsername:'sumcoins',learningEnabled:false,autoAI:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learn.json')),ai:new ConversationAI(),liveOps});
 const msg=(n,text,user=1,locale='pt-BR')=>({message_id:n,date:Math.floor(Date.now()/1000),text,from:{id:user,language_code:locale},chat:{id:-123,type:'supergroup',username:'sumcoins'}});
 return {handler,msg,sent,calls,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v0.0.7 /price, /currency CODE, /currency auto isolated by member; explicit override temporary',async()=>{
 const f=fixture();try{
  await f.handler(f.msg(1,'/price',1,'pt-BR'));assert.match(f.sent.at(-1),/RATE BRL pt/);
  await f.handler(f.msg(2,'/currency MXN'));assert.match(f.sent.at(-1),/MXN/);
  await f.handler(f.msg(3,'/price'));assert.match(f.sent.at(-1),/RATE MXN pt/);
  await f.handler(f.msg(4,'/price EUR'));assert.match(f.sent.at(-1),/RATE EUR pt/);
  await f.handler(f.msg(5,'/price'));assert.match(f.sent.at(-1),/RATE MXN pt/);
  await f.handler(f.msg(6,'/price',2,'pt-BR'));assert.match(f.sent.at(-1),/RATE BRL pt/);
  await f.handler(f.msg(7,'/currency auto'));await f.handler(f.msg(8,'/price'));
  assert.match(f.sent.at(-1),/RATE BRL pt/);
 }finally{f.clean()}
});
test('v0.0.7 invalid currency rejected before live calls, even in observe mode',async()=>{
 const f=fixture();try{
  await f.handler(f.msg(1,'/price ../../bad'));
  await f.handler(f.msg(2,'/currency 1234'));
  assert.equal(f.calls.length,0);
  assert.ok(f.sent.some(s=>/três letras/.test(s)));
 }finally{f.clean()}
});
test('v0.0.7 explorer output localized in non-English languages and keeps input validation',async()=>{
 const txid='a'.repeat(64),address='1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
 const tx=await liveTransaction(txid,{lang:'fr',fetchImpl:async()=>response({txid,confirmations:2})});
 const addr=await liveAddress(address,{lang:'de',fetchImpl:async()=>response({addrStr:address,balance:12,txApperances:3})});
 assert.match(tx,/Confirmations: 2/);
 assert.match(addr,/Bestätigtes Guthaben: 12 SUM/);
 assert.match(addr,/Transaktionen: 3/);
 assert.match(await liveAddress('bad/secret',{lang:'zh',fetchImpl:async()=>{throw new Error('network must not run')}}),/用法/);
});
import {isCurrentPriceQuestion} from '../src/bot.js';
test('v0.0.7 current-price intent in major languages still distinguishes index methodology',()=>{
  const requests=[
   'What is the current Sumcoin price?',
   '¿Cuál es el precio actual de Sumcoin?',
   'Qual a cotação atual do Sumcoin?',
   'Quel est le prix actuel de Sumcoin?',
   'Wie ist der Preis von Sumcoin heute?',
   'Qual è il prezzo di Sumcoin oggi?',
   'Какая цена Sumcoin сегодня?',
   'ما سعر Sumcoin اليوم؟',
   'आज Sumcoin की कीमत क्या है?',
   'Sumcoin 现在的价格是多少？',
   '現在のSumcoin価格はいくらですか？',
   '지금 Sumcoin 가격은 얼마인가요?',
   'Sumcoin güncel fiyatı nedir?',
   'Berapa harga Sumcoin hari ini?'
  ];
  for(const q of requests)assert.equal(isCurrentPriceQuestion(q),true,q);
  for(const q of ['How does Sumcoin calculate its current value?', 'Como o índice Sumcoin é calculado hoje?', 'What is the Sumcoin index formula?'])
   assert.equal(isCurrentPriceQuestion(q),false,q);
});
import {TelegramClient} from '../src/telegram.js';
test('v0.0.7 Telegram menus localize /price, /currency, /guide for all 14 supported languages',async()=>{
 const calls=[];
 const client=new TelegramClient('123:test',{fetchImpl:async(_url,opts)=>{
   calls.push(JSON.parse(opts.body));
   return {ok:true,status:200,json:async()=>({ok:true,result:true})};
 }});
 for(const lang of supportedLanguageCodes){
   await client.setMyCommands(lang);
   const last=calls.at(-1);
   assert.equal(last.language_code,lang);
   assert.equal(last.commands.find(x=>x.command==='price').description,ui(lang,'rate').slice(0,130));
   assert.equal(last.commands.find(x=>x.command==='currency').description,ui(lang,'selected'));
 }
});
