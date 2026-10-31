// Private, bounded, privacy-filtered Telegram discussion memory.
// No member account IDs or names, never shared with GitHub, never asserted as truth.
import fs from 'node:fs';
import path from 'node:path';
import {safeForLearning,containsSecret} from './privacy.js';
import {isSupportMessage,classify} from './classify.js';

const AGE=90*86400000, MAX=5000, MAX_CHARS=560;
const SUM_CONTEXT=/(?:\bsumcoin\b|\bsumcoinindex\b|\bslice\s*wallet\b|\bSUM\b|#sumcoin\b|\bsumcoinwallet\b|サムコイン|섬코인|苏姆币)/iu;
const PRIVATE=/(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\+?\d[\d\s().-]{8,}\d|\b(?:1|3|bc1)[a-z0-9]{25,}\b|\b[a-f0-9]{40,}\b|\b(?:t\.me\/|@\w+))/iu;
const TIME=()=>Date.now();
function clean(text){
 const s=String(text||'').trim();
 // Privacy-first: reject the entire message instead of trying to redact secrets,
 // which can leak through context or partial replacement.
 if(s.length<13||s.length>2000||!safeForLearning(s)||containsSecret(s)||PRIVATE.test(s)||/\b(?:my address is|my phone|my email|my password|account number)\b/iu.test(s))return null;
 return s.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').slice(0,MAX_CHARS).trim();
}
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+process.pid+'.new';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
export class GroupIndex {
 constructor(file='./data/group-index.json',now=TIME){this.file=file;this.now=now;try{this.data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;this.data={schemaVersion:1,entries:[]};}this.data.entries||=[];this.prune();}
 prune(){const cutoff=this.now()-AGE;this.data.entries=this.data.entries.filter(x=>x.at>=cutoff).slice(-MAX);}
 // Call on every noncommand text update from the one allowed group, even in observe mode.
 observe(message,{administrator=false,language='en'}={}){
  if(!message?.message_id||message.from?.is_bot||message.sender_chat||message.forward_origin||!message.text)return null;
  const raw=String(message.text||'');
  const urls=raw.match(/https?:\/\/[^\s]+/giu)||[];
  let source=null;
  if(urls.length>1)return null;
  if(urls.length===1){
   try{const u=new URL(urls[0]);
    if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
       !/^(?:www\.)?(?:sumcoin\.org|sumcoinwallet\.org|sumcoinindex\.com)$/.test(u.hostname)&&
       !(u.hostname==='github.com'&&u.pathname.startsWith('/sumcoinlabs/')))return null;
    source=u.href;
   }catch{return null;}
  }
  const q=clean(raw.replace(/https?:\/\/[^\s]+/giu,' '));if(!q)return null;
  const parent=Number(message.reply_to_message?.message_id)||null;
  const related=this.data.entries.find(x=>x.messageId===parent);
  if(!SUM_CONTEXT.test(q)&&!related)return null;
  const topic=classify(q,language).topic||null;
  const entry={messageId:message.message_id,replyTo:parent,at:this.now(),text:q,
   language:/^[a-z]{2}$/i.test(language)?language.toLowerCase():'unknown',
   kind:isSupportMessage(q)?'question':administrator?'admin-comment':'discussion',topic,
   administrator:Boolean(administrator),...(source?{source}:{})};
  this.data.entries=this.data.entries.filter(x=>x.messageId!==entry.messageId);
  this.data.entries.push(entry);this.prune();write(this.file,this.data);return entry;
 }
 // A true Telegram administrator replying to a previously indexed question becomes
 // a DRAFT candidate. No source means no factual approval; review still required.
 candidate(message){
  const response=this.data.entries.find(x=>x.messageId===message?.message_id);
  let original=this.data.entries.find(x=>x.messageId===response?.replyTo);
  // Follow a short reply chain: an admin's later correction may reply to
  // their earlier answer, not directly to the original member question.
  for(let i=0;original&&original.kind!=='question'&&i<3;i++)
   original=this.data.entries.find(x=>x.messageId===original.replyTo);
  if(!response?.administrator||!original||original.kind!=='question'||!safeForLearning(response.text))return null;
  return {question:original.text,answer:response.text,source:response.source||null};
 }
 stats(){return {captured:this.data.entries.length,questions:this.data.entries.filter(x=>x.kind==='question').length,adminNotes:this.data.entries.filter(x=>x.administrator).length,retentionDays:90};}
 forget(messageId){const before=this.data.entries.length;this.data.entries=this.data.entries.filter(x=>x.messageId!==Number(messageId));if(before!==this.data.entries.length){write(this.file,this.data);return true;}return false;}
}
