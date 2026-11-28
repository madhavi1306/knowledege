import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from statistics import median

import pymupdf as fitz

DEFINITION_PATTERN = re.compile(
    r"\b(?:is defined as|is a|is an|means|refers to|can be defined as)\b",
    re.IGNORECASE,
)
EXAMPLE_PATTERN = re.compile(
    r"^(?:for example|e\.g\.|example\b|consider\b|such as\b)",
    re.IGNORECASE,
)
FORMULA_PATTERN = re.compile(r"(?:[=<>±×÷∑∫√^]|\b[A-Za-z]\s*=\s*\S)")
TERM_PATTERN = re.compile(r"\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|[A-Z]{2,})\b")
LIST_PATTERN = re.compile(r"^(?:[-*•]|\d+[.)])\s+(.+)")


def _paragraphs(page, original_text):
    blocks = page.get_text("blocks", sort=True)
    extracted = [
        block[4].strip()
        for block in blocks
        if len(block) > 6 and block[6] == 0 and block[4].strip()
    ]
    if extracted:
        return extracted
    return [part.strip() for part in re.split(r"\n\s*\n", original_text) if part.strip()]


def _headings(page):
    lines = []
    sizes = []
    for block in page.get_text("dict", sort=True).get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text:
                continue
            size = max((span.get("size", 0) for span in spans), default=0)
            bold = any("bold" in span.get("font", "").lower() for span in spans)
            sizes.append(size)
            lines.append((text, size, bold))

    baseline = median(sizes) if sizes else 0
    headings = []
    subheadings = []
    for text, size, bold in lines:
        if len(text) > 160:
            continue
        is_heading = baseline > 0 and size >= baseline * 1.18
        is_subheading = bold and len(text) <= 100
        if is_heading:
            headings.append(text)
        elif is_subheading or (text.isupper() and len(text) <= 80):
            subheadings.append(text)
    return list(dict.fromkeys(headings)), list(dict.fromkeys(subheadings))


def _tables(page):
    if not hasattr(page, "find_tables"):
        return []
    try:
        found = page.find_tables()
        return [
            [[cell or "" for cell in row] for row in table.extract()]
            for table in found.tables
        ]
    except (RuntimeError, ValueError):
        return []


def _visuals(page):
    """
    Detect visual content: raster images, drawings/diagrams, and vector flowcharts.
    """
    images_list = []
    for img in page.get_images(full=True):
        xref = img[0]
        images_list.append({
            "xref": xref,
            "width": img[2],
            "height": img[3],
            "colorspace": img[5],
        })

    drawings = page.get_drawings()
    has_diagram = len(drawings) > 10

    return {
        "imageCount": len(images_list),
        "images": images_list[:10],
        "hasDiagramOrChart": has_diagram,
        "drawingElementCount": len(drawings),
    }


def _lists(paragraphs):
    detected_lists = []
    current_list = []
    for p in paragraphs:
        lines = p.splitlines()
        for line in lines:
            match = LIST_PATTERN.match(line.strip())
            if match:
                current_list.append(match.group(1).strip())
            else:
                if current_list:
                    detected_lists.append(current_list)
                    current_list = []
    if current_list:
        detected_lists.append(current_list)
    return detected_lists


def _terms(text, headings):
    candidates = TERM_PATTERN.findall(" ".join(headings) + "\n" + text)
    excluded = {"The", "This", "That", "These", "Those", "Chapter", "Section"}
    counts = Counter(term for term in candidates if term not in excluded)
    return [term for term, _count in counts.most_common(20)]


def extract_document(pdf_path):
    pages = []
    current_section = "Introduction"
    all_sections = []

    with fitz.open(pdf_path) as document:
        if document.needs_pass:
            raise ValueError("The PDF requires a password.")
        
        toc = document.get_toc() # Table of contents if present

        for page_index, page in enumerate(document):
            original_text = page.get_text("text", sort=True)
            paragraphs = _paragraphs(page, original_text)
            headings, subheadings = _headings(page)
            if headings:
                current_section = headings[-1]
                all_sections.append({"heading": current_section, "page": page_index + 1})

            definitions = [
                paragraph for paragraph in paragraphs
                if DEFINITION_PATTERN.search(paragraph)
            ]
            examples = [
                paragraph for paragraph in paragraphs
                if EXAMPLE_PATTERN.search(paragraph.strip())
            ]
            formulas = [
                line.strip() for line in original_text.splitlines()
                if line.strip() and FORMULA_PATTERN.search(line)
            ]
            visuals = _visuals(page)
            lists = _lists(paragraphs)
            context_parts = [current_section, *paragraphs[:2]]

            pages.append({
                "pageNumber": page_index + 1,
                "originalText": original_text,
                "textContext": "\n".join(context_parts)[:1600],
                "section": current_section,
                "headings": headings,
                "subheadings": subheadings,
                "paragraphs": paragraphs,
                "definitions": definitions,
                "examples": examples,
                "formulas": formulas,
                "tables": _tables(page),
                "visuals": visuals,
                "lists": lists,
                "importantTerms": _terms(original_text, headings),
                "sections": [{
                    "heading": current_section,
                    "subheadings": subheadings,
                    "paragraphCount": len(paragraphs),
                }],
            })

    total_images = sum(page["visuals"]["imageCount"] for page in pages)
    total_tables = sum(len(page["tables"]) for page in pages)

    return {
        "pageCount": len(pages),
        "totalCharacters": sum(len(page["originalText"]) for page in pages),
        "totalImages": total_images,
        "totalTables": total_tables,
        "toc": toc,
        "sections": all_sections,
        "pages": pages,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("output_path", type=Path)
    arguments = parser.parse_args()

    try:
        result = extract_document(arguments.pdf_path)
        arguments.output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = arguments.output_path.with_suffix(
            arguments.output_path.suffix + ".tmp"
        )
        temporary_path.write_text(
            json.dumps(result, ensure_ascii=False),
            encoding="utf-8",
        )
        temporary_path.replace(arguments.output_path)
    except (fitz.FileDataError, OSError, ValueError) as error:
        print(f"PDF extraction failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
