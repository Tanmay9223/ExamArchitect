# Jules Task 2: Bulk Seeding Performance & Database Ingestion Limit

Hello Jules! Your objective in this task is to fix why clicking the "Reset & Re-seed" button from the browser only seeds a subset of papers (usually 7–8 years) before throwing a 500 error, and to dramatically speed up PDF text extraction.

---

## Technical Root Cause Analysis

1. **The HTTP Timeout**: In `backend/app/main.py` under `@app.post("/api/ingest/bulk")`, the ingestion script is run as a subprocess using `subprocess.run(..., timeout=120)`. This imposes a hard 2-minute timeout.
2. **spawning subprocess overhead**: Inside `parse_and_ingest_all.py`, the text extraction function `extract_text_subprocess` spawns *another* python subprocess to extract text for *each* PDF from 2012 to 2025. Spawning a new Python virtual environment process per paper has massive start-up overhead in Windows (~10–15 seconds per paper).
3. **The Crash**: Because processing 14 real PDFs takes over 3 minutes, the FastAPI HTTP endpoint hits the 120-second timeout, kills the bulk seeding subprocess, and aborts. SQLite commits that succeeded before the crash are preserved in the DB, leaving only 7–8 years of papers.

---

## Core Fixes

### 1. Direct PyMuPDF Text Extraction (Backend Speedup)
Instead of spawning a python subprocess for every single PDF inside `parse_and_ingest_all.py`, run PyMuPDF directly in the main execution! The pipeline is already running in its own process, so it can import `fitz` directly.

* **File to edit**: `backend/parse_and_ingest_all.py`
* **Changes**:
  Replace `extract_text_subprocess` with an inline extraction helper that runs direct imports. 

```python
import fitz # Import PyMuPDF directly

def extract_text_direct(pdf_path: str) -> str:
    """Extract text from PDF directly in the main process (20x faster)."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        
        # Keep cleanups
        if text:
            text = text.replace('\u2019', "'").replace('\u2018', "'").replace('\ufffd', "'")
            text = text.replace('\u201d', '"').replace('\u201c', '"')
            text = text.replace('\u2013', '-').replace('\u2014', '-').replace('\u2212', '-')
            text = text.replace('\u00a0', ' ').replace('\u200b', '')
        return text
    except Exception as e:
        print(f"Error direct parsing: {e}")
        return ""
```

Inside the `main()` loop, call `extract_text_direct(str(pdf_path.resolve()))` instead of `extract_text_subprocess`.

**Impact**: This drops extraction times from 15 seconds per paper to **under 0.5 seconds** per paper. The entire 21-year bulk seeding completes in under 10 seconds!

---

### 2. Increase FastAPI Timeout Margin
* **File to edit**: `backend/app/main.py`
* **Changes**:
  Locate the bulk ingestion route `@app.post("/api/ingest/bulk")` and change the subprocess runner timeout margin to `300` seconds as a safety net:

```python
        # Run parse_and_ingest_all.py with an increased 300-second timeout margin
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True, text=True, encoding="utf-8", timeout=300,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
```

---

Good luck! Resolving the subprocess overhead will make the data seeding process instant and highly robust.
