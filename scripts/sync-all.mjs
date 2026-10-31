import {sync} from '../src/sync.js';
import {syncGithubDocs} from '../src/discovery.js';
import {syncNews} from '../src/news.js';
let ok=0;for(const [name,fn] of [['official docs',sync],['public GitHub documentation',syncGithubDocs],['news metadata',syncNews]]){
 try{const result=await fn({onProgress:()=>{}});console.log(name,JSON.stringify(result));ok++;}
 catch(e){console.warn(name+': '+e.message+' (old index preserved)');}
}
if(!ok)process.exitCode=1;
