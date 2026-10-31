import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {parseUsd,livePrice,liveTransaction,liveAddress} from '../src/live.js';
import {GUIDES,guideReply} from '../src/guides.js';
import {Knowledge} from '../src/knowledge.js';
import {createHandler} from '../src/bot.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import {SOURCES} from '../src/sync.js';
const k=new Knowledge();
function response(json){return {ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},text:async()=>JSON.stringify(json)};}
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v005-'));const sent=[];const calls=[];
 const client={sendMessage:async(m,txt)=>{sent.push({m,txt});return{message_id:sent.length}},getChatMember:async()=>({status:'administrator'})};
 const liveOps={price:async opts=>{calls.push(['price',opts]);return 'LIVE PRICE MOCK';},tx:async(id,opts)=>{calls.push(['tx',id,opts]);return 'LIVE TX MOCK';},address:async(id,opts)=>{calls.push(['address',id,opts]);return 'LIVE ADDR MOCK';}};
 const handler=createHandler({client,state:new State(path.join(dir,'state.json'),'observe'),config:{allowedChatUsername:'sumcoins',learningEnabled:false,autoAI:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:k,learning:new Learning(path.join(dir,'learning.json')),ai:new ConversationAI(),liveOps});
 const msg=(text,id=1)=>({message_id:id,chat:{id:-1001,type:'supergroup',username:'sumcoins'},date:Math.floor(Date.now()/1000),from:{id:123,language_code:'en'},text});
 return {handler,msg,sent,calls,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v0.0.5 retains original core index answer and expands with reviewed context',()=>{
 const docs=k.search('How does Sumcoin calculate its value?',{limit:12});assert.equal(docs[0].id,'index');
 assert.ok(k.curated.length>=40);
 assert.ok(k.find('sumcoinlib'));
});
test('v0.0.5 source expansion is fixed and excludes the unreviewed PHP-injected FAQ',()=>{
 assert.ok(SOURCES.length>=17);assert.ok(SOURCES.some(x=>x[0].endsWith('sumcoinlib/master/MIGRATION.md')));
 assert.ok(!SOURCES.some(x=>x[0].includes('page/faq')));
});
test('wallet, staking and migration guides offer clear source-backed steps without seed requests',()=>{
 assert.ok(Object.keys(GUIDES).length>=8);
 for(const lang of ['en','es','pt']){
  const s=guideReply('restore',lang);assert.match(s,/https:\/\//);assert.match(s,/1\./);assert.match(s,/2\./);
  assert.ok(s.length>220);
 }
});
test('v0.0.5 commands work in observe mode and live operations are mockable',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('/guide restore',1));await x.handler(x.msg('/price',2));
  await x.handler(x.msg('/tx '+'a'.repeat(64),3));
  await x.handler(x.msg('/address 1BoatSLRHtKNngkdXEeobR76b53LETtpyT',4));
  assert.equal(x.sent.length,4);assert.equal(x.calls.length,3);
  assert.match(x.sent[0].txt,/restore/);
  assert.equal(x.sent[1].txt,'LIVE PRICE MOCK');
  assert.equal(x.sent[2].txt,'LIVE TX MOCK');
  assert.equal(x.sent[3].txt,'LIVE ADDR MOCK');
 }finally{x.close()}
});
test('v0.0.5 rejects malformed IDs and wallet secrets before network calls',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('/tx garbage',1));await x.handler(x.msg('/address private key',2));
  assert.equal(x.calls.length,2); // passed to validator, not actual network
  assert.match(x.sent[0].txt,/MOCK/);
  // Real validators will reject before making any request.
  let calls=0;const fetchImpl=async()=>{calls++;throw Error('should never call');};
  const tx=await liveTransaction('../abc',{fetchImpl});assert.match(tx,/Usage/);
  const addr=await liveAddress('../../etc/passwd',{fetchImpl});assert.match(addr,/Usage/);
  assert.equal(calls,0);
 }finally{x.close()}
});
test('live price recognizes only explicitly labeled USD and never other arbitrary metrics',async()=>{
 assert.equal(parseUsd({rates:{EUR:1200,USD:'1234.50'}}),1234.5);
 assert.equal(parseUsd({BTC:0.01,marketCap:500000000}),null);
 assert.equal(parseUsd({rates:{USD:'NaN'}}),null);
 const text=await livePrice({fetchImpl:async url=>{assert.equal(url,'https://rate.slicewallet.org/api/rates');return response({rates:{USD:1402.75}})}});
 assert.match(text,/1,402\.75/);assert.match(text,/not a guaranteed sale/);
});
test('live price returns unavailable instead of inventing numbers if API changes',async()=>{
 const text=await livePrice({fetchImpl:async()=>response({marketcap:500000000,random:999})});
 assert.match(text,/unavailable/);assert.doesNotMatch(text,/500000000|\$999/);
});
test('live lookups disable redirects and request only fixed allowlisted URLs',async()=>{
 const txid='f'.repeat(64);let hits=[];
 const fetchImpl=async(url,opts)=>{hits.push(url);assert.equal(opts.redirect,'error');
 if(url.includes('/tx/'))return response({txid,confirmations:4,blockheight:1000});
 return response({addrStr:'1BoatSLRHtKNngkdXEeobR76b53LETtpyT',balance:0.234,unconfirmedBalance:0,txApperances:5});};
 const tx=await liveTransaction(txid,{fetchImpl});assert.match(tx,/Confirmations: 4/);
 const addr=await liveAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyT',{fetchImpl});assert.match(addr,/Confirmed balance: 0.234 SUM/);
 assert.ok(hits.every(u=>u.startsWith('https://sumcoin.space/api/')));
});
test('live lookups reject mismatched or unrecognized JSON and do not display fabricated fields',async()=>{
 const tx=await liveTransaction('a'.repeat(64),{fetchImpl:async()=>response({txid:'b'.repeat(64),confirmations:999})});
 assert.match(tx,/unavailable/);assert.doesNotMatch(tx,/Confirmations: 999/);
 const addr=await liveAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyT',{fetchImpl:async()=>response({balance: 'invalid'})});
 assert.match(addr,/unavailable/);
});
test('live lookups reject oversized responses and HTML',async()=>{
 const text=await livePrice({fetchImpl:async()=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'text/html':null},text:async()=>'<html>something</html>'})});
 assert.match(text,/unavailable/);
});
test('Spanish and Portuguese /guide output is localized',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('/guide restore',1));
  assert.match(guideReply('pending','es'),/Transacción|transacción/);
  assert.match(guideReply('pending','pt'),/Transação|transação/);
 }finally{x.close()}
});
test('natural-language current price routes to live read-only API, not canned index explanation',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('/ask@SumcoinHelperBot What is the current Sumcoin price?',1));
  assert.equal(x.calls.length,1);assert.equal(x.calls[0][0],'price');assert.equal(x.sent[0].txt,'LIVE PRICE MOCK');
 }finally{x.close()}
});
test('formula explanation does not make a live price call',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('/ask@SumcoinHelperBot How does Sumcoin calculate its value?',1));
  assert.equal(x.calls.length,0);assert.match(x.sent[0].txt,/top 100 cryptocurrencies/);
 }finally{x.close()}
});
test('all three languages have translated new wallet and explorer topics',async()=>{
 const {offlineAnswer}=await import('../src/offline.js');
 const docs=[...k.search('Why does my wallet lose connection?',{limit:12})];
 const topic=k.find('wallet-connect');
 for(const lang of ['en','es','pt']){
  const txt=offlineAnswer({docs:[{...topic,kind:'curated',body:topic.text}],knowledge:k,lang});
  assert.ok(txt.length>150);assert.ok(txt.includes('https://sumcoinwallet.org/'));
 }
});
