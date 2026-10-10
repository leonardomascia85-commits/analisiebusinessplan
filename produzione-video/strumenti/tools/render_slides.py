"""Render Slides-format <section> files to 1920x1080 PNGs with local brand fonts."""
import sys, os, pathlib
from playwright.sync_api import sync_playwright

FONTS = pathlib.Path(__file__).resolve().parent.parent / "fonts"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

BASE_CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:#0B1120}
section{position:relative;width:1920px;height:1080px;overflow:hidden;display:flex;flex-direction:column}
h1{font-size:96px;font-weight:600;line-height:1.1}
h2{font-size:64px;font-weight:600;line-height:1.15}
h3{font-size:44px;font-weight:600;line-height:1.2}
p{font-size:32px;font-weight:400;line-height:1.4}
ul,ol{padding-left:1.2em;line-height:1.4}
li{margin:0}
div{min-width:0}
table{border-collapse:collapse;width:100%}
th,td{padding:0.35em 0.6em;border-bottom:1px solid rgba(255,255,255,0.12);text-align:left;vertical-align:middle}
th{font-weight:700}
x-connector{display:block;height:4px;align-self:center;background:currentColor;position:relative}
x-connector::after{content:"";position:absolute;right:-2px;top:-9px;border-left:18px solid currentColor;border-top:11px solid transparent;border-bottom:11px solid transparent}
x-icon{display:inline-block}
aside{display:none}
"""


def page_html(section_html: str) -> str:
    fonts_css = (FONTS / "local-fonts.css").read_text()
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>{fonts_css}</style><style>{BASE_CSS}</style></head>
<body>{section_html}</body></html>"""


def render(pairs):
    """pairs: list of (input_html_path, output_png_path)."""
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        tmp = FONTS / f"_page_{os.getpid()}.html"
        for src, dst in pairs:
            tmp.write_text(page_html(pathlib.Path(src).read_text()))
            page.goto(tmp.as_uri())
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(150)
            over = page.evaluate("""() => {
              const sec = document.querySelector('section'); let worst = 0;
              for (const el of sec.querySelectorAll('*')) {
                if (getComputedStyle(el).position === 'absolute') continue;
                const r = el.getBoundingClientRect();
                if (r.width && r.height) worst = Math.max(worst, r.bottom, r.right - 1792 + 1792 * (r.right > 1800));
                if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') worst = Math.max(worst, 9999);
              }
              return Math.round(worst);
            }""")
            if over > 960:
                print(f"OVERFLOW {src}: contenuto fino a y={over}px")
            page.screenshot(path=str(dst), clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
        browser.close()
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    render(list(zip(args[0::2], args[1::2])))
