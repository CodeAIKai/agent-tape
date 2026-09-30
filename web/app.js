import {evaluate_json, minimize_target_json} from './agent_tape.js';
const $=id=>document.getElementById(id);
let last=null, revision=0;
function node(tag,text,cls) {
  const n=document.createElement(tag);n.textContent=text;
  if(cls)n.className=cls;return n;
}
function invalidate() {
  last=null;$('target').replaceChildren(node('option','首个违规（自动）'));$('target').firstChild.value='';$('target').disabled=true;$('download').disabled=true;$('report').textContent='';
  $('error').textContent='';$('events').replaceChildren();$('reduction').replaceChildren();
  for(const id of ['calls','cost','network'])$(id).textContent='—';
  $('status').textContent='等待回放';$('status').className='status';
}
function render(r) {
  last=r;$('download').disabled=false;$('report').textContent=JSON.stringify(r,null,2);
  $('calls').textContent=r.calls??'—';$('cost').textContent=r.total_cost??'—';$('network').textContent=r.network_calls??'—';
  $('status').textContent=r.error?r.error:r.ok?'通过 · 可重复回放':'未通过 · 发现违规';
  $('status').className='status'+(r.ok?'':' bad');$('events').replaceChildren();
  const targets=new Set();
  for(const v of r.violations||[]) {
    const value=JSON.stringify({code:v.code,event:v.event_id});
    if(!targets.has(value)){targets.add(value);const option=node('option',v.code+' / '+v.event_id);option.value=value;$('target').append(option);$('target').disabled=false;}
    const d=node('div','','event bad');d.append(node('b',v.code+' / '+v.event_id),node('p','步骤 '+v.step+' · '+v.message));$('events').append(d);
  }
  for(const x of r.replay||[]) {
    const d=node('div','','event');d.append(node('b',x.event_id+' → '+x.tool),node('p','fixture: '+x.result));$('events').append(d);
  }
}
function run() {
  invalidate();
  try {const r=JSON.parse(evaluate_json($('tape').value));render(r);return r;}
  catch(e) {$('error').textContent=e.message;return null;}
}
async function load(name) {
  const current=++revision;invalidate();$('tape').value='';
  try {
    const response=await fetch('./fixtures/'+name+'.json');
    if(!response.ok)throw Error('示例加载失败');
    const value=JSON.stringify(await response.json(),null,2);
    if(current!==revision)return;
    $('tape').value=value;$('import-status').textContent='JSON 文件仅在本地处理';run();
  } catch(e) {if(current===revision)$('error').textContent=e.message;}
}
$('import').onclick=()=>{$('file').value='';$('file').click();};
$('file').onchange=async()=>{
  const file=$('file').files[0];if(!file)return;
  const current=++revision;invalidate();$('tape').value='';
  try {
    if(file.size>800000)throw Error('文件过大；磁带文本上限为 200,000 字符');
    const raw=(await file.text()).replace(/^\uFEFF/,'');
    if(current!==revision)return;
    $('tape').value=raw;const r=run();
    $('import-status').textContent=r?.error?'文件已读取，磁带校验未通过':'已在本地读取磁带文件';
  } catch(e) {if(current===revision){$('error').textContent=e.message;$('import-status').textContent='文件导入失败';}}
};
$('tape').oninput=()=>{revision++;invalidate();};
$('bad').onclick=()=>load('missing-approval');$('good').onclick=()=>load('approved');$('drift').onclick=()=>load('drift');$('evaluate').onclick=run;
$('reduce').onclick=()=>{
  const target=$('target').value?JSON.parse($('target').value):{code:'',event:''};
  invalidate();
  try {
    const r=JSON.parse(minimize_target_json($('tape').value,target.code,target.event));
    if(r.error){render(r);return;}
    if(r.message){render(JSON.parse(evaluate_json($('tape').value)));$('reduction').append(node('p',r.message));return;}
    render(r.report);last=r;
    $('reduction').append(node('h2',`缩减 ${r.before} → ${r.after} 个事件`),node('p','保留违规类型：'+r.target_code),node('pre',JSON.stringify(r.tape.events,null,2)));
    $('report').textContent=JSON.stringify(r,null,2);
  } catch(e) {$('error').textContent=e.message;}
};
$('download').onclick=()=>{
  if(!last)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(last,null,2)],{type:'application/json'}));
  const a=node('a','');a.href=url;a.download='agent-tape-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
load('missing-approval');
