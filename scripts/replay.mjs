import {readFileSync} from 'node:fs';
import {evaluate_json,minimize_json} from '../web/agent_tape.js';
const path=process.argv[2];if(!path){console.error('Usage: node scripts/replay.mjs tape.json [--minimize]');process.exit(2)}
try{const raw=readFileSync(path,'utf8');const result=JSON.parse(process.argv.includes('--minimize')?minimize_json(raw):evaluate_json(raw));console.log(JSON.stringify(result,null,2));process.exitCode=result.error||result.ok===false?1:0}catch{console.error('Cannot read or evaluate tape');process.exitCode=2}
