import { sync } from '../src/sync.js';
try{const result=await sync({onProgress:console.log});console.log('Finished:',JSON.stringify(result,null,2));}catch(e){console.error('SYNC FAILED:',e.message);process.exitCode=1;}
