import fs from 'node:fs';
import path from 'node:path';

const TOPICS = ['cashout', 'wallet', 'security', 'staking', 'language', 'legacy', 'index', 'fees', 'missing-balance', 'pending', 'buy', 'chain', 'answered-ai'];

export class State {
  constructor(file, initialMode = 'reply', now = () => Date.now()) {
    this.file = file;
    this.now = now;
    this.cooldowns = new Map(); // in-memory only; never written to disk
    this.data = { mode: initialMode, detected: {}, answered: {}, days: {} };
    try {
      const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (['reply', 'observe'].includes(loaded.mode)) this.data.mode = loaded.mode;
      for (const key of ['detected', 'answered', 'days']) {
        if (loaded[key] && typeof loaded[key] === 'object' && !Array.isArray(loaded[key])) this.data[key] = loaded[key];
      }
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

  summary() {
    const fmt = (values) => TOPICS.map(topic => `${topic}: ${Number(values[topic]) || 0}`).join(', ');
    const today = new Date(this.now()).toISOString().slice(0, 10);
    return `Bot mode: ${this.data.mode}\nDetected (lifetime): ${fmt(this.data.detected)}\nReplied (lifetime): ${fmt(this.data.answered)}\nDetected today (${today} UTC): ${fmt(this.data.days[today]?.detected || {})}\n\nCounts only. Message text, user IDs and seeds are not stored.`;
  }
}
