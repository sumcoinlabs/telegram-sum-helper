import {FACTS} from './facts-localized.js';
import {ui} from './locale-ui.js';
// Deterministic, zero-API-cost answers. Facts are from the reviewed curated index.
// Live-synced text is discoverable as reading links, but never silently promoted
// to factual statements: some official pages/white papers describe old PoW behavior.
import { citationUrls } from './knowledge.js';
import { t, hasTranslation } from './languages.js';

const RELATED = Object.freeze({
  index:['chain','buy'],cashout:['buy','index'],buy:['p2p','cashout'],
  wallet:['seed','pending'],seed:['legacy','security'],legacy:['seed','wallet'],
  staking:['chain','wallet'],pending:['irreversible','wallet'],
  'missing-balance':['legacy','pending'],fees:['security','wallet'],
  security:['seed','irreversible'],chain:['staking','index'],
  irreversible:['pending','security'],p2p:['buy','security'],github:['chain'],
  'wallet-connect':['wallet','pending'],'wallet-restore':['seed','legacy'],
  'wallet-send':['fees','irreversible'],'wallet-receive':['wallet','pending'],
  'index-math':['index','chain'],'index-data':['index','index-math'],
  'index-live':['index','index-vs-liquidity'],'tx-explorer':['confirmations','pending'],
  'address-history':['wallet','security'],'staking-check':['staking','chain'],
  'migration-recovery':['legacy','seed'],'sumcoinlib':['github','wallet']
});
const LABELS = {
  en:{context:'Related context',reading:'Further official reading',more:'For more detail, reply with /more@SumcoinHelperBot',historic:'Some linked material describes older mining software. Current Sumcoin operates on proof-of-stake.',unreviewed:'I found official documents but cannot confirm an accurate short answer from reviewed facts. See these references:',english:'The additional reviewed details below are currently available in English.'},
  es:{context:'Contexto relacionado',reading:'Documentación oficial adicional',more:'Para más detalles, responde /more@SumcoinHelperBot',historic:'Algunos documentos enlazados describen minería antigua. Sumcoin actualmente utiliza prueba de participación (PoS).',unreviewed:'Encontré documentos oficiales, pero no una respuesta resumida suficientemente verificada. Consulta las referencias:',english:'Los detalles adicionales verificados están disponibles en inglés.'},
  pt:{context:'Contexto relacionado',reading:'Leitura oficial adicional',more:'Para mais detalhes, responda /more@SumcoinHelperBot',historic:'Alguns documentos vinculados descrevem mineração antiga. A rede Sumcoin atual utiliza prova de participação (PoS).',unreviewed:'Encontrei documentos oficiais, mas não uma resposta resumida suficientemente verificada. Consulte as referências:',english:'Os detalhes adicionais verificados estão disponíveis em inglês.'}
};

