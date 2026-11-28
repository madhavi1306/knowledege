import sys
from pathlib import Path
import fitz

def main():
    if len(sys.argv) < 4:
        print("Usage: render_visual.py <pdf_path> <page_number> <output_image_path> [x0 y0 x1 y1]", file=sys.stderr)
        return 1
    
    pdf_path = Path(sys.argv[1])
    page_num = int(sys.argv[2])
    output_path = Path(sys.argv[3])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with fitz.open(pdf_path) as doc:
        if page_num < 1 or page_num > len(doc):
            print(f"Page {page_num} out of range (1..{len(doc)})", file=sys.stderr)
            return 1
        page = doc[page_num - 1]
        
        clip = None
        if len(sys.argv) >= 8:
            try:
                clip = fitz.Rect(
                    float(sys.argv[4]),
                    float(sys.argv[5]),
                    float(sys.argv[6]),
                    float(sys.argv[7])
                )
            except Exception:
                clip = None
            
        pix = page.get_pixmap(dpi=150, clip=clip)
        pix.save(str(output_path))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
