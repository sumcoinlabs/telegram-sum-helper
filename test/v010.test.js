import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {GroupIndex} from '../src/group-index.js';
import {Learning} from '../src/learning.js';
import {Knowledge,tokens} from '../src/knowledge.js';
import {State} from '../src/state.js';
import {Escalations} from '../src/escalations.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {syncGithubDocs} from '../src/discovery.js';
import {syncNews} from '../src/news.js';
function context(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum010-')),sent=[],privateSent=[];
 const state=new State(path.join(dir,'state.json'),'observe'),learning=new Learning(path.join(dir,'learning.json')),
  groupIndex=new GroupIndex(path.join(dir,'group-index.json')),escalations=new Escalations(path.join(dir,'escalations.json'));
 let roles=new Set([1,999]);
 const client={sendMessage:async(_m,t)=>{sent.push(t);return{message_id:100+sent.length}},sendDirect:async(id,t)=>{privateSent.push({id,t})},getChatMember:async(_g,id)=>({status:roles.has(id)?'administrator':'member'})};
 const handler=createHandler({client,state,config:{allowedChatUsername:'sumcoins',groupIndexEnabled:true,learningEnabled:false,allowPrivateChats:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning,escalations,groupIndex,ai:new ConversationAI()});
 const msg=(text,id,user=11,extra={})=>({chat:{id:-1000333,username:'sumcoins',type:'supergroup'},from:{id:user,language_code:'en',username:user===999?'SumcoinAdmin':'member'},message_id:id,date:Math.floor(Date.now()/1000),text,...extra});
 const dm=(text)=>({chat:{id:999,type:'private'},from:{id:999,username:'SumcoinAdmin',language_code:'en'},message_id:1000,date:Math.floor(Date.now()/1000),text});
 return {dir,sent,roles,client,groupIndex,learning,handler,msg,dm,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v010 indexes group discussions in observe mode without bot replies or member IDs',async()=>{const x=context();try{
 await x.handler(x.msg('Can I migrate my old Sumcoin wallet?',21));
 await x.handler(x.msg('The discussion of Sumcoin may need a new wallet version.',22));
 assert.equal(x.groupIndex.stats().captured,2);assert.equal(x.sent.length,0);
 const raw=fs.readFileSync(path.join(x.dir,'group-index.json'),'utf8');assert.doesNotMatch(raw,/"from"|"userId"|"username"|"chatId"/);assert.doesNotMatch(raw,/\b11\b/);
 }finally{x.close()}});
test('v010 queues a real administrator response to a stored question as an unapproved draft',async()=>{const x=context();try{
 await x.handler(x.dm('/start'));
 await x.handler(x.msg('How does Sumcoin staking work?',21));
 await x.handler(x.msg('The current Sumcoin network uses proof of stake and compatible Core software.',22,1,{reply_to_message:{message_id:21,text:'How does Sumcoin staking work?',from:{id:11}}}));
 assert.equal(x.learning.data.pending.length,1);assert.equal(x.learning.data.approved.length,0);
 assert.match(x.learning.data.pending[0].title,/staking/);assert.match(x.learning.data.pending[0].text,/proof of stake/);
 await x.handler(x.dm('/drafts'));assert.match(x.sent.at(-1),/proof of stake/);
 const id=x.learning.data.pending[0].id;
 await x.handler(x.dm(`/source ${id} | https://www.sumcoin.org/about/`));await x.handler(x.dm(`/approve ${id}`));
 assert.equal(x.learning.data.approved.length,1);assert.equal(x.learning.data.pending.length,0);
 }finally{x.close()}});
test('v010 a later clarification replying to a previous admin answer becomes a new draft',async()=>{const x=context();try{
 await x.handler(x.msg('How does Sumcoin staking work?',30));
 await x.handler(x.msg('Sumcoin current staking uses the Core application.',31,1,{reply_to_message:{message_id:30,from:{id:11}}}));
 await x.handler(x.msg('For clarity, Sumcoin mobile wallet does not mint coins.',32,1,{reply_to_message:{message_id:31,from:{id:1}}}));
 assert.equal(x.learning.data.pending.length,2);
 assert.match(x.learning.data.pending[1].text,/mobile wallet/);
 }finally{x.close()}});
test('v010 does not trust an unverified admin, message from another group, or a fake sender_chat',async()=>{const x=context();try{
 await x.handler(x.msg('How does Sumcoin staking work?',10));
 x.roles.clear();await x.handler(x.msg('Sumcoin staking is guaranteed to double your coins.',11,22,{reply_to_message:{message_id:10,from:{id:11}}}));
 assert.equal(x.learning.data.pending.length,0);
 await x.handler({...x.msg('How does Sumcoin staking work?',12),chat:{id:-100123,username:'different',type:'supergroup'}});
 await x.handler(x.msg('Sumcoin staking question from channel',13,22,{sender_chat:{id:14}}));
 assert.equal(x.groupIndex.data.entries.length,2);
 }finally{x.close()}});
