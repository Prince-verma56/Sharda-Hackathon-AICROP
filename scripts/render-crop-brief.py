"""Render the editable Hinglish Markdown into a two-page local PDF and QA PNGs.

Local document tooling only: pip install reportlab pypdf pymupdf
"""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path
import re
import tempfile

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
BRIEF = ROOT / "docs/project-brief/crop-project-explanation-hinglish.md"
GREEN = colors.HexColor("#145044")
INK = colors.HexColor("#20332E")
MUTED = colors.HexColor("#586F66")
PALE = colors.HexColor("#EDF4EF")


def render(preview_dir: Path) -> None:
    regular, bold = "Helvetica", "Helvetica-Bold"
    fonts = Path("C:/Windows/Fonts")
    if (fonts / "arial.ttf").exists():
        pdfmetrics.registerFont(TTFont("BriefArial", str(fonts / "arial.ttf")))
        pdfmetrics.registerFont(TTFont("BriefArialBold", str(fonts / "arialbd.ttf")))
        regular, bold = "BriefArial", "BriefArialBold"
    styles = {
        "title": ParagraphStyle("title", fontName=bold, fontSize=23, leading=28, textColor=GREEN, spaceAfter=12),
        "sub": ParagraphStyle("sub", fontName=regular, fontSize=9, leading=13, textColor=MUTED, spaceAfter=16),
        "heading": ParagraphStyle("heading", fontName=bold, fontSize=10, leading=14, textColor=GREEN, spaceBefore=10, spaceAfter=5),
        "body": ParagraphStyle("body", fontName=regular, fontSize=11, leading=16, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("small", fontName=regular, fontSize=9, leading=13, textColor=INK, spaceAfter=8),
        "cell": ParagraphStyle("cell", fontName=regular, fontSize=9, leading=13, textColor=INK),
        "cellbold": ParagraphStyle("cellbold", fontName=bold, fontSize=9, leading=13, textColor=GREEN),
    }
    source = BRIEF.read_text(encoding="utf-8")
    title = source.splitlines()[0].removeprefix("# ")
    spoken = source.split("## Spoken script", 1)[1].split("## Internal technical overview", 1)[0]
    sections = re.findall(r"### (.*?)\n\n(.*?)(?=\n### |\Z)", spoken, flags=re.S)
    word_count = sum(len(body.split()) for _, body in sections)
    if len(sections) != 6 or not 180 <= word_count <= 250:
        raise ValueError(f"Unexpected spoken script: {len(sections)} sections, {word_count} words")
    destination = BRIEF.with_suffix(".pdf")
    doc = SimpleDocTemplate(str(destination), pagesize=A4, rightMargin=48, leftMargin=48,
                            topMargin=49, bottomMargin=47, title=title,
                            author="Project engineering preparation", pageCompression=1)
    p = lambda text, style: Paragraph(escape(text), styles[style])
    story = [p("PROJECT BRIEF  /  WORKING TITLE", "heading"), p(title, "title"),
             p(f"Roman Hinglish speaking script  |  {word_count} words  |  Approx. 60-90 seconds, rehearse for pace", "sub")]
    for heading, body in sections:
        story.append(KeepTogether([p(heading, "heading"), p(body.strip().replace("\n", " "), "body")]))
    story += [Spacer(1, 9), p("Planned product. AI assessment supports expert advice; it does not establish laboratory confirmation.", "small"), PageBreak()]
    story += [p("INTERNAL PREPARATION  /  NOT SPOKEN", "heading"), p("How the pieces fit", "title"),
              p("A compact technology map. These are planned responsibilities, not a completed deployment.", "sub")]
    internal = source.split("## Internal technical overview - not spoken", 1)[1]
    rows = []
    for line in internal.splitlines():
        if not line.startswith("|") or line.startswith("|---"):
            continue
        a, b = [column.strip() for column in line.strip("|").split("|")]
        rows.append([p(a.replace("`", ""), "cellbold"), p(b.replace("`", ""), "cell")])
    table = Table(rows, colWidths=[135, A4[0] - 96 - 135], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9F7")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, GREEN),
    ]))
    story += [table, Spacer(1, 13), p("One connected flow", "heading"),
              p("Photo > private inference > weather context + approved knowledge > simple explanation > optional voice / expert review.", "small"),
              p("Before a farmer pilot", "heading"),
              p("Review model and dataset rights, local field performance, languages, agricultural guidance, OTP/admin security and retention. Upstream advice and translations remain drafts. No outbreak probability or independent accuracy is claimed.", "small"),
              p("Sources and detail", "heading"),
              p("Model: github.com/wpzvqrs8/SIH_2026 (India v1). Weather: open-meteo.com/en/docs. Voice: docs.vapi.ai/server-url/server-authentication. Full decisions and contracts: docs/project-planning/README.md.", "small")]

    def frame(canvas, document):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(GREEN)
        canvas.rect(0, height - 12, width, 12, fill=1, stroke=0)
        canvas.setStrokeColor(colors.HexColor("#CEDCD2"))
        canvas.line(48, 37, width - 48, 37)
        canvas.setFont(regular, 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(48, 24, "Engineering preparation  |  13 November 2026  |  Working title")
        canvas.drawRightString(width - 48, 24, f"{document.page} / 2")
        canvas.restoreState()

    doc.build(story, onFirstPage=frame, onLaterPages=frame)
    from pypdf import PdfReader
    reader = PdfReader(str(destination))
    if len(reader.pages) != 2:
        raise ValueError(f"Expected 2 pages; rendered {len(reader.pages)}")
    import pymupdf
    preview_dir.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(destination) as pdf:
        for i, page in enumerate(pdf):
            page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).save(preview_dir / f"page-{i + 1}.png")
    print(f"PDF: {destination}\nPages: 2\nSpoken words: {word_count}\nPreviews: {preview_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "crop-brief-preview")
    render(parser.parse_args().preview_dir)
