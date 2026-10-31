import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {State} from '../src/state.js';
import {Learning,isOfficialSource} from '../src/learning.js';
import {Knowledge} from '../src/knowledge.js';
import {reviewedFact,offlineAnswer} from '../src/offline.js';
import {createHandler} from '../src/bot.js';
import {ConversationAI,safeQuestion} from '../src/ai.js';
import {VERSION} from '../src/version.js';
const fixture=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v014-'));return {dir,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};};

test('v014 version, protected publisher and branded concise README',()=>{
 assert.equal(VERSION,'0.0.18');
 const script=fs.readFileSync(new URL('../scripts/push-update.sh',import.meta.url),'utf8');
 assert.match(script,/bc66b905da56604e1bcf1642bcd5dc8c10e60d9a/);
 assert.match(script,/CURRENT.*0\.0\.16/);
 assert.match(script,/CURRENT.*0\.0\.16/);
 assert.match(script,/git rev-parse HEAD/);
 assert.doesNotMatch(script,/git push --force/);
 const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(readme,/sumcoin_400x400\.png/);
 assert.match(readme,/version-0\.0\.18/);
 assert.ok(readme.split('\n').length<100);
});

test('v014 AI is strictly off by default, caps advertised and free offline always available',()=>{
 const entry=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(entry,/process\.env\.AI_ENABLED==='true'/);
 assert.match(entry,/apiKey:config\.aiEnabled\?/);
 const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8');
 for(const key of ['AI_ENABLED=false','AI_HOURLY_LIMIT=4','AI_DAILY_LIMIT=12','AI_MONTHLY_LIMIT=60'])assert.ok(env.includes(key));
 assert.match(env,/WEEKLY_REPORT_ENABLED=false/);
});

test('v014 quota respects three independent windows and persists across restarts',()=>{const e=fixture();try{
 let time=Date.parse('2026-10-31T10:01:01Z');const file=path.join(e.dir,'state.json');
 let s=new State(file,'reply',()=>time);
 assert.equal(s.consumeAiQuota(2,1,3),true);
 assert.equal(s.consumeAiQuota(2,1,3),false,'hour cap');
 s=new State(file,'reply',()=>time);assert.equal(s.consumeAiQuota(2,1,3),false,'restart does not clear cap');
 time=Date.parse('2026-10-31T11:01:00Z');assert.equal(s.consumeAiQuota(2,1,3),true);
 assert.equal(s.consumeAiQuota(2,1,3),false,'daily cap');
 time=Date.parse('2026-11-01T00:01:00Z');assert.equal(s.consumeAiQuota(2,1,3),true);
 time=Date.parse('2026-11-01T01:01:00Z');assert.equal(s.consumeAiQuota(2,1,3),true);
 time=Date.parse('2026-11-02T02:01:00Z');assert.equal(s.consumeAiQuota(2,1,3),true);
 assert.equal(s.consumeAiQuota(2,1,3),false);
 assert.equal(s.consumeAiQuota(2,0,3),false,'zero limit is off');
}finally{e.clean();}});

test('v014 source allowlist does not accept deceptive hosts, credentials or off-org code',()=>{
 for(const url of ['https://sumcoin.org/about/','https://www.sumcoin.org/','https://github.com/sumcoinlabs/sumcoin/blob/master/src/main.cpp','https://docs.sumcoin.org/'])assert.equal(isOfficialSource(url),true,url);
 for(const url of ['https://sumcoin.org.evil.com/','https://github.com/evil/sumcoin','https://github.com/sumcoinlabs.evil/repo','http://sumcoin.org/','https://foo@sumcoin.org/','https://sumcoin.org/#inject','https://sumcoin.org:8000/'])assert.equal(isOfficialSource(url),false,url);
});

test('v014 approved correction replaces only its precise reviewed topic and can be revoked',()=>{const e=fixture();try{
 const l=new Learning(path.join(e.dir,'learning.json'));
 const k=new Knowledge({learned:l.data.approved});
 const original=k.find('cashout');assert.equal(original.kind,'curated');
 assert.equal(l.queue(original.title,'A misleading edit.','https://sumcoin.org.evil.com/','correction:cashout'),null);
 const id=l.queue(original.title,'Use a willing peer-to-peer buyer; the index is not an automatic bank conversion.','https://sumcoin.org/about/','correction:cashout');
 assert.ok(id>0);assert.equal(k.find('cashout').kind,'curated','draft is not activated');
 assert.equal(l.approve(id),true);k.learned=l.data.approved;
 const corrected=k.find('cashout');assert.equal(corrected.kind,'admin-approved');
 assert.equal(corrected.supersedesId,'cashout');
 assert.equal(k.documents().filter(x=>x.id==='cashout').length,1,'no conflicting current answer');
 assert.match(offlineAnswer({docs:[corrected],knowledge:k,lang:'en'}),/willing peer-to-peer buyer/);
 assert.equal(reviewedFact(corrected,'es'),null,'old Spanish translation is not silently reused for updated facts');
 assert.match(offlineAnswer({docs:[corrected],knowledge:k,lang:'es'}),/willing peer-to-peer buyer/);
 assert.equal(l.revoke(id),true);k.learned=l.data.approved;
 assert.equal(k.find('cashout').kind,'curated');
}finally{e.clean();}});

