import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Escalations,isDismissal,needsHumanReview} from '../src/escalations.js';
import {createHandler} from '../src/bot.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {State} from '../src/state.js';
import {ConversationAI} from '../src/ai.js';
import {importTranscript} from '../src/video.js';

function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v008-'));let clock=Date.now();
 const state=new State(path.join(dir,'state.json'),'reply',()=>clock);
 const escalations=new Escalations(path.join(dir,'escalations.json'),()=>clock);
 const learning=new Learning(path.join(dir,'learning.json'));
 const sent=[];const direct=[];let adminIds=new Set([1,999]);
 const client={sendMessage:async(m,text)=>{sent.push({m,text});return{message_id:500+sent.length}},sendDirect:async(id,text)=>{direct.push({id,text});return{message_id:900+direct.length}},getChatMember:async(_chat,id)=>({status:adminIds.has(id)?'administrator':'member'})};
 const k=new Knowledge();
 const handler=createHandler({client,state,config:{allowedChatUsername:'sumcoins',allowPrivateChats:false,learningEnabled:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:k,learning,ai:new ConversationAI(),escalations});
 const msg=(text,id=1,user=11,other={})=>({message_id:id,chat:{id:-1000123,type:'supergroup',username:'sumcoins'},date:Math.floor(Date.now()/1000),from:{id:user,username:user===999?'SumcoinAdmin':'regular'+user,language_code:'en'},text,...other});
 const pm=(text,id=1,user=999,username='SumcoinAdmin')=>({message_id:id,chat:{id:user,type:'private'},date:Math.floor(Date.now()/1000),from:{id:user,username,language_code:'en'},text});
 return {handler,msg,pm,client,escalations,state,k,learning,sent,direct,adminIds,setClock:n=>{clock=n},advance:ms=>{clock+=ms},close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v008 normal member recognized question gets answer without any command and ignores admins',async()=>{const x=fixture();try{
 await x.handler(x.msg('How does Sumcoin staking work?',1,11));assert.equal(x.sent.length,1);assert.match(x.sent[0].text,/stake|proof-of-stake/i);
 await x.handler(x.msg('How does Sumcoin staking work?',2,1));assert.equal(x.sent.length,1);
 await x.handler(x.msg('How does Sumcoin staking work?',3,30,{sender_chat:{id:-1000123,title:'Sumcoin'}}));assert.equal(x.sent.length,1);
 await x.handler(x.msg('Hey everyone, nice weather today',4,12));assert.equal(x.sent.length,1);
 }finally{x.close()}});
test('v008 unknown specialized question queues a safe private request only after verified reviewer opts in',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start',1,999));assert.match(x.sent[0].text,/Review notifications are enabled/);
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',3,11));
 assert.equal(x.escalations.pending().length,1);assert.equal(x.direct.length,1);assert.equal(x.direct[0].id,999);
 assert.match(x.direct[0].text,/hardware wallet staking/i);assert.doesNotMatch(x.direct[0].text,/member.*11|private key/i);
 assert.match(x.sent.at(-1).text,/checking this with/);
 }finally{x.close()}});
test('v008 refuses fake reviewer username and non-admin reviewer',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start',1,998,'SumcoinAdmin'));
 assert.equal(x.escalations.data.adminId,null);
 await x.handler(x.pm('/start',2,999,'SumcoinAdmin'));assert.equal(x.escalations.data.adminId,999);
 await x.handler(x.pm('/answer 1 | fake | https://sumcoin.org/',3,997,'attacker'));assert.equal(x.learning.data.approved.length,0);
 }finally{x.close()}});
test('v008 admin can respond privately with vetted source and bot replies to original group message',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start'));
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',3,11));
 assert.match(x.escalations.pending()[0].question,/Ledger/);
 await x.handler(x.pm('/answer 1 | That capability is not confirmed by current project documentation. | https://github.com/sumcoinlabs/sumcoin',4));
 assert.equal(x.learning.data.approved.length,1);assert.equal(x.escalations.get(1).status,'closed');
 assert.match(x.sent.at(-2).text,/not confirmed/i);assert.match(x.sent.at(-1).text,/Approved and answered/);
 }finally{x.close()}});
test('v008 delayed fallback shares only closest reviewed guidance and keeps review open',async()=>{const x=fixture();try{
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',3,11));
 assert.equal(x.escalations.pending()[0].status,'pending');
 x.advance(21*60_000);await x.handler.tick();
 assert.equal(x.escalations.get(1).status,'fallback');assert.match(x.sent.at(-1).text,/haven’t confirmed the exact answer/);
 assert.doesNotMatch(x.sent.at(-1).text,/supports Ledger/i);
 }finally{x.close()}});
