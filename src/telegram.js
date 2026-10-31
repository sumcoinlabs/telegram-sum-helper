const API_TIMEOUT_MS = 40_000;

export class TelegramApiError extends Error {
  constructor(method, description, status, retryAfter = 0) {
    super(`Telegram ${method}: ${description} (HTTP ${status})`);
    this.name = 'TelegramApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export class TelegramClient {
  constructor(token, { fetchImpl = fetch } = {}) {
    this.token = token;
    this.fetch = fetchImpl;
    this.base = `https://api.telegram.org/bot${token}/`;
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
    return this.call('sendMessage', payload);
  }
  getChatMember(chatId, userId) { return this.call('getChatMember', { chat_id: chatId, user_id: userId }); }
  setMyCommands() {
    return this.call('setMyCommands', { commands: [
      { command: 'help', description: 'Bot features and safety information' },
      { command: 'ask', description: 'Ask a Sumcoin question with sources' },
      { command: 'find', description: 'Search official Sumcoin knowledge' },
      { command: 'github', description: 'Search official Sumcoin GitHub files' },
      { command: 'sources', description: 'Verified Sumcoin information sources' },
      { command: 'cashout', description: 'USD index value vs cash withdrawal' },
      { command: 'migration', description: 'Old Slice / PoW to current wallet' },
      { command: 'wallet', description: 'Mobile wallet basics' },
      { command: 'staking', description: 'Proof-of-stake and minting' },
      { command: 'security', description: 'Scam and recovery-phrase safety' }
    ] });
  }
}