// Explicit editorial translations: do NOT translate arbitrary scraped material.
const PT = {
  'wallet-connect':'Quando a carteira perde conexão com o backend Electrum, o saldo e o histórico mostrados podem estar desatualizados. Confira internet, sincronização e histórico público do endereço. Nunca insira sua frase de recuperação em sites.',
  'wallet-restore':'Identifique o aplicativo e a versão que criaram a carteira. Sumcoin Wallet atual e Slice Wallet antiga podem derivar endereços diferentes. Recupere apenas em aplicativo legítimo e nunca compartilhe palavras de recuperação.',
  'wallet-send':'Para enviar SUM, confirme o endereço público de destino, o valor e a eventual taxa na carteira antes de autorizar. Transferências confirmadas geralmente não podem ser revertidas.',
  'wallet-receive':'Para receber SUM, use o endereço público de recebimento de uma carteira compatível e confirme a rede. Confira o histórico no explorador; nunca forneça a chave privada.',
  'index-math':'A capitalização de mercado costuma ser preço multiplicado pela oferta circulante. O índice do Sumcoin acompanha as 100 maiores criptomoedas por capitalização. Isso não revela sozinho a fórmula completa de ponderação do índice.',
  'index-data':'O FAQ do Sumcoin Index descreve o CryptoCompare como fonte de cotações históricas e em tempo real. É necessário verificar a fonte e a atualização; uma cotação não garante compradores.',
  'index-live':'Use /price para consultar a taxa de referência SUM/USD em uma API aprovada. O resultado só é mostrado quando o formato recebido é reconhecido; não representa preço de venda garantido.',
  'tx-explorer':'Use /tx seguido de um ID público de transação com 64 caracteres para consultar o explorador aprovado. Verifique confirmações e endereço de destino; nunca compartilhe senhas.',
  'address-history':'Use /address com um endereço PÚBLICO para consultar o histórico no explorador aprovado. O endereço fica visível a todos no grupo, embora não seja uma chave privada.',
  'confirmations':'Uma confirmação indica que uma transação entrou em um bloco; confirmações adicionais chegam com novos blocos. Cada serviço pode exigir uma quantidade diferente.',
  'staking-check':'Se o Core não faz staking, verifique se a versão é compatível, se o nó está sincronizado e se os critérios atuais são atendidos. Não use parâmetros de mineração PoW antigos.',
  'staking-mobile':'A carteira móvel Sumcoin Wallet não faz minting; o staking depende de uma instalação Core compatível e atualizada.',
  'migration-recovery':'Slice/SPV antigo e a carteira atual podem usar caminhos de derivação incompatíveis. As mesmas palavras não garantem os mesmos endereços. Consulte o procedimento oficial.',
  'sumcoinlib':'sumcoinlib é uma biblioteca Dart/Flutter para endereços Sumcoin, chaves hierárquicas e construção/assinatura de transações UTXO. Verifique a compatibilidade na documentação da versão.',
  index:'O Sumcoin Index acompanha as 100 maiores criptomoedas por capitalização de mercado e publica uma cotação de referência para negociações diretas entre pessoas. Para a cotação atual na sua moeda, use /price.',
  chain:'Sumcoin é uma criptomoeda de camada 1 para transferências diretas entre pessoas. A rede começou com prova de trabalho e migrou para prova de participação (PoS).',
  buy:'SUM pode ser comprado ou vendido diretamente entre pessoas. Confira a cotação de referência com /price e combine valor e pagamento com a outra parte.',
  p2p:'SUM pode ser transferido diretamente entre carteiras compatíveis para pagar quem concordar em recebê-lo. A aceitação por uma loja ou a disponibilidade de anúncios no marketplace deve ser confirmada no momento da negociação.',
  wallet:'Sumcoin Wallet é uma carteira de autocustódia para enviar e receber SUM. Você controla suas chaves e deve guardar a frase de recuperação em segurança.',
  seed:'Nunca envie palavras de recuperação, chaves privadas, senhas ou códigos para este bot ou alguém que se diga suporte. Carteiras Slice antigas podem usar um método de recuperação diferente das carteiras atuais.',
  legacy:'As carteiras Slice antigas e a Sumcoin Wallet atual podem usar formatos de recuperação incompatíveis. Consulte a página oficial de migração para verificar condições e elegibilidade; não há conversão automática garantida.',
  staking:'A rede Sumcoin atual utiliza prova de participação (PoS). A participação depende de software Core compatível; a carteira móvel não realiza minting. Regras e recompensas precisam ser conferidas na versão atual do Core.',
  fees:'Transferências de SUM podem exigir uma taxa da rede. Isso é diferente de uma cobrança feita por alguém para supostamente desbloquear um saldo em dólares — trate pedidos assim como sinal de possível fraude.',
  'missing-balance':'Um saldo zerado na tela não significa necessariamente perda das moedas. Verifique a carteira correta, o endereço público, a conexão e o histórico no explorador. A recuperação de carteiras Slice antigas difere da recuperação das carteiras atuais.',
  pending:'Se uma transferência não apareceu, verifique o ID público da transação, o endereço de destino e as confirmações num explorador oficial. A conexão da carteira também pode estar desatualizada. Nunca compartilhe palavras de recuperação.',
  irreversible:'Transações confirmadas na blockchain geralmente não podem ser revertidas por administradores ou por este bot. Confira o endereço antes de enviar; só o destinatário pode optar por devolver uma transferência concluída.',
  security:'Nunca compartilhe a frase de recuperação, chave privada, senha ou código de verificação, nem com administradores. Ignore mensagens privadas não solicitadas que prometam saques ou recuperação mediante pagamento.'
};
const ES = {
  'wallet-connect':'Si la cartera no puede conectarse al servidor Electrum, el saldo y el historial mostrados pueden quedar desactualizados. Comprueba conexión, sincronización e historial público. Nunca introduzcas tu frase de recuperación en una web.',
  'wallet-restore':'Identifica la aplicación y versión que crearon la cartera. Sumcoin Wallet actual y Slice antigua pueden derivar direcciones distintas. Restaura solo en software legítimo y no compartas palabras de recuperación.',
  'wallet-send':'Para enviar SUM, verifica la dirección pública de destino, el importe y las posibles tarifas antes de autorizar. Una transferencia confirmada normalmente no se puede revertir.',
  'wallet-receive':'Para recibir SUM, utiliza una dirección pública de una cartera compatible y confirma la red. Consulta su historial en el explorador y nunca compartas claves privadas.',
  'index-math':'La capitalización de mercado suele calcularse como precio multiplicado por oferta circulante. El índice Sumcoin sigue las 100 criptomonedas más grandes por capitalización. Ese dato por sí solo no especifica toda la fórmula de ponderación.',
  'index-data':'Las preguntas frecuentes del Sumcoin Index citan CryptoCompare como fuente de cotizaciones históricas y actuales. Es necesario verificar la actualidad de los datos; ninguna cotización garantiza compradores.',
  'index-live':'Usa /price para consultar el valor de referencia SUM/USD desde una API aprobada. Solo se muestra un número si se reconoce el formato de la respuesta; no garantiza un precio de venta.',
  'tx-explorer':'Usa /tx seguido de un identificador PÚBLICO hexadecimal de 64 caracteres para consultar el explorador. Revisa confirmaciones y destino; no compartas contraseñas.',
  'address-history':'Usa /address con una dirección PÚBLICA para comprobar el historial en el explorador aprobado. Todos los miembros del grupo podrán verla, aunque no es una clave privada.',
  'confirmations':'Una confirmación indica que una transacción figura en un bloque; las siguientes llegan con nuevos bloques. Cada servicio puede exigir un número distinto.',
  'staking-check':'Si Core no hace staking, comprueba versión compatible, sincronización y requisitos actuales. No sigas parámetros de minería PoW antiguos.',
  'staking-mobile':'La cartera móvil Sumcoin Wallet no realiza minting; el staking depende de una instalación compatible y actualizada de Core.',
  'migration-recovery':'La antigua Slice/SPV y la cartera actual pueden usar rutas de derivación incompatibles. Las mismas palabras no garantizan las mismas direcciones. Consulta la migración oficial.',
  'sumcoinlib':'sumcoinlib es una biblioteca Dart/Flutter para direcciones Sumcoin, claves jerárquicas y construcción/firma de transacciones UTXO. Consulta la compatibilidad documentada de cada versión.',
  chain:'Sumcoin es una criptomoneda de capa 1 para transferencias directas. Comenzó con prueba de trabajo y después migró a prueba de participación. SUM no es un depósito bancario ni una participación en una empresa.',
  p2p:'SUM puede transferirse directamente entre carteras compatibles para pagar a quien acepte recibirlo. La disponibilidad de un comercio o anuncio debe confirmarse antes de negociar.',
  'missing-balance':'Que el saldo aparezca a cero no significa necesariamente que las monedas hayan desaparecido. Revisa la cartera correcta, la dirección pública, la conexión y el historial del explorador. La recuperación de antiguas carteras Slice es diferente.',
  pending:'Si una transferencia no aparece, comprueba el identificador público de la transacción, la dirección de destino y las confirmaciones en un explorador oficial. Nunca compartas tus palabras de recuperación.'
};
const ADDITIONS = {
  en:{
    index:'The calculation tracks the market capitalization of leading cryptocurrencies; it does not discover a live bid for SUM. A reference rate and a price someone will actually pay are separate things.',
    cashout:'Before making any trade, independently verify the other party and the amount you will receive. A wallet showing a USD estimate does not hold those dollars for you.',
    staking:'The historic white paper and some older project pages may describe proof-of-work mining. Do not use those instructions as a guide to the current staking network.',
    legacy:'Do not assume that importing a legacy recovery phrase into a new wallet will reproduce the old addresses. Review the currently published migration conditions before doing anything irreversible.',
    'missing-balance':'A missing display balance can arise from using a different recovery path or an out-of-sync connection. Public transaction history is more useful than the app balance alone.'
  },
  es:{
    index:'El cálculo sigue las capitalizaciones de las principales criptomonedas, pero no muestra una oferta real para comprar SUM. El valor de referencia y el precio que paga un comprador son conceptos distintos.',
    cashout:'Antes de negociar, confirma de forma independiente a la otra persona y las condiciones. Mostrar una estimación en dólares no significa que esos dólares estén depositados en tu cartera.',
    staking:'El libro blanco y algunas páginas antiguas describen minería por prueba de trabajo. No uses esas instrucciones para la red actual basada en prueba de participación.',
    legacy:'Importar una frase antigua en una cartera nueva puede producir direcciones distintas. Comprueba las condiciones vigentes de migración antes de actuar.',
    'missing-balance':'El método de recuperación o una conexión desactualizada puede hacer que el saldo aparezca vacío. Consulta también el historial público de direcciones.'
  },
  pt:{
    index:'O índice acompanha capitalizações de mercado, mas não identifica uma oferta real de compra de SUM. A cotação de referência e o preço efetivamente pago por alguém são coisas diferentes.',
    cashout:'Antes de negociar, confirme a identidade da outra parte e as condições da troca. Uma estimativa em dólares na carteira não significa que haja dólares depositados para saque.',
    staking:'O white paper e algumas páginas antigas descrevem mineração por prova de trabalho. Não use essas instruções para operar na rede atual de prova de participação.',
    legacy:'Importar uma frase antiga na carteira atual pode gerar endereços diferentes. Confira os requisitos de migração antes de qualquer ação irreversível.',
    'missing-balance':'Um método de recuperação diferente ou uma conexão desatualizada pode mostrar saldo vazio. Consulte também o histórico público do endereço.'
  }
};
function labels(lang){return LABELS[lang]||LABELS.en;}
export function reviewedFact(article,lang){
  if(lang==='en')return article.body||article.text;
  if(lang==='pt'&&PT[article.id])return PT[article.id];
  if(lang==='es'&&ES[article.id])return ES[article.id];
  if(FACTS[lang]?.[article.id])return FACTS[lang][article.id];
  if(hasTranslation(lang,article.id))return t(lang,article.id);
  return null;
}
function sourceLinks(docs,limit=3){
  return citationUrls(docs,limit).map(url=>url);
}
export function offlineAnswer({docs,knowledge,lang='en',expanded=false}){
  if(!docs.length)return t(lang,'none');
  const l=labels(lang);
  const primary=docs.find(d=>d.kind==='curated'||d.kind==='admin-approved');
  if(!primary){
    const links=sourceLinks(docs,2);
    return links.length?`${l.unreviewed}\n\n${links.join('\n')}`:t(lang,'none');
  }
  const original=knowledge.find(primary.id)||primary;
  const first=reviewedFact(original,lang);
  const result=[];
  if(!first){result.push(t(lang,'englishDetail'),original.body||original.text);}
  else result.push(first);
  const addon=ADDITIONS[lang]?.[original.id];
  if(addon&&expanded)result.push(addon);
  const related=(RELATED[original.id]||[]).map(id=>knowledge.find(id)).filter(Boolean);
  const slots=expanded?2:0;
  const chosen=[];
  for(const item of (expanded?related:[])){
    const f=reviewedFact(item,lang);
    if(!f)continue; // Never silently invent translations of other topics.
    result.push(`${l.context}: ${f}`);
    chosen.push(item);
    if(chosen.length>=slots)break;
  }
  // A curated summary is reviewed; indexed external text may be older or inconsistent.
  const reading=[];
  for(const d of docs){
    if(d.kind!=='synced')continue;
    const u=sourceLinks([d],1)[0];
    if(u&&!reading.includes(u)&&!sourceLinks([original,...chosen],3).includes(u))reading.push(u);
    if(reading.length>= (expanded?2:1))break;
  }
  const sources=sourceLinks([original,...chosen],expanded?3:2);
  const references=[...sources,...reading].filter((u,i,a)=>a.indexOf(u)===i).slice(0,4);
  const referenceText=references.length?`\n\n${lang==='en'?'Source':t(lang,'sources')}:\n${references.map((u,i)=>`${i+1}. ${u}`).join('\n')}`:'';
  const historical=expanded&&['staking','chain','legacy'].includes(original.id)?`\n\n${l.historic}`:'';
  const end=expanded?'':`\n\n${lang==='en'||lang==='es'||lang==='pt'?l.more:ui(lang,'more')}`;
  return `${result.join('\n\n')}${historical}${referenceText}${end}`.slice(0,3400);
}
export function isContextualFollowup(text){
  const q=String(text||'').trim();
  if(q.length<3||q.length>160)return false;
  return isMoreRequest(q)||/\b(?:that|this|it|those|earlier|previous|more details?|elaborate|explain more|explain that|eso|esa|esto|aquello|mais detalhes?|isso|aquilo|explique mais|más detalles?|explícame|explicame)\b/i.test(q)||/^(?:why\??|how\??|por que\??|por qué\??|por quê\??|why is that\??)$/i.test(q);
}

