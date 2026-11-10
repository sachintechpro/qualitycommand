"""Minimal standard-library server for hosting the standalone QualityCommand UI."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

if __name__ == '__main__':
    os.chdir(Path(__file__).resolve().parent)
    port = int(os.environ.get('PORT', '10000'))
    print(f'QualityCommand serving on port {port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), SimpleHTTPRequestHandler).serve_forever()
