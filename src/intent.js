// Carefully scoped natural-language intents, not a generative language model.
// Explicit currency names take precedence over interface locale.
const lower=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const aliases={
 USD:['usd','us dollar','us dollars','american dollar','american dollars','dollar','dollars','bucks'],
 JPY:['jpy','yen','japanese yen','円','日本円','日元','日圓','엔'],
 EUR:['eur','euro','euros','€'],
 GBP:['gbp','british pound','british pounds','pound sterling','pounds sterling','sterling','£'],
 BRL:['brl','brazilian real','brazilian reais','reais','real brasileiro'],
 MXN:['mxn','mexican peso','mexican pesos','pesos mexicanos'],
 CAD:['cad','canadian dollar','canadian dollars'],
 AUD:['aud','australian dollar','australian dollars'],
 INR:['inr','indian rupee','indian rupees','rupees','रुपये'],
 CNY:['cny','chinese yuan','yuan','renminbi','人民币','人民币'],
 KRW:['krw','korean won','won','원'],
 RUB:['rub','russian ruble','russian rubles','roubles','рубль','рублей'],
 IDR:['idr','indonesian rupiah','rupiah'],
 TRY:['try','turkish lira','lira turca'],
 ARS:['ars','argentine peso','argentine pesos'],
 COP:['cop','colombian peso','colombian pesos'],
 CLP:['clp','chilean peso','chilean pesos'],
 PEN:['pen','peruvian sol','peruvian soles'],
 AED:['aed','uae dirham','emirati dirham','dirhams'],
 ZAR:['zar','south african rand','rand'],
 CHF:['chf','swiss franc','swiss francs'],
 CZK:['czk','czech koruna','czech korunas'],
 DKK:['dkk','danish krone'],
 HUF:['huf','hungarian forint'],
 PLN:['pln','polish zloty','zloty'],
 RON:['ron','romanian leu'],
 SEK:['sek','swedish krona'],
 ISK:['isk','icelandic krona'],
 NOK:['nok','norwegian krone'],
 HKD:['hkd','hong kong dollar','hong kong dollars'],
 ILS:['ils','israeli shekel','israeli shekels'],
 MYR:['myr','malaysian ringgit'],
 PHP:['php','philippine peso','philippine pesos'],
 SGD:['sgd','singapore dollar','singapore dollars'],
 THB:['thb','thai baht','baht'],
 CRC:['crc','costa rican colon','costa rican colones'],
 NZD:['nzd','new zealand dollar','new zealand dollars'],
 BTC:['btc','bitcoin'] // Not normally offered by fiat feed; fails safely.
};
const tokenize=s=>lower(s).replace(/[\u00a0\u200b]/g,' ').replace(/[?!,:;()]/g,' ');
function literalMatch(text,phrase){
  const p=lower(phrase);
  if(/[^a-z0-9 ]/.test(p))return text.includes(p);
  return new RegExp('(?:^|[^\\p{L}\\p{N}])'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}\\p{N}])','u').test(text);
}
export function requestedCurrency(text){
  const s=tokenize(text);
  // Phrases such as 'in Japanese yen', 'a euros', or 'in BRL'.
  const sought=s.match(/(?:\b(?:in|to|into|as|en|em|por|a|currency|moneda|moeda|valuta|devise|通貨|で)\s+)([^\n.]{1,52})/iu)?.[1]||'';
  const candidates=[sought,s];
  for(const scope of candidates){
    // ISO codes are explicit, including /price-like natural requests.
    for(const code of Object.keys(aliases))if(literalMatch(scope,code.toLowerCase()))return code;
    // Prefer the longest matching name. Otherwise "Canadian dollars" becomes USD.
    const names=Object.entries(aliases).flatMap(([code,words])=>words.map(word=>({code,word})))
      .sort((a,b)=>b.word.length-a.word.length);
    for(const {code,word} of names)if(literalMatch(scope,word))return code;
  }
  return null;
}
const coin=/(?:\bsumcoin\b|\bsum\b|#sumcoin|\$sum|サムコイン|섬코인|苏姆币)/iu;
const pricing=/(?:\bprice\b|\brate\b|\bworth\b|\bvalue\b|\bquote\b|\bvalued\b|how much|how many (?:yen|euros?|dollars?|pounds?|rupees?|reais)|\bprecio\b|\bvalor\b|\bcotizaci|\bpreco\b|\bquanto vale\b|\bprix\b|\bpreis\b|\bprezzo\b|\bkurs\b|\bprecio\b|\bfiyat\b|\bharga\b|цена|стоимость|السعر|कीमत|价格|价值|価格|いくら|시세|가격)/iu;
const formula=/(?:\bcalculat|\bformula\b|methodolog|\bindex.*(?:work|derive)|\bhow.*(?:track|weigh)|\bcomo.*calcul|\bcómo.*calcul|计算方法|計算方法)/iu;
const transaction=/(?:\bmigrat|\bmigration\b|\bwithdraw|\bcash.out|\bstaking rewards?\b|\btransfer fee\b|\btransaction fee\b|\bbuy\b|\bsell\b|\bpay\b|\btax\b)/iu;
export function priceIntent(q){
  const s=tokenize(q);if(!coin.test(s)||formula.test(s)||transaction.test(s))return null;
  const explicit=requestedCurrency(q);
  // Don't treat a casual mention of 'Sumcoin' + 'dollars' as a price request.
  const quantityConversion=/(?:\b(?:how many|convert|what is|what's|whats)\b.*\b(?:sumcoin|sum)\b.*\b(?:in|to)\b|\b(?:[\d,.]+)\s*(?:sumcoin|sum)\s+(?:in|to)\s+)/iu.test(s) && explicit;
  if(!pricing.test(s)&&!quantityConversion)return null;
  if(!/[?¿？]/u.test(q) && !(explicit&&/^(?:what|how|show|tell|please|convert|price|rate|sumcoin|sum|\$sum|[0-9])/iu.test(s)) && !/(?:^(?:sumcoin|sum|\$sum)\s+(?:price|rate|value|worth)(?:\s+(?:today|now|current|live))?$|^(?:current|live)\s+sumcoin\s+(?:price|rate)|^(?:price|rate)\s+(?:of|for)\s+sumcoin$|how much|quanto|cuanto)/iu.test(s))return null;
  // A user can ask the rate without 'current': 'Sumcoin price in yen?'
  const matches=[...s.matchAll(/(?:\b([\d,]+(?:\.\d+)?)\s*(?:sumcoin|sum\b)|\b(?:sumcoin|sum)\s*([\d,]+(?:\.\d+)?))/giu)];
  let amount=1;
  if(matches.length){const parsed=Number((matches[0][1]||matches[0][2]).replace(/,/g,''));if(Number.isFinite(parsed)&&parsed>0&&parsed<=1_000_000)amount=parsed;}
  return {currency:explicit,amount};
}
// Only answer CURRENT consensus, not nuanced migration requests or old chain investigations.
export function consensusIntent(q){
  const s=tokenize(q);
  if(!coin.test(s)||/\bmigrat|\bimport|\brecover|\brestore|\bfee|\bhack|\binvest|\battack/i.test(s))return false;
  return /(?:proof[ -]?of[ -]?work|proof[ -]?of[ -]?stake|\bpow\b|\bpos\b|\bconsensus\b|\bmining\b|\bmined\b|\bminer\b|\bmineable\b|prueba de trabajo|prueba de participaci|prova de trabalho|prova de participac|preuve de travail|preuve d.enjeu|arbeitsnachweis|доказательств[ао] работ|доказательств[ао] дол|工作量证明|权益证明|プルーフオブワーク|プルーフオブステーク|작업 증명|지분 증명)/iu.test(s);
}
export function consensusReply(lang='en'){
 const translations={
 en:'No. Sumcoin originally used proof-of-work (PoW), but the current Sumcoin network uses proof-of-stake (PoS). Older mining guides describe the previous network.',
 es:'No. Sumcoin utilizó originalmente prueba de trabajo (PoW), pero la red actual funciona con prueba de participación (PoS). Las antiguas guías de minería son históricas.',
 pt:'Não. Sumcoin começou com prova de trabalho (PoW), mas a rede atual usa prova de participação (PoS). Os guias antigos de mineração são históricos.',
 fr:'Non. Sumcoin utilisait initialement la preuve de travail (PoW), mais le réseau actuel utilise la preuve d’enjeu (PoS). Les anciens guides de minage sont historiques.',
 de:'Nein. Sumcoin verwendete ursprünglich Proof of Work (PoW). Das aktuelle Netzwerk verwendet Proof of Stake (PoS). Alte Mining-Anleitungen sind historisch.',
 it:'No. Sumcoin utilizzava inizialmente Proof of Work (PoW), ma la rete attuale utilizza Proof of Stake (PoS). Le vecchie guide al mining sono storiche.',
 ru:'Нет. Изначально Sumcoin использовал Proof of Work (PoW), но нынешняя сеть работает на Proof of Stake (PoS). Старые инструкции по майнингу устарели.',
 ar:'لا. استخدمت Sumcoin في البداية إثبات العمل (PoW)، لكن الشبكة الحالية تستخدم إثبات الحصة (PoS). إرشادات التعدين القديمة تاريخية.',
 hi:'नहीं। Sumcoin ने शुरुआत में Proof of Work (PoW) इस्तेमाल किया था, लेकिन वर्तमान नेटवर्क Proof of Stake (PoS) उपयोग करता है। पुराने माइनिंग निर्देश ऐतिहासिक हैं।',
 zh:'不是。Sumcoin 最初使用工作量证明（PoW），但当前网络采用权益证明（PoS）。旧版挖矿指南仅供历史参考。',
 ja:'いいえ。Sumcoinは当初Proof of Work（PoW）でしたが、現在のネットワークはProof of Stake（PoS）です。古いマイニング手順は過去の情報です。',
 ko:'아니요. Sumcoin은 처음에 작업 증명(PoW)을 사용했지만 현재 네트워크는 지분 증명(PoS)을 사용합니다. 예전 채굴 안내는 과거 정보입니다.',
 tr:'Hayır. Sumcoin başlangıçta Proof of Work (PoW) kullandı, ancak güncel ağ Proof of Stake (PoS) kullanır. Eski madencilik rehberleri geçmişe aittir.',
 id:'Tidak. Sumcoin awalnya memakai Proof of Work (PoW), tetapi jaringan saat ini memakai Proof of Stake (PoS). Panduan penambangan lama adalah informasi historis.'
 };
 return `${translations[lang]||translations.en}\n\nhttps://www.sumcoin.org/about/`;
}
