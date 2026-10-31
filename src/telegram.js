import {ui} from './locale-ui.js';
const API_TIMEOUT_MS = 40_000;
const GROUP_SEND_INTERVAL_MS = 3_100;
const MAX_FLOOD_RETRIES = 2;
const MAX_FLOOD_WAIT_SECONDS = 120;

export class TelegramApiError extends Error {
  constructor(method, description, status, retryAfter = 0) {
    super(`Telegram ${method}: ${description} (HTTP ${status})`);
    this.name = 'TelegramApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export class TelegramClient {
  constructor(token, { fetchImpl = fetch, sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
    this.token = token;
    this.fetch = fetchImpl;
    this.sleep = sleep;
    this.now = now;
    this.base = `https://api.telegram.org/bot${token}/`;
    this.sendQueue = Promise.resolve();
    this.lastSentToChat = new Map();
  }

  async call(method, body = {}) {
    let response;
    try {
      response = await this.fetch(this.base + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT_MS)
      });
    } catch (err) {
      // Prevent credentials embedded in HTTP request URLs from appearing in logs.
      throw new Error(`Telegram ${method} network error: ${err?.cause?.code || err?.name || 'connection failed'}`);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      const desc = String(data.description || 'unknown API failure').replaceAll(this.token, '[redacted]');
      throw new TelegramApiError(method, desc, response.status, Number(data.parameters?.retry_after) || 0);
    }
    return data.result;
  }

  getMe() { return this.call('getMe'); }
  sendDirect(chatId, text) { return this.call('sendMessage', {chat_id:chatId,text:String(text).slice(0,3500),link_preview_options:{is_disabled:true}}); }
  deleteWebhook() { return this.call('deleteWebhook', { drop_pending_updates: false }); }
  getUpdates(offset) {
    return this.call('getUpdates', {
      ...(offset === null ? {} : { offset }),
      timeout: 30,
      limit: 100,
      allowed_updates: ['message']
    });
  }

  sendMessage(message, text) {
    const payload = {
      chat_id: message.chat.id,
      text,
      link_preview_options: { is_disabled: true },
      reply_parameters: {
        message_id: message.message_id,
        allow_sending_without_reply: true
      }
    };
    if (message.is_topic_message && message.message_thread_id) payload.message_thread_id = message.message_thread_id;

    // Serialize sends so simultaneous support questions cannot flood the group.
    // Telegram recommends no more than 20 messages per minute in a group.
    const send = async () => {
      const chatKey = String(payload.chat_id);
      const last = this.lastSentToChat.get(chatKey);
      if (last !== undefined) {
        const remaining = GROUP_SEND_INTERVAL_MS - (this.now() - last);
        if (remaining > 0) await this.sleep(remaining);
      }
      for (let retry = 0; ; retry++) {
        this.lastSentToChat.set(chatKey, this.now());
        try {
          return await this.call('sendMessage', payload);
        } catch (err) {
          // Retry only explicitly rejected sends. Network timeouts can leave the
          // delivery status unknown and must NOT be retried automatically.
          if (!(err instanceof TelegramApiError) || err.status !== 429 ||
              !Number.isSafeInteger(err.retryAfter) || err.retryAfter < 1 ||
              err.retryAfter > MAX_FLOOD_WAIT_SECONDS || retry >= MAX_FLOOD_RETRIES) throw err;
          const waitMs = (err.retryAfter + 1) * 1000;
          console.warn(`Telegram flood control: waiting ${err.retryAfter + 1}s to retry sendMessage (attempt ${retry + 2}/${MAX_FLOOD_RETRIES + 1}).`);
          await this.sleep(waitMs);
        }
      }
    };
    const result = this.sendQueue.then(send, send);
    this.sendQueue = result.catch(() => {});
    return result;
  }

