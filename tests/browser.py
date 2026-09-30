"""Browser workflow regression checks; run after installing requirements-browser.txt."""
import functools, http.server, json, threading, unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'web')))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch()
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':800})
        self.page=self.context.new_page();self.errors=[];self.external=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('request',lambda r:self.external.append(r.url) if not r.url.startswith('http://127.0.0.1:') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/',wait_until='networkidle')
        expect(self.page.locator('#events')).to_contain_text('APPROVAL_REQUIRED')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.external,[])
    def test_import_and_download(self):
        self.page.set_input_files('#file',str(ROOT/'fixtures/approved.json'))
        expect(self.page.locator('#status')).to_have_text('通过 · 可重复回放')
        with self.page.expect_download() as download:self.page.click('#download')
        result=json.loads(Path(download.value.path()).read_text())
        self.assertTrue(result['ok']);self.assertEqual(result['network_calls'],0)
    def test_edited_input_cannot_export_stale_report(self):
        self.page.locator('#tape').fill('{')
        expect(self.page.locator('#download')).to_be_disabled()
        self.page.click('#evaluate')
        expect(self.page.locator('#status')).to_have_text('INVALID_JSON_OR_SCHEMA')
        self.assertNotIn('APPROVAL_REQUIRED',self.page.locator('#events').inner_text())
    def test_targeted_reduction_keeps_selected_event(self):
        tape=json.loads((ROOT/'fixtures/missing-approval.json').read_text())
        tape['events'].append({**tape['events'][-1], 'id':'send2'})
        self.page.locator('#tape').fill(json.dumps(tape))
        self.page.click('#evaluate')
        self.page.select_option('#target',json.dumps({'code':'APPROVAL_REQUIRED','event':'send1'},separators=(',',':')))
        self.page.click('#reduce')
        expect(self.page.locator('#reduction')).to_contain_text('缩减 4 → 1 个事件')
        self.page.locator('details summary').click()
        report=json.loads(self.page.locator('#report').inner_text())
        self.assertEqual(report['tape']['events'][0]['id'],'send1')
        self.assertIn('send2',report['removed_event_ids'])
    def test_large_file_and_mobile_layout(self):
        self.page.set_input_files('#file',{'name':'large.json','mimeType':'application/json','buffer':b'x'*800001})
        expect(self.page.locator('#error')).to_contain_text('文件过大')
        expect(self.page.locator('#download')).to_be_disabled()
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
if __name__=='__main__':unittest.main(verbosity=2)
