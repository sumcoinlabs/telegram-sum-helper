// Example: npm run import:social -- /path/to/tweets.js --account sumcoinindex
import fs from 'node:fs';
import path from 'node:path';
import {importSocial} from '../src/social.js';
const args=process.argv.slice(2);const at=args.indexOf('--account');
const account=at>=0?args[at+1]||'':'';
const filenames=args.filter((a,i)=>a!=='--account'&&i!==at+1);
if(!filenames.length){console.error('Usage: npm run import:social -- /path/to/tweets.js [more files] --account sumcoinindex');process.exit(2);}
let total=0,skipped=0,stored=0;
for(const filename of filenames){
  const stat=fs.statSync(filename);
  const files=stat.isDirectory()?fs.readdirSync(filename).filter(x=>/^(?:tweets|tweet)(?:\.part\d+|\d*)?\.(?:js|json)$/i.test(x)).sort().map(x=>path.join(filename,x)):[filename];
  for(const file of files){const result=importSocial(fs.readFileSync(file,'utf8'),{account,append:true});
    total+=result.imported;skipped+=result.skipped;stored=result.stored;}
}
console.log(`Imported ${total} unreviewed Sumcoin-related public posts; ${stored} distinct posts stored, ${skipped} skipped. No facts automatically approved.`);
