import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {detectLanguage} from '../src/languages.js';
import {needsConversationalAnswer} from '../src/auto-ai.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {State} from '../src/state.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {VERSION} from '../src/version.js';

test('v017 version and French plain-text detection independent of Telegram language',()=>{
 assert.equal(VERSION,'0.0.22');
 assert.equal(detectLanguage("Explique-moi simplement comment fonctionne l'indice Sumcoin.",'en'),'fr');
 assert.equal(detectLanguage('Quelle est le prix d’un SUM en Euro ?','pt'),'fr');
 assert.equal(needsConversationalAnswer("Explique-moi simplement comment fonctionne l'indice Sumcoin."),true);
 assert.equal(needsConversationalAnswer('Explain how the Sumcoin index works and why it differs from an actual bid'),true);
 assert.equal(needsConversationalAnswer('Is Sumcoin proof of stake?'),false);
 assert.equal(needsConversationalAnswer('Sumcoin price in EUR'),false);
});

test('v017 Groq is automatic only for reviewed explanatory questions; /engine verifies it',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v017-'));
 try{
 const sent=[],state=new State(path.join(dir,'state.json'),'reply'),learning=new Learning(path.join(dir,'learning.json'));
 let aiCalls=0;
 const ai=new ConversationAI({apiKey:'FAKE',model:'openai/gpt-oss-120b',provider:'groq'});
 ai.answer=async({language})=>{aiCalls++;return {text:'LANG '+language+' verified explanation\nSource: https://sumcoin.org/',usedAI:true};};
 const client={sendMessage:async(m,t)=>{sent.push(t);return {message_id:101+sent.length};},getChatMember:async(chat,id)=>({status:id===1?'administrator':'member'})};
 const bot=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:true,learningEnabled:false,aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning,ai});
 let id=0;const msg=(text,user=21)=>({message_id:++id,chat:{id:-100321,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:user,language_code:'en'},text});
 await bot(msg('Explain how the Sumcoin index works and why it is not a guaranteed sale price'));
 assert.equal(aiCalls,1);assert.match(sent[0],/LANG en/);
 const admin=msg('/engine',1);admin.reply_to_message={message_id:102};
 await bot(admin);assert.match(sent.at(-1),/Groq AI/);
 await bot(msg("Explique-moi simplement comment fonctionne l'indice Sumcoin.",22));
 assert.equal(aiCalls,2);assert.match(sent.at(-1),/LANG fr/);
 assert.equal(state.data.outcomes[new Date().toISOString().slice(0,10)].ai,2);
 await bot(msg('What is the Sumcoin index?',23));assert.equal(aiCalls,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('v017 disabling automatic AI never calls model for a normal group question',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v017-off-'));try{
 const sent=[],state=new State(path.join(dir,'state.json'),'reply');
 let count=0;const ai=new ConversationAI({apiKey:'FAKE'});ai.answer=async()=>{count++;throw Error('unexpected');};
 const client={sendMessage:async(m,t)=>{sent.push(t);return {message_id:101};},getChatMember:async()=>({status:'member'})};
 const bot=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:false,learningEnabled:false},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),ai});
 await bot({message_id:1,chat:{id:-100321,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:31,language_code:'en'},text:'Explain how the Sumcoin index works'});
 assert.equal(count,0);assert.equal(sent.length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
