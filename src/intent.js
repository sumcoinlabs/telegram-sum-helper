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
// The truth of a yes/no answer depends on the requested timeline and
// consensus mechanism. Never prepend a fixed "No" to every question.
export function consensusAnswerKind(question=''){
 const q=lower(question);
 if(!q.trim())return 'pow-current'; // preserve the legacy helper default
 const historical=/(?:\b(?:was|were|did|ever|originally|formerly|previously|used to|before|historically|initially|in 2018|at launch)\b|\b(?:era|antes|antiguamente|originalmente|inicialmente|antes de)\b|以前|最初|曾经|かつて|当初|예전|처음|раньше|ранее|бывш|سابق|पहले)/iu.test(q);
 const pos=/(?:proof[ -]?of[ -]?stake|\bpos\b|\bstaking\b|prueba de participaci|prova de participac|preuve d.enjeu|权益证明|ステーキング|지분 증명|إثبات الحصة|доказательств[ао] дол)/iu.test(q);
 const pow=/(?:proof[ -]?of[ -]?work|\bpow\b|\bmineable\b|\bmining\b|\bmined\b|\bmine\b|\bminers?\b|prueba de trabajo|prova de trabalho|preuve de travail|工作量证明|プルーフオブワーク|작업 증명|إثبات العمل|доказательств[ао] работ)/iu.test(q);
 const negated=/(?:\b(?:not|isn't|aren't|doesn't|no longer|never|don't)\b|\b(?:nicht|non|n'est pas|no es|não é)\b|不是|じゃない|아닌)/iu.test(q);
 // Questions comparing both mechanisms or negative questions can be ambiguous;
 // give the unambiguous current-vs-historical facts without a yes/no prefix.
 if((pos&&pow)||negated)return 'neutral';
 if(historical&&pos)return 'pos-historical';
 if(historical&&pow)return 'pow-historical';
 if(pos)return 'pos-current';
 if(pow)return 'pow-current';
 return 'neutral';
}
const YES_POS={
 en:'Yes. Sumcoin currently uses proof-of-stake (PoS). It originally used proof-of-work (PoW), which is now historical.',
 es:'Sí. Sumcoin actualmente usa prueba de participación (PoS). Originalmente utilizaba prueba de trabajo (PoW).',
 pt:'Sim. A rede atual da Sumcoin usa prova de participação (PoS). Originalmente usava prova de trabalho (PoW).',
 fr:'Oui. Le réseau Sumcoin actuel utilise la preuve d’enjeu (PoS). À l’origine, il utilisait la preuve de travail (PoW).',
 de:'Ja. Das aktuelle Sumcoin-Netzwerk verwendet Proof of Stake (PoS). Ursprünglich nutzte es Proof of Work (PoW).',
 it:'Sì. La rete Sumcoin attuale usa Proof of Stake (PoS). Originariamente usava Proof of Work (PoW).',
 ru:'Да. Сейчас Sumcoin использует Proof of Stake (PoS). Раньше сеть работала на Proof of Work (PoW).',
 ar:'نعم. تستخدم شبكة سومكوين الحالية إثبات الحصة (PoS). وكانت تستخدم سابقًا إثبات العمل (PoW).',
 hi:'हाँ। मौजूदा Sumcoin नेटवर्क Proof of Stake (PoS) उपयोग करता है। पहले यह Proof of Work (PoW) पर था।',
 zh:'是的。Sumcoin 当前网络使用权益证明（PoS），最初则使用工作量证明（PoW）。',
 ja:'はい。現在のSumcoinネットワークはProof of Stake（PoS）です。初期はProof of Work（PoW）でした。',
 ko:'네. 현재 Sumcoin 네트워크는 지분 증명(PoS)을 사용합니다. 처음에는 작업 증명(PoW)이었습니다.',
 tr:'Evet. Güncel Sumcoin ağı Proof of Stake (PoS) kullanır. Başlangıçta Proof of Work (PoW) kullanıyordu.',
 id:'Ya. Jaringan Sumcoin saat ini menggunakan Proof of Stake (PoS). Awalnya menggunakan Proof of Work (PoW).'
};
const YES_HISTORICAL={
 en:'Yes. Sumcoin originally used proof-of-work (PoW) and later transitioned to proof-of-stake (PoS), which is used today.',
 es:'Sí. Sumcoin originalmente utilizó prueba de trabajo (PoW); luego cambió a prueba de participación (PoS), que utiliza actualmente.',
 pt:'Sim. Sumcoin começou com prova de trabalho (PoW) e depois passou à prova de participação (PoS), usada atualmente.',
 fr:'Oui. Sumcoin utilisait initialement la preuve de travail (PoW), puis est passé à la preuve d’enjeu (PoS), utilisée aujourd’hui.',
 de:'Ja. Sumcoin verwendete zunächst Proof of Work (PoW) und wechselte dann zum heutigen Proof of Stake (PoS).',
 it:'Sì. Sumcoin usava inizialmente Proof of Work (PoW), poi è passata a Proof of Stake (PoS), in uso oggi.',
 ru:'Да. Изначально Sumcoin использовал Proof of Work (PoW), а затем перешёл на Proof of Stake (PoS), используемый сейчас.',
 ar:'نعم. بدأت سومكوين بإثبات العمل (PoW)، ثم انتقلت إلى إثبات الحصة (PoS) المستخدم حاليًا.',
 hi:'हाँ। Sumcoin शुरुआत में Proof of Work (PoW) पर था, फिर वर्तमान Proof of Stake (PoS) नेटवर्क में बदला।',
 zh:'是的。Sumcoin 最初使用工作量证明（PoW），后来转为现在使用的权益证明（PoS）。',
 ja:'はい。Sumcoinは当初Proof of Work（PoW）でしたが、その後現在のProof of Stake（PoS）へ移行しました。',
 ko:'네. Sumcoin은 처음에 작업 증명(PoW)이었으며, 이후 현재의 지분 증명(PoS)으로 전환했습니다.',
 tr:'Evet. Sumcoin başlangıçta Proof of Work (PoW) kullanıyordu, sonra güncel Proof of Stake (PoS) sistemine geçti.',
 id:'Ya. Sumcoin awalnya menggunakan Proof of Work (PoW), lalu beralih ke Proof of Stake (PoS) yang digunakan sekarang.'
};
const NEUTRAL={
 en:'Sumcoin currently uses proof-of-stake (PoS). It originally used proof-of-work (PoW) before migrating to PoS. Older mining guides describe the previous network.',
 es:'Sumcoin usa actualmente prueba de participación (PoS). Antes utilizaba prueba de trabajo (PoW). Las guías antiguas se refieren a la red anterior.',
 pt:'A Sumcoin usa atualmente prova de participação (PoS). Originalmente usava prova de trabalho (PoW). Guias de mineração antigos referem-se à rede anterior.',
 fr:'Sumcoin utilise actuellement la preuve d’enjeu (PoS). À l’origine, elle utilisait la preuve de travail (PoW). Les anciennes instructions concernent le réseau précédent.',
 de:'Sumcoin verwendet aktuell Proof of Stake (PoS). Ursprünglich wurde Proof of Work (PoW) genutzt. Ältere Mining-Anleitungen gelten für das vorherige Netzwerk.',
 it:'Sumcoin usa attualmente Proof of Stake (PoS). Inizialmente utilizzava Proof of Work (PoW). Le vecchie guide riguardano la rete precedente.',
 ru:'Сейчас Sumcoin использует Proof of Stake (PoS). Изначально сеть работала на Proof of Work (PoW). Старые инструкции относятся к прошлой сети.',
 ar:'تستخدم سومكوين حاليًا إثبات الحصة (PoS). وكانت تستخدم في البداية إثبات العمل (PoW). إرشادات التعدين القديمة تخص الشبكة السابقة.',
 hi:'Sumcoin अभी Proof of Stake (PoS) उपयोग करता है। पहले इसका नेटवर्क Proof of Work (PoW) पर था। पुराने माइनिंग निर्देश पहले के नेटवर्क के हैं।',
 zh:'Sumcoin 当前采用权益证明（PoS），最初采用工作量证明（PoW）。旧挖矿指南描述的是先前的网络。',
 ja:'現在のSumcoinはProof of Stake（PoS）です。当初はProof of Work（PoW）で、古いマイニング手順は以前のネットワーク向けです。',
 ko:'현재 Sumcoin은 지분 증명(PoS)을 사용합니다. 초기에는 작업 증명(PoW)이었으며, 오래된 채굴 안내는 이전 네트워크에 관한 것입니다.',
 tr:'Sumcoin şu anda Proof of Stake (PoS) kullanıyor. İlk ağı Proof of Work (PoW) idi. Eski madencilik rehberleri önceki ağı anlatır.',
 id:'Sumcoin saat ini menggunakan Proof of Stake (PoS). Awalnya Proof of Work (PoW). Panduan penambangan lama membahas jaringan sebelumnya.'
};
export function isPoSConfirmation(text){
 return /^(?:so|therefore|then|okay|ok|right|entonces|asi que|assim|donc|also|quindi|entao|つまり|那么|그래서|значит|إذًا|तो)\s+(?:(?:it|that|sumcoin|sum)(?:'s| is| uses)?\s+)?(?:is\s+|uses\s+)?(?:proof[ -]?of[ -]?stake|pos)\s*[.!?]?$|^(?:so|okay|ok)\s+(?:sumcoin|sum)\s+(?:is\s+)?(?:pos|proof[ -]?of[ -]?stake)\s*[.!?]?$/iu.test(lower(text).trim());
}
export function consensusReply(lang='en',question=''){
 const kind=consensusAnswerKind(question);
 if(kind==='pos-current')return `${YES_POS[lang]||YES_POS.en}\n\nhttps://www.sumcoin.org/about/`;
 if(kind==='pow-historical')return `${YES_HISTORICAL[lang]||YES_HISTORICAL.en}\n\nhttps://www.sumcoin.org/about/`;
 if(kind==='neutral')return `${NEUTRAL[lang]||NEUTRAL.en}\n\nhttps://www.sumcoin.org/about/`;
 if(kind==='pos-historical')return `${lang==='en'?'No. Sumcoin originally used proof-of-work (PoW), not proof-of-stake (PoS). Today it uses PoS.':NEUTRAL[lang]||NEUTRAL.en}\n\nhttps://www.sumcoin.org/about/`;
 // Present-day PoW/mining questions keep the old, correct negative answer.
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
