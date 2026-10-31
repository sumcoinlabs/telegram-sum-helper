import {ui,preferredCurrency,explorerUI} from './locale-ui.js';
// Read-only fixed-host public API lookups. No arbitrary user-supplied URLs, redirects,
// credentials, RPC access, or writes to a blockchain. Failed lookups never become facts.
const RATE_URL = 'https://rate.slicewallet.org/api/rates';
const EXPLORER = 'https://sumcoin.space';
const MAX_BYTES = 180_000;
const TIMEOUT_MS = 8_000;
export const TXID_RE = /^[a-fA-F0-9]{64}$/;
export const ADDRESS_RE = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{26,62}$/;
const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeNumber = v => (typeof v === 'number' || typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v.trim())) && Number.isFinite(Number(v)) ? Number(v) : null;
const UTC = () => new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC';

async function json(url,fetchImpl){
  let res;
  try{
    res=await fetchImpl(url,{headers:{accept:'application/json','user-agent':'telegram-sum-helper/0.0.6'},redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});
  }catch{throw new Error('Source unreachable or timed out');}
  if(!res.ok)throw new Error(`Source returned HTTP ${res.status}`);
  const type=res.headers?.get?.('content-type')||'';
  if(type&&!/json/i.test(type))throw new Error('Source did not return JSON');
  const len=Number(res.headers?.get?.('content-length')||0);
  if(len>MAX_BYTES)throw new Error('Source response too large');
  let body;
  try{body=await res.text();}catch{throw new Error('Unable to read source response');}
  if(Buffer.byteLength(body)>MAX_BYTES)throw new Error('Source response too large');
  try{return JSON.parse(body);}catch{throw new Error('Unrecognized source JSON');}
}

