import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate_json,minimize_json} from '../web/agent_tape.js';
const load=n=>readFileSync(new URL('../fixtures/'+n+'.json',import.meta.url),'utf8');
const raw=load('missing-approval'),good=load('approved');
assert.equal(JSON.parse(evaluate_json(good)).ok,true);
assert.equal(JSON.parse(evaluate_json(raw)).violations[0].code,'APPROVAL_REQUIRED');
const reduced=JSON.parse(minimize_json(raw));assert.equal(reduced.after,1);assert.equal(reduced.target_code,'APPROVAL_REQUIRED');
for(let i=0;i<reduced.tape.events.length;i++){const t=structuredClone(reduced.tape);t.events.splice(i,1);assert(!JSON.parse(evaluate_json(JSON.stringify(t))).violations.some(v=>v.code===reduced.target_code))}
assert.equal(evaluate_json(raw),evaluate_json(raw));
for(let budget=0;budget<12;budget++){const t=JSON.parse(good);t.policy.max_total_cost=budget;const r=JSON.parse(evaluate_json(JSON.stringify(t)));assert.equal(r.violations.some(x=>x.code==='BUDGET'),r.total_cost>budget);assert.equal(r.network_calls,0)}
assert.equal(JSON.parse(evaluate_json('{')).error,'INVALID_JSON_OR_SCHEMA');
assert.equal(JSON.parse(evaluate_json('x'.repeat(200001))).error,'INPUT_TOO_LARGE');
for (const mutate of [
  t=>{t.fixtures[0].tool=''},
  t=>{t.fixtures[0].args_key='x'.repeat(4001)},
  t=>{t.fixtures[0].result='x'.repeat(8001)},
  t=>{t.policy.allowed_tools=['send','send']},
  t=>{t.policy.side_effect_tools=['']},
  t=>{t.events[0].tool=''},
  t=>{t.events[0].target='unexpected'},
  t=>{t.events[2].target=''},
]) {
  const t=JSON.parse(good);mutate(t);
  const r=JSON.parse(evaluate_json(JSON.stringify(t)));
  assert.equal(r.ok,false);assert(r.violations.some(v=>v.code==='SCHEMA'));
  assert.equal(r.calls,0);assert.equal(r.replay.length,0);
}
console.log('Host integration passed: valid/invalid tapes, minimality, 12 budget boundaries, deterministic output, limits.');
