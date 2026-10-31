import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {priceIntent} from '../src/intent.js';
import {detectLanguage} from '../src/languages.js';
import {createHandler} from '../src/bot.js';
import {Knowledge} from '../src/knowledge.js';
import {Learning} from '../src/learning.js';
import {State} from '../src/state.js';
import {ConversationAI} from '../src/ai.js';
import {VERSION} from '../src/version.js';

test('v016 French euro questions route to exact live EUR pricing and French UI',async()=>{
  for(const [q,n] of [
    ['Combien vaut un SUM en Euro ?',1],
    ['Combien valent 5 SUM en euros ?',5],
    ['Quel est le prix du SUM en euro ?',1],
    ['Quelle est la valeur de 1 SUM en EUR ?',1]
  ]){
    assert.deepEqual(priceIntent(q),{currency:'EUR',amount:n},q);
    assert.equal(detectLanguage(q,'en'),'fr',q);
  }
  assert.equal(priceIntent('Someday SUM might have a value in euros'),null);
  assert.equal(priceIntent('whats sumcoin in pesos'),null);
  assert.equal(priceIntent('Sumcoin price in yen')?.currency,'JPY');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sum-fr-v016-'));
  try {
    const sent=[],prices=[];
    const client={sendMessage:async (m,t)=>{sent.push(t);return {message_id:101};},getChatMember:async()=>({status:'member'})};
    const state=new State(path.join(folder,'state.json'),'reply');
    const bot=createHandler({client,state,config:{allowedChatUsername:'sumcoins',learningEnabled:false,userCooldownHours:6,topicCooldownSeconds:120},botUsername:'SumcoinHelperBot',knowledge:new Knowledge(),learning:new Learning(path.join(folder,'learning.json')),ai:new ConversationAI(),liveOps:{price:async x=>{prices.push(x);return 'Prix en direct en '+x.currency;},tx:async()=>'',address:async()=>''}});
    await bot({chat:{id:-100123,type:'supergroup',username:'sumcoins'},from:{id:200,username:'FrenchTester',language_code:'pt'},message_id:1,date:Math.floor(Date.now()/1000),text:'Combien vaut un SUM en Euro ?'});
    assert.equal(prices.length,1);assert.equal(prices[0].currency,'EUR');assert.equal(prices[0].lang,'fr');
    assert.match(sent.join(''),/EUR/);
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});

test('v016 Groq test distinguishes 403 model permissions and selects permitted 20B without exposing key',()=>{
  const py=String.raw`
import contextlib, importlib.util, io, json, os, pathlib, sys, tempfile, urllib.error
sys.dont_write_bytecode=True
from unittest.mock import patch
m_path=pathlib.Path('scripts/setup-groq.py').resolve()
spec=importlib.util.spec_from_file_location('groq_setup', m_path)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory(prefix='groqcheck-') as tmp:
    env=pathlib.Path(tmp)/'.env'
    env.write_text('TELEGRAM_BOT_TOKEN=SECRET_BOT_TOKEN\nINITIAL_MODE=reply\n')
    m.ENV=env
    secret='gsk_NOT_A_REAL_SECRET_KEY_123456789'
    def call(path,key,data=None):
        assert key==secret
        if path=='/models':
            return {'data':[{'id':i} for i in m.MODELS]}
        if data['model']=='openai/gpt-oss-120b':
            payload=json.dumps({'error':{'code':'model_permission_blocked_org','type':'permissions_error','message':'Blocked at org'}}).encode()
            raise urllib.error.HTTPError(m.API+path,403,'Forbidden',{},io.BytesIO(payload))
        return {'output':[{'type':'message','content':[{'type':'output_text','text':'READY'}]}]}
    m.call=call
    with patch.object(m.getpass,'getpass',return_value=secret), contextlib.redirect_stdout(io.StringIO()) as stdout:
        m.main()
    assert secret not in stdout.getvalue()
    assert 'model_permission_blocked_org' in stdout.getvalue()
    assert '20b' in stdout.getvalue()
    contents=env.read_text()
    assert 'TELEGRAM_BOT_TOKEN=SECRET_BOT_TOKEN' in contents
    assert 'AI_MODEL=openai/gpt-oss-20b' in contents
    assert 'GROQ_API_KEY='+secret in contents
    assert oct(env.stat().st_mode & 0o777)=='0o600'
    before=contents
    def denied(path,key,data=None):
        payload=json.dumps({'error':{'code':'account_restricted','type':'permissions_error','message':'Account forbidden'}}).encode()
        raise urllib.error.HTTPError(m.API+path,403,'Forbidden',{},io.BytesIO(payload))
    m.call=denied
    try:
        with patch.object(m.getpass,'getpass',return_value=secret),contextlib.redirect_stdout(io.StringIO()) as stdout:
            m.main()
    except SystemExit as exc:
        assert 'failed' in str(exc).lower()
    else:
        raise AssertionError('Expected failed authorization')
    assert env.read_text()==before
    assert secret not in stdout.getvalue()
`;
  const stdout=execFileSync('python3',['-c',py],{cwd:new URL('..',import.meta.url).pathname,encoding:'utf8'});
  assert.equal(stdout,'');
});

test('v016 release contains private key diagnostic and exact verified publisher base',()=>{
  assert.equal(VERSION,'0.0.17');
  const script=fs.readFileSync(new URL('../scripts/push-update.sh',import.meta.url),'utf8');
  assert.match(script,/bc66b905da56604e1bcf1642bcd5dc8c10e60d9a/);
  assert.match(script,/v0\.0\.17/);
  assert.doesNotMatch(script,/--force/);
  const setup=fs.readFileSync(new URL('../scripts/setup-groq.py',import.meta.url),'utf8');
  assert.match(setup,/model_permission_blocked_org|permissions_error|error_detail/);
  assert.match(setup,/openai\/gpt-oss-20b/);
  assert.match(setup,/getpass\.getpass/);
});
