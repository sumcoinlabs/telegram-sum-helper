// Human review queue: redacted, bounded, no Telegram user IDs of group members stored.
import fs from 'node:fs';
import path from 'node:path';
import {sanitizeQuestion,fingerprint} from './learning.js';

const MAX_PENDING=100;
const RETAIN_MS=7*24*3600_000;
const DELAY_MS=20*60_000;
export const REVIEW_USERNAME='SumcoinAdmin';

export class Escalations {
  constructor(file='./data/escalations.json',now=()=>Date.now()){
    this.file=file;this.now=now;this.recentUsers=new Map();this.recentGroup=new Map();
    try{this.data=JSON.parse(fs.readFileSync(file,'utf8'));}
    catch(e){if(e.code!=='ENOENT')throw e;this.data={adminId:null,adminUsername:null,nextId:1,items:[]};}
    this.data.items ||= [];
    this.data.nextId ||= 1;
  }
  save(){
    const t=this.now();
    this.data.items=this.data.items.filter(x=>t-x.created<RETAIN_MS).slice(-MAX_PENDING);
    fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
    const temp=`${this.file}.${process.pid}.new`;
    fs.writeFileSync(temp,JSON.stringify(this.data,null,2)+'\n',{mode:0o600});
    fs.renameSync(temp,this.file);
  }
  register(member){
    if(!Number.isSafeInteger(member?.id)||member.id<=0||member.username?.toLowerCase()!==REVIEW_USERNAME.toLowerCase())return false;
    this.data.adminId=member.id;this.data.adminUsername=member.username;this.save();return true;
  }
  isRegistered(member){return Boolean(member?.id&&this.data.adminId===member.id&&member.username?.toLowerCase()===REVIEW_USERNAME.toLowerCase());}
  enqueue(message,question,lang){
    const redacted=sanitizeQuestion(question);
    if(!redacted || redacted.length<12 || !message?.chat?.id || !Number.isSafeInteger(message.message_id))return null;
    const hash=fingerprint(redacted);if(!hash)return null;
    const now=this.now();
    if(this.data.items.some(x=>x.hash===hash&&x.chatId===message.chat.id&&x.status!=='closed'&&now-x.created<12*3600_000))return null;
    const key=`${message.chat.id}:${message.from?.id||message.sender_chat?.id||0}`;
    if((this.recentUsers.get(key)||0)>now || (this.recentGroup.get(String(message.chat.id))||[]).filter(t=>t>now-3600_000).length>=6)return null;
    this.recentUsers.set(key,now+45*60_000);
    const group=this.recentGroup.get(String(message.chat.id))||[];group.push(now);this.recentGroup.set(String(message.chat.id),group.filter(t=>t>now-3600_000));
    if(this.recentUsers.size>1000)for(const [k,t] of this.recentUsers)if(t<now)this.recentUsers.delete(k);
    const item={id:this.data.nextId++,hash,question:redacted.slice(0,240),lang:/^[a-z]{2}$/.test(lang)?lang:'en',chatId:message.chat.id,messageId:message.message_id,created:now,status:'pending',notified:false};
    this.data.items.push(item);this.save();return item;
  }
  get(id){return this.data.items.find(x=>x.id===Number(id));}
  pending(){return this.data.items.filter(x=>['pending','fallback'].includes(x.status)).slice(-10);}
  due(){return this.data.items.filter(x=>x.status==='pending'&&this.now()-x.created>=DELAY_MS).slice(0,5);}
  mark(id,status){const item=this.get(id);if(!item)return false;item.status=status;this.save();return true;}
  markNotified(id){const item=this.get(id);if(!item)return false;item.notified=true;this.save();return true;}
  stats(){return `Unanswered: ${this.data.items.filter(x=>x.status==='pending').length}; awaiting review after fallback: ${this.data.items.filter(x=>x.status==='fallback').length}; admin notifications: ${this.data.adminId?'registered':'not registered'}`;}
}

export function needsHumanReview(text){
  // Specific capabilities not established by the high-level FAQ should not receive generic assurances.
  return /\b(?:ledger|trezor|hardware wallet|hardware-wallet|cold staking|smart contracts?|nft|tax treatment|taxes|quantum|encryption|iphone widgets?|legal classification|staking on mobile|cross.chain|bridge support)\b/i.test(text||'');
}

export function isDismissal(text){
  const s=String(text||'').toLowerCase().trim();
  return /^(?:no\s*thanks[.! ]*|no\s*thank\s*you[.! ]*|i\s*(?:don't|do not)\s*need\s*(?:your\s*)?help[.! ]*|stop\s*replying[.! ]*|never\s*mind[.! ]*|nevermind[.! ]*|no\s*gracias[.! ]*|no\s*necesito\s*ayuda[.! ]*|n[aã]o\s*(?:preciso|obrigad[oa])[.! ]*|pas\s*besoin[.! ]*|non\s*merci[.! ]*|nein\s*danke[.! ]*|いいえ[、。 ]*|괜찮아요[.! ]*)$/iu.test(s);
}