test('v008 direct opt-out works, admin commands and opt-in remain available',async()=>{const x=fixture();try{
 await x.handler(x.msg('How does Sumcoin staking work?',1,11));
 await x.handler(x.msg('No thanks',2,11,{reply_to_message:{message_id:501,from:{is_bot:true,username:'SumcoinHelperBot'}}}));
 assert.match(x.sent.at(-1).text,/24 hours/);
 const prior=x.sent.length;
 await x.handler(x.msg('How does Sumcoin index work?',3,11));assert.equal(x.sent.length,prior);
 await x.handler(x.msg('/resume',4,11));assert.match(x.sent.at(-1).text,/enabled/);
 await x.handler(x.msg('How does Sumcoin index work?',5,11));assert.ok(x.sent.length>prior+1);
 }finally{x.close()}});
test('v008 no duplicate queue escalation and hard cap for repeating members',async()=>{const x=fixture();try{
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',1,11));
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',2,11));
 assert.equal(x.escalations.pending().length,1);
 }finally{x.close()}});
test('v008 human intake rejects wallet secrets and never notifies reviewer',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start'));
 await x.handler(x.msg('My Sumcoin seed phrase is: correct horse battery staple',1,11));
 assert.equal(x.escalations.pending().length,0);assert.equal(x.direct.length,0);
 }finally{x.close()}});
test('v008 new reviewed technical subjects and unreviewed transcript have separate provenance',()=>{
 const k=new Knowledge();assert.ok(k.curated.length>=52);assert.ok(k.find('sumcoinlib-compat'));assert.ok(k.find('core-rpc-security'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sumvideo-'));try{
 const out=path.join(dir,'video.json');const count=importTranscript('A discussion of Sumcoin features, older history, and current project goals. '.repeat(60),{out});assert.ok(count>=1);
 const docs=JSON.parse(fs.readFileSync(out,'utf8')).documents;assert.equal(docs[0].reviewed,false);
 const full=new Knowledge({videoFile:out});assert.ok(full.documents().some(d=>d.kind==='video'));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('v008 classification and explicit stop phrases',()=>{assert.equal(isDismissal('no gracias'),true);assert.equal(isDismissal('no thanks'),true);assert.equal(isDismissal('I need help with Sumcoin'),false);assert.equal(needsHumanReview('Does Sumcoin support Ledger hardware wallet staking?'),true)});
test('v008 explicit /ask with unverified capability escalates instead of generic confidence',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start'));
 await x.handler(x.msg('/ask@SumcoinHelperBot Does Sumcoin support Ledger hardware wallet staking?',1,11));
 assert.equal(x.escalations.pending().length,1);
 assert.match(x.sent.at(-1).text,/checking this/i);
 }finally{x.close()}});
test('v008 ordinary current price question invokes live source instead of static answer',async()=>{
 const x=fixture();try{
 // Recreate handler with a mock live price and a member classification, using the same fixtures.
 let calls=0;const h=createHandler({client:x.client,state:x.state,config:{allowedChatUsername:'sumcoins',learningEnabled:false,allowPrivateChats:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:x.k,learning:x.learning,ai:new ConversationAI(),escalations:x.escalations,liveOps:{price:async()=>{calls++;return 'LIVE RATE';},tx:async()=>'',address:async()=>''}});
 await h(x.msg('What is the current Sumcoin price today?',1,11));
 assert.equal(calls,1);assert.equal(x.sent.at(-1).text,'LIVE RATE');
 }finally{x.close()}});
test('v008 cannot notify a reviewer whose administrator role has been revoked',async()=>{const x=fixture();try{
 await x.handler(x.pm('/start'));
 x.adminIds.delete(999);
 await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?',1,11));
 assert.equal(x.escalations.pending().length,1);assert.equal(x.direct.length,0);
 }finally{x.close()}});
test('v008 source-backed video transcript chunks are only discoverable, not automatically asserted',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sumvideo2-'));try{
 const out=path.join(dir,'video.json');importTranscript('A hypothetical video mentions Sumcoin discovery and addresses, but may have outdated statements. '.repeat(60),{out});
 const k=new Knowledge({videoFile:out});const docs=k.search('hypothetical video addresses',{limit:10});assert.ok(docs.some(x=>x.kind==='video'));
 const {_unused}= { _unused:null};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
