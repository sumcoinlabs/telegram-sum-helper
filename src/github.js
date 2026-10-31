// Live, bounded GitHub repository path search. Never search arbitrary user-provided repos.
import {tokens} from './knowledge.js';
const REPOS=[['sumcoin','main'],['sumcoin_flutter','0.0.9'],['insight-sum-api','master'],['insight-sum-ui','master'],['electrumx','master'],['sumcore','master']];
const cache=new Map(); // per-process public path index; at most six entries
const CACHE_MS=60*60*1000;
function scorePath(query,path){const parts=tokens(query),p=path.toLowerCase();let score=0;for(const term of parts)if(p.includes(term))score+=p.split('/').at(-1).includes(term)?4:2;
  if(/(?:readme|changelog|doc\/|migration|faq)/i.test(p))score+=0.5;return score;}
async function paths(repo,branch,fetchImpl,token){
  const key=repo+'/'+branch,now=Date.now(),cached=cache.get(key);if(cached && now<cached.until)return cached.files;
  const url=`https://api.github.com/repos/sumcoinlabs/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  try{const res=await fetchImpl(url,{headers:{'user-agent':'telegram-sum-helper/0.0.1',accept:'application/vnd.github+json',...(token?{authorization:`Bearer ${token}`}:{})},redirect:'error',signal:AbortSignal.timeout(8500)});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();
    const files=(data.tree||[]).filter(e=>e.type==='blob'&&e.path&&e.path.length<=180).map(e=>e.path).slice(0,12000);
    cache.set(key,{files,until:now+CACHE_MS});return files;
  }catch{cache.set(key,{files:[],until:now+60_000});return [];}
}
export async function githubSearch(question,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN||''}={}){
  const query=String(question||'').trim().slice(0,120);if(tokens(query).length<1)return [];
  const all=await Promise.all(REPOS.map(async([repo,branch])=>({repo,branch,files:await paths(repo,branch,fetchImpl,token)})));
  const results=[];
  for(const {repo,branch,files} of all)for(const filepath of files){const sc=scorePath(query,filepath);if(sc<3)continue;
    results.push({repo,path:filepath,score:sc,url:`https://github.com/sumcoinlabs/${repo}/blob/${branch}/${filepath.split('/').map(encodeURIComponent).join('/')}`});}
  return results.sort((a,b)=>b.score-a.score).slice(0,6);
}
