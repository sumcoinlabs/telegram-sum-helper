import test from 'node:test';import assert from 'node:assert/strict';import os from 'node:os';import fs from 'node:fs';import path from 'node:path';
import {Learning,sanitizeQuestion} from '../src/learning.js';
const env=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sumlearn-'));return {dir,file:path.join(dir,'state.json'),clean:()=>fs.rmSync(dir,{recursive:true,force:true})};};
test('learning captures repeated safe question patterns and adapts a known topic',()=>{const e=env();try{
 const l=new Learning(e.file);const q='Is there a way I can get my Sumcoin dollars out?';for(let i=0;i<3;i++)l.observe(q,'cashout');assert.equal(l.learnedTopic(q),'cashout');assert.ok(!JSON.stringify(l.data).includes('user_id'));
}finally{e.clean()}});
test('learning excludes secrets, email and seed-related content',()=>{assert.equal(sanitizeQuestion('My seed phrase is apple dog xyz sumcoin help?'),null);assert.equal(sanitizeQuestion('Where is @example on https://evil.com ?'),null);});
test('human answer needs official source, admin approval and is persisted',()=>{const e=env();try{
 const l=new Learning(e.file);assert.equal(l.queue('How do I get more SUM?', 'Send money to me', 'https://evil.com'),null);
 const id=l.queue('How do I stake Sumcoin?', 'Staking is done using compatible Core software.', 'https://sumcoin.org/about/');assert.ok(id);assert.equal(l.data.approved.length,0);assert.equal(l.approve(id),true);
 assert.equal(new Learning(e.file).data.approved.length,1);
}finally{e.clean()}});
test('no approving an unreferenced admin reply',()=>{const e=env();try{const l=new Learning(e.file);const id=l.queue('How do I fix wallet sync?', 'Try checking network connectivity.','');assert.equal(l.approve(id),false);assert.equal(l.data.pending.length,1);}finally{e.clean()}});
