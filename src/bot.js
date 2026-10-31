import { classify, detectLanguage, isSupportMessage } from './classify.js';
import { citationUrls } from './knowledge.js';
import { githubSearch } from './github.js';
import { t, hasTranslation, normalizeLanguage, LANGUAGE_NAMES } from './languages.js';
import { containsSecret } from './privacy.js';

const COMMAND_TOPICS={cashout:'cashout',wallet:'wallet',staking:'staking',security:'security',migration:'legacy',index:'index',fees:'fees'};
const HELP=`Sumcoin Helper v0.0.3 — multilingual, source-grounded Sumcoin support.\n\n/ask your question — reply in your language (AI if configured)\n/language CODE — choose response language; /language auto resets (24h in memory)\n/find words — search approved docs\n/github words — search allowlisted official GitHub files\n/sources — official reference URLs\n/cashout /wallet /migration /staking /security /index /fees\n/feedback — report an inaccurate answer (aggregated)\n\nGroup admins: /mode observe|reply, /stats, /feedbacks, /learn, /review, /teach QUESTION | ANSWER | OFFICIAL_URL, /approve NUMBER, /reject NUMBER, /chatid\n\nQuestions in any language are welcome. The USD index is NOT a bank deposit or guaranteed withdrawal. Never share seed words or keys. Admin commands remain English.`;
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
export function createHandler({client,state,config,botUsername,knowledge,learning,ai}){
  const preferences=new Map(),seenReplies=new Map();
  const now=()=>Date.now();
  async function send(m,text){return client.sendMessage(m,String(text).slice(0,3500));}
  async function admin(m){if(!m.from?.id||!inAllowedGroup(m.chat,config))return false;
    try{return ['administrator','creator'].includes((await client.getChatMember(m.chat.id,m.from.id))?.status);}catch{return false;}}
  function languageFor(m,q){
    const key=String(m.from?.id||'');const pref=preferences.get(key);
    if(pref && pref.until<=now())preferences.delete(key);
    if(pref?.until>now())return pref.code;
    return detectLanguage(q||'',m.from?.language_code||'en');
  }
  function article(id,lang){
    const a=knowledge.find(id);if(!a)return t(lang,'none');
    const fact=hasTranslation(lang,id)?t(lang,id):`${t(lang,'englishDetail')}\n${a.body}`;
    return `${fact}\n\n${t(lang,'source')}: ${citationUrls([a],1)[0]||'https://sumcoin.org/'}`;
  }
  function offline(docs,lang){if(!docs.length)return t(lang,'none');
    const d=docs[0];return `${t(lang,'offline')}\n\n${article(d.id,lang)}`;}
  const CHAT_LIMIT=Math.max(1,Number(config.aiDailyLimit)||100);
  async function ask(m,q,{automatic=false}={}){
    const lang=languageFor(m,q);
    if(!q||q.length>1000)return automatic?undefined:send(m,t(lang,'need'));
    if(containsSecret(q))return automatic?undefined:send(m,t(lang,'security'));
    if(automatic&&state.data.mode!=='reply')return;
    if(!state.shouldReply(m,automatic?'auto-ai':`ask-user:${m.from?.id||'unknown'}`,automatic?config.userCooldownHours:0,automatic?config.topicCooldownSeconds:8))return;
    const key=`${m.chat.id}:${m.from?.id||m.sender_chat?.id||0}`;
    const retrievalQuery=ai.apiKey?ai.retrievalQuestion(key,q):q;
    const docs=knowledge.search(retrievalQuery,{limit:5});
    if(!docs.length)return automatic?undefined:send(m,t(lang,'none'));
    if(!ai.apiKey)return send(m,offline(docs,lang));
    if(!state.consumeAiQuota(CHAT_LIMIT))return send(m,offline(docs,lang)+'\n\n(AI daily limit reached.)');
    try{
      const answer=await ai.answer({question:q,context:docs,historyKey:key,language:lang});
      await send(m,answer.text);state.record('answered-ai',true);
    }catch(err){console.error('AI unavailable:',err.message);
      return send(m,`${t(lang,'temporarily')}\n\n${article(docs[0].id,lang)}`);}
  }
  return async function handle(m){
    if(!m?.chat||!m.text||m.from?.is_bot)return;
    const group=inAllowedGroup(m.chat,config),dm=m.chat.type==='private';
    if(!group&&!(dm&&config.allowPrivateChats))return;
    if(m.date&&now()/1000-m.date>900)return;
    const command=commandFrom(m.text,botUsername);
    const lang=languageFor(m,command?.arg||m.text);
    if(command){
      const name=command.name,arg=command.arg;
      if(['start','help'].includes(name))return send(m,lang==='en'?HELP:`${t(lang,'need')}\n\n/ask <question> — Sumcoin answers\n/language <code> — response language\n/cashout — SUM versus USD\n/find — documentation\n/feedback — report a bot answer\n\n${t(lang,'security')}\n\n${t(lang,'englishDetail')}\n${HELP}`);
      if(['lang','language'].includes(name)){
        if(!arg)return send(m,`Your current reply language: ${LANGUAGE_NAMES[lang]||lang}. Choose /language en, es, pt, fr, de, it, ru, ar, hi, zh, ja, ko, tr or id; /language auto to reset.`);
        if(arg.toLowerCase()==='auto'){preferences.delete(String(m.from?.id||''));return send(m,'Automatic language detection enabled.');}
        const code=arg.toLowerCase();if(!Object.hasOwn(LANGUAGE_NAMES,code))return send(m,'Unsupported language code. Use /language for choices.');
        preferences.set(String(m.from?.id||''),{code,until:now()+24*3600000});return send(m,`Reply language: ${LANGUAGE_NAMES[code]}. Expires in 24 hours; not written to disk.`);
      }
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
      if(name==='feedback'){
        if(!group)return send(m,'Use /feedback inside the authorized group.');
        if(!m.reply_to_message?.from?.is_bot||m.reply_to_message.from.username?.toLowerCase()!==botUsername.toLowerCase())return send(m,'Reply to a bot answer with /feedback to flag it for admin review.');
        const key=`${m.chat.id}:${m.from?.id||0}:feedback:${m.reply_to_message.message_id}`;
        if(seenReplies.has(key))return;
        seenReplies.set(key,now()+86400000);if(seenReplies.size>1500)for(const [k,v] of seenReplies)if(v<now())seenReplies.delete(k);
        state.addFeedback(Number(m.reply_to_message.message_id));return send(m,'Feedback saved for administrator review. Only the bot reply ID was recorded; no member text.');
      }
      if(['mode','stats','feedbacks','learn','review','approve','reject','teach','chatid'].includes(name)){
        if(!group||!await admin(m))return send(m,'This command is restricted to authorized Sumcoin group administrators.');
        if(name==='stats')return send(m,state.summary());
        if(name==='feedbacks')return send(m,state.reports());
        if(name==='chatid')return send(m,`Group ID: ${m.chat.id}`);
        if(name==='learn')return send(m,learning.stats());
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
    // Explicit bot follow-ups must work even if the user's question is "What about fees?"
    const mention=botUsername&&new RegExp('(?:^|\\s)@'+botUsername.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(m.text);
    const repliedToBot=m.reply_to_message?.from?.username?.toLowerCase()===botUsername.toLowerCase() && m.reply_to_message?.from?.is_bot===true;
    if(mention||repliedToBot){return ask(m,m.text.replace(new RegExp('@'+botUsername,'ig'),'').trim());}
    if(containsSecret(m.text))return;
    // Learn admin answers only after the group admin was verified, and never auto-promote them.
    if(m.reply_to_message?.text&&m.text.length>30&&await admin(m)){
      const source=m.text.match(/https:\/\/(?:www\.)?(?:sumcoin\.org|sumcoinwallet\.org|sumcoinindex\.com|github\.com\/sumcoinlabs\/)[^\s]*/i)?.[0];
      if(source&&isSupportMessage(m.reply_to_message.text))learning.queue(m.reply_to_message.text,m.text,source,'admin-reply');
    }
    if(!isSupportMessage(m.text))return;
    const {topic,language}=classify(m.text,m.from?.language_code);
    if(config.learningEnabled!==false)learning.observe(m.text,topic,language);
    if(topic)state.record(topic,false);
    state.recordLanguage(language);
    if(state.data.mode!=='reply')return;
    const recognized=topic||learning.learnedTopic(m.text);
    if(!recognized){
      if(config.autoAI&&ai.apiKey&&knowledge.search(m.text,{limit:1})[0]?.score>=10)return ask(m,m.text,{automatic:true});
      return;
    }
    if(!knowledge.find(recognized))return;
    if(!state.shouldReply(m,recognized,config.userCooldownHours,config.topicCooldownSeconds))return;
    await send(m,article(recognized,languageFor(m,m.text)));
    state.record(recognized,true);
  };
}
