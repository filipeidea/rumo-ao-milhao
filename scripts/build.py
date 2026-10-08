"""Gera versões em arquivo único a partir do projeto modular.

    python3 scripts/build.py   (ou: npm run build)

dist/rumo-ao-milhao.html  -> arquivo único para abrir direto no navegador (offline, pendrive, TV)
dist/artifact.html        -> mesmo conteúdo sem <html>/<head>/<body>, para publicação como página
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
fonte = (SRC / "index.html").read_text(encoding="utf-8")


def inline_css(m):
    caminho = m.group(1)
    if caminho.startswith("http"):
        return m.group(0)
    return "<style>\n" + (SRC / caminho).read_text(encoding="utf-8") + "\n</style>"


def inline_js(m):
    codigo = (SRC / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + codigo.replace("</script", "<\\/script") + "\n</script>"


html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, fonte)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

dist = RAIZ / "dist"
dist.mkdir(exist_ok=True)
(dist / "rumo-ao-milhao.html").write_text(html, encoding="utf-8")

head = re.search(r"<head>(.*)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
head = re.sub(r'<meta (charset|name="viewport")[^>]*>\s*', "", head)
(dist / "artifact.html").write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
print("ok:", len(html) // 1024, "KB")
