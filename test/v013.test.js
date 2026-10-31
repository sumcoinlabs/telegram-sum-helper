import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Learning} from '../src/learning.js';
import {syncNews,NEWS_SOURCES} from '../src/news.js';
import {VERSION} from '../src/version.js';
import {createHandler} from '../src/bot.js';
import {State} from '../src/state.js';
import {Knowledge} from '../src/knowledge.js';

const tmp=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v013-'));return {dir,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};};

test('v013 banner version has one source and README badge matches',()=>{
 assert.equal(VERSION,'0.0.14');
 const index=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(index,/Sumcoin Helper v\$\{VERSION\}/);
 assert.doesNotMatch(index,/v0\.0\.10/);
 const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(readme,/version-0\.0\.14/);
 assert.match(readme,/sumcoin_400x400\.png/);
 assert.ok(readme.split('\n').length<100);
});

test('v013 protected publisher pins verified v0.0.12 commit without stale checksums or force',()=>{
 const script=fs.readFileSync(new URL('../scripts/push-update.sh',import.meta.url),'utf8');
 assert.match(script,/2308a6cd35d0d1c30cc9868c13aa6b3263e8e8e1/);
 assert.match(script,/git rev-parse HEAD/);
 assert.doesNotMatch(script,/while read -r file expected/);
 assert.doesNotMatch(script,/\bgit push --force\b/);
 assert.ok(!script.includes('data/learning.json'));
});

test('v013 historical fingerprint persists beyond normal 30-day rolling window',()=>{const e=tmp();try{
 let now=Date.UTC(2026,9,31);const l=new Learning(path.join(e.dir,'learning.json'),()=>now);
 const past='How can I move my older Sumcoin wallet balance to the current chain?';
 const recent='Where do I check my pending Sumcoin transaction today?';
 assert.ok(l.observe(past,'legacy','en',{historical:true,save:false}));
 assert.ok(l.observe(recent,'pending','en',{save:false}));l.prune();l.save();
 now+=40*86400000;
 const later=new Learning(l.file,()=>now);let records=Object.values(later.data.patterns);
 assert.equal(records.length,1);
 assert.equal(records[0].historical,true);
 assert.equal(records[0].historicalCount,1);
 assert.equal(later.learnedTopic(past),null,'one question must never become an automatic fact');
 assert.doesNotMatch(fs.readFileSync(l.file,'utf8'),/older Sumcoin wallet|pending Sumcoin transaction/);
}finally{e.clean();}});

