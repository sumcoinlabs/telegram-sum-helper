// Intentionally high-precision rules. False negatives are safer than unsolicited bot spam.
// They are not a general-purpose language detector or trading-advice system.
const RE = {
  cashoutEnglish: /\b(withdraw(?:al)?|cash[ -]?out|redeem|convert|sell|exchange)\b.{0,100}\b(sumcoin|\bsum\b|wallet|dollars?|usd|money|balance|coins?)\b|\b(sumcoin|wallet|\bsum\b|balance)\b.{0,100}\b(withdraw(?:al)?|cash[ -]?out|redeem|convert|sell|exchange)\b/i,
  cashoutSpanish: /\b(retirar|sacar|convertir|cambiar|cobrar|vender|canjear)\b.{0,100}\b(dolares|usd|dinero|billetera|wallet|sumcoin|saldo|monedas)\b|\b(dolares|dinero|wallet|sumcoin|saldo|billetera)\b.{0,100}\b(retirar|sacar|convertir|cambiar|vender)\b/i,
  security: /\b(seed phrase|recovery phrase|secret phrase|private key|scamm?(?:er|ed|ing)?|hack(?:ed)?|phish(?:ing)?|unlock fee|support (?:asked|sent|messaged) me|frase de recuperacion|clave privada|estafa|hackearon)\b/i,
  staking: /\b(stak(?:e|ing|ed|er|ers)|proof.of.stake|pos reward|stake reward|minting|recompensas por participacion)\b/i,
  wallet: /\b(send|receive|transfer|transaction|address|wallet sync|wallet not working|not showing|how to use wallet|enviar|recibir|transferir|direccion|billetera|monedero)\b.{0,100}\b(sumcoin|\bsum\b|wallet|billetera|monedero|coin)\b|\b(sumcoin|wallet|billetera)\b.{0,100}\b(send|receive|transfer|transaction|address|sync|enviar|recibir|transferir|direccion)\b/i
};

const SPANISH_WORDS = new Set('como puedo retirar dolares dinero billetera monedero saldo cambiar sacar quiero necesito ayuda gracias hola tengo mis para por favor cuanto enviar recibir convertir vender'.split(' '));
const PORTUGUESE_WORDS = new Set('como posso retirar dinheiro carteira tenho saque obrigado voce minha reais fazer'.split(' '));

export function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectLanguage(raw) {
  const t = normalize(raw);
  if (/[\u0400-\u04ff]/u.test(t) && t.match(/[\u0400-\u04ff]/gu)?.length >= 4) return 'other';
  if (/[\u0600-\u06ff\u0900-\u097f\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(t)) return 'other';
  const words = t.match(/[a-z]+/g) || [];
  const spanish = words.filter(w => SPANISH_WORDS.has(w)).length;
  const portuguese = words.filter(w => PORTUGUESE_WORDS.has(w)).length;
  if (spanish >= 2 && spanish > portuguese) return 'es';
  if (portuguese >= 3 && portuguese > spanish) return 'other';
  return 'unknown'; // Do NOT infer non-English merely from Telegram's user language setting.
}

// Avoid interrupting casual discussions merely because they mention "sell", "wallet", or "staking".
// A short help-style message without a '?' can still qualify. Language notices are separate.
function appearsToNeedHelp(text) {
  const s = text.trim();
  return /[?¿]/.test(s)
    || /^(?:hi[,!]?\s+|hello[,!]?\s+)?(?:how|why|what|where|when|can|could|would|should|is|are|does|did|help|please|anyone know|i (?:need|want|cannot|can't|am trying|have a problem)|i'm (?:trying|stuck)|need help|trying to|unable to|no puedo|necesito|ayuda|quiero|alguien sabe|como|por que|posso|preciso)\b/i.test(s)
    || /\b(?:not working|doesn't work|won't work|unable to|cannot|can't|error|failed|stuck)\b/i.test(s);
}

export function classify(raw) {
  const text = normalize(raw).slice(0, 4000);
  if (!text.trim()) return { topic: null, language: 'unknown' };
  const language = detectLanguage(raw);
  const helpRequest = appearsToNeedHelp(text);
  // Explicit scam reports warrant a safety response without a question mark.
  const scamReport = /\b(i (?:was|got|have been) scammed|someone asked (?:for|me for) my (?:seed|recovery)|support (?:asked|wants) my (?:seed|private)|me estafaron)\b/i.test(text);
  const credentialRisk = /\b(password|passphrase|login code|verification code)\b/i.test(text)
    && /\b(wallet|sumcoin|sum|support|admin|telegram|seed|recovery)\b/i.test(text);
  if ((helpRequest || scamReport) && (RE.security.test(text) || credentialRisk)) return { topic: 'security', language };
  const bankCashout = /\b(sumcoin|sum|wallet)\b.{0,100}\b(bank account|fiat withdrawal|to my bank)\b|\b(bank account|fiat withdrawal|to my bank)\b.{0,100}\b(sumcoin|sum|wallet)\b/i;
  if (helpRequest && (RE.cashoutEnglish.test(text) || RE.cashoutSpanish.test(text) || bankCashout.test(text))) return { topic: 'cashout', language };
  if (helpRequest && RE.staking.test(text)) return { topic: 'staking', language };
  if (helpRequest && RE.wallet.test(text)) return { topic: 'wallet', language };
  if (language === 'es' || language === 'other') return { topic: 'language', language };
  return { topic: null, language };
}
