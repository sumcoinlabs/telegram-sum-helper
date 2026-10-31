import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {priceIntent,requestedCurrency,consensusIntent,consensusReply} from '../src/intent.js';
import {importSocial} from '../src/social.js';
import {Knowledge} from '../src/knowledge.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {Escalations} from '../src/escalations.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {livePrice} from '../src/live.js';
function setup(){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'sum009-'));
 const sent=[],direct=[],prices=[],roles=new Set([1,999]);
 const state=new State(path.join(d,'state.json'),'reply');
 const learning=new Learning(path.join(d,'learning.json'));
 const escalations=new Escalations(path.join(d,'review.json'));
 const client={sendMessage:async(m,t)=>{sent.push({m,t});return {message_id:100+sent.length}},sendDirect:async(id,t)=>{direct.push({id,t});},getChatMember:async(chat,id)=>({status:roles.has(id)?'administrator':'member'})};
 const handler=createHandler({client,state,config:{allowedChatUsername:'sumcoins',learningEnabled:false,allowPrivateChats:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning,ai:new ConversationAI(),escalations,liveOps:{price:async opts=>{prices.push(opts);return `LIVE ${opts.currency||'USD'} ${opts.amount||1}`},tx:async()=>'',address:async()=>''}});
 let id=0;const msg=(text,user=21,lang='en')=>({message_id:++id,chat:{id:-1000123,type:'supergroup',username:'sumcoins'},date:Math.floor(Date.now()/1000),from:{id:user,username:user===999?'SumcoinAdmin':'tester',language_code:lang},text});
 return {d,sent,direct,prices,roles,handler,msg,escalations,close:()=>fs.rmSync(d,{recursive:true,force:true})};
}
test('v009 currency aliases are specific, including yen, Canadian dollars and Mexican pesos',()=>{
 for(const [input,code] of [['What is the current Sumcoin price in yen?','JPY'],['Sumcoin price in Canadian dollars','CAD'],['Sumcoin price in Mexican pesos','MXN'],['Sumcoin price in euros?','EUR'],['Sumcoin price in BRL?','BRL'],['SUM price in Japanese yen?','JPY'],['Sumcoin value in Thai baht?','THB'],['Sumcoin price in SGD?','SGD'],['Sumcoin price in Philippine pesos?','PHP']]){
  assert.equal(priceIntent(input)?.currency,code,input);
 }
 assert.equal(requestedCurrency('Canadian dollars'),'CAD');
 assert.equal(requestedCurrency('pesos'),null,'unqualified pesos must not pretend to be MXN');
});
test('v009 natural language price multipliers and questions do not override explanation questions',()=>{
 assert.equal(priceIntent('How much is 5 SUM in Japanese yen?')?.amount,5);
 assert.equal(priceIntent('What is Sumcoin price in yen?')?.amount,1);
 assert.equal(priceIntent('How is the Sumcoin index price calculated?'),null);
 assert.equal(priceIntent('How many dollars will migration cost?'),null);
 assert.equal(priceIntent('The Sumcoin price is high today'),null);
 assert.equal(priceIntent('Do you like the Sumcoin logo?'),null);
});
test('v009 consensus distinguishes present PoS from historical PoW without migrating users',()=>{
 for(const question of ['Is Sumcoin proof of work?','Is Sumcoin PoW?','Does Sumcoin use proof of stake?','What consensus does Sumcoin use?','Is mining Sumcoin still possible?'])assert.equal(consensusIntent(question),true,question);
 for(const question of ['How do I migrate old proof of work Sumcoin?','What is the migration fee for old PoW SUM?','Can I restore a Slice proof of work wallet?'])assert.equal(consensusIntent(question),false,question);
 assert.match(consensusReply('en'),/originally used proof-of-work.*current.*proof-of-stake/is);
 assert.match(consensusReply('ja'),/PoW.*PoS/s);
});
test('v009 real group routing: member question in yen returns JPY without command',async()=>{
 const x=setup();try{await x.handler(x.msg('What is the current Sumcoin price in yen?'));assert.equal(x.prices.length,1);assert.equal(x.prices[0].currency,'JPY');assert.match(x.sent[0].t,/LIVE JPY 1/);assert.equal(x.escalations.pending().length,0);}finally{x.close();}
});
test('v009 real group routing: amount in yen is passed through without fabricated conversion',async()=>{
 const x=setup();try{await x.handler(x.msg('How much is 5 SUM in Japanese yen?'));assert.deepEqual([x.prices[0].currency,x.prices[0].amount],['JPY',5]);}finally{x.close();}
});
test('v009 commandless price request without question mark works but casual chat stays silent',async()=>{
 const x=setup();try{await x.handler(x.msg('Sumcoin price in yen',21));assert.equal(x.prices.length,1);await x.handler(x.msg('Sumcoin price is high',22));assert.equal(x.prices.length,1);}finally{x.close();}
});
test('v009 real group routing: proof of work answers automatically without admin escalation',async()=>{
 const x=setup();try{await x.handler(x.msg('Is Sumcoin proof of work?'));assert.equal(x.sent.length,1);assert.match(x.sent[0].t,/originally used proof-of-work.*current.*proof-of-stake/is);assert.equal(x.escalations.pending().length,0);}finally{x.close();}
});
test('v009 group admin announcements are ignored but admin can ask explicitly',async()=>{
 const x=setup();try{await x.handler(x.msg('Is Sumcoin proof of work?',1));assert.equal(x.sent.length,0);await x.handler(x.msg('/ask@SumcoinHelperBot Is Sumcoin proof of work?',1));assert.equal(x.sent.length,1);assert.match(x.sent[0].t,/proof-of-stake/);}finally{x.close();}
});
test('v009 two different natural-language prices within a few seconds do not get silently lost',async()=>{
 const x=setup();try{await x.handler(x.msg('What is Sumcoin price in yen?',21));await x.handler(x.msg('What is Sumcoin price in euros?',22));assert.equal(x.prices.length,2);assert.deepEqual(x.prices.map(p=>p.currency),['JPY','EUR']);}finally{x.close();}
});
test('v009 explicit /ask is not suppressed for two immediate distinct questions',async()=>{
 const x=setup();try{await x.handler(x.msg('/ask@SumcoinHelperBot Is Sumcoin proof of work?',1));await x.handler(x.msg('/ask@SumcoinHelperBot Does Sumcoin use proof of stake?',1));assert.equal(x.sent.length,2);}finally{x.close();}
});
test('v009 rate API uses requested JPY record, not an FX estimate',async()=>{
 const fetchImpl=async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify([{code:'USD',n:1234.25},{code:'JPY',n:189123.5}])});
 const reply=await livePrice({currency:'JPY',amount:5,fetchImpl});assert.match(reply,/5 SUM ≈ 945,617\.50 JPY/);assert.doesNotMatch(reply,/USD/);
});
test('v009 podcast chaptered transcript is packaged as unreviewed and never becomes curated answers',()=>{
 const k=new Knowledge();const p=k.documents().filter(x=>x.kind==='podcast');assert.equal(p.length,8);assert.equal(p.filter(x=>x.reviewed!==false).length,0);assert.ok(k.curated.length>=57);
 assert.match(p[2].body,/proof of work/i);
});
test('v009 social import accepts user-supplied official X archive data but not unrelated $SUM',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'social009-'));try{
 const posts=[{tweet:{id_str:'2012345678901234567',full_text:'A project news post about #Sumcoin and the blockchain.',created_at:'Sat Oct 31 11:00:00 +0000 2026'}},{tweet:{id_str:'2012345678901234568',full_text:'Totally unrelated $SUM stock ticker in another company'}},{tweet:{id_str:'2012345678901234569',full_text:'Another Sumcoin announcement and notes'}}];
 const out=path.join(d,'social.json');const count=importSocial('window.YTD.tweets.part0 = '+JSON.stringify(posts)+';', {out,account:'sumcoinindex'});
 assert.equal(count.imported,2);assert.equal(count.skipped,1);
 const k=new Knowledge({socialFile:out});const docs=k.documents().filter(x=>x.kind==='social');assert.equal(docs.length,2);assert.ok(docs.every(x=>x.reviewed===false&&x.source.startsWith('https://x.com/sumcoinindex/status/')));
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('v009 social importer rejects made-up social domains and unrelated anonymous mentions',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'social009b-'));try{
 const posts={posts:[{author:'random',text:'#Sumcoin buy now!',url:'https://evil.example/status/2012345678901234567'}, {author:'random',text:'$SUM market hype only',url:'https://x.com/random/status/2012345678901234567'}]};
 const r=importSocial(JSON.stringify(posts),{out:path.join(d,'social.json')});assert.equal(r.imported,0);
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('v009 unknown hardware wallet capabilities still escalate rather than hallucinate',async()=>{
 const x=setup();try{await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?'));assert.equal(x.escalations.pending().length,1);}finally{x.close();}
});