test('v014 corrected admin workflow requires reply to recent bot message and explicit approval',async()=>{const e=fixture();try{
 const messages=[],g={chat:{id:-10012345,type:'supergroup',username:'sumcoins'},from:{id:123,username:'owner',language_code:'en'},date:Math.floor(Date.now()/1000)};
 const client={sendMessage:async(_msg,text)=>{messages.push(text);return {message_id:100+messages.length};},getChatMember:async()=>({status:'administrator'})};
 const learning=new Learning(path.join(e.dir,'learning.json')),k=new Knowledge({learned:learning.data.approved});
 const handler=createHandler({client,state:new State(path.join(e.dir,'state.json'),'reply'),config:{allowedChatId:'-10012345',allowedChatUsername:'sumcoins',aiDailyLimit:12},botUsername:'SumcoinHelperBot',knowledge:k,learning,ai:new ConversationAI()});
 await handler({...g,message_id:1,text:'/ask How can I cash out Sumcoin to a bank account?'});
 assert.ok(messages.length>0);
 const botMessageId=100+messages.length;
 await handler({...g,message_id:2,text:'/correct A peer-to-peer trader is required to obtain fiat currency. | https://sumcoin.org/about/',reply_to_message:{message_id:botMessageId,from:{is_bot:true,username:'SumcoinHelperBot'}}});
 assert.equal(learning.data.pending.length,1);
 assert.equal(k.find('cashout').kind,'curated');
 await handler({...g,message_id:3,text:`/approve ${learning.data.pending[0].id}`});
 assert.equal(k.find('cashout').kind,'admin-approved');
 const correctionId=learning.data.approved[0].id;
 await handler({...g,message_id:4,text:`/revoke ${correctionId}`});
 assert.equal(k.find('cashout').kind,'curated');
}finally{e.clean();}});

test('v014 weekly report contains aggregate counts only, including feedback and corrections',()=>{const e=fixture();try{
 const s=new State(path.join(e.dir,'state.json'),'reply');s.noteOutcome('answered');s.noteOutcome('offline');s.noteOutcome('escalated');s.noteOutcome('correction');s.addFeedback(910);
 const r=s.weeklyReport();
 for(const phrase of ['Answers delivered: 1','Offline / reviewed answers: 1','Escalated: 1','Corrections approved: 1','Feedback received: 1'])assert.ok(r.includes(phrase));
 assert.doesNotMatch(r,/message #910|telegram id|member_id|123456789/);
}finally{e.clean();}});

test('v014 admin /weekly works and a normal member cannot use it',async()=>{const e=fixture();try{
 const messages=[],common={chat:{type:'supergroup',id:-10012345,username:'sumcoins'},date:Math.floor(Date.now()/1000)};
 const client={sendMessage:async(_m,t)=>{messages.push(t);return {message_id:44};},getChatMember:async(_id,user)=>({status:user===10?'administrator':'member'})};
 const handler=createHandler({client,state:new State(path.join(e.dir,'state.json'),'reply'),config:{allowedChatId:'-10012345',allowedChatUsername:'sumcoins'},knowledge:new Knowledge(),learning:new Learning(path.join(e.dir,'learn.json')),ai:new ConversationAI(),botUsername:'SumcoinHelperBot'});
 await handler({...common,from:{id:10},message_id:1,text:'/weekly'});assert.match(messages.at(-1),/weekly quality report/);
 await handler({...common,from:{id:11},message_id:2,text:'/weekly'});assert.match(messages.at(-1),/restricted/);
}finally{e.clean();}});

test('v014 after reaching API quota direct questions still receive reviewed answers with sources',async()=>{const e=fixture();try{
 let calls=0;const ai=new ConversationAI({apiKey:'mock',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({output_text:'The verified documents say you need a trading partner.'})};}});
 const replies=[],client={sendMessage:async(_m,s)=>{replies.push(s);return {message_id:50+replies.length};},getChatMember:async()=>({status:'member'})};
 const state=new State(path.join(e.dir,'state.json'),'reply');const bot=createHandler({client,state,config:{allowedChatId:'-10012345',allowedChatUsername:'sumcoins',aiDailyLimit:1,aiHourlyLimit:1,aiMonthlyLimit:1},knowledge:new Knowledge(),learning:new Learning(path.join(e.dir,'learning.json')),ai,botUsername:'SumcoinHelperBot'});
 const msg={chat:{id:-10012345,type:'supergroup',username:'sumcoins'},from:{id:50,language_code:'en'},date:Math.floor(Date.now()/1000)};
 await bot({...msg,message_id:1,text:'/ask How can I withdraw USD from Sumcoin wallet?'});
 await bot({...msg,message_id:2,text:'/ask How can I withdraw USD from Sumcoin wallet?'});
 assert.equal(calls,1);assert.equal(replies.length,2);
 assert.match(replies.at(-1),/Source:/);assert.doesNotMatch(replies.at(-1),/AI request unavailable/);
}finally{e.clean();}});

 test('v014 AI question redacts personal contact details before use',()=>{const s=safeQuestion('Please help me hello.person@example.com +1 208 555 1234 with Sumcoin wallet');assert.doesNotMatch(s,/hello\.person@|208 555 1234/);});
