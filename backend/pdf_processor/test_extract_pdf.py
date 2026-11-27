import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf as fitz

from extract_pdf import extract_document


class PdfExtractionTests(unittest.TestCase):
    def create_pdf(self, path):
        with fitz.open() as document:
            first = document.new_page()
            first.insert_text((72, 72), "Cellular Respiration", fontsize=20)
            first.insert_text(
                (72, 112),
                "ATP is a molecule that stores energy.\n\nFor example, "
                "muscle cells use ATP.\n\nE = mc2",
                fontsize=11,
            )
            second = document.new_page()
            second.insert_text((72, 72), "Energy Transfer", fontsize=20)
            second.insert_text(
                (72, 112),
                "Energy transfer means movement between systems.",
                fontsize=11,
            )
            document.save(path)

    def test_extracts_page_text_sections_and_structural_candidates(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "study.pdf"
            self.create_pdf(pdf_path)

            result = extract_document(pdf_path)

        self.assertEqual(result["pageCount"], 2)
        self.assertEqual(
            [page["pageNumber"] for page in result["pages"]],
            [1, 2],
        )
        first_page = result["pages"][0]
        self.assertIn("Cellular Respiration", first_page["headings"])
        self.assertIn("ATP is a molecule that stores energy.", first_page["definitions"][0])
        self.assertTrue(first_page["examples"])
        self.assertTrue(first_page["formulas"])
        self.assertEqual(result["pages"][1]["section"], "Energy Transfer")

    def test_cli_writes_json_to_requested_private_output_path(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "study.pdf"
            output_path = Path(directory) / ".tmp" / "pages.json"
            self.create_pdf(pdf_path)

            subprocess.run(
                [sys.executable, str(Path(__file__).with_name("extract_pdf.py")),
                 str(pdf_path), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
            )

            result = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(result["pageCount"], 2)


if __name__ == "__main__":
    unittest.main()
