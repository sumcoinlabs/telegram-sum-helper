import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { priceIntent } from '../src/intent.js';
import { isSupportMessage } from '../src/classify.js';
import { State } from '../src/state.js';
import { Knowledge } from '../src/knowledge.js';
import { Learning } from '../src/learning.js';
import { ConversationAI } from '../src/ai.js';
import { createHandler } from '../src/bot.js';
import { VERSION } from '../src/version.js';

test('v018 exact screenshot: plural and punctuation-free live price questions',()=>{
 assert.equal(VERSION,'0.0.18');
 for(const q of [
   'What’s Sumcoins price right now',
   "What's Sumcoins price right now",
   "What's Sumcoin price right now",
   'Whats SUM price right now',
   'What is the Sumcoin price now',
   'Sumcoins price in USD',
 ]){
   assert.ok(priceIntent(q),q);
   assert.equal(priceIntent(q).amount,1);
 }
 assert.equal(priceIntent('What’s Sumcoins price right now').currency,null);
 assert.equal(priceIntent('What’s sumcoin price in usd').currency,'USD');
 assert.equal(isSupportMessage('How do Sumcoins work?'),true);
 for(const q of ['The Sumcoin price is high today','I think Sumcoins price is high','Sumcoin prices can fluctuate','How is the Sumcoin index price calculated?'])assert.equal(priceIntent(q),null,q);
});

test('v018 ordinary members and admins get explicit prices; admin chatter remains silent',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v018-'));
 try {
  const messages=[],prices=[];
  let seq=50;
  const client={
   sendMessage:async(m,t)=>{messages.push({m,t});return {message_id:++seq};},
   getChatMember:async(_chat,id)=>({status:id===1?'creator':'member'})
  };
  const handler=createHandler({client,state:new State(path.join(dir,'state.json'),'reply'),
   config:{allowedChatUsername:'sumcoins',learningEnabled:false,autoAI:true,aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60,userCooldownHours:6,topicCooldownSeconds:120},
   botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),
   ai:new ConversationAI(),liveOps:{price:async opts=>{prices.push(opts);return `LIVE ${opts.currency} ${opts.amount}`;},tx:async()=>'',address:async()=>''}});
  let idx=0;
  const msg=(text,id=21,other={})=>({message_id:++idx,chat:{id:-1001,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id,language_code:'en'},text,...other});
  await handler(msg('What’s Sumcoins price right now',21));
  assert.equal(prices.length,1);
  assert.equal(prices[0].currency,'USD');
  assert.match(messages[0].t,/LIVE USD 1/);
  await handler(msg('What’s Sumcoins price right now',1));
  assert.equal(prices.length,2);
  assert.equal(prices[1].currency,'USD');
  await handler(msg('What’s Sumcoin price in EUR',1));
  assert.equal(prices.length,3);
  assert.equal(prices[2].currency,'EUR');
  await handler(msg('Sumcoin price in EUR',1)); // Admin announcement, no direct question.
  assert.equal(prices.length,3);
  await handler(msg('Is Sumcoin proof of stake?',1));
  assert.equal(messages.length,3); // Still suppress nonprice admin auto-replies.
  await handler(msg('What’s Sumcoins price right now',1,{sender_chat:{id:-1001}}));
  assert.equal(prices.length,3); // Anonymous administrator remains suppressed.
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('v018 Groq installer identifies itself instead of the rejected Python urllib user agent',()=>{
 const script=fs.readFileSync(new URL('../scripts/setup-groq.py',import.meta.url),'utf8');
 assert.match(script,/User-Agent.*SumcoinHelper\/0\.0\.18/);
});
