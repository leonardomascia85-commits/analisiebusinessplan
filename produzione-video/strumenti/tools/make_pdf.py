"""Render a SkillEasy Markdown document to a branded A4 PDF.

Usage: make_pdf.py input.md output.pdf "Titolo corso" "Sottotitolo (es. Dispensa · Sezione 1)"
The first '# ' heading of the markdown is the document title on the cover.
"""
import re, sys, html, pathlib
import markdown
from pypdf import PdfWriter, PdfReader
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

CSS = """
@page { size: A4; margin: 22mm 20mm 24mm 20mm; }
* { box-sizing: border-box; }
html { font-family: 'Inter', sans-serif; font-size: 10.5pt; color: #1E293B; line-height: 1.6; }
body { margin: 0; }
.cover { height: 297mm; width: 210mm; background: #0B1120; color: #F8FAFC; padding: 30mm 22mm;
  display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;
  background: radial-gradient(circle at 88% 8%, rgba(245,158,11,0.30) 0%, rgba(245,158,11,0) 42%), linear-gradient(160deg, #0F172A 0%, #0B1120 70%); }
.cover .brand { font-family: 'Fraunces', serif; font-weight: 800; font-size: 20pt; }
.cover .brand em { font-style: normal; color: #F59E0B; }
.cover .kicker { color: #F59E0B; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 10pt; }
.cover h1 { font-family: 'Fraunces', serif; font-weight: 800; font-size: 34pt; line-height: 1.12; margin: 6mm 0 6mm; color: #F8FAFC; border: 0; }
.cover .sub { font-size: 13pt; color: rgba(248,250,252,.75); max-width: 150mm; }
.cover .author { border-top: 1px solid rgba(255,255,255,.18); padding-top: 6mm; font-size: 10pt; color: rgba(248,250,252,.75); }
.cover .author b { color: #F8FAFC; }
.content h1 { font-family: 'Fraunces', serif; font-weight: 800; font-size: 22pt; color: #0B1120; margin: 0 0 4mm;
  padding-bottom: 3mm; border-bottom: 3px solid #F59E0B; page-break-before: always; }
.content h1:first-child { page-break-before: avoid; }
.content h2 { font-family: 'Fraunces', serif; font-weight: 800; font-size: 16pt; color: #0B1120; margin: 9mm 0 3mm;
  page-break-after: avoid; }
.content h2.lesson { page-break-before: always; margin-top: 0; padding: 4mm 5mm; background: #0B1120; color: #F8FAFC;
  border-left: 6px solid #F59E0B; border-radius: 3px; }
.content h3 { font-size: 11.5pt; font-weight: 700; color: #B45309; margin: 6mm 0 2mm; page-break-after: avoid;
  text-transform: uppercase; letter-spacing: .04em; }
.content h4 { font-size: 10.5pt; font-weight: 700; margin: 4mm 0 1mm; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1mm; }
strong { color: #0B1120; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #0B1120; color: #F8FAFC; text-align: left; font-weight: 600; padding: 2mm 3mm; }
td { padding: 1.8mm 3mm; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
tr:nth-child(even) td { background: #F8FAFC; }
blockquote { margin: 3mm 0 5mm; padding: 3mm 5mm; background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 2px; }
blockquote p:last-child { margin-bottom: 0; }
code { font-family: 'Inter', sans-serif; background: #F1F5F9; padding: 0 1mm; border-radius: 2px; }
hr { border: 0; border-top: 1px solid #E2E8F0; margin: 6mm 0; }
details { margin: 2mm 0 5mm; padding: 3mm 5mm; border: 1px dashed #CBD5E1; border-radius: 3px; background: #F8FAFC; }
details summary { font-weight: 700; color: #B45309; margin-bottom: 2mm; list-style: none; }
.solution { margin: 2mm 0 5mm; padding: 3mm 5mm; border: 1px dashed #CBD5E1; border-radius: 3px; background: #F8FAFC; }
.solution > p:first-child strong { color: #B45309; }
.callout { margin: 3mm 0 5mm; padding: 3mm 5mm; background: #FFFBEB; border-left: 4px solid #F59E0B; }
.toc { page-break-after: always; }
.toc h1 { page-break-before: avoid; }
.toc ol { list-style: none; padding: 0; }
.toc li { display: flex; gap: 3mm; padding: 1.6mm 0; border-bottom: 1px dotted #CBD5E1; }
.toc li span.n { color: #B45309; font-weight: 700; min-width: 16mm; }
.disclaimer { font-size: 8.5pt; color: #64748B; margin-top: 8mm; border-top: 1px solid #E2E8F0; padding-top: 3mm; }
"""

