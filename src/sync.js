// Curated, fixed allowlist. No group member can add arbitrary remote URL targets.
import fs from 'node:fs';
import path from 'node:path';
const SOURCES = Object.freeze([
  ['https://www.sumcoin.org/about/','Official: Sumcoin about / consensus / index'],
  ['https://www.sumcoin.org/faq/','Official: transaction and wallet FAQ'],
  ['https://www.sumcoin.org/migrations/','Official: legacy wallet migration (terms can change)'],
  ['https://www.sumcoin.org/sumcoin-marketplace/','Official: peer-to-peer trade'],
  ['https://sumcoinwallet.org/','Official: Electrum wallet and recovery'],
  ['https://www.sumcoinindex.com/white-paper.html','Official: project white paper (claims are project statements)'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoin/main/README.md','GitHub: Sumcoin Core overview'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoin/main/doc/README.md','GitHub: Sumcoin Core docs index'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoin/main/doc/JSON-RPC-interface.md','GitHub: Sumcoin Core RPC interface'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoin_flutter/0.0.9/README.md','GitHub: Sumcoin mobile wallet'],
  ['https://raw.githubusercontent.com/sumcoinlabs/insight-sum-api/master/README.md','GitHub: explorer API'],
  ['https://raw.githubusercontent.com/sumcoinlabs/insight-sum-ui/master/README.md','GitHub: explorer UI'],
  ['https://raw.githubusercontent.com/sumcoinlabs/electrumx/master/README.rst','GitHub: ElectrumX server'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoinlib/master/README.md','GitHub: sumcoinlib overview'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoinlib/master/CHANGELOG.md','GitHub: sumcoinlib changes'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoinlib/master/MIGRATION.md','GitHub: sumcoinlib migration'],
  ['https://raw.githubusercontent.com/sumcoinlabs/sumcoinlib/master/VALIDATION.md','GitHub: sumcoinlib validation']
]);
const entity=t=>t.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
export function toText(input,isHtml){
  let t=String(input||'').replace(/<\?(?:php)?[\s\S]*?\?>/gi,'');
  if(isHtml)t=t.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,' ').replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi,' ').replace(/<[^>]+>/g,' ');
  return entity(t).replace(/\[!?\[[^\]]+\]\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
}
export function chunks(t,words=170){const arr=t.split(/\s+/);const out=[];for(let i=0;i<arr.length&&out.length<12;i+=words)out.push(arr.slice(i,i+words).join(' '));return out;}
async function fetchText(url,fetchImpl){
  const res=await fetchImpl(url,{headers:{'user-agent':'telegram-sum-helper/0.0.1 public-docs-sync','accept':'text/html,text/plain,text/markdown'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const len=Number(res.headers.get('content-length')||0);
  if(len>420000)throw new Error('Document too large');
  const body=await res.text();if(Buffer.byteLength(body)>420000)throw new Error('Document too large');
  return body;
}
export async function sync({fetchImpl=fetch,out='./data/synced.json',onProgress=()=>{}}={}){
  const documents=[],failures=[];
  for(const [url,title] of SOURCES){try{
    const raw=await fetchText(url,fetchImpl),parsed=toText(raw,/\.org\/|\.html\b/.test(url)&&!url.includes('raw.githubusercontent.com'));
    if(parsed.length<100)throw new Error('Page too short');
    chunks(parsed).forEach((text,i)=>documents.push({id:`sync-${SOURCES.findIndex(x=>x[0]===url)}-${i}`,title:`${title} — part ${i+1}`,text,source:url}));
    onProgress(`OK ${title}`);
  }catch(e){failures.push({url,error:e.message});onProgress(`SKIP ${title}: ${e.message}`);}}
  if(documents.length<5)throw new Error('Too few documents downloaded. Retaining existing index.');
  fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});const tmp=out+'.'+process.pid+'.new';
  fs.writeFileSync(tmp,JSON.stringify({generatedAt:new Date().toISOString(),sources:SOURCES.length,documents,failures},null,2)+'\n',{mode:0o600});fs.renameSync(tmp,out);
  return {sources:SOURCES.length,documents:documents.length,failures};
}
export { SOURCES };
