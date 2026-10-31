import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {safeForLearning} from './privacy.js';
import { normalize,tokens } from './knowledge.js';

const DAYS_30=30*86400000;
const BANNED=/(?:\b(?:seed|recovery|secret|mnemonic|private|password|passphrase|verification code|otp)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b.*\b(?:seed|words)\b)/i;
export function isOfficialSource(source){
  if(typeof source!=='string'||source.length>300)return false;
  try{
    const u=new URL(source);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
    // Accept only the two documented SumcoinPrice historical query URLs.
    // Never allow arbitrary query strings to become reviewed evidence.
    if(u.search)return ['https://sumcoinprice.com/api/history.php?range=1d',
      'https://sumcoinprice.com/api/history.php?range=1d&pair=btc'].includes(u.href);
    if(u.hostname==='github.com')return /^\/sumcoinlabs\/[a-z0-9_.-]+(?:\/|$)/i.test(u.pathname);
    return ['sumcoin.org','www.sumcoin.org','sumcoinwallet.org','www.sumcoinwallet.org','sumcoinindex.com','www.sumcoinindex.com','sumcoinprice.com','www.sumcoinprice.com','docs.sumcoin.org'].includes(u.hostname);
  }catch{return false;}
}

export function sanitizeQuestion(input){
  const s=String(input||'').slice(0,600).trim();
  if(s.length<10 || BANNED.test(s) || !safeForLearning(s) || /https?:\/\/|t\.me\/|@\w+/.test(s))return null;
  return s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,'[email]').replace(/\+?\d[\d\s()-]{7,}\d/g,'[number]')
    .replace(/\b[a-zA-Z0-9]{26,}\b/g,'[address]').replace(/\b\d+(?:[.,]\d+)?\b/g,'[number]').replace(/[\r\n]+/g,' ').slice(0,240);
}
export function fingerprint(s){
  const cleaned=normalize(String(s||'').replace(/\d+(?:[.,]\d+)?/g,' # '));
  const words=cleaned.match(/[\p{L}\p{N}]+/gu)||[];
  const filtered=[...new Set(words.filter(w=>w.length>1&&!['sumcoin','wallet','hello','please','help'].includes(w)))].sort();
  const canonical=filtered.join('|');
  return canonical.length<4?'':createHash('sha256').update(canonical).digest('hex').slice(0,24);
}
const jsonread=(f,def)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){if(e.code==='ENOENT')return def;throw e;}};
export class Learning {
  constructor(file='./data/learning.json',now=()=>Date.now()){
    this.file=file;this.now=now;this.storeExamples=process.env.LEARNING_STORE_EXAMPLES==='true';this.data=jsonread(file,{patterns:{},pending:[],approved:[],nextId:1});this.prune();
    if(!this.storeExamples){let changed=false;for(const p of Object.values(this.data.patterns))if('example' in p){delete p.example;changed=true;}if(changed)this.save();}
  }
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});const tmp=this.file+'.'+process.pid+'.new';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,this.file);}
  prune(){const n=this.now();for(const [k,p] of Object.entries(this.data.patterns))if(!p.historical&&n-p.seen>DAYS_30)delete this.data.patterns[k];this.data.pending=this.data.pending.slice(-150);
    const keys=Object.entries(this.data.patterns).sort((a,b)=>b[1].count-a[1].count || b[1].seen-a[1].seen);
    for(const [key] of keys.slice(1000))delete this.data.patterns[key];}
  observe(q,topic=null,language='unknown',{historical=false,save=true}={}){
    const s=sanitizeQuestion(q);if(!s)return false;
    const key=fingerprint(s);if(key.length<5)return false;
    const p=this.data.patterns[key]||={count:0,topic:null,language,seen:0};
    delete p.example;
    if(this.storeExamples&&!historical)p.example=s;
    p.count=Math.min(p.count+1,100000);p.seen=this.now();
    if(historical){p.historical=true;p.historicalCount=Math.min((p.historicalCount||0)+1,100000);}
    if(topic&&p.topic!==topic)p.topic=topic;
    if(/^[a-z]{2}$/.test(language))p.language=language;
    this.data.patterns[key]=p;if(save){this.prune();this.save();}return true;
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
    if(kind==='group-admin-draft'&&(this.data.pending.some(x=>x.kind===kind&&x.title===question&&x.text===answer)||this.data.approved.some(x=>x.kind===kind&&x.title===question&&x.text===answer)))return null;
    if(source && !isOfficialSource(source))return null;
    const entry={id:this.data.nextId++,title:question,text:answer,source:source||null,created:this.now(),status:'pending',kind};
    if(/^correction:[a-z0-9-]{2,60}$/.test(kind))entry.supersedesId=kind.slice(11);
    this.data.pending.push(entry);this.save();return entry.id;
  }
  approve(id){const pos=this.data.pending.findIndex(x=>x.id===id);if(pos<0)return false;
    const item=this.data.pending[pos];if(!isOfficialSource(item.source))return false;this.data.pending.splice(pos,1);
    if(item.supersedesId)this.data.approved=this.data.approved.filter(x=>x.supersedesId!==item.supersedesId);
    item.status='approved';item.sources=[item.source];item.tags=tokens(item.title);this.data.approved.push(item);this.data.approved=this.data.approved.slice(-100);this.save();return true;
  }
  setSource(id,source){
    const item=this.data.pending.find(x=>x.id===Number(id));
    if(!item||!isOfficialSource(source))return false;
    item.source=source;this.save();return true;
  }
  revoke(id){const before=this.data.approved.length;this.data.approved=this.data.approved.filter(x=>x.id!==Number(id));if(before===this.data.approved.length)return false;this.save();return true;}
  reject(id){const prev=this.data.pending.length;this.data.pending=this.data.pending.filter(x=>x.id!==id);if(this.data.pending.length!==prev){this.save();return true;}return false;}
  stats(){const hot=Object.values(this.data.patterns).sort((a,b)=>b.count-a.count).slice(0,5);
    return `Learned question patterns: ${Object.keys(this.data.patterns).length} (historical: ${Object.values(this.data.patterns).filter(p=>p.historical).length})\nPending moderator-reviewed answers: ${this.data.pending.length}\nApproved answers: ${this.data.approved.length}\nRepeated patterns (redacted):\n${hot.map(x=>`${x.count}× [${x.language||'?'} / ${x.topic||'unclassified'}] ${x.example||'(no text stored)'}`).join('\n')||'(none)'}`;
  }
  review(){return this.data.pending.slice(0,6).map(x=>`#${x.id} (${x.kind}): ${x.title}\nAnswer: ${x.text.slice(0,250)}\nSource: ${x.source||'MISSING: add a source before approval'}`).join('\n\n')||'No pending community answers.';}
}
