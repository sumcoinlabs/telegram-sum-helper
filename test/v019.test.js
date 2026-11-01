import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { marketDiscoveryIntent, marketDiscoveryReply, SUMCOINPRICE } from '../src/market-discovery.js';
import { detectLanguage } from '../src/languages.js';
import { isOfficialSource } from '../src/learning.js';
import { citationUrls } from '../src/knowledge.js';
import { State } from '../src/state.js';
import { Knowledge } from '../src/knowledge.js';
import { Learning } from '../src/learning.js';
import { ConversationAI } from '../src/ai.js';
import { createHandler } from '../src/bot.js';
import { VERSION } from '../src/version.js';

test('v019 version, safe allowlist and nonfabricated official fixed endpoints',()=>{
  assert.equal(VERSION,'0.0.22');
  assert.equal(SUMCOINPRICE.website,'https://sumcoinprice.com/');
  assert.equal(SUMCOINPRICE.market,'https://sumcoinprice.com/market.php');
  assert.equal(SUMCOINPRICE.history,'https://sumcoinprice.com/api/history.php?range=1d');
  assert.equal(SUMCOINPRICE.btcHistory,'https://sumcoinprice.com/api/history.php?range=1d&pair=btc');
  for(const url of [SUMCOINPRICE.website,SUMCOINPRICE.market,SUMCOINPRICE.history,SUMCOINPRICE.btcHistory])assert.equal(isOfficialSource(url),true);
  for(const url of ['https://sumcoinprice.com.evil.io/','http://sumcoinprice.com/','https://evil.io@sumcoinprice.com/','https://sumcoinprice.com:444/','https://sumcoinprice.com/api/history.php?range=1d&pair=evil'])assert.equal(isOfficialSource(url),false,url);
  assert.deepEqual(citationUrls([{source:SUMCOINPRICE.website}]),[SUMCOINPRICE.website]);
  assert.deepEqual(citationUrls([{source:'https://sumcoinprice.com.evil.io'}]),[]);
  assert.match(marketDiscoveryReply('api','en'),/history.php\?range=1d&pair=btc/);
  assert.doesNotMatch(marketDiscoveryReply('chart','en'),/\$\d/);
});

test('v019 market discovery handles genuine requests, ignores live quotes and chatter',()=>{
  for(const [q,k] of [
    ['Show me Sumcoin price history','chart'],
    ['Where is the Sumcoin all-time high?','chart'],
    ['Can you show the SUM vs Bitcoin chart?','chart'],
    ['Show me SUM historical prices','chart'],
    ['Where can I see a Sumcoin chart?','chart'],
    ['What is the Sumcoin price API?','api'],
    ['Give me Sumcoin market data JSON API','api'],
    ['Show the SUM historical price API','api'],
    ['Sumcoin historical price api','api'],
    ['SumcoinPrice API','api'],
    ['Montre-moi un graphique historique de Sumcoin','chart'],
    ['Muéstrame el gráfico de Sumcoin','chart'],
    ['Mostra o histórico de preço do Sumcoin','chart'],
    ['Explique-moi les graphiques historiques de Sumcoin','chart']
  ])assert.equal(marketDiscoveryIntent(q),k,q);
  for(const q of ['What’s Sumcoins price right now','What is Sumcoin price in EUR?','What is the Sumcoin index formula?','Sumcoin chart looks great today','Hey everyone I added a Sumcoin chart','I saw the SUM price chart yesterday','Where is the Bitcoin price chart?','What is the market cap of Bitcoin?'])assert.equal(marketDiscoveryIntent(q),null,q);
  assert.equal(detectLanguage('Montre-moi le graphique de Sumcoin','en'),'fr');
});

test('v019 full bot: public commands, group chart routing, admin, Groq untouched, per-message source',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v019-'));
 try{
  const sent=[];let seq=100,groqCalls=0,priceCalls=0;
  const state=new State(path.join(dir,'state.json'),'reply');
  const client={sendMessage:async(m,text)=>{sent.push({m,text,id:++seq});return {message_id:seq};},getChatMember:async(_c,id)=>({status:id===1?'creator':'member'})};
  const ai=new ConversationAI({apiKey:'TEST_ONLY',provider:'groq'});
  ai.answer=async()=>{groqCalls++;return {text:'TEST GENERATED ANSWER',usedAI:true};};
  const handler=createHandler({client,state,config:{allowedChatUsername:'sumcoins',autoAI:true,learningEnabled:false,aiDailyLimit:12,aiHourlyLimit:4,aiMonthlyLimit:60,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(dir,'learning.json')),ai,
   liveOps:{price:async()=>{priceCalls++;return 'LIVE TEST RATE';},tx:async()=>'',address:async()=>''}});
  let id=0;
  const msg=(text,uid=7)=>({message_id:++id,chat:{id:-10013,username:'sumcoins',type:'supergroup'},date:Math.floor(Date.now()/1000),from:{id:uid,language_code:'en'},text});
  await handler(msg('/chart',1));assert.match(sent.at(-1).text,/https:\/\/sumcoinprice.com\//);
  await handler(msg('/priceapi',1));assert.match(sent.at(-1).text,/market.php/);assert.match(sent.at(-1).text,/history.php/);
  await handler(msg('/sources',1));assert.match(sent.at(-1).text,/sumcoinprice.com/);
  await handler(msg('Show me Sumcoin price history'));assert.match(sent.at(-1).text,/sumcoinprice\.com\/history\//);
  assert.equal(groqCalls,0);
  await handler(msg('Show me the Sumcoin price API',8));assert.match(sent.at(-1).text,/market.php/);
  await handler(msg('Montre-moi le graphique historique de Sumcoin',9));assert.match(sent.at(-1).text,/sumcoinprice\.com\/history\//);
  await handler(msg('Where can I see the Sumcoin price chart?',1));assert.match(sent.at(-1).text,/sumcoinprice\.com\/history\//); // explicit admin question
  const count=sent.length;
  await handler(msg('Sumcoin price chart looks great',1));assert.equal(sent.length,count);
  await handler(msg('What is Sumcoin price in USD?',8));assert.equal(priceCalls,1);assert.match(sent.at(-1).text,/LIVE TEST RATE/);
  assert.equal(groqCalls,0);
  const cmd=msg('/engine',1);cmd.reply_to_message={message_id:sent[count-1].id};await handler(cmd);assert.match(sent.at(-1).text,/verified local knowledge/);
  const before=state.data.aiRequests[new Date().toISOString().slice(0,10)]||0;assert.equal(before,0);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
