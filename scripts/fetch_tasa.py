# -*- coding: utf-8 -*-
"""
Descarga la tasa de cambio (Bs/USD) desde el sitio del BCV
y la guarda en data/tasa.json.

Se usa dentro de GitHub Actions para mantener la tasa actualizada
una vez al día. Si la descarga falla, termina con error para no
sobrescribir el último valor bueno.
"""

import json
import os
import re
import ssl
import sys
import time
import urllib.request

BASE_URL = "https://www.bcv.org.ve/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "..", "data", "tasa.json")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean_num(raw):
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


def parse(html):
    dolar = re.search(r'id="dolar".*?<strong[^>]*>\s*([\d.,\s]+?)\s*</strong>', html, re.DOTALL)
    fecha = re.search(
        r'<span class="date-display-single"[^>]*content="([^"]+)"[^>]*>([^<]+)</span>', html
    )
    data = {"ok": True, "dolar": None, "fuente": BASE_URL, "consulta": time.strftime("%Y-%m-%d %H:%M:%S")}
    if dolar:
        data["dolar"] = clean_num(dolar.group(1))
    if fecha:
        data["fecha_valor"] = fecha.group(2).strip()
        data["fecha_actualizacion"] = fecha.group(1)
    return data


def main():
    data = parse(fetch_html(BASE_URL))
    if data["dolar"] is None:
        print("ERROR: no se encontró la tasa en la página del BCV", file=sys.stderr)
        sys.exit(1)

    # Solo escribir si hay un cambio, para no ensuciar el historial del repo
    if os.path.exists(SALIDA):
        try:
            with open(SALIDA, "r", encoding="utf-8") as f:
                anterior = json.load(f)
            if anterior.get("dolar") == data["dolar"]:
                print("La tasa no cambió (%s). Sin actualizar." % data["dolar"])
                return
        except Exception:
            pass

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Tasa guardada: %s Bs/USD (%s)" % (data["dolar"], data.get("fecha_valor", "?")))


if __name__ == "__main__":
    main()