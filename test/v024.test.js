import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {State} from '../src/state.js';
import {ConversationAI,modelTokenUsage} from '../src/ai.js';
import {VERSION} from '../src/version.js';

function setup(now=Date.parse('2026-11-01T12:00:00Z')){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sum-v024-'));
  let clock=now;
  const file=path.join(dir,'state.json');
  const state=new State(file,'reply',()=>clock);
  const opts={dailyLimit:500,hourlyLimit:900,monthlyLimit:15500,minuteLimit:15,tokensMinuteLimit:4000,tokensDailyLimit:100000,estimatedTokens:100};
  return {state,opts,file,advance:ms=>clock+=ms,clock:()=>clock,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('v024 version, published Groq free-tier half budgets',()=>{
  assert.equal(VERSION,'0.0.24');
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8');
  for(const [name,n] of Object.entries({AI_MINUTE_LIMIT:15,AI_HOURLY_LIMIT:900,AI_DAILY_LIMIT:500,AI_MONTHLY_LIMIT:15500,AI_TOKENS_MINUTE_LIMIT:4000,AI_TOKENS_DAILY_LIMIT:100000}))
    assert.match(env,new RegExp(`^${name}=${n}$`,'m'));
});
test('v024 rolling 60-second 15-request cap has no calendar-boundary loophole',()=>{
  const t=setup(Date.parse('2026-11-01T12:00:59.000Z'));try{
    for(let i=0;i<15;i++)assert.ok(t.state.reserveAiBudget(t.opts));
    t.advance(2000); // 12:01:01, calendar minute changes but rolling window has not
    assert.equal(t.state.reserveAiBudget(t.opts),null);
    t.advance(58001);assert.ok(t.state.reserveAiBudget(t.opts));
  }finally{t.cleanup()}
});
test('v024 token-per-minute reserve, real usage refund and day budget',()=>{
  const t=setup();try{
    const first=t.state.reserveAiBudget({...t.opts,estimatedTokens:3800});
    assert.ok(first);assert.equal(t.state.reserveAiBudget({...t.opts,estimatedTokens:250}),null);
    t.state.settleAiBudget(first,900);
    assert.equal(t.state.data.aiTokenDays['2026-11-01'],900);
    assert.ok(t.state.reserveAiBudget({...t.opts,estimatedTokens:3000}));
    assert.equal(t.state.reserveAiBudget({...t.opts,estimatedTokens:101}),null);
  }finally{t.cleanup()}
});
test('v024 token-day cap persists through service restart',()=>{
  const t=setup();try{
    const ticket=t.state.reserveAiBudget({...t.opts,estimatedTokens:3500,tokensDailyLimit:3650});
    assert.ok(ticket);
    const fresh=new State(t.file,'reply',t.clock);
    assert.equal(fresh.reserveAiBudget({...t.opts,estimatedTokens:151,tokensDailyLimit:3650}),null);
    assert.ok(fresh.reserveAiBudget({...t.opts,estimatedTokens:150,tokensDailyLimit:3650}));
  }finally{t.cleanup()}
});
test('v024 daily cap catches 500 calls despite hourly and monthly allowance',()=>{
  const t=setup();try{
    const p={...t.opts,minuteLimit:null,tokensMinuteLimit:null,tokensDailyLimit:null,estimatedTokens:0};
    for(let i=0;i<500;i++)assert.ok(t.state.reserveAiBudget(p),`request ${i}`);
    assert.equal(t.state.reserveAiBudget(p),null);
  }finally{t.cleanup()}
});
test('v024 setting any provider budget to zero safely disables new Groq requests',()=>{
  const t=setup();try{
    for(const name of ['minuteLimit','tokensMinuteLimit','tokensDailyLimit'])
      assert.equal(t.state.reserveAiBudget({...t.opts,[name]:0}),null,name);
    assert.equal(t.state.data.aiRequests['2026-11-01']||0,0);
  }finally{t.cleanup()}
});
test('v024 unchanged legacy consumeAiQuota uses request counters',()=>{
  const t=setup();try{
    assert.equal(t.state.consumeAiQuota(2,2,2),true);
    assert.equal(t.state.consumeAiQuota(2,2,2),true);
    assert.equal(t.state.consumeAiQuota(2,2,2),false);
  }finally{t.cleanup()}
});
test('v024 real provider token usage parsed, missing usage keeps reservation',async()=>{
  assert.equal(modelTokenUsage({usage:{total_tokens:1789}}),1789);
  assert.equal(modelTokenUsage({usage:{input_tokens:500,output_tokens:200}}),700);
  assert.equal(modelTokenUsage({output:[]}),null);
  let counted=null;
  const ai=new ConversationAI({apiKey:'FAKE',provider:'groq',fetchImpl:async()=>({ok:true,json:async()=>({usage:{total_tokens:376},output:[{content:[{type:'output_text',text:'{"kind":"performance","range":"1d"}'}]}]})})});
  const r=await ai.interpretMarketIntent('change since yesterday',{active:true,onUsage:n=>counted=n});
  assert.equal(r.kind,'performance');assert.equal(counted,376);
});
test('v024 preflight estimates have a token ceiling and preserve non-provider operation',()=>{
  const ai=new ConversationAI({provider:'groq'});
  assert.ok(ai.estimateIntentTokens('what happened to SUM')<4000);
  assert.ok(ai.estimateAnswerTokens('Why does Sumcoin use an index?',[])<4000);
});
