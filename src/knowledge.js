import fs from 'node:fs';
import path from 'node:path';

export const CURATED_FILE = new URL('../knowledge/curated.json', import.meta.url);
export const SYNC_FILE = new URL('../data/synced.json', import.meta.url);
const STOP = new Set('a an the is are was were be been to in on at for my me i it of we you your and or do does did can could how what why where when who this that with from some any there please help like have has had about tell would want need get very just more into by through does they them are our an as should my he she an 100 200'.split(' '));
const ES = {retirar:'withdraw',sacar:'withdraw',dinero:'money',dolares:'usd',billetera:'wallet',monedero:'wallet',saldo:'balance',vender:'sell',comprar:'buy',como:'how',puedo:'can',sumcoin:'sumcoin',monedas:'coins',perdido:'missing',perdi:'missing',recuperar:'recover',frase:'phrase',semilla:'seed',enviar:'send',recibir:'receive',estafa:'scam',cuanto:'how',por:'for',favor:'please',recompensas:'staking',apostar:'staking',recompensa:'staking'};
export function normalize(text) {
  return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
export function tokens(text) {
  return (normalize(text).match(/[a-z0-9]+/g)||[])
    .map(w=>ES[w]||w).filter(w=>w.length>2 && !STOP.has(w)).map(w=>w.endsWith('ing')&&w.length>6?w.slice(0,-3):w.endsWith('s')&&w.length>5?w.slice(0,-1):w);
}
export function tokenizeSet(text) { return [...new Set(tokens(text))]; }
function readJson(file, fallback) { try {return JSON.parse(fs.readFileSync(file,'utf8'));} catch(e) {if(e.code==='ENOENT')return fallback; throw e;} }
export class Knowledge {
  constructor(options={}) {
    this.curated = readJson(options.curatedFile||CURATED_FILE,{articles:[]}).articles;
    this.synced = readJson(options.syncFile||SYNC_FILE,{documents:[]}).documents;
    this.learned = options.learned||[];
  }
  documents() {
    const primary = this.curated.map(a=>({...a,kind:'curated',body:a.text}));
    const learned = this.learned.filter(a=>a.status==='approved').map(a=>({...a,kind:'admin-approved',body:a.text}));
    const synced = this.synced.filter(a=>a.source&&a.text).map(a=>({...a,kind:'synced',body:a.text}));
    return [...primary,...learned,...synced];
  }
  search(input,{limit=5}={}) {
    const terms = tokenizeSet(input), q=normalize(input);
    if(!terms.length)return [];
    const scored = [];
    for(const d of this.documents()) {
      const title = tokenizeSet(d.title||'');
      const tag = tokenizeSet((d.tags||[]).join(' '));
      const body = tokenizeSet((d.body||'').slice(0,18000));
      const tset=new Set(title), tagset=new Set(tag), bset=new Set(body);
      let score=0, matched=0;
      for(const term of terms){
        if(tset.has(term)){score+=5;matched++;}
        else if(tagset.has(term)){score+=4;matched++;}
        else if(bset.has(term)){score+=1.2;matched++;}
      }
      if(d.id==='cashout' && /withdraw|cash\s*out|retirar|sacar|redeem/.test(q))score+=6;
      if(d.id==='missing-balance' && /zero|missing|disappear|gone|empty|lost.*coin/.test(q))score+=8;
      if(d.id==='legacy' && /slice|bip32|migration|migrate|legacy|old (?:sum|wallet)|pow/.test(q))score+=6;
      if(d.id==='staking' && /staking|stake|mint|reward/.test(q))score+=6;
      if(d.id==='seed' && /recovery|restore|seed|phrase|private key/.test(q))score+=6;
      if(d.id==='pending' && /pending|not arrived|sent.*arrive|transaction|txid|unconfirmed/.test(q))score+=6;
      if(d.id==='security' && /scam|hack|fraud|phish/.test(q))score+=6;
      if(d.id==='irreversible'&& /cancel|undo|reverse|wrong address|refund/.test(q))score+=6;
      if(d.id==='index'&&/why.*price|index|calculated|valuation/.test(q))score+=5;
      if(d.id==='buy'&&/where (?:can|do).*buy|exchange list|kiosk|atm|coinbase/.test(q))score+=6;
      if(d.kind==='curated')score*=1.2;
      if(d.kind==='synced')score*=0.72;
      const coverage=matched / Math.max(terms.length,1);
      if(score>=3 && (coverage>=0.16 || score>=8))scored.push({...d,score:Math.round(score*100)/100,coverage});
    }
    return scored.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  find(id) {return this.documents().find(d=>d.id===id);}
}
export function citationUrls(docs,max=3){
  const found=[];
  for(const d of docs){for(const url of (d.sources||[d.source])){
    if(url && /^https:\/\/(?:www\.)?(?:sumcoin\.org|sumcoinwallet\.org|sumcoinindex\.com|github\.com|raw\.githubusercontent\.com|docs\.sumcoin\.org|t\.me)(?:\/|$)/i.test(url) && !found.includes(url))found.push(url);
    if(found.length>=max)return found;
  }}return found;
}
