import assert from 'node:assert/strict';
import {evaluate_json,minimize_target_json} from '../web/agent_tape.js';
const seed=0x5a17e001;
let state=seed, assertions=0;
function random(n){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)%n;}
function equal(actual,expected){assertions++;assert.deepEqual(actual,expected);}
const evaluate=t=>JSON.parse(evaluate_json(JSON.stringify(t)));
const reduce=(t,code,id)=>JSON.parse(minimize_target_json(JSON.stringify(t),code,id));
const totalCases=64;
for(let trial=0;trial<totalCases;trial++) {
  const count=2+random(11),events=[],fixtures=[];
  let sum=0;
  for(let i=0;i<count;i++) {
    const tool=i===0 || random(3)===0?'send':'read';
    const id='event-'+i,args_key='item='+i,result='response-'+random(10000),cost=1+random(10);
    fixtures.push({tool,args_key,result});sum+=cost;
    if(tool==='send')events.push({id:'approval-'+i,kind:'approve',tool,args_key,result:'',cost:0,target:id});
    events.push({id,kind:'call',tool,args_key,result,cost,target:''});
  }
  const tape={version:1,policy:{allowed_tools:['read','send'],side_effect_tools:['send'],max_total_cost:sum,max_calls:count},fixtures,events};
  const baseline=evaluate(tape);equal(baseline.ok,true);equal(baseline.total_cost,sum);
  equal(evaluate(tape),baseline);
  const permuted=structuredClone(tape);permuted.fixtures.reverse();permuted.policy.allowed_tools.reverse();
  equal(evaluate(permuted),baseline);
  const extended=structuredClone(tape);extended.fixtures.push({tool:'read',args_key:'unused='+trial,result:'unobserved'});
  equal(evaluate(extended),baseline);
  const tight=structuredClone(tape);tight.policy.max_total_cost=sum-1;
  equal(evaluate(tight).violations.some(v=>v.code==='BUDGET'),true);
  tight.policy.max_total_cost=sum+1;equal(evaluate(tight).ok,true);
  const broken=structuredClone(tape);broken.events=broken.events.filter(e=>e.id!=='approval-0');
  const failures=evaluate(broken).violations;
  equal(failures.map(v=>[v.code,v.event_id]),[['APPROVAL_REQUIRED','event-0']]);
  const reduced=reduce(broken,'APPROVAL_REQUIRED','event-0');
  equal(reduced.target_event_id,'event-0');equal(reduced.after,1);
  const ids=reduced.tape.events.map(e=>e.id),originalIds=broken.events.map(e=>e.id);
  equal(originalIds.filter(id=>ids.includes(id)),ids);
  equal(reduce(reduced.tape,'APPROVAL_REQUIRED','event-0').tape,reduced.tape);
  for(let i=0;i<reduced.tape.events.length;i++) {
    const smaller=structuredClone(reduced.tape);smaller.events.splice(i,1);
    equal(evaluate(smaller).violations.some(v=>v.code==='APPROVAL_REQUIRED' && v.event_id==='event-0'),false);
  }
}
const summary={status:'passed',seed:'0x'+seed.toString(16),generated_tapes:totalCases,assertions,properties:['deterministic replay','fixture permutation invariance','unused fixture invariance','budget monotonicity','approval removal localization','pinned reduction subsequence','reducer fixed point','single-deletion minimality']};
console.log(process.argv.includes('--json')?JSON.stringify(summary,null,2):`Metamorphic checks passed: ${totalCases} generated tapes, ${assertions} assertions, fixed seed ${summary.seed}.`);
