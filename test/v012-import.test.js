import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const importer=new URL('../scripts/learn-export.mjs',import.meta.url).pathname;
test('v012 STDIN Telegram export imports only redacted fingerprints without raw transcript',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-history-'));
 try{
  const content={messages:[
   {type:'message',text:'Is Sumcoin proof of stake?'},
   {type:'message',text:'How can I migrate my Sumcoin wallet safely?'},
   {type:'message',text:'Here are my seed words and recovery phrase, please help'},
   {type:'service',text:'A person joined the group'}
  ]};
  const res=spawnSync(process.execPath,[importer,'-'],{input:JSON.stringify(content),cwd:dir,encoding:'utf8'});
  assert.equal(res.status,0,res.stderr);
  assert.match(res.stdout,/recorded 2 safely filtered question patterns/);
  const saved=fs.readFileSync(path.join(dir,'data','learning.json'),'utf8');
  assert.doesNotMatch(saved,/proof of stake|migrate my Sumcoin|seed words|members|messages|telegram/i);
  const parsed=JSON.parse(saved);
  assert.equal(Object.keys(parsed.patterns).length,2);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
