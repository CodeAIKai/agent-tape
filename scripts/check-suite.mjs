import {readFileSync, realpathSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {evaluate_json} from '../web/agent_tape.js';
const usage='Usage: node scripts/check-suite.mjs suite.json';
try {
  const args=process.argv.slice(2);
  if(args.length===1 && ['--help','-h'].includes(args[0])) console.log(usage);
  else {
    if(args.length!==1)throw Error(usage);
    const manifest=realpathSync(args[0]), base=dirname(manifest);
    const suite=JSON.parse(readFileSync(manifest,'utf8'));
    if(suite.version!==1 || !Array.isArray(suite.cases) || !suite.cases.length || suite.cases.length>100) throw Error('A version 1 suite requires 1–100 cases');
    const names=new Set(), results=[];
    for(const item of suite.cases) {
      if(typeof item.name!=='string' || !item.name || names.has(item.name)) throw Error('Case names must be nonempty and unique');
      names.add(item.name);
      if(typeof item.file!=='string' || !item.file || isAbsolute(item.file)) throw Error('Case files must be relative to the suite directory');
      const file=realpathSync(resolve(base,item.file)),rel=relative(base,file);
      if(rel==='..' || rel.startsWith('..'+sep) || isAbsolute(rel)) throw Error('Case files must stay inside the suite directory');
      const expected=item.expect;
      if(!expected || typeof expected.ok!=='boolean' || !Array.isArray(expected.codes) || !expected.codes.every(c=>typeof c==='string')) throw Error('Each case requires expect.ok and expect.codes');
      if(expected.error!==undefined && expected.error!==null && typeof expected.error!=='string')throw Error('expect.error must be a string or null');
      const raw=readFileSync(file,'utf8').replace(/^\uFEFF/,'');
      const report=JSON.parse(evaluate_json(raw));
      const actual={ok:report.ok,codes:[...new Set((report.violations||[]).map(v=>v.code))].sort(),error:report.error??null};
      const target={ok:expected.ok,codes:[...new Set(expected.codes)].sort(),error:expected.error??null};
      const passed=JSON.stringify(actual)===JSON.stringify(target);
      results.push({name:item.name,file:item.file,passed,expected:target,actual});
    }
    const passed=results.filter(r=>r.passed).length;
    console.log(JSON.stringify({ok:passed===results.length,total:results.length,passed,failed:results.length-passed,cases:results},null,2));
    process.exitCode=passed===results.length?0:1;
  }
} catch(error) {console.error(error.message);process.exitCode=2;}