// Read only a currency record explicitly labelled with the requested ISO code.
// Never synthesize FX conversions from another currency or parse display strings.
export function parseCurrency(input,currency='USD'){
  const code=String(currency).toUpperCase();
  if(!/^[A-Z]{3}$/.test(code))return null;
  const rows=Array.isArray(input)?input
    :Array.isArray(input?.rates)?input.rates
    :Array.isArray(input?.data?.rates)?input.data.rates:null;
  if(rows){
    const found=rows.filter(r=>isPlain(r)&&String(r.code||'').toUpperCase()===code);
    if(found.length!==1)return null;
    const n=safeNumber(found[0].n);
    return n!==null&&n>0&&n<1_000_000_000?n:null;
  }
  if(!isPlain(input))return null;
  const containers=[input,input.rates,input.data,input.data?.rates,input.result,input.price];
  for(const obj of containers){
    if(!isPlain(obj))continue;
    for(const key of [code,code.toLowerCase()]){
      if(!Object.hasOwn(obj,key))continue;
      const value=obj[key];
      const n=safeNumber(isPlain(value)?(value.n??value.rate??value.value??value.price):value);
      if(n!==null&&n>0&&n<1_000_000_000)return n;
    }
  }
  // Legacy USD-specific property aliases, not guessed numeric fields.
  if(code==='USD')for(const value of [input.price_usd,input.sum_usd]){
    const n=safeNumber(value);
    if(n!==null&&n>0&&n<1_000_000_000)return n;
  }
  return null;
}
export const parseUsd=input=>parseCurrency(input,'USD');
export function isCurrencyCode(code){return /^[A-Z]{3}$/.test(String(code||''));}
export function priceCurrency({currency,lang='en',locale='' }={}){
  return currency||preferredCurrency(lang,locale);
}
function formatRate(value,currency,lang){
  const locale={en:'en-US',es:'es-ES',pt:'pt-BR',fr:'fr-FR',de:'de-DE',it:'it-IT',ru:'ru-RU',ar:'ar',hi:'hi-IN',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',tr:'tr-TR',id:'id-ID'}[lang]||'en-US';
  // Include the ISO code in plain text even if a locale shares a currency symbol.
  return new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:6,numberingSystem:'latn'}).format(value);
}
function localize(lang,en,es,pt){return lang==='es'?es:lang==='pt'?pt:en;}
function failure(lang,kind,reason,link){
  // Do not echo potentially sensitive API response bodies or remote error text.
  return localize(lang,`${kind} is temporarily unavailable (${reason}). Check the official source directly: ${link}`,
    `${kind} no está disponible temporalmente (${reason}). Consulta la fuente oficial: ${link}`,
    `${kind} está temporariamente indisponível (${reason}). Consulte a fonte oficial: ${link}`);
}
export async function livePrice({fetchImpl=fetch,lang='en',currency,locale='',fallbackToUsd=false,amount=1}={}){
  const code=String(priceCurrency({currency,lang,locale})).toUpperCase();
  if(!isCurrencyCode(code))return ui(lang,'unsupported');
  try{
    const data=await json(RATE_URL,fetchImpl);
    let value=parseCurrency(data,code);
    let actualCode=code;
    if(value===null && fallbackToUsd && code!=='USD'){
      value=parseCurrency(data,'USD');
      actualCode='USD';
    }
    if(value===null)return `${ui(lang,'unavailable')} (${code})\n${ui(lang,'usage')}\n${ui(lang,'source')}: ${RATE_URL}`;
    const qty=Number.isFinite(amount)&&amount>0&&amount<=1_000_000?amount:1;
    const rate=formatRate(value*qty,actualCode,lang);
    return `${ui(lang,'rate')}\n${qty} SUM ≈ ${rate} ${actualCode}\n${ui(lang,'trades')}\n${ui(lang,'checked')}: ${UTC()}\n${ui(lang,'source')}: ${RATE_URL}`;
  }catch{return `${ui(lang,'failed')}\n${ui(lang,'source')}: ${RATE_URL}`;}
}
export async function liveTransaction(txid,{fetchImpl=fetch,lang='en'}={}){
  if(!TXID_RE.test(txid||''))return explorerUI(lang,8);
  const path=`${EXPLORER}/api/tx/${txid.toLowerCase()}`;
  try{
    const data=await json(path,fetchImpl);
    if(!isPlain(data)||data.txid?.toLowerCase()!==txid.toLowerCase())throw new Error('invalid transaction response');
    const n=safeNumber(data.confirmations);
    const conf=n!==null&&Number.isSafeInteger(n)&&n>=0?n:null;
    const block=Number.isSafeInteger(data.blockheight)&&data.blockheight>0?data.blockheight:Number.isSafeInteger(data.blockHeight)&&data.blockHeight>0?data.blockHeight:null;
    const status=conf===null?explorerUI(lang,7):String(conf);
    return `${explorerUI(lang,0)}: ${txid.toLowerCase()}\n${explorerUI(lang,1)}: ${status}${block?'\n'+explorerUI(lang,2)+': '+block:''}\n${ui(lang,'checked')}: ${UTC()}\n${ui(lang,'source')}: ${path}`;
  }catch{return `${ui(lang,'failed')}\n${ui(lang,'source')}: ${path}`;}
}
export async function liveAddress(address,{fetchImpl=fetch,lang='en'}={}){
  if(!ADDRESS_RE.test(address||''))return `${explorerUI(lang,9)}. ${ui(lang,'safety')}`;
  const path=`${EXPLORER}/api/addr/${address}?noTxList=1`;
  try{
    const data=await json(path,fetchImpl);
    if(!isPlain(data)||(data.addrStr&&data.addrStr!==address))throw new Error('invalid address response');
    const bal=safeNumber(data.balance), unconfirmed=safeNumber(data.unconfirmedBalance), ntx=safeNumber(data.txApperances??data.txAppearances);
    if(bal===null&&unconfirmed===null&&ntx===null)throw new Error('unrecognized address response');
    const lines=[`${explorerUI(lang,3)}: ${address}`];
    if(bal!==null&&bal>=0)lines.push(`${explorerUI(lang,4)}: ${bal} SUM`);
    if(unconfirmed!==null)lines.push(`${explorerUI(lang,5)}: ${unconfirmed} SUM`);
    if(ntx!==null&&Number.isSafeInteger(ntx)&&ntx>=0)lines.push(`${explorerUI(lang,6)}: ${ntx}`);
    lines.push(`${ui(lang,'checked')}: ${UTC()}`,`${ui(lang,'source')}: ${path}`);
    return lines.join('\n');
  }catch{return `${ui(lang,'failed')}\n${ui(lang,'source')}: ${path}`;}
}
