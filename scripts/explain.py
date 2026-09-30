"""Optional server-side DeepSeek explanation. Never changes MoonBit verdicts."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from llm import explain

if __name__=='__main__':
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python scripts/explain.py report.json')
    report=json.loads(Path(sys.argv[1]).read_text())
    refs=[v['event_id'] for v in report.get('violations',[])]+['policy']
    r=explain('解释 MoonBit 输出的智能体回放违规，指出修复应补充什么证据。不能把离线检查描述为安全隔离、证明系统或线上拦截。',report,refs)
    print(json.dumps(r,ensure_ascii=False,indent=2))
