import fs from 'node:fs';
import path from 'node:path';

const TOPICS = ['cashout', 'wallet', 'security', 'seed', 'staking', 'language', 'legacy', 'index', 'fees', 'missing-balance', 'pending', 'buy', 'chain', 'answered-ai'];

export class State {
  constructor(file, initialMode = 'reply', now = () => Date.now()) {
    this.file = file;
    this.now = now;
    this.cooldowns = new Map(); // in-memory only; never written to disk
    this.data = { mode: initialMode, detected: {}, answered: {}, days: {}, languages: {}, feedback: 0, feedbackItems: [], aiRequests: {} };
    try {
      const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (['reply', 'observe'].includes(loaded.mode)) this.data.mode = loaded.mode;
      for (const key of ['detected', 'answered', 'days', 'languages', 'aiRequests']) {
        if (loaded[key] && typeof loaded[key] === 'object' && !Array.isArray(loaded[key])) this.data[key] = loaded[key];
      }
      if(Array.isArray(loaded.feedbackItems))this.data.feedbackItems=loaded.feedbackItems.slice(-100);
      if(Number.isFinite(Number(loaded.feedback)))this.data.feedback=Math.max(0,Number(loaded.feedback));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = `${this.file}.${process.pid}.new`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }

  setMode(mode) {
    if (!['reply', 'observe'].includes(mode)) throw new Error('Invalid mode');
    this.data.mode = mode;
    this.save();
  }

  record(topic, answered = false) {
    if (!TOPICS.includes(topic)) return;
    const which = answered ? 'answered' : 'detected';
    this.data[which][topic] = (Number(this.data[which][topic]) || 0) + 1;
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const bucket = this.data.days[day] ||= { detected: {}, answered: {} };
    bucket[which][topic] = (Number(bucket[which][topic]) || 0) + 1;
    // Keep only 31 daily aggregates; preserve lifetime per-topic counts.
    const days = Object.keys(this.data.days).sort();
    for (const old of days.slice(0, -31)) delete this.data.days[old];
    this.save();
  }

  shouldReply(message, topic, userHours, topicSeconds) {
    const now = this.now();
    const userKey = `u:${message.chat.id}:${message.from?.id || message.sender_chat?.id || 'anonymous'}:${topic}`;
    const groupKey = `g:${message.chat.id}:${topic}`;
    if (now < (this.cooldowns.get(userKey) || 0) || now < (this.cooldowns.get(groupKey) || 0)) return false;
    this.cooldowns.set(userKey, now + userHours * 3_600_000);
    this.cooldowns.set(groupKey, now + topicSeconds * 1000);
    if (this.cooldowns.size > 5000) {
      for (const [key, expiry] of this.cooldowns) if (expiry <= now) this.cooldowns.delete(key);
    }
    return true;
  }

  recordLanguage(language){
    if (!/^[a-z]{2}$/.test(language)) return;
    this.data.languages[language]=(Number(this.data.languages[language])||0)+1;
    this.save();
  }

  addFeedback(botMessageId){
    this.data.feedback++;
    if(Number.isSafeInteger(botMessageId)&&botMessageId>0){this.data.feedbackItems.push({messageId:botMessageId,at:this.now()});
      this.data.feedbackItems=this.data.feedbackItems.filter(x=>this.now()-x.at<30*86400000).slice(-100);}
    this.save();
  }
  reports(){return this.data.feedbackItems.slice(-15).reverse().map(r=>`Bot message #${r.messageId} (${new Date(r.at).toISOString().slice(0,10)})`).join('\n')||'No recent feedback entries.';}

  consumeAiQuota(limit){
    const day=new Date(this.now()).toISOString().slice(0,10);
    this.data.aiRequests=Object.fromEntries(Object.entries(this.data.aiRequests).filter(([d])=>d>=day));
    const count=Number(this.data.aiRequests[day]||0);
    if(count>=limit)return false;
    this.data.aiRequests[day]=count+1;this.save();return true;
  }

  summary() {
    const fmt = (values) => TOPICS.map(topic => `${topic}: ${Number(values[topic]) || 0}`).join(', ');
    const today = new Date(this.now()).toISOString().slice(0, 10);
    return `Bot mode: ${this.data.mode}\nDetected (lifetime): ${fmt(this.data.detected)}\nReplied (lifetime): ${fmt(this.data.answered)}\nDetected today (${today} UTC): ${fmt(this.data.days[today]?.detected || {})}\n\nLanguages (aggregate): ${Object.entries(this.data.languages).sort((a,b)=>b[1]-a[1]).map(([l,n])=>l+': '+n).join(', ')||'(none)'}\nFeedback reports: ${this.data.feedback}\nAI requests today: ${this.data.aiRequests[today]||0}\nCounts only. Message text, user IDs and seeds are not stored in stats.`;
  }
}