FOOTER = """<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#64748B;padding:0 20mm;display:flex;justify-content:space-between">
<span>SkillEasy · {course}</span><span>Pagina <span class="pageNumber"></span> di <span class="totalPages"></span></span></div>"""


def build_html(md_text, course, subtitle):
    lines = md_text.splitlines()
    title = next((l[2:].strip() for l in lines if l.startswith("# ")), course)
    body_md = "\n".join(l for l in lines if l.strip() != f"# {title}")
    body_md = re.sub(r"<details>\s*<summary>(.*?)</summary>", r'<div class="solution" markdown="1">\n\n**\1**\n', body_md)
    body_md = body_md.replace("</details>", "\n</div>")
    body = markdown.markdown(body_md, extensions=["tables", "sane_lists", "md_in_html"])
    body = re.sub(r"<h2>(Lezione \d+[^<]*)</h2>", r'<h2 class="lesson">\1</h2>', body)
    body = re.sub(r"<p>(📌[\s\S]*?)</p>", r'<div class="callout"><p>\1</p></div>', body)
    lessons = re.findall(r'<h2 class="lesson">Lezione (\d+)\s*[—-]\s*([^<]*)</h2>', body)
    toc = ""
    if lessons:
        items = "".join(f'<li><span class="n">Lezione {n}</span><span>{t}</span></li>' for n, t in lessons)
        toc = f'<section class="toc content"><h1>Indice</h1><ol>{items}</ol></section>'
    fonts_css = (FONTS / "local-fonts.css").read_text()
    return f"""<!doctype html><html lang="it"><head><meta charset="utf-8">
<style>{fonts_css}</style><style>{CSS}</style></head><body>
<section class="cover">
  <div class="brand">Skill<em>Easy</em></div>
  <div>
    <div class="kicker">{html.escape(course)}</div>
    <h1>{html.escape(title)}</h1>
    <div class="sub">{html.escape(subtitle)}</div>
  </div>
  <div class="author">A cura di <b>Dr. Leonardo Mascia</b><br>Dottore Commercialista e Revisore Legale dei Conti</div>
</section>
{toc}
<section class="content">{body}
<p class="disclaimer">Materiale didattico a scopo formativo, aggiornato alla normativa in vigore alla data di pubblicazione.
Non sostituisce una consulenza professionale personalizzata. © SkillEasy — riproduzione e diffusione vietate.</p>
</section></body></html>"""


def render(md_path, pdf_path, course, subtitle):
    full = build_html(pathlib.Path(md_path).read_text(encoding="utf-8"), course, subtitle)
    head, rest = full.split('<section class="cover">', 1)
    cover_html, body_html = rest.split("</section>", 1)
    cover_doc = head + '<style>@page{margin:0}</style><section class="cover">' + cover_html + "</section></body></html>"
    body_doc = head + body_html
    out = pathlib.Path(pdf_path)
    parts = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page()
        for name, doc, kw in (
            ("cover", cover_doc, dict(margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})),
            ("body", body_doc, dict(display_header_footer=True, header_template="<span></span>",
                                    footer_template=FOOTER.format(course=html.escape(course)),
                                    margin={"top": "22mm", "bottom": "24mm", "left": "20mm", "right": "20mm"})),
        ):
            tmp = FONTS / f"_{name}.html"
            tmp.write_text(doc, encoding="utf-8")
            page.goto(tmp.as_uri())
            page.evaluate("document.fonts.ready")
            part = out.with_name(out.stem + f"_{name}.pdf")
            page.pdf(path=str(part), format="A4", print_background=True, **kw)
            parts.append(part)
        browser.close()
    w = PdfWriter()
    for part in parts:
        for pg in PdfReader(str(part)).pages:
            w.add_page(pg)
        part.unlink()
    with open(out, "wb") as f:
        w.write(f)


if __name__ == "__main__":
    render(*sys.argv[1:5])
