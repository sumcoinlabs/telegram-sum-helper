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
    res=await fetchImpl(url,{headers:{accept:'application/json','user-agent':'telegram-sum-helper/0.0.5'},redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});
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

// The rates API is an external dependency. Only explicitly USD-labeled values
// qualify; arbitrary numeric fields, BTC rates, timestamps and multipliers don't.
export function parseUsd(input){
  const candidates=[input?.USD,input?.usd,input?.rates?.USD,input?.rates?.usd,
    input?.data?.USD,input?.data?.usd,input?.data?.rates?.USD,
    input?.result?.USD,input?.result?.usd,input?.price?.USD,
    input?.price?.usd,input?.price_usd,input?.sum_usd];
  for(const candidate of candidates){
    const v=isPlain(candidate)?(candidate.price??candidate.rate??candidate.value):candidate;
    const n=safeNumber(v);
    if(n!==null&&n>0&&n<1_000_000_000)return n;
  }
  return null;
}
function localize(lang,en,es,pt){return lang==='es'?es:lang==='pt'?pt:en;}
function failure(lang,kind,reason,link){
  // Do not echo potentially sensitive API response bodies or remote error text.
  return localize(lang,`${kind} is temporarily unavailable (${reason}). Check the official source directly: ${link}`,
    `${kind} no está disponible temporalmente (${reason}). Consulta la fuente oficial: ${link}`,
    `${kind} está temporariamente indisponível (${reason}). Consulte a fonte oficial: ${link}`);
}
export async function livePrice({fetchImpl=fetch,lang='en'}={}){
  try{
    const data=await json(RATE_URL,fetchImpl);
    const usd=parseUsd(data);
    if(usd===null)return failure(lang,'SUM/USD','unrecognized rate format',RATE_URL);
    const formatted=usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6});
    return localize(lang,
      `SUM reference index rate: $${formatted} USD per SUM\nChecked: ${UTC()}\nThis is an index reference, not a guaranteed sale or cash-out price.\nSource: ${RATE_URL}`,
      `Valor de referencia del índice SUM: $${formatted} USD por SUM\nConsultado: ${UTC()}\nEs una referencia del índice, no un precio de venta ni retiro garantizado.\nFuente: ${RATE_URL}`,
      `Taxa de referência do índice SUM: US$ ${formatted} por SUM\nConsultado: ${UTC()}\nÉ uma referência do índice, não um preço de venda ou saque garantido.\nFonte: ${RATE_URL}`);
  }catch(err){return failure(lang,'SUM/USD',err.message,RATE_URL);}
}
export async function liveTransaction(txid,{fetchImpl=fetch,lang='en'}={}){
  if(!TXID_RE.test(txid||''))return localize(lang,'Usage: /tx 64-character hexadecimal transaction ID. Never share private keys.','Uso: /tx ID hexadecimal de transacción de 64 caracteres. No compartas claves privadas.','Uso: /tx ID hexadecimal de transação com 64 caracteres. Nunca compartilhe chaves privadas.');
  const path=`${EXPLORER}/api/tx/${txid.toLowerCase()}`;
  try{
    const data=await json(path,fetchImpl);
    if(!isPlain(data)||data.txid?.toLowerCase()!==txid.toLowerCase())throw new Error('invalid transaction response');
    const n=safeNumber(data.confirmations);
    const conf=n!==null&&Number.isSafeInteger(n)&&n>=0?n:null;
    const block=Number.isSafeInteger(data.blockheight)&&data.blockheight>0?data.blockheight:Number.isSafeInteger(data.blockHeight)&&data.blockHeight>0?data.blockHeight:null;
    const status=conf===null?localize(lang,'not verified','sin verificar','não verificado'):conf===0?localize(lang,'0 (unconfirmed)','0 (sin confirmar)','0 (não confirmada)'):`${conf}`;
    return localize(lang,
      `Transaction: ${txid.toLowerCase()}\nConfirmations: ${status}${block?'\nBlock height: '+block:''}\nChecked: ${UTC()}\nSource: ${path}`,
      `Transacción: ${txid.toLowerCase()}\nConfirmaciones: ${status}${block?'\nAltura del bloque: '+block:''}\nConsultado: ${UTC()}\nFuente: ${path}`,
      `Transação: ${txid.toLowerCase()}\nConfirmações: ${status}${block?'\nAltura do bloco: '+block:''}\nConsultado: ${UTC()}\nFonte: ${path}`);
  }catch(err){return failure(lang,localize(lang,'Transaction','Transacción','Transação'),err.message,path);}
}
export async function liveAddress(address,{fetchImpl=fetch,lang='en'}={}){
  if(!ADDRESS_RE.test(address||''))return localize(lang,'Usage: /address PUBLIC_SUM_ADDRESS. Never submit a seed, private key, or password. Addresses posted here are visible to everyone.','Uso: /address DIRECCIÓN_PÚBLICA. No publiques claves ni palabras de recuperación. La dirección será visible para todos.','Uso: /address ENDEREÇO_PÚBLICO. Não publique chaves nem palavras de recuperação. O endereço ficará visível para todos.');
  const path=`${EXPLORER}/api/addr/${address}?noTxList=1`;
  try{
    const data=await json(path,fetchImpl);
    if(!isPlain(data)|| (data.addrStr&&data.addrStr!==address))throw new Error('invalid address response');
    // Require at least one Insight summary field; never treat a 200 HTML-ish message as a wallet.
    const bal=safeNumber(data.balance), unconfirmed=safeNumber(data.unconfirmedBalance), ntx=safeNumber(data.txApperances??data.txAppearances);
    if(bal===null&&unconfirmed===null&&ntx===null)throw new Error('unrecognized address response');
    const lines=[localize(lang,`Public address: ${address}`,`Dirección pública: ${address}`,`Endereço público: ${address}`)];
    if(bal!==null&&bal>=0)lines.push(localize(lang,`Confirmed balance: ${bal} SUM`,`Saldo confirmado: ${bal} SUM`,`Saldo confirmado: ${bal} SUM`));
    if(unconfirmed!==null)lines.push(localize(lang,`Unconfirmed balance: ${unconfirmed} SUM`,`Saldo sin confirmar: ${unconfirmed} SUM`,`Saldo não confirmado: ${unconfirmed} SUM`));
    if(ntx!==null&&Number.isSafeInteger(ntx)&&ntx>=0)lines.push(localize(lang,`Transactions: ${ntx}`,`Transacciones: ${ntx}`,`Transações: ${ntx}`));
    lines.push(`${localize(lang,'Checked','Consultado','Consultado')}: ${UTC()}`,`${localize(lang,'Source','Fuente','Fonte')}: ${path}`);
    return lines.join('\n');
  }catch(err){return failure(lang,localize(lang,'Address lookup','Consulta de dirección','Consulta de endereço'),err.message,path);}
}
