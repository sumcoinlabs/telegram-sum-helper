import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHandler} from '../src/bot.js';
import {consensusAnswerKind,consensusReply,isPoSConfirmation} from '../src/intent.js';
import {Knowledge} from '../src/knowledge.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {Escalations} from '../src/escalations.js';
import {ConversationAI} from '../src/ai.js';
const root=new URL('../',import.meta.url);
function fixture(mode='reply'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum012-'));const replies=[];let counter=0;
 const roles=new Map([[1,'administrator']]);
 const client={sendMessage:async(m,t)=>{replies.push(t);return {message_id:100+replies.length};},getChatMember:async(_chat,id)=>({status:roles.get(id)||'member'})};
 const escalation=new Escalations(path.join(dir,'escalation.json'));
 const handler=createHandler({client,state:new State(path.join(dir,'state.json'),mode),config:{allowedChatUsername:'sumcoins',learningEnabled:false,allowPrivateChats:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),ai:new ConversationAI(),escalations:escalation,liveOps:{price:async()=>'',tx:async()=>'',address:async()=>''}});
 const msg=(text,user=21,language_code='en')=>({message_id:++counter,chat:{id:-1000123,type:'supergroup',username:'sumcoins'},from:{id:user,language_code},date:Date.now()/1000|0,text});
 return {dir,replies,roles,handler,escalation,msg,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v012 exact screenshot: is Sum PoS -> Yes; so it is pos -> Yes; is proof of work -> No',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('this is more AI testing.'));
  assert.equal(x.replies.length,0);
  await x.handler(x.msg('is Sum pos?'));
  assert.equal(x.replies.length,1);assert.match(x.replies[0],/^Yes\. Sumcoin currently uses proof-of-stake/);
  await x.handler(x.msg('so it is pos'));
  assert.equal(x.replies.length,2);assert.match(x.replies[1],/^Yes\./);
  await x.handler(x.msg('is sumcoin proof of work?'));
  assert.equal(x.replies.length,3);assert.match(x.replies[2],/^No\. Sumcoin originally used proof-of-work/);
  assert.equal(x.escalation.pending().length,0);
 }finally{x.close();}
});
test('v012 historical PoW question must answer yes, originally PoS must answer no',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('Was Sumcoin originally proof of work?'));
  await x.handler(x.msg('Was Sumcoin originally proof of stake?'));
  assert.equal(x.replies.length,2);assert.match(x.replies[0],/^Yes\./);assert.match(x.replies[1],/^No\./);
 }finally{x.close();}
});
test('v012 bare confirmation has no effect without a recently answered question',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('so it is pos'));
  assert.equal(x.replies.length,0);
  await x.handler(x.msg('Is Sumcoin proof of work?',21));
  await x.handler(x.msg('so it is pos',22));
  assert.equal(x.replies.length,1);
 }finally{x.close();}
});
test('v012 administrator confirmation remains quiet, explicit ask is available',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('Is Sum PoS?',1));
  assert.equal(x.replies.length,0);
  await x.handler(x.msg('/ask@SumcoinHelperBot Is Sum PoS?',1));
  assert.equal(x.replies.length,1);assert.match(x.replies[0],/^Yes\./);
  await x.handler(x.msg('so it is pos',1));assert.equal(x.replies.length,1);
 }finally{x.close();}
});
test('v012 unknown technical question still escalates, unrelated benign message ignored',async()=>{
 const x=fixture();try{
  await x.handler(x.msg('This is merely a test.'));
  assert.equal(x.replies.length,0);
  await x.handler(x.msg('Does Sumcoin support Ledger hardware wallet staking?'));
  assert.equal(x.escalation.pending().length,1);
 }finally{x.close();}
});
test('v012 current vs historical consensus interpretations include ambiguity-safe neutral',()=>{
 for(const [q,expect] of [
  ['Is SUM PoS?','pos-current'],['Does Sumcoin use proof of stake?','pos-current'],
  ['Is SUM proof of work?','pow-current'],['Can Sumcoin still be mined?','pow-current'],
  ['Was Sumcoin ever proof of work?','pow-historical'],
  ['Was Sumcoin originally PoS?','pos-historical'],
  ['Is Sumcoin proof of work or proof of stake?','neutral'],
  ["Isn't Sumcoin PoS?",'neutral'],
  ['What consensus does Sumcoin use?','neutral']])assert.equal(consensusAnswerKind(q),expect,q);
});
test('v012 all 14 language affirmative answers begin affirmatively, negative ones remain negative',()=>{
 const positive=/^(?:Yes|Sí|Sim|Oui|Ja|Sì|Да|نعم|हाँ|是的|はい|네|Evet|Ya)\b|^(?:نعم|हाँ|是的|はい|네)\./u;
 for(const lang of ['en','es','pt','fr','de','it','ru','ar','hi','zh','ja','ko','tr','id']){
  const yes=consensusReply(lang,'Is Sumcoin proof of stake?');
  const no=consensusReply(lang,'Is Sumcoin proof of work?');
  assert.match(yes,/PoS/);assert.match(no,/PoW/);
  assert.doesNotMatch(yes,/^(?:No\.|Non\.|Nein\.|Нет\.|لا\.|नहीं|不是|いいえ|아니요|Hayır|Tidak)/u,lang);
  assert.match(yes,/https:\/\/www.sumcoin.org\/about\//);
 }
});
test('v012 verified community insights contain aggregate counts only, not usernames or messages',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('../knowledge/community-insights.json',import.meta.url)));
 assert.equal(f.totalEvents,9531);assert.equal(f.textMessages,6573);assert.equal(f.serviceEvents,2764);
 assert.ok(f.topicCounts.legacy_and_migration>200);
 assert.ok(!('messages' in f));assert.ok(!('userIds' in f));
});
test('v012 five history-derived FAQ topics have current official references and avoid promises',()=>{
 const k=new Knowledge();for(const id of ['legacy-chain','migration-payment','exchange-safety','faucet-compatibility','wallet-network-mismatch']){
  const a=k.find(id);assert.ok(a,id);assert.ok(a.sources.length>0,id);assert.ok(a.sources.every(s=>s.startsWith('https://')),id);
  assert.ok(!/guaranteed|fixed current fee is/i.test(a.body),id);
 }
 assert.ok(k.curated.length>=62);
});
test('v012 historical examples are searchable without ingesting member transcript',()=>{
 const k=new Knowledge();
 for(const [q,id] of [['Can I pay migration cost in SUM and deduct it from the old wallet?','migration-payment'],['Is the Sumcoin faucet compatible with my old wallet?','faucet-compatibility'],['Why is my old PoW chain balance not in new Sumcoin?','legacy-chain']]){
  const docs=k.search(q,{limit:4});assert.ok(docs.some(d=>d.id===id),`${q} :: ${docs.map(d=>d.id)}`);
 }
});
test('v012 branded README is still concise and announces current release',()=>{
 const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(readme,/version-0\.0\.15/);
 assert.match(readme,/sumcoin_400x400\.png/);
 assert.ok(readme.split('\n').length<100);
});
