// Offline import for user-provided X archive/social post records.
// No scraping, credentials, remote API requests, or automatic factual promotion.
import fs from 'node:fs';
import path from 'node:path';
import {containsSecret} from './privacy.js';
const DEFAULT_FILE=new URL('../data/social-posts.json',import.meta.url);
const MAX_POSTS=3000;
function dataFromText(input){
  const text=String(input||'').trim();
  // X's official user archive contains JS assignments (e.g. window.YTD.tweets.part0 = [...]).
  // Strip only that fixed prefix; use JSON.parse, NEVER eval() or a JS interpreter.
  const cleaned=text.replace(/^window\.YTD\.(?:tweets|tweet)\.part\d+\s*=\s*/,'').replace(/;\s*$/,'').trim();
  const parsed=JSON.parse(cleaned);
  const entries=Array.isArray(parsed)?parsed:(parsed.posts||parsed.tweets||parsed.data||[]);
  if(!Array.isArray(entries))throw Error('Expected an array or an object containing posts/tweets/data.');
  return entries;
}
function clean(text){return String(text||'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,' ').replace(/\s+/g,' ').trim();}
const relevant=text=>/#sumcoin\b|\bsumcoin\b|\bsumcoinindex\b|\bsumcoinwallet\b|\bsumcoinmarketplace\b/iu.test(text);
const extractHandle=person=>String(person||'').replace(/^@/,'').trim().toLowerCase();
function acceptedUrl(url,author,id){
  if(id && /^\d{8,22}$/.test(String(id)) && /^[a-z0-9_]{1,15}$/i.test(author))return `https://x.com/${author}/status/${id}`;
  try{const u=new URL(url);if(u.protocol!=='https:'||!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(u.hostname))return null;
    const match=u.pathname.match(/^\/([a-z0-9_]{1,15})\/status\/(\d{8,22})(?:\/)?$/i);
    if(!match||match[1].toLowerCase()!==author)return null;
    return `https://x.com/${match[1]}/status/${match[2]}`;
  }catch{return null;}
}
export function importSocial(input,{out=DEFAULT_FILE,account='',max=MAX_POSTS,append=false}={}){
  const records=dataFromText(input);
  const docs=[];const seen=new Set();let skipped=0;
  const expected=extractHandle(account);
  if(expected && !/^[a-z0-9_]{1,15}$/.test(expected))throw Error('Invalid account handle.');
  for(const r of records){
    if(docs.length>=Math.min(max,MAX_POSTS))break;
    const t=r?.tweet||r;
    const author=extractHandle(t.user?.screen_name||t.author?.username||t.author||t.username||r.author||expected);
    const content=clean(t.full_text||t.text||r.full_text||r.text);
    // An archive's tweet records may omit author; --account verifies user intent,
    // but imports still remain unreviewed even when a handle is declared.
    if(!author || (expected&&author!==expected) || !/^[a-z0-9_]{1,15}$/.test(author) ||
       content.length<18 || content.length>3000 || containsSecret(content) || !relevant(content)){
      skipped++;continue;
    }
    // $SUM alone is ambiguous across many assets; exclude until it names Sumcoin.
    const id=t.id_str||t.id||r.id;
    const source=acceptedUrl(t.url||r.url||'',author,id);
    if(!source||seen.has(source)){skipped++;continue;}
    seen.add(source);
    const date=String(t.created_at||r.created_at||r.date||'');
    docs.push({id:`social-${author}-${String(id||source.split('/').at(-1))}`,
      title:`${author==='sumcoinindex'?'Official account post':'Community post'} @${author} — ${date.slice(0,40)} (unreviewed)`,
      text:content,source,author,date:date.slice(0,40),reviewed:false,provenance:'user-supplied-X-archive'});
  }
  const file=out instanceof URL?out:path.resolve(out);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  let prior=[];
  if(append){try{const prev=JSON.parse(fs.readFileSync(file,'utf8'));if(Array.isArray(prev.documents))prior=prev.documents.filter(x=>x?.kind!=='curated'&&x?.reviewed===false&&/^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{8,22}$/.test(x.source||''));}catch(e){if(e.code!=='ENOENT')throw e;}}
  const all=[...prior,...docs];
  const unique=[...new Map(all.map(d=>[d.source,d])).values()].slice(-MAX_POSTS);
  const payload={schemaVersion:1,generatedAt:new Date().toISOString(),reviewed:false,note:'User-supplied X posts: discoverable but not verified protocol facts. $SUM without Sumcoin context excluded.',documents:unique};
  const tmp=String(file)+'.'+process.pid+'.new';fs.writeFileSync(tmp,JSON.stringify(payload,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);
  return {imported:docs.length,stored:unique.length,skipped};
}
