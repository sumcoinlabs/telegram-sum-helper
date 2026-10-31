import test from 'node:test';import assert from 'node:assert/strict';
import {githubSearch} from '../src/github.js';
test('GitHub live search queries fixed sumcoinlabs repos only and ranks relevant paths',async()=>{
 const visited=[];const found=await githubSearch('wallet restore',{fetchImpl:async url=>{visited.push(url);return {ok:true,json:async()=>({tree:[{type:'blob',path:'doc/wallet_restore.md'},{type:'blob',path:'src/peers.cpp'}]})};}});
 assert.equal(visited.length,7);assert.ok(visited.every(url=>url.startsWith('https://api.github.com/repos/sumcoinlabs/')));assert.ok(found.some(x=>x.path==='doc/wallet_restore.md'));
});
test('GitHub errors never produce arbitrary or non-official links',async()=>{const r=await githubSearch('someprivateunknownfeature',{fetchImpl:async()=>{throw Error('offline');}});assert.deepEqual(r,[]);});
