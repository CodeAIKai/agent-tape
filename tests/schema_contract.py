"""Check the published format against fixtures and the independently compiled kernel."""
import copy,json,subprocess,unittest
from pathlib import Path
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[1]
SCHEMA=json.loads((ROOT/'schema/tape.schema.json').read_text())
VALIDATOR=Draft202012Validator(SCHEMA)
def kernel(tape):
    p=subprocess.run(['node','scripts/replay.mjs','-'],cwd=ROOT,input=json.dumps(tape,ensure_ascii=False),text=True,capture_output=True)
    return json.loads(p.stdout)
class SchemaContractTests(unittest.TestCase):
    def setUp(self):self.good=json.loads((ROOT/'fixtures/approved.json').read_text())
    def test_schema_and_shipped_tapes(self):
        Draft202012Validator.check_schema(SCHEMA)
        for name in ['approved','missing-approval','drift']:
            VALIDATOR.validate(json.loads((ROOT/f'fixtures/{name}.json').read_text()))
    def test_structural_rejections_agree_with_kernel(self):
        mutations=[lambda t:t.update(version=2),lambda t:t['events'][0].update(cost=-1),lambda t:t['events'][0].update(target='unexpected'),lambda t:t['events'][2].update(target=''),lambda t:t['fixtures'][0].update(tool=''),lambda t:t['policy'].update(allowed_tools=['send','send'])]
        for mutate in mutations:
            t=copy.deepcopy(self.good);mutate(t)
            self.assertFalse(VALIDATOR.is_valid(t));self.assertFalse(kernel(t)['ok'])
    def test_cross_event_rules_are_owned_by_kernel(self):
        t=copy.deepcopy(self.good);t['events'][1]['id']=t['events'][0]['id']
        VALIDATOR.validate(t)
        self.assertIn('SCHEMA',[v['code'] for v in kernel(t)['violations']])
    def test_unicode_unit_boundary_is_documented(self):
        t=copy.deepcopy(self.good);t['events'][0]['id']='😀'*61
        VALIDATOR.validate(t)
        self.assertIn('SCHEMA',[v['code'] for v in kernel(t)['violations']])
    def test_unknown_metadata_is_permitted(self):
        self.good['annotation']={'example':True};VALIDATOR.validate(self.good)
        self.assertTrue(kernel(self.good)['ok'])
if __name__=='__main__':unittest.main(verbosity=2)
