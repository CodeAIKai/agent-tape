import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluate_json, minimize_target_json} from '../web/agent_tape.js';

const usage = 'Usage: node scripts/replay.mjs <tape.json|-> [--minimize [--violation CODE] [--event EVENT_ID]] [--output report.json]';
function parse(args) {
  const options = {path: null, minimize: false, output: null, violation: '', event: ''};
  for (let i=0; i<args.length; i++) {
    const arg=args[i];
    if (arg==='--help' || arg==='-h') return {help:true};
    if (arg==='--minimize' && !options.minimize) options.minimize=true;
    else if (arg==='--output' && !options.output) {
      const value=args[++i];
      if (!value || value.startsWith('--') || value==='-') throw Error('--output requires a file path');
      options.output=value;
    } else if (arg==='--violation' || arg==='--event') {
      const key=arg.slice(2),value=args[++i];
      if (!value || value.startsWith('--') || options[key]) throw Error(arg+' requires one unique value');
      options[key]=value;
    } else if ((!arg.startsWith('-') || arg==='-') && !options.path) options.path=arg;
    else throw Error('Unknown or duplicate argument: '+arg);
  }
  if (!options.path) throw Error('A tape file or - for standard input is required');
  if ((options.violation || options.event) && !options.minimize) throw Error('A reduction target requires --minimize');
  if (options.event && !options.violation) throw Error('--event requires --violation');
  if (options.path!=='-' && options.output && resolve(options.path)===resolve(options.output)) {
    throw Error('The report output must not overwrite the input tape');
  }
  return options;
}
try {
  const options=parse(process.argv.slice(2));
  if (options.help) console.log(usage);
  else {
    const raw=readFileSync(options.path==='-' ? 0 : options.path,'utf8').replace(/^\uFEFF/,'');
    const result=JSON.parse(options.minimize ? minimize_target_json(raw,options.violation,options.event) : evaluate_json(raw));
    const text=JSON.stringify(result,null,2)+'\n';
    if (options.output) writeFileSync(options.output,text,{flag:'wx'});
    process.stdout.write(text);
    process.exitCode=result.error || result.ok===false ? 1 : 0;
  }
} catch (error) {
  console.error(error.code==='EEXIST' ? 'Output already exists; choose a new report path.' : error.message);
  console.error(usage);
  process.exitCode=2;
}
