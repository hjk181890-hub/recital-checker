import fitz
import base64
import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))
        pdf_base64 = body.get('pdfBase64', '')

        pdf_bytes = base64.b64decode(pdf_base64)
        doc = fitz.open(stream=pdf_bytes, filetype='pdf')

        results = {
            'pageCount': doc.page_count,
            'firstLineText': '',
            'colorIssues': [],
            'fontIssues': [],
            'sizeIssues': []
        }

        ALLOWED_FONTS = [
            'malgun', 'malgungothic',
            'hanchopyeom', 'hcr', 'hamchorom',
            'hamchoerom', 'hcrbatang', 'batang'
        ]

        for page_num, page in enumerate(doc):
            blocks = page.get_text('dict')['blocks']
            for block in blocks:
                if block.get('type') != 0:
                    continue
                for line in block.get('lines', []):
                    for span in line.get('spans', []):
                        text = span.get('text', '').strip()
                        if not text:
                            continue

                        if page_num == 0 and not results['firstLineText']:
                            results['firstLineText'] = text

                        color = span.get('color', 0)
                        if color > 100000:
                            r = (color >> 16) & 0xFF
                            g = (color >> 8) & 0xFF
                            b = color & 0xFF
                            results['colorIssues'].append({
                                'text': text[:20],
                                'color': f'#{r:02x}{g:02x}{b:02x}',
                                'page': page_num + 1
                            })

                        font = span.get('font', '').lower()
                        font_clean = font.replace('-', '').replace(' ', '').replace('+', '')
                        is_allowed = any(f in font_clean for f in ALLOWED_FONTS)
                        if not is_allowed and text:
                            results['fontIssues'].append({
                                'text': text[:20],
                                'font': span.get('font'),
                                'page': page_num + 1
                            })

                        size = round(span.get('size', 0))
                        if size > 0 and (size < 9 or size > 22):
                            results['sizeIssues'].append({
                                'text': text[:20],
                                'size': size,
                                'page': page_num + 1
                            })

        doc.close()

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(results, ensure_ascii=False).encode())
