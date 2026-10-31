import test from 'node:test';import assert from 'node:assert/strict';
import {Knowledge,citationUrls} from '../src/knowledge.js';
const k=new Knowledge();
test('curated index has 15+ sourced topics',()=>{assert.ok(k.curated.length>=15);for(const a of k.curated){assert.ok(a.sources.length);assert.ok(a.text.length>=100);}});
test('Spanish cashout retrieval gets withdrawal facts',()=>{assert.equal(k.search('Como puedo retirar 100 dolares de mi wallet sumcoin?')[0].id,'cashout');});
test('queries distinguish recovery, missing balance, migration and price index',()=>{
 assert.equal(k.search('My wallet balance is zero where did SUM go?')[0].id,'missing-balance');
 assert.equal(k.search('I have an old Slice wallet can I migrate from BIP32?')[0].id,'legacy');
 assert.equal(k.search('How can I cancel a Sumcoin transaction?')[0].id,'irreversible');
});
test('unrelated topic has no official Sumcoin matches',()=>{assert.equal(k.search('Tell me about horses racing').length,0);});
test('citations only accept preapproved source domains',()=>{assert.deepEqual(citationUrls([{sources:['https://evil.com','https://github.com/sumcoinlabs/sumcoin']}]),['https://github.com/sumcoinlabs/sumcoin']);});
