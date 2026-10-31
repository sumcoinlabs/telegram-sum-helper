import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, detectLanguage } from '../src/classify.js';

test('real Spanish question correctly classifies cashout', () => {
  assert.deepEqual(classify('Como puedo retirar 100 dolares de mi wallet sumcoin?'), { topic: 'cashout', language: 'es' });
  assert.deepEqual(classify('¿Cómo puedo retirar 100 dólares de mi wallet Sumcoin?'), { topic: 'cashout', language: 'es' });
});

test('English withdrawal questions get a cashout reply', () => {
  assert.equal(classify('How do I withdraw $100 from my Sumcoin wallet?').topic, 'cashout');
  assert.equal(classify('How can I cash out my SUM?').topic, 'cashout');
});

test('queries about seed phrases are treated as security first', () => {
  assert.equal(classify('Someone asked for my seed phrase to withdraw my wallet').topic, 'security');
  assert.equal(classify('Is it okay to send my private key to support?').topic, 'security');
});

test('staking and wallet transfer have their own categories', () => {
  assert.equal(classify('How does Sumcoin staking work?').topic, 'staking');
  assert.equal(classify('How do I send Sumcoin from the wallet?').topic, 'wallet');
});

test('do not issue language-enforcement reminders or interrupt unrelated chat', () => {
  assert.equal(classify('Hola, ¿cómo están? Gracias').topic, null);
  assert.equal(classify('Привет, как дела?').topic, null);
  assert.equal(classify('Can I ask one question?').topic, null);
  assert.equal(classify('sumcoin').topic, null);
  assert.equal(detectLanguage('Mi Wallet'), 'en');
});

test('ordinary messages and approximate values should not trigger replies', () => {
  for (const text of ['Welcome to the group!', 'The Sumcoin price is $100', 'Interesting indexed currency', 'I had pizza with my buddy']) {
    assert.equal(classify(text).topic, null, text);
  }
});


test('does not interrupt non-questions that merely mention FAQ keywords', () => {
  for (const text of [
    'Do not sell your SUM! It is a decentralized cryptocurrency',
    'I am explaining how to withdraw your balance',
    'My password manager is broken',
    'The private key signature looks wrong on this API request',
    'This is a good proof-of-stake protocol'
  ]) assert.equal(classify(text).topic, null, text);
});

test('bank cashout question is categorized as cashout not wallet', () => {
  assert.equal(classify('Can I receive USD in my bank account from SUM?').topic, 'cashout');
});

test('routes common troubleshooting to sourced support, without claiming to diagnose accounts', () => {
  assert.equal(classify('My wallet balance is zero, where did my SUM go?').topic,'missing-balance');
  assert.equal(classify('I sent 5 SUM and it never arrived').topic,'pending');
  assert.equal(classify('How do I restore my Sumcoin wallet after changing my phone?').topic,'seed');
  assert.equal(classify('Is SUM BIP39 compatible?').topic,'legacy');
});

test('explicitly reporting a scam gets security guidance', () => {
  assert.equal(classify('I was scammed on Telegram by fake support!').topic, 'security');
});


test('wallet password or verification code requests get security guidance', () => {
  assert.equal(classify('Should I give Sumcoin support my wallet password?').topic, 'security');
  assert.equal(classify('Can I send the Telegram verification code to support?').topic, 'security');
});
