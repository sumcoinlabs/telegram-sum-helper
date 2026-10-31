// Usage: npm run import:video -- /absolute/path/to/video-transcript.txt
import fs from 'node:fs';
import {importTranscript} from '../src/video.js';
const path=process.argv[2];
if(!path){console.error('Usage: npm run import:video -- /path/to/supplied-transcript.txt');process.exit(1);}
console.log(`Imported ${importTranscript(fs.readFileSync(path,'utf8'))} unreviewed transcript segments. No claims automatically approved.`);
