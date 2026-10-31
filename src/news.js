// News discovery is an attributable headline/description index; never copies full articles.
// Articles may include opinions, allegations, paid press releases and historic PoW terms.
import fs from 'node:fs';import path from 'node:path';
export const NEWS_SOURCES=[
 {url:'https://www.sumcoinindex.com/news/sumcoin-at-5-and-whats-next.php',label:'Sumcoin Index: project retrospective (2023)'},
 {url:'https://www.accessnewswire.com/newsroom/en/blockchain-and-cryptocurrency/bmcs-launches-the-first-crypto-investment-fund-for-sumcoin-687976',label:'ACCESSWIRE: BMCS press release (2022)'},
 {url:'https://www.technologyreview.com/2026/09/10/1143588/indxcoin-god-regalados-sell-crypto-investors-lost-everything/',label:'MIT Technology Review: INDXcoin and Sumcoin reporting (2026)'}
];
function unescape(s){return String(s||'').replace(/&quot;|&#34;/gi,'"').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');}
function meta(html,name){const tags=html.match(/<meta\b[^>]*>/gi)||[];for(const tag of tags){const key=(tag.match(/(?:name|property)=["']([^"']+)["']/i)||[])[1];if(key!==name)continue;return unescape((tag.match(/content=["']([^"']*)["']/i)||[])[1]||'');}return '';}
export async function syncNews({fetchImpl=fetch,out='./data/news.json',onProgress=()=>{}}={}){
 const docs=[],failures=[];
 for(let i=0;i<NEWS_SOURCES.length;i++){
  const {url,label}=NEWS_SOURCES[i];try{
   const r=await fetchImpl(url,{redirect:'error',headers:{accept:'text/html','user-agent':'SumcoinHelper/0.0.10-public-meta'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('HTTP '+r.status);if(Number(r.headers?.get?.('content-length')||0)>900000)throw Error('Article too large');
   const html=await r.text();if(Buffer.byteLength(html)>900000)throw Error('Article too large');
   const headline=meta(html,'og:title')||meta(html,'twitter:title')||label;
   const summary=meta(html,'description')||meta(html,'og:description');
   if(!summary||summary.length<25)throw Error('No suitable publisher description');
   // Short publisher-supplied summaries only. Never auto-generate protocol assertions.
   const description=summary.slice(0,300);
   if(!/sumcoin|indxcoin|regalados|bmcs/i.test(headline+' '+description))throw Error('Not a relevant Sumcoin story');
   docs.push({id:`news-${i}`,title:`${headline.slice(0,170)} (journalism / press, unreviewed)`,text:description,source:url,reviewed:false,date:meta(html,'article:published_time').slice(0,30),publisher:label});
   onProgress(`News indexed: ${label}`);
  }catch(e){failures.push({url,reason:e.message});onProgress(`News skipped: ${label}: ${e.message}`);}
 }
 if(!docs.length)throw Error('No news metadata available; existing index preserved');
 fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});const t=out+'.'+process.pid+'.new';fs.writeFileSync(t,JSON.stringify({indexedAt:new Date().toISOString(),reviewed:false,documents:docs,failures},null,2)+'\n',{mode:0o600});fs.renameSync(t,out);
 return {articles:docs.length,failures:failures.length};
}
