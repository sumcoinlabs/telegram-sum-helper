// Optional public documentation discovery: fixed repositories, branches, and formats.
// GET-only; content is UNREVIEWED searchable material, not executable code or approved facts.
import fs from 'node:fs';import path from 'node:path';
import {chunks,toText} from './sync.js';
const REPOS=[['sumcoin','main'],['sumcoin_flutter','0.0.9'],['sumcoinlib','master'],['electrumx','master'],['insight-sum-api','master'],['insight-sum-ui','master'],['sumcore','master'],['telegram-sum-helper','main']];
const ALLOWED=/^(?:(?:doc|docs|documentation|guides|examples|scripts)\/)?[\w\/.\-]+\.(?:md|markdown|rst|txt)$/i;
const PRIVATE=/(?:private.key|\.env|secrets?|credential|password|\.ssh|node_modules|package-lock|yarn\.lock|\.git\/|vendor\/|target\/|build\/|test\/fixtures\/)/i;
const MAX_DOCS=160,MAX_FILE=80_000;
function output(file,data){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const t=file+'.'+process.pid+'.new';fs.writeFileSync(t,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(t,file);}
async function fetchString(url,fetchImpl,limit=MAX_FILE){const r=await fetchImpl(url,{redirect:'error',headers:{accept:'application/json,text/plain,text/markdown','user-agent':'SumcoinHelper/0.0.10-docs'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);if(Number(r.headers?.get?.('content-length')||0)>limit)throw Error('Too large');const s=await r.text();if(Buffer.byteLength(s)>limit)throw Error('Too large');return s;}
export async function syncGithubDocs({fetchImpl=fetch,out='./data/github-docs.json',maxDocs=MAX_DOCS,onProgress=()=>{}}={}){
 const documents=[],failures=[];
 for(const [repo,branch] of REPOS){
  if(documents.length>=maxDocs)break;
  try{
   const url=`https://api.github.com/repos/sumcoinlabs/${repo}/git/trees/${branch}?recursive=1`;
   const tree=JSON.parse(await fetchString(url,fetchImpl,2800000));
   if(!Array.isArray(tree.tree))throw Error('Missing GitHub tree');
   if(tree.truncated)onProgress(`GitHub ${repo}: incomplete tree; indexing visible docs only`);
   const candidates=tree.tree.filter(e=>e.type==='blob'&&e.size>140&&e.size<MAX_FILE&&ALLOWED.test(e.path)&&!PRIVATE.test(e.path)&&!e.path.includes('..'))
    .sort((a,b)=>{const priority=x=>/^(?:README|CHANGELOG|MIGRATION|VALIDATION|doc\/README|docs\/README)/i.test(x.path)?0:1;return priority(a)-priority(b)||a.path.localeCompare(b.path);}).slice(0,10);
   for(const item of candidates){if(documents.length>=maxDocs)break;
    const pathname=item.path.split('/').map(encodeURIComponent).join('/');
    const rawUrl=`https://raw.githubusercontent.com/sumcoinlabs/${repo}/${encodeURIComponent(branch)}/${pathname}`;
    try{const plain=toText(await fetchString(rawUrl,fetchImpl),false);
     if(plain.length<150)continue;
     // Small excerpts only, with exact public source and repo path.
     const part=chunks(plain,170).slice(0,2);
     part.forEach((text,i)=>documents.push({id:`github-${repo}-${item.sha.slice(0,10)}-${i}`,title:`${repo}/${item.path} — part ${i+1} (unreviewed documentation)`,text,source:`https://github.com/sumcoinlabs/${repo}/blob/${branch}/${item.path}`,reviewed:false,repo,path:item.path}));
    }catch(e){failures.push({repo,path:item.path,reason:e.message});}
   }
   onProgress(`GitHub ${repo}: indexed docs`);
  }catch(e){failures.push({repo,reason:e.message});onProgress(`GitHub ${repo}: ${e.message}`);}
 }
 if(!documents.length)throw Error('No new GitHub docs; existing index preserved');
 output(out,{indexedAt:new Date().toISOString(),reviewed:false,documents,failures});return {repositories:REPOS.length,documents:documents.length,failures:failures.length};
}
export const GITHUB_REPOS=REPOS.map(([repo])=>repo);
