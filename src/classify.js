// High-precision multilingual intent recognizer for voluntary support requests.
// Unlike a machine translation system, this must NOT invent a user language.
import {detectLanguage} from './languages.js';
export {detectLanguage} from './languages.js';
export const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const PATTERNS={
 cashout:['withdraw','cash out','cash-out','bank account','fiat withdrawal','to my bank','redeem','take out','convert to dollars','sell for usd','retirar','sacar','vender','canjear','cambiar','levantamento','saque','resgatar','prelevare','ritirare','retirer','retrait','auszahlen','abheben','verkaufen','вывести','снять','обменять','سحب','تحويل','निकाल','बेच','提现','取出','兑换','換金','引き出','出金','환전','출금','인출','bozdur','çek','tarik','cairkan'],
 security:['scam','scammer','scammed','phishing','hacked','stolen','unlock fee','estafa','estafador','fraude','golpe','escroquerie','arnaque','betrug','truffa','мошен','обман','احتيال','نصب','धोखा','ठगी','诈骗','骗局','詐欺','사기'],
 missing:['balance is zero','zero balance','wallet is empty','coins are gone','balance missing','not showing my balance','saldo cero','saldo zero','sin saldo','saldo desapareceu','solde zéro','solde zero','kontostand null','saldo sparito','нулевой баланс','баланс ноль','رصيدي صفر','बैलेंस शून्य','余额为零','余额不见','残高がゼロ','잔액 0','잔액이 없어'],
 pending:['transaction pending','not arrived','never arrived','transaction stuck','still waiting','transfer not received','no ha llegado','transaccion pendiente','no recibí','nao chegou','não chegou','transação pendente','pas reçu','transaction en attente','nicht angekommen','transaktion ausstehend','non arrivato','transazione in sospeso','не пришло','транзакция зависла','لم يصل','التحويل معلق','नहीं पहुँचा','लेनदेन लंबित','交易未到账','交易待确认','まだ届かない','送金が届か','입금 안 됨','거래 보류'],
 legacy:['slice wallet','legacy wallet','old wallet','old coins','bip32','bip39','migration','migrate','migrar','migracao','migração','migración','migrazione','migration','миграц','старый кошелек','الترحيل','पुराना वॉलेट','迁移','旧钱包','移行','旧ウォレット','마이그레이션'],
 staking:['staking','stake','staked','staker','proof of stake','minting','estacar','participación','recompensas','apostar','staking','jalonnement','staken','stakинг','стейкинг','التخزين','التحصيص','स्टेकिंग','质押','权益证明','ステーキング','스테이킹'],
 index:['index','indice','índice','indexado','preisindex','indice de prix','индекс','مؤشر','सूचकांक','指数','인덱스'],
 fees:['fee','fees','transaction cost','comisión','comissao','comissão','taxa de rede','frais','gebühr','commissioni','комиссия','رسوم','शुल्क','手续费','手数料','수수료'],
 seed:['recovery phrase','seed phrase','mnemonic','private key','password','verification code','restore wallet','recover wallet','restore my','bip39','frase de recuperacion','frase semilla','clave privada','frase de recuperação','clé privée','phrase de récupération','wiederherstellungsphrase','chiave privata','фраза восстановления','сид фраз','عبارة الاسترداد','مفتاح خاص','रिकवरी वाक्यांश','助记词','私钥','リカバリーフレーズ','復元フレーズ','복구 문구','개인 키'],
 irreversible:['reverse transaction','cancel transaction','wrong address','undo transaction','revertir transaccion','direccion equivocada','endereço errado','annuler transaction','falsche adresse','indirizzo sbagliato','неверный адрес','عنوان خاطئ','गलत पता','发错地址','撤销交易','誤ったアドレス','잘못된 주소'],
 wallet:['wallet','billetera','monedero','cartera','carteira','portefeuille','geldbörse','brieftasche','portafoglio','кошелек','кошелёк','محفظة','वॉलेट','钱包','ウォレット','지갑','cüzdan','dompet'],
 buy:['buy','where to buy','exchange listing','comprar','acheter','kaufen','acquistare','купить','شراء','खरीद','购买','買う','구매']
};
const context=/(?:\bsumcoin\b|\bsum\b|\bslice\b|\belectrum\b|\bwallet\b|\bbilletera\b|\bcarteira\b|\bportefeuille\b|\bbrieftasche\b|\bportafoglio\b|кошел|محفظ|वॉलेट|钱包|ウォレット|지갑)/iu;
const helper=/\b(?:how|what|why|where|when|can i|could i|please|help|anyone|need help|i cannot|i can't|i have a problem|not working|missing|lost|stuck|error|failed|como|puedo|necesito|ayuda|quiero|quanto|posso|preciso|ajuda|comment|pourquoi|besoin|aide|wie|kann|hilfe|come|posso|aiuto|nasıl|bisa|bagaimana)\b|как|почему|помог|можно|كيف|لماذا|مساعدة|कैसे|क्यों|मदद|怎么|如何|为什么|请问|できますか|どうして|教えて|어떻게|왜|도움/iu;
const explicitReport=/(?:not arrived|never arrived|wallet is empty|balance missing|my (?:wallet|coins?) (?:is|are) (?:gone|missing)|no ha llegado|não chegou|钱包.*不见|余额.*零|残高.*ゼロ|잔액.*없어)/iu;
function has(s,patterns){return patterns.some(p=>{const n=normalize(p);const i=s.indexOf(n);if(i<0)return false;
  // Avoid matching 'sell' within 'reseller', 'fee' within 'coffee', etc.
  if(/^[a-z ]+$/.test(n)){const before=s[i-1],after=s[i+n.length];return (!before||!/\p{L}/u.test(before))&&(!after||!/\p{L}/u.test(after));}
  return true;
});}
export function isHelpQuestion(raw){const text=normalize(raw);return /[?¿？]/u.test(text)||helper.test(text)||explicitReport.test(text);}
export function isSupportMessage(raw){const text=normalize(raw);return context.test(text)&&isHelpQuestion(text);}
export function classify(raw,hint=''){
  const s=normalize(raw).slice(0,2000),language=detectLanguage(raw,hint);
  if(!s.trim())return {topic:null,language};
  // Telegram scam and verification-code reports are safety-relevant even without a SUM keyword.
  if(/(?:telegram|support|admin|someone asked)/i.test(s) && (has(s,PATTERNS.security)||has(s,['seed phrase','private key','password','verification code','mnemonic'])))
    if(isHelpQuestion(s)||/\b(?:scammed|hacked|stolen|asked)\b/i.test(s))return {topic:'security',language};
  if(!isSupportMessage(s))return {topic:null,language};
  if(has(s,['seed phrase','private key','password','verification code','mnemonic','clave privada','助记词','私钥','秘密鍵','복구 문구'])
      && /(?:send|give|share|asked|support|telegram|someone|admin|compartir|enviar|dar|envoi|weitergeben|послать|передать|إرسال|भेज|发送|提供|送る|보내)/iu.test(s))return {topic:'security',language};
  for(const kind of ['security','missing','pending','legacy','seed','irreversible','cashout','staking','fees','index','buy']){
    if(has(s,PATTERNS[kind]))return {topic:kind==='missing'?'missing-balance':kind,language};
  }
  // Wallet alone is too broad to automatically explain the wrong problem.
  const walletHelp=has(s,PATTERNS.wallet)&&has(s,['send','receive','transfer','connect','sync','enviar','recibir','enviar','receber','envoyer','senden','inviare','отправ','получ','إرسال','استلام','भेज','प्राप्त','发送','接收','送金','受信','보내','받']);
  if(walletHelp)return {topic:'wallet',language};
  return {topic:null,language};
}
export function retrievalTerms(q){
  const t=classify(q).topic;
  const mapping={'cashout':'withdraw sumcoin USD cash out exchange wallet index liquidity','missing-balance':'sumcoin balance zero empty wallet electrum restore','pending':'sumcoin transaction pending confirmation transaction ID explorer','legacy':'slice wallet legacy BIP32 BIP39 migrate','security':'scam phishing wallet private key safety','seed':'wallet seed recovery BIP39 restore','staking':'proof of stake minting rewards core','index':'sumcoin index price valuation marketcap','fees':'sumcoin network transaction fees','wallet':'sumcoin wallet send receive address','irreversible':'sumcoin cancel reverse transaction wrong address','buy':'sumcoin buy sell peer to peer marketplace'};
  return t ? `${q} ${mapping[t]}` : q;
}