test('v010 refuses secrets, private details and third party links',async()=>{const x=context();try{
 const messages=['My Sumcoin seed phrase is: correct horse battery staple','My Sumcoin email is test@example.com','My Sumcoin address is 1BoatSLRHtKNngkdXEeobR76b53LETtpyT','My Sumcoin support is https://fake-wallet.example'];
 for(let i=0;i<messages.length;i++)await x.handler(x.msg(messages[i],i+1));
 assert.equal(x.groupIndex.stats().captured,0);
 }finally{x.close()}});
test('v010 accepts explicit supported official URLs for reviewed admin candidate without storing link in question text',async()=>{const x=context();try{
 await x.handler(x.msg('How does Sumcoin staking work?',10));
 await x.handler(x.msg('Sumcoin Core documentation describes PoS operation. https://github.com/sumcoinlabs/sumcoin',11,1,{reply_to_message:{message_id:10,from:{id:11}}}));
 assert.equal(x.learning.data.pending[0]?.source,'https://github.com/sumcoinlabs/sumcoin');
 assert.doesNotMatch(x.groupIndex.data.entries[1]?.text,/https:/);
 }finally{x.close()}});
test('v010 member can remove saved excerpt by replying to their own message',async()=>{const x=context();try{
 await x.handler(x.msg('How does Sumcoin staking work?',10));
 await x.handler(x.msg('/forget',12,11,{reply_to_message:{message_id:10,from:{id:11}}}));
 assert.equal(x.groupIndex.stats().captured,0);assert.match(x.sent.at(-1),/removed/);
 await x.handler(x.msg('How does Sumcoin staking work?',13));
 await x.handler(x.msg('/forget',14,22,{reply_to_message:{message_id:13,from:{id:11}}}));
 assert.equal(x.groupIndex.stats().captured,1);
 }finally{x.close()}});
test('v010 group index enforces 90-day retention and maximum size',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'sumindex-'));try{
 let t=100*86400000;const x=new GroupIndex(path.join(d,'group.json'),()=>t);
 x.observe({message_id:1,text:'How does Sumcoin staking work?',from:{id:2}},{language:'en'});
 t+=91*86400000;
 x.observe({message_id:2,text:'How does Sumcoin staking work today?',from:{id:2}},{language:'en'});
 assert.equal(x.stats().captured,1);assert.equal(x.data.entries[0].messageId,2);
 }finally{fs.rmSync(d,{recursive:true,force:true})}});
test('v010 supports Unicode retrieval and exact user-supplied transcript provenance',()=>{
 assert.ok(tokens('钱包 нужна помощь 財布').includes('钱包'));
 const k=new Knowledge();assert.equal(k.podcastTwo.length,22);assert.equal(k.projectUpdate.length,8);
 assert.ok(k.projectUpdate.every(x=>x.reviewed===false&&x.source==='user-supplied:sumtoshi-project-update-2024-07-08'));
 assert.ok(k.podcastTwo.every(x=>x.reviewed===false));
 assert.ok(k.transcriptSearch('What did the Sumcoin podcast say about decentralization?').some(x=>x.kind==='podcast'));
 assert.ok(k.transcriptSearch('podcast 2',3).every(x=>x.id.startsWith('podcast-2-')));
 assert.ok(k.transcriptSearch('Sumtoshi 2024 migration',3).every(x=>x.id.startsWith('project-update-2024-07-08-')));
});
test('v010 GitHub discovery indexes fixed allowlisted documentation, never code or secrets',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'sumgithub010-'));try{
 const fetchImpl=async url=>{
  const data=url.includes('api.github.com')?{tree:[{type:'blob',path:'README.md',sha:'abcdeabcde1234',size:500},{type:'blob',path:'src/private-key.js',sha:'bcdefbcdef1234',size:500},{type:'blob',path:'.env',sha:'cdefgcdefg1234',size:500}]}:null;
  return {ok:true,headers:{get:()=>null},text:async()=>data?JSON.stringify(data):'Sumcoin official developer documentation with addresses and blockchain networks. '.repeat(20)};
 };
 const out=path.join(d,'docs.json');const result=await syncGithubDocs({fetchImpl,out,maxDocs:4});const docs=JSON.parse(fs.readFileSync(out,'utf8')).documents;
 assert.ok(result.documents>=1);assert.ok(docs.every(x=>x.source.startsWith('https://github.com/sumcoinlabs/')&&x.reviewed===false));
 }finally{fs.rmSync(d,{recursive:true,force:true})}});
test('v010 news discovery stores publisher description, not complete article',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'sumnews010-'));try{
 const meta='<meta property="og:title" content="Sumcoin index update"><meta name="description" content="A public Sumcoin project report about a changing cryptocurrency market and a new blockchain project.">';
 const fetchImpl=async()=>({ok:true,headers:{get:()=>null},text:async()=>`<html><head>${meta}</head><body>${'full copyrighted news article '.repeat(500)}</body></html>`});
 const out=path.join(d,'news.json');const result=await syncNews({fetchImpl,out});const data=JSON.parse(fs.readFileSync(out,'utf8'));
 assert.equal(result.articles,3);assert.ok(data.documents.every(x=>x.reviewed===false&&x.text.length<300));
 assert.doesNotMatch(JSON.stringify(data),/full copyrighted/);
 }finally{fs.rmSync(d,{recursive:true,force:true})}});
