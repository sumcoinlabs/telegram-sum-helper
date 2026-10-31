// Read-only analysis of Telegram Desktop JSON export. Never prints user identities or messages.
import fs from 'node:fs';
import { classify } from '../src/classify.js';

const filename = process.argv[2];
if (!filename || process.argv.includes('--help')) {
  console.log('Usage: npm run analyze -- /absolute/path/to/result.json');
  process.exit(filename ? 0 : 1);
}
const doc = JSON.parse(fs.readFileSync(filename, 'utf8'));
if (!Array.isArray(doc.messages)) throw new Error('This is not a Telegram Desktop JSON chat export (missing messages array).');
const counts = { cashout: 0, wallet: 0, security: 0, staking: 0, language: 0, other: 0 };
const languages = { es: 0, other: 0, unknown: 0 };
const byMonth = {};
let scanned = 0;
for (const msg of doc.messages) {
  if (msg.type !== 'message') continue;
  const raw = typeof msg.text === 'string' ? msg.text : Array.isArray(msg.text) ? msg.text.map(part => typeof part === 'string' ? part : (part?.text || '')).join('') : '';
  if (!raw.trim()) continue;
  scanned++;
  const { topic, language } = classify(raw);
  counts[topic || 'other']++;
  languages[language]++;
  const month = String(msg.date || '').slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(month)) {
    const bucket = byMonth[month] ||= {};
    bucket[topic || 'other'] = (bucket[topic || 'other'] || 0) + 1;
  }
}
console.log(JSON.stringify({ scanned, topicCounts: counts, languageSignals: languages, byMonth }, null, 2));
console.log('\nNote: keyword-based estimates; check the group manually before expanding rules. No message text or user info was output.');
