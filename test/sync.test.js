import test from 'node:test';import assert from 'node:assert/strict';import os from 'node:os';import fs from 'node:fs';import path from 'node:path';
import {sync,SOURCES,toText} from '../src/sync.js';
test('sync hardcodes approved official/GitHub targets and uses no redirects',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-sync-'));try{const urls=[];const result=await sync({out:path.join(dir,'sync.json'),fetchImpl:async(url,opts)=>{urls.push(url);assert.equal(opts.redirect,'error');return {ok:true,headers:{get:()=>null},text:async()=>'<html><style>junk</style><script>attack</script><p>Sumcoin official documentation '.repeat(8)+'</p></html>'};}});
 assert.equal(urls.length,SOURCES.length);assert.ok(result.documents>=SOURCES.length);const saved=JSON.parse(fs.readFileSync(path.join(dir,'sync.json'),'utf8'));assert.ok(!saved.documents[0].text.includes('attack'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('HTML sanitizer removes active tags and PHP blocks',()=>{assert.equal(toText('<script>attack()</script><p>Safe</p><?php system(1); ?>',true),'Safe');});