  getChatMember(chatId, userId) { return this.call('getChatMember', { chat_id: chatId, user_id: userId }); }
  setMyCommands(languageCode='') {
    const desc={es:['Ayuda y seguridad','Pregunta sobre Sumcoin','Elegir idioma','Buscar documentos oficiales','Buscar archivos GitHub','Fuentes oficiales','USD y retiros','Migración de carteras','Enviar comentarios'],pt:['Ajuda e segurança','Perguntar sobre Sumcoin','Escolher idioma','Pesquisar documentos','Pesquisar GitHub','Fontes oficiais','USD e saques','Migração da carteira','Enviar feedback'],fr:['Aide et sécurité','Question sur Sumcoin','Choisir la langue','Chercher les documents','Chercher sur GitHub','Sources officielles','USD et retraits','Migration des wallets','Signaler une réponse'],de:['Hilfe und Sicherheit','Sumcoin-Frage stellen','Sprache wählen','Dokumente durchsuchen','GitHub durchsuchen','Offizielle Quellen','USD und Auszahlung','Wallet-Migration','Antwort melden'],it:['Aiuto e sicurezza','Domanda su Sumcoin','Scegli la lingua','Cerca documenti','Cerca su GitHub','Fonti ufficiali','USD e prelievi','Migrazione wallet','Segnala risposta'],ru:['Помощь и безопасность','Вопрос о Sumcoin','Выбор языка','Поиск в документах','Поиск на GitHub','Официальные источники','USD и вывод','Миграция кошелька','Сообщить об ошибке'],zh:['帮助与安全','询问 Sumcoin','选择语言','搜索官方文档','搜索 GitHub','官方资料','美元与提现','钱包迁移','反馈回答'],
     ar:['المساعدة والأمان','اسأل عن Sumcoin','اختر اللغة','بحث في الوثائق','بحث في GitHub','المصادر الرسمية','تبادل العملات','ترحيل المحفظة','إبلاغ عن خطأ'],
     hi:['सहायता और सुरक्षा','Sumcoin के बारे में पूछें','भाषा चुनें','दस्तावेज़ खोजें','GitHub खोजें','आधिकारिक स्रोत','मुद्रा विनिमय','वॉलेट माइग्रेशन','प्रतिक्रिया दें'],
     ja:['ヘルプと安全','Sumcoinについて質問','言語を選択','資料を検索','GitHubを検索','公式情報','通貨交換','ウォレット移行','回答を報告'],
     ko:['도움말과 보안','Sumcoin 질문','언어 선택','문서 검색','GitHub 검색','공식 자료','통화 교환','지갑 이전','답변 신고'],
     tr:['Yardım ve güvenlik','Sumcoin hakkında sor','Dil seç','Belgeleri ara','GitHub ara','Resmi kaynaklar','Döviz takası','Cüzdan geçişi','Yanıtı bildir'],
     id:['Bantuan dan keamanan','Tanya tentang Sumcoin','Pilih bahasa','Cari dokumen','Cari GitHub','Sumber resmi','Penukaran mata uang','Migrasi dompet','Laporkan jawaban']};
    const commands = [
      { command: 'help', description: 'Bot features and safety information' },
      { command: 'ask', description: 'Ask a Sumcoin question with sources' },
      { command: 'more', description: 'More detail about your last question' },
      { command: 'guide', description: 'Step-by-step wallet troubleshooting' },
      { command: 'price', description: 'Live peer-to-peer rate in your currency' },
      { command: 'currency', description: 'Set your preferred rate currency' },
      { command: 'tx', description: 'Look up a public transaction ID' },
      { command: 'address', description: 'Look up a public SUM address' },
      { command: 'language', description: 'Set your reply language' },
      { command: 'find', description: 'Search official Sumcoin knowledge' },
      { command: 'github', description: 'Search official Sumcoin GitHub files' },
      { command: 'sources', description: 'Verified Sumcoin information sources' },
      { command: 'podcast', description: 'Search historical podcast and project update excerpts' },
      { command: 'news', description: 'Read indexed Sumcoin news headlines' },
      { command: 'privacy', description: 'How public group conversation learning works' },
      { command: 'forget', description: 'Remove saved excerpt: reply to your own message' },
      { command: 'cashout', description: 'USD index value vs cash withdrawal' },
      { command: 'feedback', description: 'Report a bot answer' },
      { command: 'stop', description: 'Pause automatic replies for 24 hours' },
      { command: 'resume', description: 'Resume automatic support replies' },
      { command: 'migration', description: 'Old Slice / PoW to current wallet' },
      { command: 'wallet', description: 'Mobile wallet basics' },
      { command: 'staking', description: 'Proof-of-stake and minting' },
      { command: 'security', description: 'Scam and recovery-phrase safety' }
    ];
    const moreDescriptions={es:'Más detalles de tu última pregunta',pt:'Mais detalhes da última pergunta',fr:'Plus de détails sur la dernière réponse',de:'Weitere Details zur letzten Antwort',it:'Più dettagli sull’ultima risposta',ru:'Подробнее о последнем ответе',zh:'查看上一条回答的更多详情',ar:'تفاصيل إضافية للإجابة الأخيرة',hi:'पिछले उत्तर का अधिक विवरण',ja:'前の回答の詳細',ko:'지난 답변 더 보기',tr:'Son yanıtın ayrıntıları',id:'Detail lebih lanjut dari jawaban terakhir'};
    const more=commands.find(x=>x.command==='more');
    if(moreDescriptions[languageCode])more.description=moreDescriptions[languageCode];
    if(languageCode){
      commands.find(x=>x.command==='price').description=ui(languageCode,'rate').slice(0,130);
      commands.find(x=>x.command==='currency').description=ui(languageCode,'selected');
      commands.find(x=>x.command==='guide').description=ui(languageCode,'guide').slice(0,130);
    }
    const order=['help','ask','language','find','github','sources','cashout','migration','feedback'];
    if(desc[languageCode])order.forEach((name,i)=>{const item=commands.find(x=>x.command===name);if(item)item.description=desc[languageCode][i];});
    return this.call('setMyCommands',{commands,...(languageCode?{language_code:languageCode}:{})});
  }
}
