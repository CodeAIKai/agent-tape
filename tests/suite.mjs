import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../scripts/check-suite.mjs',import.meta.url));
const fixture=name=>fileURLToPath(new URL('../fixtures/'+name,import.meta.url));
const run=path=>spawnSync(process.execPath,[cli,path],{encoding:'utf8'});
const dir=mkdtempSync(join(tmpdir(),'agent-tape-suite-'));
try {
  const normal=run(fixture('regression-suite.json'));assert.equal(normal.status,0);
  assert.equal(JSON.parse(normal.stdout).passed,3);
  copyFileSync(fixture('approved.json'),join(dir,'tape.json'));
  const manifest=join(dir,'suite.json');
  const suite={version:1,cases:[{name:'trace',file:'tape.json',expect:{ok:true,codes:[]}}]};
  const save=()=>writeFileSync(manifest,JSON.stringify(suite));save();
  assert.equal(run(manifest).status,0);
  const mutated=JSON.parse(readFileSync(join(dir,'tape.json')));mutated.policy.max_total_cost=0;
  writeFileSync(join(dir,'tape.json'),JSON.stringify(mutated));
  const mismatch=run(manifest);assert.equal(mismatch.status,1);
  assert.deepEqual(JSON.parse(mismatch.stdout).cases[0].actual.codes,['BUDGET']);
  suite.cases[0].expect={ok:false,codes:['BUDGET']};save();assert.equal(run(manifest).status,0);
  suite.cases.push({...suite.cases[0]});save();assert.equal(run(manifest).status,2);suite.cases.pop();
  symlinkSync(fixture('approved.json'),join(dir,'outside.json'));
  suite.cases[0].file='outside.json';save();assert.equal(run(manifest).status,2);
  suite.cases[0].file=fixture('approved.json');save();assert.equal(run(manifest).status,2);
  console.log('Suite runner passed: expected failures, regression mismatch, unique names and path containment.');
} finally {rmSync(dir,{recursive:true,force:true});}
