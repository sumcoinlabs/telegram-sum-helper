// Gate for optional conversational assistance, never a blanket API call for group chatter.
// Pure function: no keys, state, or private data. Deterministic live-price and
// consensus paths always take priority before this gate is considered.
const EXPLAIN=/(?:\b(?:explain|explanation|why|how does|how do|how is|difference between|compare|contradiction|what makes|does that mean|in simple terms|simplify)\b|\b(?:explique|expliquer|explique-moi|simplement|fonctionne|pourquoi|différence|diferencia|explica|explique|como funciona|por que|warum|erklare|erklären|unterschied|spiega|spiegami|perché|perche|come funziona|почему|объясни|как работает|لماذا|اشرح|कैसे|क्यों|解释|为什么|どうして|説明|왜|설명|neden|açıkla|acikla|bagaimana|jelaskan)\b)/iu;
export function needsConversationalAnswer(q){
  const s=String(q||'').trim();
  if(s.length<12||s.length>1000)return false;
  return EXPLAIN.test(s);
}