// A deliberately narrow set of short, context-dependent requests. Do not
// interpret arbitrary "more" chatter or unrelated questions as bot follow-ups.
// Keep this separate from isContextualFollowup: automatic replies require a
// stronger signal than explicit /ask or a direct reply to the bot.
export function isMoreRequest(text){
  const q=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F]/g,'').normalize('NFC')
    .replace(/^[\s¿?¡!]+|[\s?!؟。！.,،]+$/gu,'').trim();
  if(q.length<4||q.length>100)return false;
  return [
    /^(?:(?:can|could|would) you |please )?(?:tell me more|explain (?:that|it|more|further)|elaborate(?: on (?:that|it))?|expand on (?:that|it)|give me more (?:details|information|info))$/u,
    /^(?:more (?:details?|information|info)|what else|tell me more about (?:that|it)|can you expand on that)$/u,
    /^(?:cuentame mas|dime mas|explica(?:me)? mas|puedes explicar mas|mas (?:detalles|informacion)|explicame mejor)$/u,
    /^(?:conte mais|me conte mais|pode explicar melhor|explique mais|mais (?:detalhes|informacoes)|fale mais)$/u,
    /^(?:dis.m.en plus|explique davantage|plus de (?:details|precisions)|peux.tu expliquer davantage)$/u,
    /^(?:erzahl mir mehr|kannst du mehr erklaren|mehr details|erklar das genauer)$/u,
    /^(?:dimmi di piu|puoi spiegare meglio|spiega meglio|maggiori dettagli)$/u,
    /^(?:расскажи подробнее|объясни подробнее|можно подробнее|подробнее)$/u,
    /^(?:اشرح اكثر|هل يمكنك التوضيح اكثر|مزيد من التفاصيل|اخبرني المزيد)$/u,
    /^(?:और बताओ|और विस्तार से बताओ|थोड़ा और समझाओ)$/u,
    /^(?:能说详细一点吗|请多解释一下|详细说说|再多说一点|多讲一点)$/u,
    /^(?:もっと詳しく(?:教えて|説明して)?|もう少し説明して|詳しく教えて)$/u,
    /^(?:좀 더 자세히(?: 설명해줘| 알려줘)?|더 설명해줘|자세히 알려줘)$/u,
    /^(?:daha fazla anlat|biraz daha acikla|daha ayrintili anlat)$/u,
    /^(?:jelaskan lebih lanjut|ceritakan lebih banyak|bisa jelaskan lebih detail)$/u
  ].some(pattern=>pattern.test(q));
}
