# -*- coding: utf-8 -*-
"""
Calculadora BCV - Servidor local
Scrapea la tasa de cambio (Bs/USD) de https://www.bcv.org.ve/ y sirve la app web.
Solo usa la biblioteca estándar de Python.
"""

import json
import re
import ssl
import threading
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from os.path import join, dirname, abspath

BASE_URL = "https://www.bcv.org.ve/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
PORT = 8000
CACHE_SECONDS = 600  # 10 minutos; la tasa se actualiza una vez al día en el BCV

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

_cache = {
    "data": None,
    "timestamp": 0.0,
}


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _clean_num(raw):
    # Acepta "846,51310000" o "1.234,56" -> 846.5131 / 1234.56
    s = raw.strip().replace("\xa0", "").replace(" ", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_rate(html):
    dolar = re.search(r'id="dolar".*?<strong[^>]*>\s*([\d.,\s]+?)\s*</strong>', html, re.DOTALL)
    fecha_match = re.search(
        r'<span class="date-display-single"[^>]*content="([^"]+)"[^>]*>([^<]+)</span>', html
    )
    resultado = {
        "dolar": None,
        "fecha_valor": None,
        "fecha_actualizacion": None,
        "fuente": BASE_URL,
    }
    if dolar:
        resultado["dolar"] = _clean_num(dolar.group(1))
    if fecha_match:
        resultado["fecha_valor"] = fecha_match.group(2).strip()
        resultado["fecha_actualizacion"] = fecha_match.group(1)
    return resultado


def get_tasa(force=False):
    import time
    now = time.time()
    if not force and _cache["data"] and (now - _cache["timestamp"]) < CACHE_SECONDS:
        return _cache["data"]
    html = fetch_html(BASE_URL)
    data = parse_rate(html)
    if data["dolar"] is None:
        raise RuntimeError("No se pudo localizar la tasa en la página del BCV")
    data["consulta"] = time.strftime("%Y-%m-%d %H:%M:%S")
    _cache["data"] = data
    _cache["timestamp"] = now
    return data


STATIC_ROOT = dirname(abspath(__file__))

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json",
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            return self._serve_static("index.html")
        if path == "/api/tasa":
            return self._api_tasa()
        if path.startswith("/static/"):
            return self._serve_static(path[len("/static/"):])
        if path == "/favicon.ico":
            return self._serve_static("favicon.ico")
        return self._send(404, json.dumps({"error": "not found"}).encode("utf-8"))

    def _serve_static(self, name):
        safe = name.replace("\\", "/").replace("..", "").lstrip("/")
        full = join(STATIC_ROOT, "static", safe)
        try:
            with open(full, "rb") as f:
                body = f.read()
        except OSError:
            return self._send(404, json.dumps({"error": "not found"}).encode("utf-8"))
        import mimetypes
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        return self._send(200, body, ctype)

    def _api_tasa(self):
        try:
            data = get_tasa()
            data["ok"] = True
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            return self._send(200, body)
        except Exception as e:
            body = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
            return self._send(502, body)

    def log_message(self, fmt, *args):
        pass


def open_browser():
    import threading as _t
    import time as _t2
    import webbrowser

    def _go():
        _t2.sleep(1.2)
        try:
            webbrowser.open("http://localhost:%d/" % PORT)
        except Exception:
            pass

    _t.Thread(target=_go, daemon=True).start()


if __name__ == "__main__":
    print("Servidor: http://localhost:%d/" % PORT)
    open_browser()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()