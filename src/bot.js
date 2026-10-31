import { classify, detectLanguage, isSupportMessage } from './classify.js';
import { citationUrls } from './knowledge.js';
import { githubSearch } from './github.js';
import { t, hasTranslation, normalizeLanguage, LANGUAGE_NAMES } from './languages.js';
import { containsSecret } from './privacy.js';
import { offlineAnswer,isContextualFollowup,isMoreRequest,reviewedFact } from './offline.js';
import { guideReply } from './guides.js';
import { livePrice,liveTransaction,liveAddress } from './live.js';
import {ui,preferredCurrency} from './locale-ui.js';
import {needsHumanReview,isDismissal,REVIEW_USERNAME} from './escalations.js';
import {supportUI} from './support-ui.js';
import {priceIntent,consensusIntent,consensusReply,isPoSConfirmation,consensusAnswerKind} from './intent.js';
import {VERSION} from './version.js';
import fs from 'node:fs';


// Prefer a narrow reviewed FAQ over a broad category for these very common
// historical group questions. This routes to existing *approved* text only.
// It does not create knowledge from a group message or override live price/PoS.
export function specificFAQTopic(question){
  const q=String(question||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const subject=/(?:\bsumcoin\b|\bsum\b|\bslice\b)/i.test(q);
  if(!subject)return null;
  if(/(?:\bstak(?:e|ing)\b|\bmint(?:ing)?\b)/i.test(q)&&/(?:\bmobile\b|\bphone\b|\bandroid\b|\bios\b|\biphone\b|\bapp\b)/i.test(q))return 'staking-mobile';
  if(/(?:\bcore\b|\bstaking\b)/i.test(q)&&/(?:not staking|staking not working|won.t stake|can.t stake|not minting|no rewards)/i.test(q))return 'staking-check';
  if(/(?:\bindex\b|\breference\b|\bquote\b|\bprice\b|\brate\b)/i.test(q)&&/(?:\bcan.t sell\b|\bcannot sell\b|\bnot sell\b|\bno buyer\b|\bguarantee\b|\bredeem\b|\bliquidity\b|\bwho buys\b)/i.test(q))return 'index-vs-liquidity';
  if(/(?:\bslice\b|\bold wallet\b|\blegacy wallet\b)/i.test(q)&&/(?:\bzero\b|\bmissing\b|\bdisappear\b|\bdifferent\b|\bwrong\b|\bnot show\b)/i.test(q)&&/(?:\bbalance\b|\bwallet\b|\baddress\b|\bcoin\b)/i.test(q))return 'wallet-network-mismatch';
  if(/(?:\bmigrat|\bswap\b)/i.test(q)&&/(?:\bfee\b|\bcost\b|\bcharge\b|\bpay\b|\bdeduct\b|\bpercent\b|\bprice\b)/i.test(q))return 'migration-payment';
  return null;
}

export function isCurrentPriceQuestion(q){
  const text=String(q||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC');
  if(!/(?:sumcoin|\bsum\b)/u.test(text))return false;
  const when=/(?:\bcurrent\b|\bright now\b|\btoday\b|\blive\b|\bnow\b|\batual\b|\bagora\b|\bhoje\b|\bactual\b|\bhoy\b|\baujourd\b|\bmaintenant\b|\bactuel\b|\bheute\b|\baktuell\b|\bjetzt\b|\boggi\b|\badesso\b|\battuale\b|\bbugun\b|\bsimdi\b|\bguncel\b|\bsekarang\b|\bterkini\b|hari ini|сегодня|сейчас|текущ|اليوم|الان|الحالي|आज|अभी|वर्तमान|现在|今天|今日|实时|目前|現在|今|지금|오늘|현재)/u;
  const price=/(?:\bprice\b|\brate\b|\bvalue\b|\bvalor\b|\bpreco\b|\bprecio\b|\bcotacao\b|\btaxa\b|\bprix\b|\bcours\b|\bvaleur\b|\bpreis\b|\bkurs\b|\bwert\b|\bprezzo\b|\btasso\b|\bfiyat\b|\bdeger\b|\bharga\b|\bnilai\b|\bindeks\b|цена|курс|стоимость|سعر|قيمة|कीमत|मूल्य|दर|价格|汇率|价值|価格|レート|가격|시세)/u;
  const calculation=/(?:\bhow\b|\bcomo\b|\bcomment\b|\bwie\b|\bcome\b).*?(?:\bcalculat|\bformula\b|\bindice\b|\bindex\b|\bindeks\b)|рассчитыв|расчет|كيفية حساب|كيف.*حساب|कैसे.*गणना|如何.*计算|怎么.*计算|計算|어떻게.*계산|nasıl.*hesap|bagaimana.*hitung/u;
  return when.test(text)&&price.test(text)&&!calculation.test(text);
}
const COMMAND_TOPICS={cashout:'cashout',wallet:'wallet',staking:'staking',security:'security',migration:'legacy',index:'index',fees:'fees'};
const HELP=`Sumcoin Helper v${VERSION} — multilingual, source-grounded Sumcoin support.\n\n/ask your question — source-grounded answer in your language\n/more — more detail on your last question (30-minute context)\n/guide zero|restore|pending|staking|connect|migration|fees|trade — step-by-step help\n/price [USD|EUR|BRL|...] — live peer-to-peer reference rate
/currency CODE|auto — save preferred display currency (24h)\n/tx TXID — read-only transaction status\n/address PUBLIC_ADDRESS — public address history (visible in group)\n/language CODE — choose response language; /language auto resets (24h in memory)\n/find words — search approved docs\n/github words — search allowlisted official GitHub files\n/sources — official reference URLs\n/cashout /wallet /migration /staking /security /index /fees\n/feedback — report an inaccurate answer (aggregated)\n/stop — pause automatic help for 24 hours; /resume — turn it on again\n\nGroup admins: /mode observe|reply, /stats, /feedbacks, /learn, /review, /teach QUESTION | ANSWER | OFFICIAL_URL, /approve NUMBER, /reject NUMBER, /chatid, /queue\n\nQuestions in your language are welcome. Keep wallet recovery words private. Admin commands remain English.`;
export function commandFrom(text,botUsername=''){
  const m=/^\/([a-z_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(String(text||'').trim());
  if(!m||(m[2]&&m[2].toLowerCase()!==botUsername.toLowerCase()))return null;
  return {name:m[1].toLowerCase(),arg:(m[3]||'').trim()};
}
export function inAllowedGroup(chat,config){
  if(!chat||!['group','supergroup'].includes(chat.type))return false;
  const byId=config.allowedChatId&&String(chat.id)===String(config.allowedChatId);
  const byName=config.allowedChatUsername&&chat.username?.toLowerCase()===config.allowedChatUsername.toLowerCase();
  return Boolean(byId||byName);
}
// A bot mentioned in a group announcement is not necessarily being asked for help.
// Answer direct @bot requests (including statements) and clearly directed questions,
// while ignoring plain FYI posts containing an incidental @mention.
export function isDirectedMention(text,botUsername){
  if(!botUsername)return false;
  const escaped=botUsername.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const mention=new RegExp('(?:^|\\s)@'+escaped+'\\b','i');
  if(!mention.test(String(text||'')))return false;
  const start=new RegExp('^\\s*(?:(?:hey|hi|hello|hola|olá)[!,.\\s]+)?@'+escaped+'\\b','i');
  return start.test(text)||/[?¿؟？]/u.test(text);
}
export function createHandler({client,state,config,botUsername,knowledge,learning,ai,escalations=null,groupIndex=null,liveOps={price:livePrice,tx:liveTransaction,address:liveAddress}}){
  const preferences=new Map(),currencyPreferences=new Map(),seenReplies=new Map(),topicHistory=new Map(),answeredMessages=new Map(),mutedMembers=new Map(),adminCache=new Map();
  const now=()=>Date.now();
  async function send(m,text){return client.sendMessage(m,String(text).slice(0,3500));}
  async function admin(m,fresh=false,uncertainIsAdmin=true){if(!m.from?.id||!inAllowedGroup(m.chat,config))return false;
    const key=`${m.chat.id}:${m.from.id}`,cached=adminCache.get(key);
    if(!fresh&&cached&&cached.until>now())return cached.value;
    try{
      const isAdmin=['administrator','creator'].includes((await client.getChatMember(m.chat.id,m.from.id))?.status);
      adminCache.set(key,{value:isAdmin,until:now()+10_000});return isAdmin;
    }catch{return uncertainIsAdmin;} // Suppress auto-replies on API failure; never authorize admin commands.
  }
  async function verifiedGroupAdmin(m){
    if(!m.from?.id||!inAllowedGroup(m.chat,config))return false;
    // Non-admin developers can only contribute candidates when their numeric
    // Telegram ID was explicitly configured by the owner. Not a group-admin grant.
    if(Array.isArray(config.trustedDeveloperIds)&&config.trustedDeveloperIds.includes(m.from.id))return true;
    try{return ['administrator','creator'].includes((await client.getChatMember(m.chat.id,m.from.id))?.status);}catch{return false;}
  }
  async function reviewer(m){
    if(m.from?.username?.toLowerCase()!==REVIEW_USERNAME.toLowerCase()||!m.from?.id)return false;
    const groupId=config.allowedChatId||`@${config.allowedChatUsername}`;
    try{return ['administrator','creator'].includes((await client.getChatMember(groupId,m.from.id))?.status);}catch{return false;}
  }
  function isMuted(m){const key=`${m.chat.id}:${m.from?.id||0}`;return (mutedMembers.get(key)||0)>now();}
  function setMuted(m,enabled){const key=`${m.chat.id}:${m.from?.id||0}`;if(enabled)mutedMembers.set(key,now()+24*3600_000);else mutedMembers.delete(key);if(mutedMembers.size>500)for(const [k,t] of mutedMembers)if(t<now())mutedMembers.delete(k);}
  const sender=m=>({chat:{id:m.chatId},message_id:m.messageId});
  async function notifyUnanswered(item){
    if(!escalations?.data.adminId||!client.sendDirect||item.notified)return;
    // A saved numeric ID is not enough: reverify admin membership before private delivery.
    try {const reviewer=await client.getChatMember(config.allowedChatId||`@${config.allowedChatUsername}`,escalations.data.adminId);
      if(!['administrator','creator'].includes(reviewer?.status))return;
      if(reviewer.user?.username&&reviewer.user.username.toLowerCase()!==REVIEW_USERNAME.toLowerCase())return;
    } catch {return;}
    const msg=`Sumcoin Helper needs @${REVIEW_USERNAME} (question #${item.id})\n\n${item.question}\n\nReply here with:\n/answer ${item.id} | verified answer | https://sumcoin.org/official-source\n\nOr /skip ${item.id}. No member ID or recovery data is included.`;
    try{await client.sendDirect(escalations.data.adminId,msg);escalations.markNotified(item.id);}catch(e){console.warn('Admin review DM unavailable:',e.message);}
  }
  async function tick(){
    knowledge.refreshExternal?.();
    if(!escalations)return;
    for(const item of escalations.pending().filter(x=>!x.notified).slice(0,5))await notifyUnanswered(item);
    for(const item of escalations.due()){
      // Twenty-minute fallback: offer only matching reviewed information, never invent answers.
      const docs=knowledge.search(item.question,{limit:5});
      const first=docs.find(x=>x.kind==='curated'||x.kind==='admin-approved');
      const supported=first&&first.score>=15&&first.coverage>=0.25&&!needsHumanReview(item.question);
      const lang=item.lang;
      const intro=supportUI(lang,'waiting');
      const info=supported?`\n\n${supportUI(lang,'related')}: ${String(reviewedFact(first,lang)||first.body||'').slice(0,600)}\n${citationUrls([first],1)[0]||'https://sumcoin.org/'}`:`\n\n${supportUI(lang,'official')}: https://sumcoin.org/`;
      const ending=`\n\n@${REVIEW_USERNAME} — review pending.`;
      try{await client.sendMessage(sender(item),intro+info+ending);escalations.mark(item.id,'fallback');}catch(e){console.error('Delayed support reply failed:',e.message);}
    }
  }

  function languageFor(m,q){
    const key=String(m.from?.id||'');const pref=preferences.get(key);
    if(pref && pref.until<=now())preferences.delete(key);
    if(pref?.until>now())return pref.code;
    return detectLanguage(q||'',m.from?.language_code||'en');
  }
  function currencyFor(m,lang,override=''){
    if(override)return override;
    const key=String(m.from?.id||m.sender_chat?.id||'');
    const pref=currencyPreferences.get(key);
    if(pref&&pref.until>now())return pref.code;
    if(pref)currencyPreferences.delete(key);
    return preferredCurrency(lang,m.from?.language_code||'');
  }
  function priceOptions(m,lang,override=''){
    const pref=currencyPreferences.get(String(m.from?.id||m.sender_chat?.id||''));
    return {lang,currency:currencyFor(m,lang,override),locale:m.from?.language_code||'',
      fallbackToUsd:!override&&!(pref?.until>now())};
  }
  function article(id,lang){
    const a=knowledge.find(id);if(!a)return t(lang,'none');
    const body=reviewedFact(a,lang)||`${t(lang,'englishDetail')}\n${a.body}`;
    return `${body}\n\n${t(lang,'source')}: ${citationUrls([a],1)[0]||'https://sumcoin.org/'}`;
  }
  // Remember only a curated topic ID, never message text or wallet details.
  // 30-minute user+chat scope, lost on restart and bounded to 500 records.
  function recentTopic(m){
    const key=`${m.chat.id}:${m.from?.id||m.sender_chat?.id||0}`;
    const entry=topicHistory.get(key);
    if(!entry||entry.until<=now()){topicHistory.delete(key);return null;}
    return entry;
  }
  function rememberTopic(m,id,lang){
    if(!id)return;
    const key=`${m.chat.id}:${m.from?.id||m.sender_chat?.id||0}`;
    topicHistory.set(key,{id,lang,until:now()+30*60_000,autoUntil:now()+5*60_000});
    if(topicHistory.size>500){
      for(const [k,v] of topicHistory)if(v.until<=now())topicHistory.delete(k);
      while(topicHistory.size>500)topicHistory.delete(topicHistory.keys().next().value);
    }
  }
  // Track topics only after Telegram confirms delivery. Public bot replies are
  // scoped by chat+message ID, so someone replying to a different bot answer
  // gets the correct context without sharing anyone's private conversation.
  async function sendTopic(m,text,id,lang){
    const result=await send(m,text);
    if(id&&knowledge.find(id)){
      rememberTopic(m,id,lang);
      if(Number.isSafeInteger(result?.message_id)){
        const key=`${m.chat.id}:${result.message_id}`;
        answeredMessages.set(key,{id,lang,until:now()+30*60_000});
        if(answeredMessages.size>500){
          for(const [k,v] of answeredMessages)if(v.until<=now())answeredMessages.delete(k);
          while(answeredMessages.size>500)answeredMessages.delete(answeredMessages.keys().next().value);
        }
      }
    }
    return result;
  }
  function repliedTopic(m){
    const id=m.reply_to_message?.message_id;
    if(!Number.isSafeInteger(id))return null;
    const key=`${m.chat.id}:${id}`,entry=answeredMessages.get(key);
    if(!entry||entry.until<=now()){answeredMessages.delete(key);return null;}
    return entry;
  }
  function offline(docs,lang,expanded=false){
    return offlineAnswer({docs,knowledge,lang,expanded});
  }
  const CHAT_LIMIT=Math.max(1,Number(config.aiDailyLimit)||100);
  async function ask(m,q,{automatic=false,expanded=false,contextTopic=null,contextLanguage=null}={}){
    let lang=languageFor(m,q);
    if(!q||q.length>1000)return automatic?undefined:send(m,t(lang,'need'));
    if(containsSecret(q))return automatic?undefined:send(m,t(lang,'security'));
    if(automatic&&state.data.mode!=='reply')return;
    const key=`${m.chat.id}:${m.from?.id||m.sender_chat?.id||0}`;
    const prior=recentTopic(m);
    const chosenPrior=contextTopic&&knowledge.find(contextTopic)?{id:contextTopic,lang:contextLanguage||lang}:prior;
    // A generic follow-up about 'that' uses the previous verified topic.
    // A new explicit topic (e.g. fees) takes priority over context.
    const detected=specificFAQTopic(q)||classify(q).topic||(/\b(?:transaction|network)\s+fees?\b|^fees?\?*$/i.test(q)?'fees':null);
    const contextId=!detected&&chosenPrior&&isContextualFollowup(q)?chosenPrior.id:null;
    const pref=preferences.get(String(m.from?.id||''));
    if((contextId||expanded)&&chosenPrior?.lang&&!(pref?.until>now()))lang=chosenPrior.lang;
    if(!state.shouldReply(m,automatic?'auto-ai':`${expanded?'ask-user-more':contextId?'ask-user-context':'ask-user'}:${m.from?.id||'unknown'}`,automatic?config.userCooldownHours:0,automatic?config.topicCooldownSeconds:0))return;
    const pricing=priceIntent(q);
    if(pricing)return sendTopic(m,await liveOps.price({...priceOptions(m,lang,pricing.currency||''),amount:pricing.amount}),'index-live',lang);
    if(consensusIntent(q))return sendTopic(m,consensusReply(lang,q),'chain',lang);
    const retrievalQuery=ai.apiKey?ai.retrievalQuestion(key,q):q;
    const docs=knowledge.search(contextId?knowledge.find(contextId)?.title||q:retrievalQuery,{limit:12});
    if(escalations&&!automatic&&inAllowedGroup(m.chat,config)&&!await admin(m)&&
       (needsHumanReview(q)||(!contextId&&!docs.some(d=>(d.kind==='curated'||d.kind==='admin-approved')&&d.score>=12&&d.coverage>=0.25)))){
      const item=escalations.enqueue(m,q,lang);
      if(item){await notifyUnanswered(item);return send(m,supportUI(lang,'queued'));}
    }
    // A directly classified fee question must not be answered with a generic
    // transaction-pending FAQ just because it shares the word 'transaction'.
    if(!contextId&&detected==='fees'){
      const exact=knowledge.find('fees');
      if(exact){const i=docs.findIndex(d=>d.id==='fees');if(i>=0)docs.splice(i,1);docs.unshift(exact);}
    }
    if(contextId){
      const related=knowledge.find(contextId);
      if(related){const i=docs.findIndex(d=>d.id===contextId);if(i>=0)docs.splice(i,1);docs.unshift(related);}
    }
    const specific=detected&&knowledge.find(detected);
    if(specific&&!contextId&&specificFAQTopic(q)){
      const i=docs.findIndex(d=>d.id===specific.id);if(i>=0)docs.splice(i,1);
      docs.unshift(specific);
    }
    const primary=docs.find(d=>d.kind==='curated'||d.kind==='admin-approved');
    if(!docs.length)return automatic?undefined:send(m,t(lang,'none'));
    if(!ai.apiKey)return sendTopic(m,offline(docs,lang,expanded),contextId||primary?.id,lang);
    if(!state.consumeAiQuota(CHAT_LIMIT))return sendTopic(m,offline(docs,lang,expanded)+'\n\n(AI daily limit reached.)',contextId||primary?.id,lang);
    try{
      // Never send unreviewed podcast, news, social or scraped GitHub text
      // into the generative model as authority or executable instructions.
      const reviewedContext=docs.filter(d=>d.kind==='curated'||d.kind==='admin-approved');
      if(!reviewedContext.length)return sendTopic(m,offline(docs,lang,expanded),contextId||primary?.id,lang);
      const answer=await ai.answer({question:q,context:reviewedContext,historyKey:key,language:lang});
      await sendTopic(m,answer.text,contextId||primary?.id,lang);state.record('answered-ai',true);
    }catch(err){console.error('AI unavailable:',err.message);
      return sendTopic(m,`${t(lang,'temporarily')}\n\n${article(docs[0].id,lang)}`,contextId||primary?.id,lang);}
  }
  const handle=async function handle(m){
    if(!m?.chat||!m.text||m.from?.is_bot)return;
    const group=inAllowedGroup(m.chat,config),dm=m.chat.type==='private';
    if(dm && commandFrom(m.text,botUsername)?.name==='start' && m.from?.username?.toLowerCase()===REVIEW_USERNAME.toLowerCase()){
      if(!escalations||!await reviewer(m))return send(m,'Review setup requires the @SumcoinAdmin account to be an administrator in @sumcoins.');
      escalations.register(m.from);
      await send(m,`Review notifications are enabled for @${REVIEW_USERNAME}. Use /review to see the queue and /answer ID | ANSWER | OFFICIAL_URL to teach the bot.`);
      for(const item of escalations.pending().filter(x=>!x.notified).slice(0,5))await notifyUnanswered(item);
      return;
    }
    if(dm&&escalations&&await reviewer(m)&&escalations.isRegistered(m.from)){
      const c=commandFrom(m.text,botUsername);if(!c)return;
      if(c.name==='review')return send(m,escalations.pending().map(x=>`#${x.id}: ${x.question} (${x.status})`).join('\n\n')||'No unanswered questions.');
      if(c.name==='drafts')return send(m,learning.review());
      if(c.name==='source'){
        const match=c.arg.match(/^(\d+)\s*\|\s*(https:\/\/\S+)$/);
        return send(m,match&&learning.setSource(Number(match[1]),match[2])?'Source attached. Verify with /drafts, then /approve ID.':'Usage: /source ID | https://sumcoin.org/official-page');
      }
      if(c.name==='approve'){
        const ok=learning.approve(Number(c.arg));if(ok)knowledge.learned=learning.data.approved;
        return send(m,ok?'Verified knowledge approved.':'Not approved: add a valid official source with /source ID | URL.');
      }
      if(c.name==='reject')return send(m,learning.reject(Number(c.arg))?'Draft rejected.':'Draft ID not found.');
      if(c.name==='skip')return send(m,escalations.mark(Number(c.arg),'closed')?`Review #${c.arg} closed.`:'Review ID not found.');
      if(c.name==='answer'){
        const parts=c.arg.split('|').map(x=>x.trim());
        if(parts.length!==3||!/^\d+$/.test(parts[0]))return send(m,'Usage: /answer ID | verified answer | https://sumcoin.org/official-source');
        const item=escalations.get(parts[0]);if(!item||item.status==='closed')return send(m,'Question not found or already closed.');
        const id=learning.queue(item.question,parts[1],parts[2],'admin-escalation');
        if(!id||!learning.approve(id))return send(m,'Answer rejected. Supply a safe, sourced answer from an approved official domain.');
        knowledge.learned=learning.data.approved;
        const approved=learning.data.approved.find(x=>x.id===id);
        try{await client.sendMessage(sender(item),`${approved.text}\n\nSource: ${parts[2]}`);}catch(e){console.error('Approved answer group delivery failed:',e.message);return send(m,`Approved knowledge #${id}, but delivery failed. Check the group.`);}
        escalations.mark(item.id,'closed');return send(m,`Approved and answered question #${item.id}. Future matching questions can use the reviewed answer.`);
      }
      if(c.name==='start'||c.name==='help')return send(m,'Admin review: /review for unanswered questions; /drafts for group admin answers; /source ID | URL; /approve ID; /reject ID; /answer ID | answer | URL.');
      return;
    }
    if(!group&&!(dm&&config.allowPrivateChats))return;
    if(m.date&&now()/1000-m.date>900)return;
    const command=commandFrom(m.text,botUsername);
    const lang=languageFor(m,command?.arg||m.text);
    if(group&&!command&&groupIndex&&config.groupIndexEnabled!==false){
      // Track relevant public discussion even while bot answers are disabled (observe).
      // This NEVER uses untrusted group content as verified knowledge.
      const verified=await verifiedGroupAdmin(m);
      groupIndex.observe(m,{administrator:verified,language:lang});
      const candidate=verified?groupIndex.candidate(m):null;
      if(candidate && candidate.answer.length>=18 && candidate.answer.length<=1200){
        // A moderator response (including later clarifications) is a draft.
        // It must be explicitly approved with an official source.
        learning.queue(candidate.question,candidate.answer,candidate.source,'group-admin-draft');
      }
    }
    if(command){
      const name=command.name,arg=command.arg;
      if(['start','help'].includes(name))return send(m,`${ui(lang,'help')}

/ask <question>
/more
/guide zero|restore|pending|staking|connect|migration|fees|trade
/price [USD|EUR|BRL|...]
/currency CODE|auto
/language CODE|auto
/tx TXID
/address PUBLIC_ADDRESS
/find <keywords>
/github <keywords>
/sources
/feedback
/privacy | /forget (reply to your own message)
/podcast keywords | /news
/stop | /resume

${ui(lang,'safety')}`);
      if(['lang','language'].includes(name)){
        if(!arg)return send(m,`Your current reply language: ${LANGUAGE_NAMES[lang]||lang}. Choose /language en, es, pt, fr, de, it, ru, ar, hi, zh, ja, ko, tr or id; /language auto to reset.`);
        if(arg.toLowerCase()==='auto'){preferences.delete(String(m.from?.id||''));return send(m,'Automatic language detection enabled.');}
        const code=arg.toLowerCase();if(!Object.hasOwn(LANGUAGE_NAMES,code))return send(m,'Unsupported language code. Use /language for choices.');
        preferences.set(String(m.from?.id||''),{code,until:now()+24*3600000});return send(m,`Reply language: ${LANGUAGE_NAMES[code]}. Expires in 24 hours; not written to disk.`);
      }
      if(name==='currency'){
        const key=String(m.from?.id||m.sender_chat?.id||'');
        const code=arg.trim().toUpperCase();
        if(!code)return send(m,`${ui(lang,'selected')}: ${currencyFor(m,lang)}\n${ui(lang,'usage')}`);
        if(code==='AUTO'){currencyPreferences.delete(key);return send(m,ui(lang,'reset'));}
        if(!/^[A-Z]{3}$/.test(code))return send(m,ui(lang,'unsupported'));
        currencyPreferences.set(key,{code,until:now()+24*3600000});
        return send(m,`${ui(lang,'selected')}: ${code}\n${ui(lang,'usage')}`);
      }
      if(name==='guide')return send(m,guideReply(arg.toLowerCase().trim(),lang));
      if(name==='price'){
        const override=arg.trim().toUpperCase();
        if(override&&!/^[A-Z]{3}$/.test(override))return send(m,ui(lang,'unsupported'));
        return send(m,await liveOps.price(priceOptions(m,lang,override)));
      }
      if(name==='tx'){
        if(containsSecret(arg))return send(m,t(lang,'security'));
        if(!/^[a-f0-9]{64}$/i.test(arg))return send(m,await liveOps.tx(arg,{lang}));
        if(!state.shouldReply(m,`live-tx:${m.from?.id||'unknown'}`,0,18))return;
        return send(m,await liveOps.tx(arg,{lang}));
      }
      if(name==='address'){
        if(containsSecret(arg))return send(m,t(lang,'security'));
        if(!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{26,62}$/.test(arg))return send(m,await liveOps.address(arg,{lang}));
        if(!state.shouldReply(m,`live-address:${m.from?.id||'unknown'}`,0,20))return;
        return send(m,await liveOps.address(arg,{lang}));
      }
      if(name==='stop'){if(!group)return;setMuted(m,true);return send(m,supportUI(lang,'muted'));}
      if(name==='resume'){if(!group)return;setMuted(m,false);return send(m,supportUI(lang,'resumed'));}
      if(name==='privacy')return send(m,'This group helper privately indexes relevant new public group text for up to 90 days on the Sumcoin server, without member account IDs or names. An authorized historical Telegram export may also be reduced to anonymized one-way question-pattern fingerprints (maximum 1,000, without original message text or sender identities); these persist until removed by the operator. Seed phrases and obvious personal details are filtered, but no filter is perfect. Admin answers are drafts until reviewed. Reply to your own message with /forget to remove its saved group excerpt. /stop pauses automatic replies.');
      if(name==='forget'){
        const own=m.reply_to_message?.from?.id&&m.from?.id===m.reply_to_message?.from?.id;
        if(!group||!own||!groupIndex)return send(m,'Reply to one of your own group messages with /forget to delete its saved excerpt.');
        return send(m,groupIndex.forget(m.reply_to_message.message_id)?'Saved excerpt removed.':'No saved excerpt found.');
      }
      if(name==='podcast'){
        const query=arg.trim();if(!query)return send(m,'Usage: /podcast what was said about staking?');
        const docs=knowledge.transcriptSearch(query,3);
        return send(m,docs.length?docs.map(d=>`${d.title}\nTranscript excerpt (not a verified current rule): ${d.body.slice(0,450)}\n${d.source.startsWith('https://')?d.source:'Source: user-provided transcript'}`).join('\n\n'):'No matching transcript excerpts found.');
      }
      if(name==='news'){
        const docs=knowledge.documents().filter(d=>d.kind==='news').slice(0,6);
        return send(m,docs.length?docs.map(d=>`${d.title}${d.stale?' (cached; source unavailable at last refresh)':''}\n${d.source}`).join('\n\n'):'No news metadata synced yet.');
      }
      if(name==='queue'&&group&&await admin(m))return send(m,escalations?.stats()||'Review queue not configured.');
      if(name==='sources')return send(m,'Official references: https://sumcoin.org/ | https://sumcoinwallet.org/ | https://github.com/sumcoinlabs/sumcoin | https://github.com/sumcoinlabs/sumcoin_flutter\n/find searches cached official documents, not arbitrary websites.');
      if(name==='rules')return send(m,'Questions in your own language are welcome. Please keep discussion civil, never share recovery words or private keys, and avoid unsolicited financial offers. Official announcements may remain in English.');
      if(COMMAND_TOPICS[name])return send(m,article(COMMAND_TOPICS[name],lang));
      if(name==='github'){
        if(!arg)return send(m,'Usage: /github search keywords');
        if(!state.shouldReply(m,'github',0,25))return;
        const matches=await githubSearch(arg);
        return send(m,matches.length?matches.map((x,i)=>`${i+1}. ${x.repo}/${x.path}\n${x.url}`).join('\n\n'):'No relevant public paths found in approved repositories. Search might be rate-limited.');
      }
      if(name==='find'){
        if(!arg)return send(m,'Usage: /find search keywords');
        const docs=knowledge.search(arg,{limit:3});if(!docs.length)return send(m,t(lang,'none'));
        return send(m,docs.map((d,i)=>`${i+1}. ${d.title}\n${hasTranslation(lang,d.id)?t(lang,d.id):d.body.slice(0,260)+'…'}\n${citationUrls([d],1)[0]||''}`).join('\n\n'));
      }
      if(name==='ask')return ask(m,arg);
      if(name==='more'){
        const prior=recentTopic(m);
        if(!arg&&!prior)return send(m,'Ask a Sumcoin question first with /ask, then use /more for more details.');
        return ask(m,arg||'Explain that in more detail',{expanded:true});
      }
      if(name==='feedback'){
        if(!group)return send(m,'Use /feedback inside the authorized group.');
        if(!m.reply_to_message?.from?.is_bot||m.reply_to_message.from.username?.toLowerCase()!==botUsername.toLowerCase())return send(m,'Reply to a bot answer with /feedback to flag it for admin review.');
        const key=`${m.chat.id}:${m.from?.id||0}:feedback:${m.reply_to_message.message_id}`;
        if(seenReplies.has(key))return;
        seenReplies.set(key,now()+86400000);if(seenReplies.size>1500)for(const [k,v] of seenReplies)if(v<now())seenReplies.delete(k);
        state.addFeedback(Number(m.reply_to_message.message_id));return send(m,'Feedback saved for administrator review. Only the bot reply ID was recorded; no member text.');
      }
      if(['mode','stats','feedbacks','learn','review','drafts','history','status','source','approve','reject','teach','chatid'].includes(name)){
        if(!group||!await admin(m,true,false))return send(m,'This command is restricted to authorized Sumcoin group administrators.');
        if(name==='stats')return send(m,state.summary());
        if(name==='status'){
          // Files contain only sync aggregates; never print secrets, user IDs or raw excerpts.
          const describe=(file)=>{try{const x=JSON.parse(fs.readFileSync(file,'utf8'));
            const docs=x.documents?.length||0;
            const errors=Array.isArray(x.failures)?x.failures.length:Number(x.failures||0);
            const time=x.indexedAt||x.syncedAt||x.updatedAt||null;
            return `${docs} documents${time?' | '+String(time).slice(0,16)+' UTC':''}${errors?' | '+errors+' unavailable':''}`;
          }catch{return 'not synchronized';}};
          return send(m,`Sumcoin Helper v${VERSION} | mode ${state.data.mode}
Answer engine: ${ai.apiKey?'OpenAI API configured':'reviewed retrieval only (no API key)'}
Approved community answers: ${learning.data.approved.length}
Historical question patterns: ${Object.values(learning.data.patterns).filter(p=>p.historical).length}
Official docs: ${describe('./data/synced.json')}
GitHub docs: ${describe('./data/github-docs.json')}
News: ${describe('./data/news.json')}
Private runtime data is not published to GitHub.`);
        }
        if(name==='feedbacks')return send(m,state.reports());
        if(name==='chatid')return send(m,`Group ID: ${m.chat.id}`);
        if(name==='learn')return send(m,learning.stats()+'\nGroup index: '+JSON.stringify(groupIndex?.stats()||{}));
        if(name==='history'){
          if(!groupIndex)return send(m,'Group index disabled.');
          if(!arg)return send(m,'Indexed group discussion (private VM): '+JSON.stringify(groupIndex.stats())+'\nUse /history keywords to search.');
          const needle=arg.toLowerCase().slice(0,100);
          const matches=groupIndex.data.entries.filter(x=>x.text.toLowerCase().includes(needle)).slice(-4).reverse();
          return send(m,matches.length?matches.map(x=>`#${x.messageId} [${x.language}; ${x.kind}]: ${x.text.slice(0,220)}`).join('\n\n'):'No matching saved excerpts.');
        }
        if(name==='drafts')return send(m,learning.review());
        if(name==='source'){
          const match=arg.match(/^(\d+)\s*\|\s*(https:\/\/\S+)$/);
          return send(m,match&&learning.setSource(Number(match[1]),match[2])?'Source attached to draft. Review with /drafts, then /approve ID.':'Usage: /source ID | https://sumcoin.org/official-page');
        }
        if(name==='review')return send(m,learning.review());
        if(name==='mode'){
          if(!['reply','observe'].includes(arg))return send(m,'Usage: /mode observe OR /mode reply');
          state.setMode(arg);return send(m,`Mode changed to ${arg}.`);
        }
        if(name==='approve'){
          const ok=learning.approve(Number(arg));if(ok){knowledge.learned=learning.data.approved;return send(m,`Approved #${arg}.`);}
          return send(m,'Not approved. Entry requires review and an approved source.');
        }
        if(name==='reject')return send(m,learning.reject(Number(arg))?`Rejected #${arg}.`:'Not found.');
        if(name==='teach'){
          const parts=arg.split('|').map(s=>s.trim());if(parts.length!==3)return send(m,'Usage: /teach Question | Answer | https://sumcoin.org/official-source');
          const id=learning.queue(...parts,'manual-admin');return send(m,id?`Draft #${id} queued. Verify /review before /approve ${id}.`:'Rejected: provide a safe answer and approved official source.');
        }
      }
      return;
    }
    if(!group)return;
    // Dismiss an accidental response, but never interpret ordinary “no thanks” chat as a command.
    const repliedToBotForDismiss=m.reply_to_message?.from?.is_bot&&m.reply_to_message.from.username?.toLowerCase()===botUsername.toLowerCase();
    const directedToBot=isDirectedMention(m.text,botUsername);
    const dismissalText=m.text.replace(new RegExp('@'+botUsername,'ig'),'').trim();
    if((repliedToBotForDismiss||directedToBot)&&isDismissal(dismissalText)){
      setMuted(m,true);return send(m,supportUI(lang,'dismissed'));
    }
    // Explicit bot follow-ups must work even if the user's question is "What about fees?"
    const mention=isDirectedMention(m.text,botUsername);
    const repliedToBot=m.reply_to_message?.from?.username?.toLowerCase()===botUsername.toLowerCase() && m.reply_to_message?.from?.is_bot===true;
    const q=m.text.replace(new RegExp('@'+botUsername,'ig'),'').trim();
    if(mention||repliedToBot){
      const topic=repliedToBot&&isContextualFollowup(q)?repliedTopic(m):null;
      const myPrior=recentTopic(m);
      const topicLanguage=topic&&myPrior?.id===topic.id?myPrior.lang:languageFor(m,q);
      return ask(m,q,{expanded:Boolean(topic&&isMoreRequest(q)),contextTopic:topic?.id,contextLanguage:topicLanguage});
    }
    if(containsSecret(m.text))return;

    // Follow a recent answer to THIS member only. A bare "tell me more"
    // without a recent answer remains ordinary chatter and is ignored.
    const prior=recentTopic(m);
    // Affirm a direct, recent consensus clarification without turning every
    // ordinary status statement into bot chatter. No cross-member context.
    if(isPoSConfirmation(m.text)&&prior?.id==='chain'&&prior.autoUntil>now()){
      if(m.sender_chat||await admin(m,true)||isMuted(m)||state.data.mode!=='reply')return;
      if(!state.shouldReply(m,`auto:consensus-confirmation:${m.from?.id}`,0.00056,0))return;
      return sendTopic(m,consensusReply(prior.lang,m.text),'chain',prior.lang);
    }
    if(isMoreRequest(m.text)&&prior?.autoUntil>now()){
      if(m.sender_chat||await admin(m,true)||isMuted(m)||state.data.mode!=='reply')return;
      return ask(m,m.text,{expanded:true});
    }

    const standaloneConsensus=/^(?:is|does|did|was|can|will|what|how)\b/i.test(m.text.trim())&&consensusIntent(m.text);
    if(!isSupportMessage(m.text)&&!priceIntent(m.text)&&!standaloneConsensus)return;
    // Do not interrupt rhetorical, promotional, or off-topic Sumcoin chat.
    if(/^(?:do you (?:like|love)|who else (?:likes|loves)|isn't it (?:great|awesome)|sumcoin (?:to the moon|is awesome)|hey guys|good morning)\b/i.test(m.text.trim()))return;
    // No automatic messages to admins, anonymous admins, channel posts or opted-out members.
    if(m.sender_chat||await admin(m)||isMuted(m))return;
    const {topic,language}=classify(m.text,m.from?.language_code);
    if(config.learningEnabled!==false)learning.observe(m.text,topic,language);
    if(topic)state.record(topic,false);
    state.recordLanguage(language);
    if(state.data.mode!=='reply')return;
    const pricing=priceIntent(m.text);
    if(pricing){
      if(state.shouldReply(m,`auto:live-price:${pricing.currency||'auto'}:${m.from?.id}`,0.00056,0)){const lang=languageFor(m,m.text);await sendTopic(m,await liveOps.price({...priceOptions(m,lang,pricing.currency||''),amount:pricing.amount}),'index-live',lang);}
      return;
    }
    if(consensusIntent(m.text)){
      if(state.shouldReply(m,`auto:consensus:${consensusAnswerKind(m.text)}:${m.from?.id}`,0.00056,0)){const lang=languageFor(m,m.text);await sendTopic(m,consensusReply(lang,m.text),'chain',lang);}
      return;
    }
    const detected=topic||learning.learnedTopic(m.text);
    const docs=knowledge.search(m.text,{limit:5});
    const topReviewed=docs.find(x=>x.kind==='curated'||x.kind==='admin-approved');
    const narrower=specificFAQTopic(m.text);
    const recognized=narrower&&knowledge.find(narrower)?narrower:detected&&knowledge.find(detected)?detected:topReviewed?.score>=18&&topReviewed?.coverage>=0.48?topReviewed.id:null;
    if(recognized&&!needsHumanReview(m.text)){
      // Short per-user / per-group cooldown rather than blocking support for six hours.
      if(!state.shouldReply(m,`auto:${recognized}:${m.from?.id}`,0.0015,0))return;
      const lang=languageFor(m,m.text);
      await sendTopic(m,article(recognized,lang),recognized,lang);
      state.record(recognized,true);return;
    }
    if(!escalations)return;
    // Ask privately only for meaningful, unclassified support questions (bounded and redacted).
    const item=escalations.enqueue(m,m.text,languageFor(m,m.text));
    if(!item)return;
    await notifyUnanswered(item);
    // One short acknowledgement, with no misleading claims about the answer.
    await send(m,`I’m checking this with @${REVIEW_USERNAME}. If it remains unanswered, I’ll share the closest verified information here.`);
  };
  handle.tick=tick;
  return handle;
}
