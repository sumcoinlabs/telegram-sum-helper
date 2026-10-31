// Import only anonymized recurring-question patterns from a Telegram Desktop JSON export.
// Never copies user identifiers, full chat transcripts or original file into the repo.
import fs from 'node:fs';
import {Knowledge} from '../src/knowledge.js';
import {classify} from '../src/classify.js';
import {Learning} from '../src/learning.js';
const filename=process.argv[2];if(!filename){console.error('Usage: npm run ingest -- /path/to/telegram/result.json');process.exit(2);}
const doc=JSON.parse(fs.readFileSync(filename,'utf8'));
if(!Array.isArray(doc.messages))throw new Error('Expected Telegram Desktop JSON export with messages array');
const knowledge=new Knowledge(),learning=new Learning();let seen=0,accepted=0;
for(const message of doc.messages){if(message.type!=='message')continue;
  const raw=typeof message.text==='string'?message.text:Array.isArray(message.text)?message.text.map(p=>typeof p==='string'?p:(p?.text||'')).join(''):'';
  if(!raw||!/[?¿]/.test(raw)&&!/(?:how|where|why|what|can|como|quiero|i need|my wallet|ayuda)/i.test(raw))continue;
  if(!/\b(?:sumcoin|sum|slice|electrum|wallet|staking|index|retirar|billetera)\b/i.test(raw))continue;
  seen++;const result=classify(raw),matches=knowledge.search(raw,{limit:1});
  const topic=result.topic||((matches[0]?.kind==='curated'&&matches[0].score>=10)?matches[0].id:null);
  if(learning.observe(raw,topic))accepted++;
}
console.log(`Processed ${seen} Sumcoin-style questions; recorded ${accepted} safely filtered question patterns. No names or user IDs imported.`);
console.log(learning.stats());
