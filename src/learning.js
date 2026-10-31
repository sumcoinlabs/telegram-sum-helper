import fs from 'node:fs';
import path from 'node:path';
import { normalize,tokens } from './knowledge.js';

const DAYS_30=30*86400000;
const BANNED=/(?:\b(?:seed|recovery|secret|mnemonic|private|password|passphrase|verification code|otp)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b.*\b(?:seed|words)\b)/i;
const ALLOWED_SOURCE=/^https:\/\/(?:www\.)?(?:sumcoin\.org|sumcoinwallet\.org|sumcoinindex\.com|github\.com\/sumcoinlabs\/|docs\.sumcoin\.org\/)/i;
export function sanitizeQuestion(input){
  const s=String(input||'').slice(0,600).trim();
  if(s.length<12 || BANNED.test(s) || /https?:\/\/|t\.me\/|@\w+/.test(s))return null;
  return s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,'[email]').replace(/\+?\d[\d\s()-]{7,}\d/g,'[number]')
    .replace(/\b[a-zA-Z0-9]{26,}\b/g,'[address]').replace(/\b\d+(?:[.,]\d+)?\b/g,'[number]').replace(/[\r\n]+/g,' ').slice(0,240);
}
export function fingerprint(s){return [...new Set(tokens(s))].filter(t=>!['sumcoin','wallet','help','hello','please','sum'].includes(t)).sort().slice(0,6).join(':');}
const jsonread=(f,def)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){if(e.code==='ENOENT')return def;throw e;}};
export class Learning {
  constructor(file='./data/learning.json',now=()=>Date.now()){
    this.file=file;this.now=now;this.data=jsonread(file,{patterns:{},pending:[],approved:[],nextId:1});this.prune();
  }
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});const tmp=this.file+'.'+process.pid+'.new';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,this.file);}
  prune(){const n=this.now();for(const [k,p] of Object.entries(this.data.patterns))if(n-p.seen>DAYS_30)delete this.data.patterns[k];this.data.pending=this.data.pending.slice(-150);
    const keys=Object.entries(this.data.patterns).sort((a,b)=>b[1].count-a[1].count || b[1].seen-a[1].seen);
    for(const [key] of keys.slice(1000))delete this.data.patterns[key];}
  observe(q,topic=null){
    const s=sanitizeQuestion(q);if(!s)return false;
    const key=fingerprint(s);if(key.length<5)return false;
    const p=this.data.patterns[key]||={count:0,topic:null,example:s,seen:0};
    p.count=Math.min(p.count+1,100000);p.seen=this.now();
    if(topic&&p.topic!==topic)p.topic=topic;
    this.data.patterns[key]=p;this.prune();this.save();return true;
  }
  // Automatic language/intent adaptation: common approved-topic phrasings can trigger
  // retrieval. This never creates factual answers from ordinary group-member statements.
  learnedTopic(question){
    const key=fingerprint(sanitizeQuestion(question)||'');const p=this.data.patterns[key];
    return p&&p.count>=3&&p.topic ? p.topic : null;
  }
  queue(q,a,source,kind='admin-reply'){
    const question=sanitizeQuestion(q);const answer=String(a||'').trim().slice(0,1300);
    if(!question||!answer||BANNED.test(answer))return null;
    if(source && !ALLOWED_SOURCE.test(source))return null;
    const entry={id:this.data.nextId++,title:question,text:answer,source:source||null,created:this.now(),status:'pending',kind};
    this.data.pending.push(entry);this.save();return entry.id;
  }
  approve(id){const pos=this.data.pending.findIndex(x=>x.id===id);if(pos<0)return false;
    const item=this.data.pending[pos];if(!item.source)return false;this.data.pending.splice(pos,1);
    item.status='approved';item.sources=[item.source];item.tags=tokens(item.title);this.data.approved.push(item);this.data.approved=this.data.approved.slice(-100);this.save();return true;
  }
  reject(id){const prev=this.data.pending.length;this.data.pending=this.data.pending.filter(x=>x.id!==id);if(this.data.pending.length!==prev){this.save();return true;}return false;}
  stats(){const hot=Object.values(this.data.patterns).sort((a,b)=>b.count-a.count).slice(0,5);
    return `Learned question patterns: ${Object.keys(this.data.patterns).length}\nPending moderator-reviewed answers: ${this.data.pending.length}\nApproved answers: ${this.data.approved.length}\nRepeated patterns (redacted):\n${hot.map(x=>`${x.count}× ${x.example}`).join('\n')||'(none)'}`;
  }
  review(){return this.data.pending.slice(0,6).map(x=>`#${x.id} (${x.kind}): ${x.title}\nAnswer: ${x.text.slice(0,250)}\nSource: ${x.source||'MISSING: add a source before approval'}`).join('\n\n')||'No pending community answers.';}
}
