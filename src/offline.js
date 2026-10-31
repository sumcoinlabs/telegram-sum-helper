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
  irreversible:['pending','security'],p2p:['buy','security'],github:['chain']
});
const LABELS = {
  en:{context:'Related context',reading:'Further official reading',more:'For more detail, reply with /more@SumcoinHelperBot',historic:'Some linked material describes older mining software. Current Sumcoin operates on proof-of-stake.',unreviewed:'I found official documents but cannot confirm an accurate short answer from reviewed facts. See these references:',english:'The additional reviewed details below are currently available in English.'},
  es:{context:'Contexto relacionado',reading:'Documentación oficial adicional',more:'Para más detalles, responde /more@SumcoinHelperBot',historic:'Algunos documentos enlazados describen minería antigua. Sumcoin actualmente utiliza prueba de participación (PoS).',unreviewed:'Encontré documentos oficiales, pero no una respuesta resumida suficientemente verificada. Consulta las referencias:',english:'Los detalles adicionales verificados están disponibles en inglés.'},
  pt:{context:'Contexto relacionado',reading:'Leitura oficial adicional',more:'Para mais detalhes, responda /more@SumcoinHelperBot',historic:'Alguns documentos vinculados descrevem mineração antiga. A rede Sumcoin atual utiliza prova de participação (PoS).',unreviewed:'Encontrei documentos oficiais, mas não uma resposta resumida suficientemente verificada. Consulte as referências:',english:'Os detalhes adicionais verificados estão disponíveis em inglês.'}
};

// Explicit editorial translations: do NOT translate arbitrary scraped material.
const PT = {
  index:'A referência de valor do SUM é calculada por um índice que acompanha as 100 maiores criptomoedas por capitalização de mercado. Essa fórmula é uma referência de avaliação, não uma ordem de compra ou venda. Não garante liquidez, comprador disponível ou conversão automática em dólares.',
  chain:'Sumcoin é uma criptomoeda de camada 1 voltada a transferências diretas. O projeto começou com prova de trabalho e posteriormente migrou para prova de participação. A moeda SUM não representa um depósito bancário nem uma participação acionária.',
  buy:'Para comprar ou vender SUM, é preciso encontrar uma contraparte disposta e confirmar os termos de uma negociação. O valor exibido no índice não garante que exista comprador nem representa uma oferta executável.',
  p2p:'SUM pode ser transferido diretamente entre carteiras compatíveis para pagar quem concordar em recebê-lo. A aceitação por uma loja ou a disponibilidade de anúncios no marketplace deve ser confirmada no momento da negociação.',
  wallet:'A Sumcoin Wallet é uma carteira de autocustódia para enviar e receber SUM; não funciona como conta bancária nem faz saque de dólares. Guarde os dados de recuperação em local seguro, fora da internet.',
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
function fact(article,lang){
  if(lang==='en')return article.body||article.text;
  if(lang==='pt'&&PT[article.id])return PT[article.id];
  if(lang==='es'&&ES[article.id])return ES[article.id];
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
  const first=fact(original,lang);
  const result=[];
  if(!first){result.push(t(lang,'englishDetail'),original.body||original.text);}
  else result.push(first);
  const addon=ADDITIONS[lang]?.[original.id];
  if(addon)result.push(addon);
  const related=(RELATED[original.id]||[]).map(id=>knowledge.find(id)).filter(Boolean);
  const slots=expanded?2:1;
  const chosen=[];
  for(const item of related){
    const f=fact(item,lang);
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
  const end=expanded?'':`\n\n${l.more}`;
  return `${result.join('\n\n')}${historical}${referenceText}${end}`.slice(0,3400);
}
export function isContextualFollowup(text){
  const q=String(text||'').trim();
  if(q.length<3||q.length>160)return false;
  return /\b(?:that|this|it|those|earlier|previous|more details?|elaborate|explain more|explain that|eso|esa|esto|aquello|mais detalhes?|isso|aquilo|explique mais|más detalles?|explícame|explicame)\b/i.test(q)||/^(?:why\??|how\??|por que\??|por qué\??|por quê\??|why is that\??)$/i.test(q);
}
