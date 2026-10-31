import {Knowledge,citationUrls} from '../src/knowledge.js';
const q=process.argv.slice(2).join(' ').trim();if(!q){console.error('Usage: npm run search -- "my sumcoin question"');process.exitCode=2;}else{
const k=new Knowledge();const r=k.search(q);if(!r.length)console.log('No grounded matches');for(const d of r)console.log(`\n[${d.kind} | ${d.score}] ${d.title}\n${d.body.slice(0,800)}\n${citationUrls([d],1).join('')}`);
}
