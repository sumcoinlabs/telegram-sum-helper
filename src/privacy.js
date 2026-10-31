// Refuse to process likely wallet secrets. Best effort; never promise perfect detection.
const PHRASE=/(?:seed\s*(?:phrase|words)?|recovery\s*(?:phrase|words)|private\s*key|mnemonic|frase\s*(?:de\s*)?(?:recuperaci[oó]n|semilla)|clave\s*privada|chave\s*privada|phrase\s*de\s*r[eé]cup[eé]ration|cl[eé]\s*priv[eé]e|wiederherstellungsphrase|chiave\s*privata|сид[\s-]*фраз|фраз[аы]\s*восстановления|приватн(?:ый|ого)\s*ключ|عبارة\s*الاسترداد|المفتاح\s*الخاص|रिकवरी\s*(?:शब्द|वाक्यांश)|निजी\s*कुंजी|助记词|私钥|復元フレーズ|秘密鍵|복구\s*문구|개인\s*키)/iu;
const DECLARE=/(?:\b(?:is|are|here|my|mine|these|words)\b|\b(?:es|son|son\s*estos|mi|mis|é|s[aã]o|minha|mon|mes|est|ist|mein|è|sono|mio)\b|это|вот|هي|मेरे|है|是|如下|これ|です|입니다|여기)/iu;
const LOOKS_LIKE_MNEMONIC=/\b(?:[a-z]{3,10}\s+){11,23}[a-z]{3,10}\b/i;
export function containsSecret(raw){
  const text=String(raw||'').slice(0,3000);
  if(!PHRASE.test(text))return false;
  const labelEnd=text.search(PHRASE);
  const tail=text.slice(labelEnd+1,500);
  return (DECLARE.test(tail)&&/[=:：]|\b(?:is|are|es|son|é|são|ist|это|هي|है|是|です|입니다)\b/iu.test(tail)) || LOOKS_LIKE_MNEMONIC.test(tail);
}
export function safeForLearning(text){
  if(containsSecret(text))return false;
  return !/(?:\b(?:password|otp|verification code|seed phrase|private key)\b|frase\s*semilla|助记词|私钥|秘密鍵|복구\s*문구|عبارة\s*الاسترداد)/iu.test(text);
}
