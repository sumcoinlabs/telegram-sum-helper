// Safe, deterministic discovery of the owner's public market-data site.
// Never call arbitrary URLs, infer live quotes, or invent historical records.
export const SUMCOINPRICE = Object.freeze({
  website: 'https://sumcoinprice.com/',
  market: 'https://sumcoinprice.com/market.php',
  history: 'https://sumcoinprice.com/api/history.php?range=1d',
  btcHistory: 'https://sumcoinprice.com/api/history.php?range=1d&pair=btc'
});

const normalized = s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'");
const project=/(?:\bsumcoins?\b|\bsum\b|sumcoinprice(?:\.com)?)/iu;
const api=/(?:\bapi\b|\bendpoints?\b|\bjson\b|api[- ]?data|接口|エンドポイント|интерфейс api)/iu;
const historical=/(?:\bcharts?\b|\bgraphs?\b|\bcandles?(?:ticks?)?\b|\bcharting\b|\bhistory\b|\bhistorical\b|\bhistoric\b|\ball[- ]time[- ]high\b|\bath\b|\bprice over time\b|\bperformance (?:over|since|history|chart)\b|\bcompare (?:sum|sumcoin) (?:to|with|vs)\b|\bvs\.?\s*bitcoin\b|\bgraphiques?\b|\bgraphe\b|\bcourbe\b|\bhistorique\b|\bevolution\b|\bgrafico\b|\bgrafica\b|\bhistorico\b|\bhistorica\b|\bpreisverlauf\b|\bkursverlauf\b|\bdiagramm\b|\bstorico\b|\bandamento\b|\bgrafik\b|\bgrafiği\b|\btarihsel\b|\bhistori\b|график|истори|историч|تاريخ|رسم بياني|इतिहास|चार्ट|历史|历史价格|图表|最高价|チャート|履歴|史上最高値|차트|그래프|역대 최고)/iu;
const asking=/(?:[?¿？]|^(?:expliqu\w*|show|see|where|how|what|whats|what's|can|could|give|find|link|open|send|tell|compare|view|look|display|i want|i need|please|montre|montrez|ou|comment|puis|voir|affiche|donde|muestra|muestrame|mostrar|mu[eé]strame|como|onde|mostra|mostre|zeige|wo|wie|mostrami|mostra|dove|где|покажи|كيف|اين|दिखा|कहाँ|哪里|显示|見せ|どこ|보여|어디|goster|nerede|tunjukkan|dimana)\b)/iu;
const shorthand=/^(?:(?:sumcoins?|sum)(?:\s+(?:price|market|historical|historic|live)){0,2}\s+(?:chart|graph|history|api|ath)|sumcoinprice(?:\.com)?\s+api)\s*[.!]?$/iu;
export function marketDiscoveryIntent(question){
  const s=normalized(question).trim().slice(0,1000);
  if(!project.test(s)||(!asking.test(s)&&!shorthand.test(s)))return null;
  if(api.test(s) && (historical.test(s)||/\b(?:market|price|data|sumcoinprice|sumcoin|sum)\b/i.test(s)))return 'api';
  if(historical.test(s))return 'chart';
  return null;
}

// Keep useful interface strings in all 14 supported languages. These are not
// machine-generated financial claims; URL paths are the documented project API.
const copy={
 en:['SumcoinPrice — historical index charts and market context.', 'Interactive chart:', 'The displayed index value is a reference, not a guaranteed selling price.', 'SumcoinPrice public market-data endpoints:', 'Current SUM/USD market snapshot:', 'Historical SUM/USD data (1 day):', 'Historical SUM/BTC data (1 day):', 'These URLs publish reference data; they do not guarantee that an exchange will buy SUM.'],
 es:['SumcoinPrice — gráficos históricos del índice y contexto del mercado.', 'Gráfico interactivo:', 'El valor del índice es una referencia, no un precio de venta garantizado.', 'API pública de SumcoinPrice:', 'Datos actuales SUM/USD:', 'Historial SUM/USD (1 día):', 'Historial SUM/BTC (1 día):', 'Son datos de referencia; no garantizan compradores de SUM.'],
 pt:['SumcoinPrice — gráficos históricos do índice e contexto de mercado.', 'Gráfico interativo:', 'O valor do índice é uma referência, não um preço de venda garantido.', 'APIs públicas do SumcoinPrice:', 'Dados atuais SUM/USD:', 'Histórico SUM/USD (1 dia):', 'Histórico SUM/BTC (1 dia):', 'São dados de referência; não garantem compradores de SUM.'],
 fr:['SumcoinPrice — graphiques historiques de l’indice et données de marché.', 'Graphique interactif :', 'La valeur de l’indice est indicative, pas un prix de vente garanti.', 'API publiques de SumcoinPrice :', 'Données actuelles SUM/USD :', 'Historique SUM/USD (1 jour) :', 'Historique SUM/BTC (1 jour) :', 'Ces données sont indicatives et ne garantissent pas d’acheteur pour SUM.'],
 de:['SumcoinPrice — historische Indexcharts und Marktdaten.', 'Interaktiver Chart:', 'Der Indexwert ist ein Richtwert, kein garantierter Verkaufspreis.', 'Öffentliche SumcoinPrice-APIs:', 'Aktuelle SUM/USD-Marktdaten:', 'SUM/USD-Verlauf (1 Tag):', 'SUM/BTC-Verlauf (1 Tag):', 'Referenzdaten garantieren keinen Käufer für SUM.'],
 it:['SumcoinPrice — grafici storici e dati di mercato dell’indice.', 'Grafico interattivo:', 'Il valore dell’indice è indicativo, non un prezzo di vendita garantito.', 'API pubbliche di SumcoinPrice:', 'Dati attuali SUM/USD:', 'Storico SUM/USD (1 giorno):', 'Storico SUM/BTC (1 giorno):', 'Questi dati non garantiscono un acquirente di SUM.'],
 ru:['SumcoinPrice — исторические графики индекса и рыночные данные.', 'Интерактивный график:', 'Индексный курс справочный; продажа по нему не гарантирована.', 'Публичные API SumcoinPrice:', 'Текущие данные SUM/USD:', 'История SUM/USD (1 день):', 'История SUM/BTC (1 день):', 'Данные справочные; покупатель SUM не гарантирован.'],
 ar:['SumcoinPrice — الرسوم التاريخية للمؤشر وبيانات السوق.', 'الرسم التفاعلي:', 'قيمة المؤشر مرجعية وليست سعر بيع مضمونًا.', 'واجهات بيانات SumcoinPrice العامة:', 'بيانات SUM/USD الحالية:', 'سجل SUM/USD (يوم واحد):', 'سجل SUM/BTC (يوم واحد):', 'هذه بيانات مرجعية ولا تضمن وجود مشترٍ لـ SUM.'],
 hi:['SumcoinPrice — इंडेक्स के ऐतिहासिक चार्ट और बाज़ार संदर्भ।', 'इंटरैक्टिव चार्ट:', 'इंडेक्स दर संदर्भ मूल्य है, बिक्री की गारंटी नहीं।', 'SumcoinPrice के सार्वजनिक API:', 'वर्तमान SUM/USD डेटा:', 'SUM/USD इतिहास (1 दिन):', 'SUM/BTC इतिहास (1 दिन):', 'संदर्भ डेटा SUM खरीदार की गारंटी नहीं देता।'],
 zh:['SumcoinPrice — 指数历史图表及市场数据。', '交互式图表：', '指数价格仅供参考，不保证可以按此价格出售。', 'SumcoinPrice 公开数据接口：', '当前 SUM/USD 数据：', 'SUM/USD 历史数据（1天）：', 'SUM/BTC 历史数据（1天）：', '参考数据不保证存在 SUM 买家。'],
 ja:['SumcoinPrice — 指数の過去チャートと市場データ。', 'インタラクティブなチャート：', '指数値は参考値であり、売却価格を保証しません。', 'SumcoinPrice 公開API：', '現在の SUM/USD データ：', 'SUM/USD 履歴（1日）：', 'SUM/BTC 履歴（1日）：', '参考データは SUM の買い手を保証しません。'],
 ko:['SumcoinPrice — 지수 과거 차트 및 시장 정보.', '대화형 차트:', '지수 가격은 참고값이며 판매 가격을 보장하지 않습니다.', 'SumcoinPrice 공개 API:', '현재 SUM/USD 정보:', 'SUM/USD 과거 정보(1일):', 'SUM/BTC 과거 정보(1일):', '참고 데이터는 SUM 구매자를 보장하지 않습니다.'],
 tr:['SumcoinPrice — geçmiş endeks grafikleri ve piyasa verileri.', 'Etkileşimli grafik:', 'Endeks değeri referanstır; garantili satış fiyatı değildir.', 'SumcoinPrice genel API uç noktaları:', 'Güncel SUM/USD verisi:', 'SUM/USD geçmişi (1 gün):', 'SUM/BTC geçmişi (1 gün):', 'Referans verileri SUM alıcısını garanti etmez.'],
 id:['SumcoinPrice — grafik historis indeks dan data pasar.', 'Grafik interaktif:', 'Nilai indeks adalah acuan, bukan harga jual yang dijamin.', 'API publik SumcoinPrice:', 'Data SUM/USD terkini:', 'Riwayat SUM/USD (1 hari):', 'Riwayat SUM/BTC (1 hari):', 'Data acuan tidak menjamin ada pembeli SUM.']
};
export function marketDiscoveryReply(kind,lang='en'){
  const [title,chart,note,apiLabel,current,historic,btc,disclaimer]=copy[lang]||copy.en;
  return kind==='api'?`${apiLabel}\n${current} ${SUMCOINPRICE.market}\n${historic} ${SUMCOINPRICE.history}\n${btc} ${SUMCOINPRICE.btcHistory}\n\n${disclaimer}`:
    `${title}\n${chart} ${SUMCOINPRICE.website}\n\n${note}\n${historic} ${SUMCOINPRICE.history}`;
}
