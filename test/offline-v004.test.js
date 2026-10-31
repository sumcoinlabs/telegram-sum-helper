import test from 'node:test';
import assert from 'node:assert/strict';
import {Knowledge} from '../src/knowledge.js';
import {offlineAnswer,isContextualFollowup} from '../src/offline.js';
import {createHandler} from '../src/bot.js';
import {TelegramClient} from '../src/telegram.js';
import {detectLanguage} from '../src/languages.js';
import {State} from '../src/state.js';
import {Learning} from '../src/learning.js';
import {ConversationAI} from '../src/ai.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const k=new Knowledge();
function render(q,lang='en',expanded=false){return offlineAnswer({docs:k.search(q,{limit:12}),knowledge:k,lang,expanded});}

test('v0.0.4 English index answer uses multiple curated facts with sources',()=>{
  const a=render('How does Sumcoin calculate its value?');
  assert.match(a,/100 largest cryptocurrencies/i);
  assert.match(a,/peer-to-peer|directly/i);
  assert.match(a,/reference rate/i);
  assert.match(a,/https:\/\/www\.sumcoin\.org\/about\//);
  assert.ok(a.length>190);
  assert.ok(a.length<3401);
});
test('v0.0.4 Spanish bank withdrawal is native-language and makes no cash guarantee',()=>{
  const a=render('¿Cómo puedo retirar mis Sumcoin a una cuenta bancaria?','es');
  assert.match(a,/intercambiar SUM/i);assert.match(a,/referencia/i);
  assert.match(a,/otra persona|contraparte/i);
  assert.doesNotMatch(a,/The calculation tracks|Additional reviewed details/i);
});
test('v0.0.4 Portuguese index is genuinely localized without invented real sale price',()=>{
  assert.equal(detectLanguage('Como o valor do Sumcoin é calculado pelo índice?','en'),'pt');
  assert.equal(detectLanguage('Como se calcula o valor do índice do Sumcoin?','en'),'pt');
  assert.equal(detectLanguage('¿Cómo se calcula el valor del índice de Sumcoin?','en'),'es');
  const a=render('Como o valor do Sumcoin é calculado pelo índice?','pt');
  assert.match(a,/100 maiores criptomoedas/i);
  assert.match(a,/negociações diretas/i);
  assert.doesNotMatch(a,/The calculation tracks|EnglishDetail/i);
});
test('v0.0.4 detail includes more context and warns about PoW history',()=>{
  const a=render('How does Sumcoin staking work?','en');
  const b=render('How does Sumcoin staking work?','en',true);
  assert.ok(b.length>a.length);
  assert.match(b,/older mining software/i);
});
test('v0.0.4 synced text is only linked, never asserted as current facts',()=>{
  const fake={kind:'synced',title:'Historical proof of work paper',source:'https://www.sumcoinindex.com/white-paper.html',body:'Proof of work is the current Sumcoin consensus.',score:100};
  const a=offlineAnswer({docs:[k.find('staking'),fake],knowledge:k,lang:'en',expanded:true});
  assert.doesNotMatch(a,/Proof of work is the current Sumcoin consensus/i);
  assert.match(a,/https:\/\/www\.sumcoinindex\.com\/white-paper\.html/);
});
test('v0.0.4 no reviewed match means citations without unreviewed generated claims',()=>{
  const docs=[{kind:'synced',body:'Old mining makes SUM',source:'https://www.sumcoinindex.com/white-paper.html'}];
  const a=offlineAnswer({docs,knowledge:k,lang:'en'});
  assert.match(a,/cannot confirm an accurate short answer/);
  assert.doesNotMatch(a,/Old mining makes SUM/);
});
test('follow-up detection does not treat a new substantive topic as implicit continuation',()=>{
  assert.equal(isContextualFollowup('Can you explain that in more detail?'),true);
  assert.equal(isContextualFollowup('E isso, pode explicar?'),true);
  assert.equal(isContextualFollowup('What are the Sumcoin staking fees?'),false);
});
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sumv004-'));
 const state=new State(path.join(dir,'state.json'),'observe');
 const learning=new Learning(path.join(dir,'learning.json'));
 const sent=[];
 const client={sendMessage:async(m,txt)=>{sent.push({m,txt});return {message_id:sent.length}},getChatMember:async()=>({status:'administrator'})};
 const handler=createHandler({client,state,config:{allowedChatUsername:'sumcoins',learningEnabled:false,userCooldownHours:1,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:k,learning,ai:new ConversationAI()});
 const message=(id,txt,user=7)=>({message_id:id,chat:{id:-1001,type:'supergroup',username:'sumcoins'},date:Math.trunc(Date.now()/1000),from:{id:user,language_code:'en'},text:txt});
 return {handler,message,sent,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v0.0.4 /more expands a recent question immediately, even in observation mode',async()=>{
 const x=fixture();try{
   await x.handler(x.message(1,'/ask How does Sumcoin calculate its value?'));
   await x.handler(x.message(2,'/more'));
   assert.equal(x.sent.length,2);
   assert.ok(x.sent[1].txt.length>x.sent[0].txt.length);
   assert.match(x.sent[1].txt,/proof-of-stake/i);
 }finally{x.clean()}
});
test('v0.0.4 context follows a previous question but stays isolated by member',async()=>{
 const x=fixture();try{
   await x.handler(x.message(1,'/ask How does Sumcoin calculate its value?',7));
   await x.handler(x.message(2,'@SumcoinHelperBot Can you explain that in more detail?',7));
   assert.equal(x.sent.length,2);
   assert.match(x.sent[1].txt,/100 largest cryptocurrencies/i);
   await x.handler(x.message(3,'/more',8));
   assert.match(x.sent[2].txt,/Ask a Sumcoin question first/i);
 }finally{x.clean()}
});
test('v0.0.4 /more retains Spanish and Portuguese message language',async()=>{
 const x=fixture();try{
   await x.handler(x.message(1,'/ask ¿Cómo puedo retirar dólares de mi billetera Sumcoin?',7));
   await x.handler(x.message(2,'/more',7));
   assert.match(x.sent[1].txt,/SUM|dólares/i);
   assert.match(x.sent[1].txt,/Contexto relacionado/i);
   await x.handler(x.message(3,'/ask Como posso sacar dinheiro da minha carteira Sumcoin?',8));
   await x.handler(x.message(4,'/more',8));
   assert.match(x.sent.at(-1).txt,/carteira|saque/i);
   assert.match(x.sent.at(-1).txt,/Contexto relacionado/i);
 }finally{x.clean()}
});

test('v0.0.4 Portuguese free-text index question gets Portuguese response without language override',async()=>{
 const x=fixture();try{
   await x.handler(x.message(1,'/ask Como o valor do Sumcoin é calculado pelo índice?'));
   assert.match(x.sent[0].txt,/100 maiores criptomoedas/i);
   assert.match(x.sent[0].txt,/Fonte|Fontes/);
 }finally{x.clean()}
});

test('v0.0.4 command menus advertise /more in Portuguese and Spanish',async()=>{
  const calls=[];const client=new TelegramClient('123:test',{fetchImpl:async(_url,o)=>{calls.push(JSON.parse(o.body));return {ok:true,status:200,json:async()=>({ok:true,result:true})};}});
  await client.setMyCommands('pt');await client.setMyCommands('es');
  assert.ok(calls[0].commands.some(x=>x.command==='more'&&/Mais detalhes/.test(x.description)));
  assert.ok(calls[1].commands.some(x=>x.command==='more'&&/Más detalles/.test(x.description)));
});

test('v0.0.4 incidental mention in group announcement does not trigger a reply',async()=>{
  const x=fixture();try{
    await x.handler(x.message(1,'Everyone. Sumcoin AI Bot is now being implemented so you can ask @SumcoinHelperBot anything you want in your own language. Go ahead and try it using /help@SumcoinHelperBot.'));
    assert.equal(x.sent.length,0);
    await x.handler(x.message(2,'@SumcoinHelperBot Tell me about staking'));
    assert.equal(x.sent.length,1);
    assert.match(x.sent[0].txt,/stake|staking|proof-of-stake/i);
  }finally{x.clean()}
});

test('v0.0.4 in-sentence mention with explicit question still receives a reply',async()=>{
  const x=fixture();try{
    await x.handler(x.message(1,'Could @SumcoinHelperBot explain how Sumcoin calculates its value?'));
    assert.equal(x.sent.length,1);
    assert.match(x.sent[0].txt,/100 largest cryptocurrencies/i);
  }finally{x.clean()}
});
