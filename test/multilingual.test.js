import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {classify,detectLanguage,isSupportMessage} from '../src/classify.js';
import {t,hasTranslation} from '../src/languages.js';
import {Knowledge} from '../src/knowledge.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import {createHandler} from '../src/bot.js';
import {containsSecret} from '../src/privacy.js';
const samples={
 es:'¿Cómo puedo retirar dólares de mi billetera Sumcoin?',
 pt:'Como posso sacar dinheiro da minha carteira Sumcoin?',
 fr:'Comment retirer de mon portefeuille Sumcoin ?',
 de:'Wie kann ich Geld aus der Sumcoin Brieftasche abheben?',
 it:'Come posso prelevare soldi dal portafoglio Sumcoin?',
 ru:'Как вывести деньги из кошелька Sumcoin?',
 ar:'كيف أسحب الأموال من محفظة Sumcoin؟',
 hi:'Sumcoin वॉलेट से पैसे कैसे निकालें?',
 zh:'如何从我的Sumcoin钱包提现美元？',
 ja:'Sumcoinウォレットからどうやって引き出す？',
 ko:'Sumcoin 지갑에서 달러 출금 어떻게 하나요?'
};
for(const [lang,q] of Object.entries(samples))test(`${lang} cashout question is routed to a localized, cited answer`,()=>{
 assert.equal(classify(q).topic,'cashout',q);assert.equal(detectLanguage(q),lang);
 assert.ok(hasTranslation(lang,'cashout'));assert.ok(t(lang,'cashout').length>45);
 assert.ok(new Knowledge().search(q)[0]?.id==='cashout',q);
});
test('message language supersedes a conflicting Telegram UI locale',()=>{
 assert.equal(detectLanguage(samples.es,'en'),'es');
 assert.equal(detectLanguage('How can I withdraw SUM from my wallet?','es'),'en');
 assert.equal(detectLanguage('wallet','pt'),'pt');
});
test('ordinary chat never causes a multilingual FAQ interruption',()=>{
 for(const s of ['Hola amigos, muchas gracias!', 'Привет как дела', 'I plan to sell some SUM next year.', 'Sumcoin は素晴らしいです', 'SUM é interessante']){
  assert.equal(classify(s).topic,null,s);
 }
});
test('security detects disclosed wallet recovery material in English and Spanish',()=>{
 assert.equal(containsSecret('My seed phrase is apple orange bread and so on'),true);
 assert.equal(containsSecret('Mi frase semilla es uno dos tres cuatro'),true);
 assert.equal(containsSecret('How do I protect my seed phrase?'),false);
});
test('new multilingual learning stores no raw question text by default',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multilearn-'));
 try{const l=new Learning(path.join(dir,'learn.json'));const q=samples.zh;
  for(let i=0;i<3;i++)assert.equal(l.observe(q,'cashout','zh'),true);
  assert.equal(l.learnedTopic(q),'cashout');assert.ok(!JSON.stringify(l.data).includes('如何从'));
  assert.equal(l.stats().includes('zh / cashout'),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
function fixture(mode='reply',ai=new ConversationAI()){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multibot-'));
 const state=new State(path.join(dir,'state.json'),mode),learning=new Learning(path.join(dir,'learn.json'));
 const knowledge=new Knowledge({learned:learning.data.approved});const sent=[];
 const client={sendMessage:async(m,text)=>{sent.push(text);return {message_id:sent.length};},getChatMember:async(_,id)=>({status:id===5?'administrator':'member'})};
 const config={allowedChatUsername:'sumcoins',allowedChatId:'',userCooldownHours:0,topicCooldownSeconds:0,learningEnabled:true,autoAI:false,allowPrivateChats:false,aiDailyLimit:2};
 const handler=createHandler({client,state,config,botUsername:'SumcoinHelperTestBot',knowledge,learning,ai});
 const message=(n,text,extra={})=>({message_id:n,date:Math.trunc(Date.now()/1000),text,chat:{type:'supergroup',id:-100100,username:'sumcoins'},from:{id:7,language_code:'en'},...extra});
 return {handler,message,sent,state,dir,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('Spanish member receives Spanish automatic cashout without English-only warning',async()=>{
 const f=fixture();try{await f.handler(f.message(1,samples.es));assert.equal(f.sent.length,1);assert.match(f.sent[0],/intercambiar SUM/i);assert.doesNotMatch(f.sent[0],/translate.*english/i);}finally{f.clean();}
});
test('per-user /language override applies and can be reset in memory',async()=>{
 const f=fixture();try{
  await f.handler(f.message(1,'/language pt'));
  await f.handler(f.message(2,'/cashout'));assert.match(f.sent.at(-1),/negociar SUM diretamente/);
  await f.handler(f.message(3,'/language auto'));
  await f.handler(f.message(4,'/cashout'));assert.match(f.sent.at(-1),/exchange SUM for fiat currency/);
 }finally{f.clean();}
});
test('observing multilingual questions makes no unsolicited replies',async()=>{
 const f=fixture('observe');try{await f.handler(f.message(1,samples.ru));assert.equal(f.sent.length,0);assert.equal(f.state.data.languages.ru,1);}finally{f.clean();}
});
test('explicit mention gets an answer even for non-question follow-up',async()=>{
 const f=fixture('observe');try{await f.handler(f.message(1,'@SumcoinHelperTestBot Why does Sumcoin use an index?'));
  assert.equal(f.sent.length,1);assert.match(f.sent[0],/Source:/);
 }finally{f.clean();}
});
test('feedback records bot message ID, never text or reporting member ID',async()=>{
 const f=fixture();try{
  await f.handler(f.message(1,'/feedback',{reply_to_message:{message_id:111,from:{is_bot:true,username:'SumcoinHelperTestBot'},text:'an answer'}}));
  assert.equal(f.state.data.feedback,1);assert.deepEqual(f.state.data.feedbackItems[0].messageId,111);
  await f.handler(f.message(2,'/feedbacks',{from:{id:5}}));assert.match(f.sent.at(-1),/#111/);
 }finally{f.clean();}
});
test('group authorization excludes private chats by default',async()=>{
 const f=fixture();try{await f.handler(f.message(1,'/ask Sumcoin cashout',{chat:{type:'private',id:123}}));assert.equal(f.sent.length,0);}finally{f.clean();}
});
test('daily AI request quota enforced for outbound model calls',async()=>{
 const f=fixture('observe',new ConversationAI({apiKey:'test-key',fetchImpl:async()=>({ok:true,json:async()=>({output_text:'I can only confirm the index value is not a USD balance.'})})}));
 try{
  for(let i=0;i<3;i++)await f.handler(f.message(i+1,'/ask How can I withdraw USD from Sumcoin wallet?',{from:{id:100+i,language_code:'en'}}));
  assert.equal(f.state.data.aiRequests[new Date().toISOString().slice(0,10)],2);
  assert.match(f.sent[2],/AI daily limit reached/);
 }finally{f.clean();}
});
