import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient } from '../src/telegram.js';

test('Telegram HTTP client uses Bot API polling and preserves reply/thread IDs', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), method: options.method });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: [] }) };
  };
  const client = new TelegramClient('123:placeholder', { fetchImpl: fakeFetch });
  await client.getUpdates(44);
  await client.sendMessage({ chat: { id: -100123 }, message_id: 12, is_topic_message: true, message_thread_id: 8 }, 'Example');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith('/getUpdates'));
  assert.equal(calls[0].body.offset, 44);
  assert.deepEqual(calls[0].body.allowed_updates, ['message']);
  assert.equal(calls[1].body.chat_id, -100123);
  assert.equal(calls[1].body.message_thread_id, 8);
  assert.equal(calls[1].body.reply_parameters.message_id, 12);
});

test('Telegram errors redact secret API token', async () => {
  const token = '123:SECRET_TOKEN_NEVER_LOG';
  const client = new TelegramClient(token, {
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, description: `Too many requests for ${token}`, parameters: { retry_after: 15 } })
    })
  });
  await assert.rejects(() => client.getMe(), err => {
    assert.equal(err.retryAfter, 15);
    assert.doesNotMatch(err.message, /SECRET_TOKEN_NEVER_LOG/);
    assert.match(err.message, /\[redacted\]/);
    return true;
  });
});

test('Telegram network errors do not interpolate token-bearing URLs', async () => {
  const client = new TelegramClient('123:DO_NOT_LOG', {
    fetchImpl: async () => { throw new Error('URL https://api.telegram.org/bot123:DO_NOT_LOG/getMe failed'); }
  });
  await assert.rejects(() => client.getMe(), err => {
    assert.doesNotMatch(err.message, /DO_NOT_LOG/);
    assert.match(err.message, /network error/);
    return true;
  });
});
