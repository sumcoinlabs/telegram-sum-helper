// Public, read-only SumcoinPrice historical market intelligence.
// Numeric answers are computed ONLY from validated data returned by fixed URLs.
// A bot is never allowed to infer chart observations or invent past prices.
export const MARKET_SITE = 'https://sumcoinprice.com/';
export const MARKET_CHART = 'https://sumcoinprice.com/history/';
export const MARKET_API = 'https://sumcoinprice.com/market.php';
const HISTORY_BASE = 'https://sumcoinprice.com/api/history.php';
const RANGES = new Set(['1d','1w','1m','3m','6m','1y','5y','all']);
const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").normalize('NFC').trim();
const coin = /(?:\bsumcoins?\b|\bsum\b|sumcoinprice(?:\.com)?|サムコイン|섬코인|苏姆币)/iu;
const chart = /\b(?:chart|charts|graph|graphs|candles?|history|historical|historic|price history|historique|graphique|courbe|evolution|historia|grafica|grafico|historico|historica|grafik|preisverlauf|kursverlauf|storico|andamento|historisi|riwayat|gecmisini|gecmisi|gecmis)\b|истори|график|تاريخ|رسم بياني|इतिहास|चार्ट|历史|图表|チャート|履歴|차트|그래프|기록/iu;
const high = /\b(?:all[ -]?time[ -]?high|ath|highest|record high|peak|maximum ever|record price|plus haut|record historique|prix record|mas alto|precio maximo|maximo historico|maior valor|recorde|allzeithoch|hochster|höchster|massimo storico|massimo|rekor tertinggi|tertinggi|tertingginya|en yuksek|rekor|plus eleve|plus haute|prix le plus eleve|mas alto|preco mais alto|maior valor|最高水準)\b|рекорд|максимальн|максимум|أعلى|رقم قياسي|सर्वोच्च|सबसे ऊँचा|最高|最高値|史上最高|最高价|歴代最高|사상 최고|역대 최고/iu;
const performance = /\b(?:performance|perform|gain|gained|lost|change|changed|increase|decrease|rise|fall|return|up or down|past year|last year|past month|last month|past week|last week|past five years|5 years|one year|one month|last 24 hours|30 days|365 days|how (?:did|has).*?(?:do|done)|what about (?:last|past)|variation|evolution|evolucion|rendimiento|desempenho|desempeno|entwicklung|leistung|prestazione|performans|kinerja)\b|изменени|نسبة|تغير|बदलाव|表现|变化|騰落|成績|변동|성과/iu;
const compare = /\b(?:compare|comparison|versus|vs\.?|against|compared|higher than bitcoin|better than bitcoin|bitcoin|btc|compar|vergleich|confronto|bandingkan|karsilastir)\b|比較|对比|비교|сравнен|مقارن|तुलना/iu;
const api = /\b(?:api|endpoint|json|data feed|raw data|developer|technical data|api publique|interfaz|接口)\b/iu;
const price = /\b(?:price|rate|quote|worth|value|precio|prix|preco|cotac|preis|kurs|prezzo|harga|fiyat|valeur|valor|wert|valore)\b|цена|سعر|कीमत|価格|价格|가격/iu;
const ask = /[?¿？؟]|^(?:what|whats|what's|where|when|how|show|tell|give|find|open|link|compare|can|could|please|i want|i need|what about|and|was|were|is|montre|montrez|quel|quelle|quand|ou|comment|et|cuanto|cuando|donde|muestra|mostrar|mostra|quando|onde|wie|wann|wo|zeige|come|quando|dove|mostra|сколько|когда|где|как|покажи|متى|أين|كم|कैसे|कब|कहाँ|多少|什么时候|哪里|どう|いつ|どこ|얼마|언제|어디|ne|nerede|kapan|berapa|bagaimana|di mana)\b/iu;
const shorthand = /^(?:sumcoins?|sum)\s+(?:chart|graph|history|ath|api)$/iu;
// In the dedicated Sumcoin group, an unqualified, standalone ATH question is
// a clear request for SUM's record index value. Do not require the member to
// first click a chart link or state the project name. Keep this narrowly
// bounded to unambiguous complete questions, never fragments of other chat.
const standaloneAth = /^(?:what\s+(?:was|is|has been|were)|what['’]?s|how high (?:was|did)|when was)\s+(?:the\s+)?(?:all[ -]?time[ -]?high|ath|highest(?:\s+(?:price|value|rate))?|peak(?:\s+(?:price|value))?|record(?:\s+(?:price|high))?)(?:\s+(?:ever|reached|recorded))?[?.!]*$/iu;
// A follow-up that explicitly names a *different* coin is NOT a question
// about SUM even when the member has recent Sumcoin market context.
const differentAsset = /\b(?:bitcoin|btc|ethereum|ether|eth|dogecoin|doge|litecoin|ltc|digibyte|dgb|solana|ripple|xrp|cardano)\b/iu;

const rangeFrom = s => {
  if(/\b(?:five years|5 years|5y|cinco anos|cinq ans|funf jahre)\b/u.test(s))return '5y';
  if(/\b(?:past year|last year|one year|1 year|12 months|1y|ano passado|ultimo ano|ano anterior|dernier an|derniere annee|letzte jahr|ultimo anno|ultimo ano|annee derniere|año pasado|ultimo año|tahun lalu|gecen yil)\b|去年|昨年|작년| पिछले साल/u.test(s))return '1y';
  if(/\b(?:three months|3 months|3m)\b/u.test(s))return '3m';
  if(/\b(?:six months|6 months|6m)\b/u.test(s))return '6m';
  if(/\b(?:past month|last month|one month|1 month|30 days|1m|dernier mois|mes pasado|ultimo mes|ultimo mes|ultimo mes|letzten monat|ultimo mese|bulan lalu)\b|先月|지난달/u.test(s))return '1m';
  if(/\b(?:past week|last week|one week|7 days|1w|derniere semaine|semaine derniere|semana passada|semana pasada|letzte woche|minggu lalu)\b|先週|지난주/u.test(s))return '1w';
  if(/\b(?:today|24 hours|24h|1 day|yesterday|1d|aujourd|hoy|hoje|heute|oggi|hari ini)\b|今日|今天|오늘/u.test(s))return '1d';
  return null;
};
export function marketIntent(question, {active=false}={}) {
  const s=normalize(question).slice(0,1000);
  if(!s || !ask.test(s) && !shorthand.test(s) && !/^(?:покажи|расскажи|اعرض|أرني|बताओ|दिखाओ|告诉我|显示|見せて|教えて|보여줘|알려줘)/u.test(s))return null;
  const named=coin.test(s);
  // A group follow-up may omit the coin name ONLY with a recent, same-member
  // market conversation or an explicit reply to the relevant bot message.
  const isHigh=high.test(s), isCompare=compare.test(s), isChart=chart.test(s);
  if(!named&&!active&&!standaloneAth.test(s))return null;
  // Prevent questions about Bitcoin's own ATH being answered with SUM's ATH.
  // Explicit relative comparisons retain their separate, safe routing.
  if(!named&&isHigh&&differentAsset.test(s)&&
     !/\b(?:relative to|compared|comparison|compare|versus|vs|higher than|against|in bitcoin|in btc)\b/iu.test(s))return null;
  if(api.test(s)&&named)return {kind:'api',pair:'usd'};
  if(isHigh)return {kind:'ath',pair:/\b(?:btc|bitcoin)\b/i.test(s)?'btc':'usd'};
  if(isCompare)return {kind:'compare',pair:'btc'};
  const range=rangeFrom(s);
  if(range && (performance.test(s)||isChart||(active&&/^(?:what about|and|et|y|e|und|last|past|what's|what is)/u.test(s))))
    return {kind:'performance',range,pair:'usd'};
  if(isChart)return {kind:'chart',pair:'usd'};
  if(active&&/\b(?:that|it|the value|the rate)\b/u.test(s)&&price.test(s))return {kind:'chart',pair:'usd'};
  return null;
}
const translations = {
 en:{chart:'You can explore Sumcoin’s price history, candlestick charts and Bitcoin comparisons here:',ath:'Sumcoin’s highest recorded {pair} index value was {value} on {date} (UTC).',perf:'Over the past {range}, the recorded SUM/{pair} index changed {change}%. The period high was {high} and the low was {low}.',compare:'Do you mean SUM’s value relative to Bitcoin, or which performed better over a particular period? You can see SUM/BTC history here:',api:'For developers, these are the public SumcoinPrice market and historical-data endpoints:',unavailable:'I couldn’t verify that historical figure from the live dataset just now. You can check the full chart here:',source:'Historical data:',range:{'1d':'24 hours','1w':'week','1m':'month','3m':'three months','6m':'six months','1y':'12 months','5y':'five years','all':'available history'}},
 es:{chart:'Puedes consultar el historial, las velas y las comparaciones con Bitcoin aquí:',ath:'El valor máximo registrado del índice SUM/{pair} fue {value} el {date} (UTC).',perf:'En los últimos {range}, el índice SUM/{pair} cambió {change}%. Máximo: {high}; mínimo: {low}.',compare:'¿Quieres comparar el valor de SUM frente a Bitcoin o su rendimiento durante un período? Consulta el historial SUM/BTC aquí:',api:'Estos son los endpoints públicos de SumcoinPrice para desarrolladores:',unavailable:'No pude verificar ese dato histórico ahora mismo. Puedes consultar el gráfico completo aquí:',source:'Datos históricos:',range:{'1d':'24 horas','1w':'7 días','1m':'30 días','3m':'3 meses','6m':'6 meses','1y':'12 meses','5y':'5 años','all':'historial disponible'}},
 pt:{chart:'Você pode consultar o histórico do Sumcoin, gráficos de velas e comparações com Bitcoin aqui:',ath:'O maior valor registrado do índice SUM/{pair} foi {value} em {date} (UTC).',perf:'Nos últimos {range}, o índice SUM/{pair} variou {change}%. Máxima: {high}; mínima: {low}.',compare:'Você quer comparar o valor do SUM em Bitcoin ou o desempenho dos dois em um período? Veja o histórico SUM/BTC aqui:',api:'Estes são os endpoints públicos do SumcoinPrice para desenvolvedores:',unavailable:'Não consegui verificar esse dado histórico agora. Consulte o gráfico completo aqui:',source:'Dados históricos:',range:{'1d':'24 horas','1w':'7 dias','1m':'30 dias','3m':'3 meses','6m':'6 meses','1y':'12 meses','5y':'5 anos','all':'histórico disponível'}},
 fr:{chart:'Tu peux consulter l’historique du Sumcoin, les chandeliers et les comparaisons avec Bitcoin ici :',ath:'Le plus haut niveau enregistré de l’indice SUM/{pair} était de {value} le {date} (UTC).',perf:'Sur les {range} écoulés, l’indice SUM/{pair} a varié de {change} %. Plus haut : {high} ; plus bas : {low}.',compare:'Tu veux comparer la valeur du SUM en bitcoins ou leurs performances sur une période ? Voici l’historique SUM/BTC :',api:'Voici les API publiques de SumcoinPrice pour les développeurs :',unavailable:'Je n’arrive pas à vérifier ce chiffre historique pour le moment. Le graphique complet est ici :',source:'Données historiques :',range:{'1d':'dernières 24 heures','1w':'7 derniers jours','1m':'30 derniers jours','3m':'3 derniers mois','6m':'6 derniers mois','1y':'12 derniers mois','5y':'5 dernières années','all':'données disponibles'}},
 de:{chart:'Hier findest du den Kursverlauf von Sumcoin mit Kerzencharts und Bitcoin-Vergleichen:',ath:'Der höchste erfasste SUM/{pair}-Indexwert lag am {date} (UTC) bei {value}.',perf:'In den letzten {range} änderte sich der SUM/{pair}-Index um {change} %. Hoch: {high}; Tief: {low}.',compare:'Meinst du den SUM-Wert in Bitcoin oder die Wertentwicklung über einen Zeitraum? Hier ist der SUM/BTC-Verlauf:',api:'Hier sind die öffentlichen SumcoinPrice-API-Endpunkte:',unavailable:'Der historische Wert lässt sich gerade nicht verifizieren. Hier findest du den vollständigen Chart:',source:'Historische Daten:',range:{'1d':'24 Stunden','1w':'7 Tagen','1m':'30 Tagen','3m':'3 Monaten','6m':'6 Monaten','1y':'12 Monaten','5y':'5 Jahren','all':'verfügbaren Zeitraum'}},
 it:{chart:'Qui trovi lo storico di Sumcoin, i grafici a candele e il confronto con Bitcoin:',ath:'Il massimo registrato dell’indice SUM/{pair} è stato {value} il {date} (UTC).',perf:'Negli ultimi {range}, l’indice SUM/{pair} è variato del {change}%. Massimo: {high}; minimo: {low}.',compare:'Vuoi confrontare il valore di SUM in bitcoin o la performance in un periodo? Qui trovi lo storico SUM/BTC:',api:'Queste sono le API pubbliche di SumcoinPrice:',unavailable:'Al momento non riesco a verificare quel dato storico. Puoi consultare il grafico completo qui:',source:'Dati storici:',range:{'1d':'24 ore','1w':'7 giorni','1m':'30 giorni','3m':'3 mesi','6m':'6 mesi','1y':'12 mesi','5y':'5 anni','all':'periodo disponibile'}},
 ru:{chart:'Здесь можно посмотреть историю цены Sumcoin, свечные графики и сравнение с Bitcoin:',ath:'Максимальное зарегистрированное значение индекса SUM/{pair}: {value} на {date} (UTC).',perf:'За последние {range} индекс SUM/{pair} изменился на {change}%. Максимум: {high}; минимум: {low}.',compare:'Вы хотите сравнить цену SUM в биткоинах или доходность за период? История SUM/BTC здесь:',api:'Публичные API SumcoinPrice для разработчиков:',unavailable:'Сейчас не удалось подтвердить историческое значение. Полный график доступен здесь:',source:'Исторические данные:',range:{'1d':'24 часа','1w':'7 дней','1m':'30 дней','3m':'3 месяца','6m':'6 месяцев','1y':'12 месяцев','5y':'5 лет','all':'всю доступную историю'}},
 ar:{chart:'يمكنك مشاهدة تاريخ سعر سومكوين والشموع البيانية ومقارنته ببيتكوين هنا:',ath:'أعلى قيمة مسجلة لمؤشر SUM/{pair} هي {value} بتاريخ {date} (UTC).',perf:'خلال {range} الماضية تغير مؤشر SUM/{pair} بنسبة {change}%. الأعلى: {high} والأدنى: {low}.',compare:'هل تقصد مقارنة قيمة SUM ببيتكوين أم أداءهما خلال فترة معينة؟ تاريخ SUM/BTC هنا:',api:'واجهات SumcoinPrice العامة للمطورين:',unavailable:'تعذر التحقق من القيمة التاريخية الآن. يمكنك مراجعة الرسم الكامل هنا:',source:'البيانات التاريخية:',range:{'1d':'24 ساعة','1w':'7 أيام','1m':'30 يوماً','3m':'3 أشهر','6m':'6 أشهر','1y':'12 شهراً','5y':'5 سنوات','all':'الفترة المتاحة'}},
 hi:{chart:'Sumcoin का पुराना मूल्य, कैंडल चार्ट और Bitcoin से तुलना यहाँ देख सकते हैं:',ath:'SUM/{pair} सूचकांक का सबसे ऊँचा दर्ज मूल्य {value} था, दिनांक {date} (UTC)।',perf:'पिछले {range} में SUM/{pair} सूचकांक {change}% बदला। अधिकतम: {high}, न्यूनतम: {low}।',compare:'आप SUM का Bitcoin में मूल्य जानना चाहते हैं या किसी अवधि में प्रदर्शन की तुलना? SUM/BTC इतिहास यहाँ है:',api:'डेवलपर्स के लिए SumcoinPrice के सार्वजनिक API:',unavailable:'अभी ऐतिहासिक आँकड़ा सत्यापित नहीं हो सका। पूरा चार्ट यहाँ देखें:',source:'ऐतिहासिक आँकड़े:',range:{'1d':'24 घंटे','1w':'7 दिन','1m':'30 दिन','3m':'3 महीने','6m':'6 महीने','1y':'12 महीने','5y':'5 साल','all':'उपलब्ध इतिहास'}},
 zh:{chart:'你可以在这里查看 Sumcoin 历史价格、K 线图以及与比特币的比较：',ath:'SUM/{pair} 指数记录的历史最高值为 {value}，日期为 {date}（UTC）。',perf:'过去 {range}，SUM/{pair} 指数变动 {change}%。最高 {high}，最低 {low}。',compare:'你想比较 SUM 相对比特币的价格，还是比较一段时间内的涨跌幅？SUM/BTC 历史数据在这里：',api:'SumcoinPrice 面向开发者的公开 API：',unavailable:'目前无法核实该历史数值。完整图表在这里：',source:'历史数据：',range:{'1d':'24 小时','1w':'7 天','1m':'30 天','3m':'3 个月','6m':'6 个月','1y':'12 个月','5y':'5 年','all':'全部可用历史'}},
 ja:{chart:'Sumcoin の過去の価格、ローソク足、ビットコインとの比較はこちらです：',ath:'SUM/{pair} 指数の記録上の最高値は {date}（UTC）の {value} です。',perf:'過去 {range} の SUM/{pair} 指数変動率は {change}% です。高値 {high}、安値 {low}。',compare:'SUM のビットコイン建て価格と、期間中の値動きの比較のどちらですか？SUM/BTC の履歴はこちら：',api:'開発者向け SumcoinPrice 公開 API：',unavailable:'現在、過去の数値を検証できません。チャートはこちらです：',source:'履歴データ：',range:{'1d':'24 時間','1w':'7 日','1m':'30 日','3m':'3 か月','6m':'6 か月','1y':'12 か月','5y':'5 年','all':'全履歴'}},
 ko:{chart:'Sumcoin의 과거 가격, 캔들 차트, 비트코인 비교를 여기에서 볼 수 있습니다:',ath:'SUM/{pair} 지수의 기록상 최고값은 {date}(UTC)에 {value}였습니다.',perf:'지난 {range} 동안 SUM/{pair} 지수 변동률은 {change}%입니다. 최고 {high}, 최저 {low}.',compare:'SUM의 비트코인 기준 가격과 일정 기간의 수익률 중 무엇을 비교하시나요? SUM/BTC 기록은 여기에서 볼 수 있습니다:',api:'개발자를 위한 SumcoinPrice 공개 API:',unavailable:'현재 과거 수치를 검증할 수 없습니다. 전체 차트는 여기에서 확인하세요:',source:'과거 데이터:',range:{'1d':'24시간','1w':'7일','1m':'30일','3m':'3개월','6m':'6개월','1y':'12개월','5y':'5년','all':'전체 기록'}},
 tr:{chart:'Sumcoin fiyat geçmişini, mum grafiklerini ve Bitcoin karşılaştırmalarını burada görebilirsin:',ath:'SUM/{pair} endeksinin kaydedilen en yüksek değeri {date} (UTC) tarihinde {value} idi.',perf:'Son {range} içinde SUM/{pair} endeksi %{change} değişti. En yüksek {high}, en düşük {low}.',compare:'SUM’un Bitcoin cinsinden değerini mi, yoksa bir dönemdeki performanslarını mı karşılaştırmak istiyorsun? SUM/BTC geçmişi burada:',api:'Geliştiriciler için SumcoinPrice genel API adresleri:',unavailable:'Şu anda tarihsel veriyi doğrulayamıyorum. Tam grafik burada:',source:'Tarihsel veri:',range:{'1d':'24 saat','1w':'7 gün','1m':'30 gün','3m':'3 ay','6m':'6 ay','1y':'12 ay','5y':'5 yıl','all':'mevcut tüm geçmiş'}},
 id:{chart:'Riwayat harga Sumcoin, grafik candlestick, dan perbandingan Bitcoin bisa dilihat di sini:',ath:'Nilai indeks SUM/{pair} tertinggi yang tercatat adalah {value} pada {date} (UTC).',perf:'Selama {range} terakhir, indeks SUM/{pair} berubah {change}%. Tertinggi {high}, terendah {low}.',compare:'Maksud Anda harga SUM dalam Bitcoin atau perbandingan kinerja selama periode tertentu? Riwayat SUM/BTC ada di sini:',api:'Berikut API publik SumcoinPrice untuk pengembang:',unavailable:'Saya belum bisa memverifikasi data historis saat ini. Grafik lengkap tersedia di sini:',source:'Data historis:',range:{'1d':'24 jam','1w':'7 hari','1m':'30 hari','3m':'3 bulan','6m':'6 bulan','1y':'12 bulan','5y':'5 tahun','all':'seluruh riwayat tersedia'}}
};
function render(template, values){return template.replace(/\{(\w+)\}/g,(_match,k)=>String(values[k]??''));}
function numeric(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1e12;}
function readResponse(json,kind,range,pair){
 if(!json||json.success!==true||json.pair!==pair||json.range!==range||!Array.isArray(json.data)||!json.data.length||json.data.length>100_000)throw Error('Unverified historical response');
 if(kind==='ath'){
   let peak=null;
   for(const point of json.data){
     const time=point?.time,high=point?.high;
     if(!numeric(time)||!Number.isSafeInteger(time)||time<1_400_000_000||time>4_100_000_000||!numeric(high)||high<=0)throw Error('Invalid historical point');
     if(!peak||high>peak.high)peak={time,high};
   }
   return peak;
 }
 const p=json.period;
 if(!p||!['high','low','change_percent','start_time','end_time'].every(k=>numeric(p[k])||k==='change_percent'&&typeof p[k]==='number'&&Number.isFinite(p[k])&&Math.abs(p[k])<1e9))throw Error('Invalid historical period');
 if(p.high<p.low||p.high<=0)throw Error('Bad period range');
 return p;
}
export function historyUrl(range='all',pair='usd'){
 if(!RANGES.has(range)||!['usd','btc'].includes(pair))throw Error('Unsupported historical query');
 return `${HISTORY_BASE}?range=${range}&pair=${pair}`;
}
export class MarketHistory {
 constructor({fetchImpl=fetch,now=Date.now}={}){this.fetch=fetchImpl;this.now=now;this.cache=new Map();}
 async query(kind,range='all',pair='usd'){
   if(!['ath','performance'].includes(kind))throw Error('Invalid market calculation');
   const url=historyUrl(range,pair),now=this.now(),cached=this.cache.get(url);
   if(cached&&cached.until>now)return readResponse(cached.data,kind,range,pair);
   // Only fixed HTTPS endpoints. No redirects, raw HTML, or oversized responses.
   const res=await this.fetch(url,{headers:{accept:'application/json','user-agent':'SumcoinHelper/0.0.21'},redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!res.ok)throw Error('Market data unavailable');
   const type=res.headers?.get?.('content-type')||'';
   if(type&&!/json/i.test(type))throw Error('Unexpected market response type');
   const declared=Number(res.headers?.get?.('content-length')||0);
   if(declared>12_000_000)throw Error('Historical data too large');
   const body=await res.text();
   if(Buffer.byteLength(body,'utf8')>12_000_000)throw Error('Historical data too large');
   const data=JSON.parse(body);
   const result=readResponse(data,kind,range,pair);
   this.cache.set(url,{data,until:now+15*60_000});
   if(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);
   return result;
 }
}
export async function marketAnswer(intent,lang='en',{history=new MarketHistory()}={}){
 const c=translations[lang]||translations.en;
 const pair=(intent.pair||'usd').toUpperCase();
 const format=n=>new Intl.NumberFormat(({en:'en-US',fr:'fr-FR',es:'es-ES',pt:'pt-BR',de:'de-DE',it:'it-IT',ru:'ru-RU',tr:'tr-TR',id:'id-ID'}[lang]||'en-US'),{maximumFractionDigits:pair==='BTC'?9:2,minimumFractionDigits:pair==='BTC'?0:2}).format(n);
 if(intent.kind==='api')return {text:`${c.api}\n${MARKET_API}\n${historyUrl('all','usd')}\n${historyUrl('all','btc')}`,verified:false};
 if(intent.kind==='chart')return {text:`${c.chart}\n${MARKET_CHART}`,verified:false};
 if(intent.kind==='compare')return {text:`${c.compare}\n${MARKET_CHART}`,verified:false};
 if(!['ath','performance'].includes(intent.kind))throw Error('Invalid market answer');
 const range=intent.kind==='ath'?'all':intent.range;
 try{
   const result=await history.query(intent.kind,range,intent.pair||'usd');
   if(intent.kind==='ath'){
     const date=new Date(result.time*1000).toISOString().slice(0,10);
     return {text:render(c.ath,{pair,value:format(result.high),date})+`\n${c.source} ${MARKET_CHART}`,verified:true};
   }
   return {text:render(c.perf,{pair,range:c.range[range]||range,change:result.change_percent.toFixed(2),high:format(result.high),low:format(result.low)})+`\n${c.source} ${MARKET_CHART}`,verified:true};
 }catch{return {text:`${c.unavailable}\n${MARKET_CHART}`,verified:false};}
}
