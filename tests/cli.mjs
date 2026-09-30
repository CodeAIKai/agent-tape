import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../scripts/replay.mjs',import.meta.url));
const good=fileURLToPath(new URL('../fixtures/approved.json',import.meta.url));
const bad=fileURLToPath(new URL('../fixtures/missing-approval.json',import.meta.url));
const run=(args,input)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',input});
const dir=mkdtempSync(join(tmpdir(),'agent-tape-cli-'));
try {
  assert.equal(run(['--help']).status,0);
  for (const args of [[],[good,'--unknown'],[good,'--output'],[good,good],[good,'--minimize','--minimize']]) {
    const r=run(args);assert.equal(r.status,2);assert.equal(r.stdout,'');
  }
  const viaStdin=run(['-'],'\uFEFF'+readFileSync(good,'utf8'));
  assert.equal(viaStdin.status,0);assert.equal(JSON.parse(viaStdin.stdout).ok,true);
  const report=join(dir,'report.json');
  const reduced=run([bad,'--minimize','--output',report]);
  assert.equal(reduced.status,0);assert.equal(JSON.parse(readFileSync(report)).after,1);
  assert.equal(reduced.stdout,readFileSync(report,'utf8'));
  writeFileSync(report,'preserve existing file');
  assert.equal(run([good,'--output',report]).status,2);
  assert.equal(readFileSync(report,'utf8'),'preserve existing file');
  assert.equal(run([good,'--output',good]).status,2);
  assert.equal(run(['-'],'{').status,1);
  assert.equal(run([bad]).status,1);
  const target=run([bad,'--minimize','--violation','APPROVAL_REQUIRED','--event','send1']);
  assert.equal(target.status,0);assert.equal(JSON.parse(target.stdout).target_event_id,'send1');
  assert.equal(run([bad,'--event','send1']).status,2);
  assert.equal(run([bad,'--minimize','--event','send1']).status,2);
  assert.equal(run([bad,'--minimize','--violation','UNKNOWN']).status,1);
  assert.equal(run([join(dir,'missing.json')]).status,2);
  console.log('CLI passed: stdin/BOM, output creation, overwrite protection, argument and exit-code contracts.');
} finally {rmSync(dir,{recursive:true,force:true});}
