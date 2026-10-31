import { classify, detectLanguage } from './classify.js';
import { citationUrls } from './knowledge.js';
import { githubSearch } from './github.js';

const COMMAND_TOPICS={cashout:'cashout',wallet:'wallet',staking:'staking',security:'security',rules:'language',migration:'legacy',index:'index',fees:'fees'};
const HELP=`Sumcoin Helper v0.0.1 — answers grounded in official Sumcoin information.\n\n/ask your question — conversational answers (AI if configured)\n/find words — search approved knowledge and synced official docs\n/github words — search files in official GitHub repos\n/sources — see reference sources\n/cashout /wallet /migration /staking /security /index /fees\n\nGroup admins: /mode observe, /mode reply, /stats, /learn, /review, /teach QUESTION | ANSWER | OFFICIAL_URL, /approve NUMBER, /reject NUMBER, /chatid\n\nThe USD index value is NOT a bank balance or guaranteed withdrawal. This bot never requests seed words or funds. English-speaking group; translate questions to English, please.`;
export function commandFrom(text,botUsername=''){
  const m=/^\/([a-z_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(String(text||'').trim());
  if(!m || (m[2]&&m[2].toLowerCase()!==botUsername.toLowerCase()))return null;
  return {name:m[1].toLowerCase(),arg:(m[3]||'').trim()};
}
export function inAllowedGroup(chat,config){
  if(!chat||!['group','supergroup'].includes(chat.type))return false;
  const byId=config.allowedChatId&&String(chat.id)===String(config.allowedChatId);
  const byName=config.allowedChatUsername&&chat.username?.toLowerCase()===config.allowedChatUsername.toLowerCase();
  return Boolean(byId||byName);
}
const isQuestion=s=>/[?¿]/.test(s)||/^(?:hi[, ]*|hello[, ]*)?(?:how|where|why|what|can|could|is|does|did|i need|i have|help|please|my wallet|anyone|como|por que|puedo|necesito|quiero|ayuda)\b/i.test(s);
const isAboutSum=s=>/\b(sumcoin|sum|slice|electrum|staking|cash.?out|wallet|withdraw|index|migration|retirar|billetera)\b/i.test(s);
const secretExposure=s=>/\b(?:my|here(?:'s| is| are)|these are)\b.{0,35}\b(?:seed|recovery|private key|secret phrase|mnemonic)\b.{0,25}(?:[:=]|\bis\b|\bare\b)/i.test(s);

export function createHandler({client,state,config,botUsername,knowledge,learning,ai}){
  const now=()=>Date.now();
  async function send(m,text){return client.sendMessage(m,String(text).slice(0,3500));}
  async function admin(m){if(!m.from?.id||!inAllowedGroup(m.chat,config))return false;try{return ['administrator','creator'].includes((await client.getChatMember(m.chat.id,m.from.id))?.status);}catch{return false;}}
  function articleAnswer(id){const a=knowledge.find(id);if(!a)return 'No verified article found for that topic.';return `${a.body}\n\nSource: ${citationUrls([a],1)[0]||'https://sumcoin.org/'}`;}
  async function ask(m,q,{automatic=false}={}){
    if(!q||q.length>1000)return send(m,'Please ask a question of 1–1000 characters.');
    if(secretExposure(q))return send(m,'Please do NOT share recovery words, private keys or passwords, even with this bot. Remove any secret information before asking.');
    if(automatic && state.data.mode!=='reply')return;
    if(!state.shouldReply(m,automatic?'auto-ai':'ask',config.userCooldownHours,automatic?config.topicCooldownSeconds:10))return;
    const docs=knowledge.search(q,{limit:5});
    if(!docs.length)return automatic ? undefined : send(m,'I could not find an official Sumcoin source addressing that question. Please consult https://sumcoin.org/ or ask a human group administrator. Never share seed phrases.');
    try{const answer=await ai.answer({question:q,context:docs,historyKey:`${m.chat.id}:${m.from?.id||0}`,language:detectLanguage(q)});await send(m,answer.text);state.record('answered-ai',true);}
    catch(err){console.error('AI answer failed:',err.message);await send(m,`${docs[0].body}\n\nSource: ${citationUrls(docs,1)[0]||'https://sumcoin.org/'}\n\n(The conversational AI service is temporarily unavailable.)`);}
  }
  return async function handle(m){
    if(!m?.chat||!m.text||m.from?.is_bot)return;
    const group=inAllowedGroup(m.chat,config),dm=m.chat.type==='private';
    if(!group&&!dm)return;
    if(m.date&&now()/1000-m.date>900)return;
    const command=commandFrom(m.text,botUsername);
    if(command){
      const name=command.name,arg=command.arg;
      if(['start','help'].includes(name))return send(m,HELP);
      if(name==='sources')return send(m,'Verified sources: https://sumcoin.org/ | https://sumcoinwallet.org/ | https://github.com/sumcoinlabs/sumcoin | https://github.com/sumcoinlabs/sumcoin_flutter\n/ find searches our curated and refreshed knowledge; no arbitrary sites are trusted.');
      if(COMMAND_TOPICS[name])return send(m,articleAnswer(COMMAND_TOPICS[name]));
      if(name==='github'){
        if(!arg)return send(m,'Usage: /github search keywords');
        if(!state.shouldReply(m,'github',0,25))return;
        const matches=await githubSearch(arg);return send(m,matches.length?matches.map((x,i)=>`${i+1}. ${x.repo}/${x.path}\n${x.url}`).join('\n\n'):'No matching public files found in the allowlisted sumcoinlabs repositories. Search may also be rate-limited.');
      }
      if(name==='find'){
        if(!arg)return send(m,'Usage: /find your search terms');
        const docs=knowledge.search(arg,{limit:3});if(!docs.length)return send(m,'No verified knowledge matches. Try /ask.');
        return send(m,docs.map((d,i)=>`${i+1}. ${d.title}\n${String(d.body).slice(0,260)}...\n${citationUrls([d],1)[0]||''}`).join('\n\n'));
      }
      if(name==='ask')return ask(m,arg);
      if(['mode','stats','learn','review','approve','reject','teach','chatid'].includes(name)){
        if(!group||!await admin(m))return send(m,'That command is restricted to administrators in the authorized Sumcoin group.');
        if(name==='stats')return send(m,state.summary());
        if(name==='chatid')return send(m,`Group ID: ${m.chat.id}`);
        if(name==='learn')return send(m,learning.stats());
        if(name==='review')return send(m,learning.review());
        if(name==='mode'){if(!['reply','observe'].includes(arg))return send(m,'Usage: /mode observe OR /mode reply');state.setMode(arg);return send(m,`Mode changed to ${arg}.`);}
        if(name==='approve'){const ok=learning.approve(Number(arg));if(ok){knowledge.learned=learning.data.approved;return send(m,`Approved #${arg}. New answers may now be retrieved.`);}return send(m,'Not approved. Entry must exist and have an official source.');}
        if(name==='reject')return send(m,learning.reject(Number(arg))?`Rejected #${arg}.`:'Not found.');
        if(name==='teach'){
          const segments=arg.split('|').map(s=>s.trim());if(segments.length!==3)return send(m,'Usage: /teach question | answer | https://sumcoin.org/verified-source');
          const id=learning.queue(...segments,'manual-admin');return send(m,id?`Draft #${id} queued. Verify it via /review then /approve ${id}.`:'Rejected: use a non-sensitive question/answer and an approved official source URL.');
        }
      }
      return;
    }
    if(!group)return;
    // Learn candidate answers from VERIFIED group administrators replying to questions.
    // Never promote directly; require explicit /approve and an official source URL.
    if(m.reply_to_message?.text && m.text.length>30 && await admin(m)){
      const source=m.text.match(/https:\/\/(?:www\.)?(?:sumcoin\.org|sumcoinwallet\.org|sumcoinindex\.com|github\.com\/sumcoinlabs\/)[^\s]*/i)?.[0];
      if(source && isQuestion(m.reply_to_message.text))learning.queue(m.reply_to_message.text,m.text,source,'admin-reply');
    }
    // Observe only support-related questions, not arbitrary conversation.
    if(!isQuestion(m.text)||!isAboutSum(m.text))return;
    if(secretExposure(m.text))return; // never capture raw secrets or repeat them
    const found=knowledge.search(m.text,{limit:2});
    const classified=classify(m.text);
    const inferred=classified.topic==='language'?null:classified.topic;
    const specific=['missing-balance','legacy','pending','irreversible','index','seed','buy','security'];
    const top=(found[0]?.kind==='curated'&&found[0].score>=15)?found[0].id:null;
    const topic=(top&&specific.includes(top))?top:(inferred||learning.learnedTopic(m.text)||top);
    if(config.learningEnabled!==false)learning.observe(m.text,topic);
    if(topic)state.record(topic,false);
    // Always require an explicit @mention, a reply to the bot, or /ask for deep AI.
    const mention=botUsername&&new RegExp('(?:^|\\s)@'+botUsername.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(m.text);
    const repliedToBot=m.reply_to_message?.from?.username?.toLowerCase()===botUsername.toLowerCase();
    if(mention||repliedToBot){return ask(m,m.text.replace(new RegExp('@'+botUsername,'ig'),'').trim());}
    if(state.data.mode!=='reply')return;
    if(topic&&found[0]?.kind==='curated'&&found[0].score>=8){
      if(!state.shouldReply(m,topic,config.userCooldownHours,config.topicCooldownSeconds))return;
      const a=knowledge.find(topic)||found[0];await send(m,articleAnswer(a.id));state.record(topic,true);return;
    }
    if(config.autoAI && ai.apiKey && found[0]?.score>=8)return ask(m,m.text,{automatic:true});
  };
}