test('v013 private backfill merges with existing approved answers and never stores raw messages',()=>{const e=tmp();try{
 const file=path.join(e.dir,'data','learning.json');
 const original=new Learning(file);
 const id=original.queue('How can I stake Sumcoin using Core safely?','Staking requires compatible Core software.','https://sumcoin.org/about/');
 assert.ok(original.approve(id));
 const exp={name:'Private group export',messages:[
  {type:'message',from:'Person A',text:'Is Sumcoin proof of stake?'},
  {type:'message',from:'Person B',text:'Is Sumcoin proof of stake?'},
  {type:'message',from:'Person C',text:'How do I migrate Sumcoin from Slice wallet?'},
  {type:'message',from:'Person D',text:'My seed phrase and recovery words are secret and should stay private'}
 ]};
 const importer=new URL('../scripts/learn-export.mjs',import.meta.url).pathname;
 const p=spawnSync(process.execPath,[importer,'-'],{cwd:e.dir,input:JSON.stringify(exp),encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 const next=new Learning(file);assert.equal(next.data.approved.length,1);
 assert.ok(Object.values(next.data.patterns).every(x=>x.historical));
 assert.equal(next.learnedTopic('Is Sumcoin proof of stake?'),null);
 assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Person A|Person B|Slice wallet|proof of stake|Private group export/);
}finally{e.clean();}});

test('v013 news sync keeps publisher summaries when a source fails and marks them stale',async()=>{const e=tmp();try{
 const out=path.join(e.dir,'news.json');const saved={indexedAt:'2026-10-30T12:00:00Z',documents:[
  {id:'news-1',title:'BMCS Sumcoin fund report',text:'Publisher says a historical Sumcoin fund was announced.',source:NEWS_SOURCES[1].url,reviewed:false}
 ]};fs.writeFileSync(out,JSON.stringify(saved));
 const html='<meta property="og:title" content="Sumcoin news historical discussion"><meta name="description" content="The Sumcoin project has a historical discussion about a cryptocurrency index.">';
 const progress=[];
 const result=await syncNews({out,fetchImpl:async url=>{
  if(url===NEWS_SOURCES[1].url)throw new Error('HTTP 403');
  return {ok:true,headers:{get:()=>null},text:async()=>html};
 },onProgress:x=>progress.push(x)});
 assert.deepEqual([result.live,result.retained,result.failures],[2,1,1]);
 const actual=JSON.parse(fs.readFileSync(out,'utf8'));
 assert.equal(actual.documents.length,3);
 assert.equal(actual.documents.find(x=>x.source===NEWS_SOURCES[1].url).stale,true);
 assert.equal(actual.documents.find(x=>x.source===NEWS_SOURCES[0].url).stale,false);
 assert.ok(progress.some(x=>x.includes('retained from previous sync')));
}finally{e.clean();}});

test('v013 news sync never invents a cached source if none was previously fetched',async()=>{const e=tmp();try{
 const out=path.join(e.dir,'news.json');
 const html='<meta property="og:title" content="Sumcoin community article"><meta name="description" content="A Sumcoin public update discussed index pricing and the marketplace.">';
 const response=await syncNews({out,fetchImpl:async url=>url===NEWS_SOURCES[2].url?{ok:false,status:403,headers:{get:()=>null}}:{ok:true,headers:{get:()=>null},text:async()=>html}});
 assert.equal(response.retained,0);assert.equal(response.articles,2);
 const obj=JSON.parse(fs.readFileSync(out,'utf8'));assert.equal(obj.failures.length,1);
 assert.ok(!obj.documents.some(d=>d.source===NEWS_SOURCES[2].url));
}finally{e.clean();}});

test('v013 news sync never overwrites old metadata if every fetch fails',async()=>{const e=tmp();try{
 const out=path.join(e.dir,'news.json');
 const original=JSON.stringify({documents:[{source:'https://example.com/fake',text:'untrusted'}]});fs.writeFileSync(out,original);
 await assert.rejects(syncNews({out,fetchImpl:async()=>{throw Error('network down');}}),/existing index preserved/);
 assert.equal(fs.readFileSync(out,'utf8'),original);
}finally{e.clean();}});

test('v013 restricted status reports version and engine without exposing secrets or raw chat',async()=>{const e=tmp();try{
 const msgs=[];
 const client={sendMessage:async(m,text)=>{msgs.push(String(text));return {message_id:53};},getChatMember:async()=>({status:'administrator'})};
 const state=new State(path.join(e.dir,'state.json'),'reply');
 const knowledge=new Knowledge();
 const learning=new Learning(path.join(e.dir,'learning.json'));
 const bot=createHandler({client,state,knowledge,learning,ai:{apiKey:'',retrievalQuestion:()=>''},
   botUsername:'SumcoinHelperBot',config:{allowedChatId:'-10012345',allowedChatUsername:'sumcoins',aiDailyLimit:100,initialMode:'reply'},liveOps:{}});
 const now=Math.floor(Date.now()/1000);
 await bot({chat:{id:-10012345,type:'supergroup',username:'sumcoins'},from:{id:12345,username:'admin',language_code:'en'},date:now,message_id:11,text:'/status'});
 assert.equal(msgs.length,1);
 assert.match(msgs[0],/v0\.0\.14/);
 assert.match(msgs[0],/retrieval only \(no API key\)/);
 assert.doesNotMatch(msgs[0],/TELEGRAM_BOT_TOKEN|OPENAI_API_KEY/);
}finally{e.clean();}});

import {specificFAQTopic} from '../src/bot.js';
test('v013 focuses on precise reviewed FAQ instead of generic consensus or wallet answer',()=>{
 assert.equal(specificFAQTopic('Can I stake Sumcoin on the mobile wallet app?'),'staking-mobile');
 assert.equal(specificFAQTopic('My Sumcoin Core is not staking?'),'staking-check');
 assert.equal(specificFAQTopic('Why can I not sell SUM at the reference index price?'),'index-vs-liquidity');
 assert.equal(specificFAQTopic('My old Slice Wallet Sumcoin balance is zero now?'),'wallet-network-mismatch');
 assert.equal(specificFAQTopic('Can I pay a Sumcoin migration fee by deducting it from old coin?'),'migration-payment');
 assert.equal(specificFAQTopic('Can I stake Bitcoin on my phone?'),null);
 assert.equal(specificFAQTopic('Hey everyone, my phone is old.'),null);
});

test('v013 import of same export twice is idempotent; only one-way digest retained',()=>{const e=tmp();try{
 const importer=new URL('../scripts/learn-export.mjs',import.meta.url).pathname;
 const raw=JSON.stringify({messages:[{type:'message',text:'Is Sumcoin proof of stake?'}]});
 const run=()=>spawnSync(process.execPath,[importer,'-'],{cwd:e.dir,input:raw,encoding:'utf8'});
 const a=run();assert.equal(a.status,0,a.stderr);
 const first=new Learning(path.join(e.dir,'data','learning.json'));
 const before=JSON.stringify(first.data.patterns);
 const b=run();assert.equal(b.status,0,b.stderr);assert.match(b.stdout,/already been imported/);
 const next=new Learning(path.join(e.dir,'data','learning.json'));
 assert.equal(JSON.stringify(next.data.patterns),before);
 assert.equal(next.data.historicalImports.length,1);
 assert.doesNotMatch(fs.readFileSync(next.file,'utf8'),/proof of stake|Is Sumcoin/);
}finally{e.clean();}});

test('v013 Telegram admin lookup outage cannot authorize /mode or /approve',async()=>{const e=tmp();try{
 const msgs=[];
 const client={sendMessage:async(m,text)=>{msgs.push(String(text));return {message_id:100};},getChatMember:async()=>{throw new Error('Telegram API timeout');}};
 const state=new State(path.join(e.dir,'state.json'),'observe');
 const bot=createHandler({client,state,knowledge:new Knowledge(),learning:new Learning(path.join(e.dir,'learning.json')),
   ai:{apiKey:''},botUsername:'SumcoinHelperBot',config:{allowedChatId:'-10023455',allowedChatUsername:'sumcoins',aiDailyLimit:100},liveOps:{}});
 const now=Math.floor(Date.now()/1000);
 const base={chat:{id:-10023455,type:'supergroup',username:'sumcoins'},from:{id:8888,username:'notadmin',language_code:'en'},date:now,message_id:15};
 await bot({...base,text:'/mode reply'});
 assert.equal(state.data.mode,'observe');
 await bot({...base,message_id:16,text:'/approve 1'});
 assert.equal(msgs.length,2);
 assert.ok(msgs.every(x=>/restricted/.test(x)));
}finally{e.clean();}});
