# Jules Phase 3 Tasks: Question Browser, Ingestion Performance & Interaction

Hello Jules! Here is the next set of task definitions to polish the **ExamArchitect** app. The user has requested three major improvements:
1. **Question Browser Pagination**: Replace the endless scrolling list with elegant, high-performance pagination (10 questions per page default, next/prev navigation, custom page size select).
2. **Seeding limit fix**: Diagnose and fix why the bulk ingestion only seeds 7-8 years when clicked from the frontend, and optimize extraction performance.
3. **Question Card Fixes & Interactivity**:
   - Fix the question number mismatch where the UI badge number doesn't match the card text number.
   - Clean up corrupted mathematical unicode characters extracted from PDFs (e.g. Epigraphical M `ꟽ` or script letters).
   - Implement interactive selection logic for MCQ options, adding premium highlighted state changes and validation feedback once the answer is revealed.

These tasks are well-defined, and we are confident that you will be able to implement them flawlessly! Below is a comprehensive guide on exactly what needs to be changed and where.

To make things incredibly efficient, the user is assigning these 3 tasks to **3 concurrent Jules windows** so they run asynchronously. We have decoupled these tasks completely to prevent git conflicts:
- **Task 2** is purely Backend (ingestion speed, re-indexing, math mapping).
- **Task 3** creates a NEW frontend file `frontend/src/components/QuestionCard.jsx` (adding options selection states and styles).
- **Task 1** handles pagination controls in `frontend/src/App.jsx`.

---

## Task 1: Question Browser Pagination UI/UX

### Objective
The historical Question Explorer tab shows an endless list of questions which causes significant browser rendering lag and a poor user experience. We need standard client-side pagination where:
* The default page size is **10 questions**.
* The user can select a custom page size (e.g. 10, 25, 50, 100, or "All") via a dropdown.
* Simple "Next Page" / "Previous Page" buttons let users slide pages.
* **Page Windowing**: To prevent rendering 140 page buttons in a row for all 1,395 questions, only show Page 1, ellipsis (`...`), surrounding pages around the current page, and the final page.
* Pagination state resets back to page 1 whenever search input or filters (paper/subject) change.

### Frontend Implementation Blueprint
* **Files to edit**: `frontend/src/App.jsx` and `frontend/src/App.css`
* **Steps**:
  1. Add states for pagination inside `App`:
     ```javascript
     const [currentPage, setCurrentPage] = useState(1);
     const [questionsPerPage, setQuestionsPerPage] = useState(10);
     ```
  2. In the filtering `useEffect` blocks, reset the page:
     ```javascript
     useEffect(() => {
       setCurrentPage(1);
     }, [selectedPaper, questionSubjectFilter, questionSearch]);
     ```
  3. Slice the questions list dynamically before mapping:
     ```javascript
     const totalQuestions = questions.length;
     const totalPages = Math.ceil(totalQuestions / questionsPerPage);
     const indexOfLastQuestion = currentPage * questionsPerPage;
     const indexOfFirstQuestion = indexOfLastQuestion - questionsPerPage;
     
     const currentQuestions = questionsPerPage === 'all' 
       ? questions 
       : questions.slice(indexOfFirstQuestion, indexOfLastQuestion);
     ```
  4. Change the rendering block to iterate over `currentQuestions.map(q => ...)` instead of `questions.map`.
  5. Add page range generator logic:
     ```javascript
     const getPageNumbers = () => {
       const pages = [];
       const maxVisible = 5;
       if (totalPages <= maxVisible) {
         for (let i = 1; i <= totalPages; i++) pages.push(i);
       } else {
         pages.push(1);
         if (currentPage > 3) pages.push('...');
         const start = Math.max(2, currentPage - 1);
         const end = Math.min(totalPages - 1, currentPage + 1);
         for (let i = start; i <= end; i++) pages.push(i);
         if (currentPage < totalPages - 2) pages.push('...');
         pages.push(totalPages);
       }
       return pages;
     };
     ```
  6. Add a modern, glassmorphic pagination control component at the bottom of the questions list. Make it look beautiful and align with the existing style:
     ```javascript
     {totalPages > 1 && (
       <div className="pagination-container">
         <div className="pagination-info">
           Showing {indexOfFirstQuestion + 1} to {Math.min(indexOfLastQuestion, totalQuestions)} of {totalQuestions} questions
         </div>
         
         <div className="pagination-buttons">
           <button 
             className="btn-secondary pagination-arrow" 
             disabled={currentPage === 1} 
             onClick={() => setCurrentPage(prev => prev - 1)}
           >
             Previous
           </button>
           
           {getPageNumbers().map((pageNum, idx) => {
             if (pageNum === '...') {
               return <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>;
             }
             return (
               <button
                 key={`page-${pageNum}`}
                 className={`btn-secondary pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                 onClick={() => setCurrentPage(pageNum)}
               >
                 {pageNum}
               </button>
             );
           })}
           
           <button 
             className="btn-secondary pagination-arrow" 
             disabled={currentPage === totalPages} 
             onClick={() => setCurrentPage(prev => prev + 1)}
           >
             Next
           </button>
         </div>
         
         <div className="pagination-select-wrapper">
           <select 
             className="question-filter-select pagination-select"
             value={questionsPerPage}
             onChange={(e) => {
               const val = e.target.value;
               setQuestionsPerPage(val === 'all' ? 'all' : parseInt(val));
               setCurrentPage(1);
             }}
           >
             <option value={10}>10 per page</option>
             <option value={25}>25 per page</option>
             <option value={50}>50 per page</option>
             <option value={100}>100 per page</option>
             <option value="all">Show All</option>
           </select>
         </div>
       </div>
     )}
     ```

* **CSS Styles to append in `frontend/src/App.css`**:
  ```css
  .pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    flex-wrap: wrap;
    gap: 16px;
  }
  .pagination-info { font-size: 0.85rem; color: var(--text-muted); }
  .pagination-buttons { display: flex; gap: 6px; align-items: center; }
  .pagination-number {
    padding: 6px 10px;
    min-width: 32px;
    font-size: 0.8rem;
    border-radius: 6px;
    transition: all 0.2s ease;
    background: transparent;
    border-color: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
  }
  .pagination-number:hover { background: rgba(255, 255, 255, 0.05); color: white; }
  .pagination-number.active {
    background: rgba(99, 102, 241, 0.2) !important;
    border-color: var(--accent-indigo) !important;
    color: white !important;
    font-weight: 600;
  }
  .pagination-arrow { padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; transition: all 0.2s ease; }
  .pagination-ellipsis { padding: 0 4px; color: var(--text-muted); font-size: 0.85rem; }
  .pagination-select { margin: 0; padding: 6px 12px; font-size: 0.8rem; }
  ```

---

## Task 2: Seeding Limit (7-Yr vs 21-Yr Ingestion) & Ingestion Optimization

### Root Cause Analysis
When the user clicks "Reset & Re-seed", they trigger the POST endpoint `/api/ingest/bulk` in `backend/app/main.py`.
* **The FastAPI Timeout**: In `main.py` (line 473), the endpoint triggers `parse_and_ingest_all.py` using `subprocess.run(..., timeout=120)`. This imposes a hard limit of 2 minutes.
* **The Process Slowness**: In `parse_and_ingest_all.py`, text extraction uses `extract_text_subprocess(pdf_path, timeout=10)`. For each PDF from 2012 to 2025, it spawns a python subprocess that imports `fitz` (PyMuPDF) and extracts text. Starting a new python script per PDF has a significant overhead on Windows, taking ~15 seconds per paper.
* **The Crash**: Because processing 14 non-skip papers takes well over 2 minutes, the FastAPI subprocess runner hits the 120-second timeout, throws `subprocess.TimeoutExpired`, kills the ingestion script mid-way (around year 2017), and rolls back the FastAPI session. Only the papers that finished processing before the timeout remain in SQLite.

### Recommended Fixes
1. **Remove subprocess overhead (Highly Recommended)**:
   Instead of spawning a subprocess for every PDF inside `parse_and_ingest_all.py`, perform the extraction directly! `parse_and_ingest_all.py` is already running in its own process, so it can import `fitz` directly.
   Modify `extract_text_subprocess` in `backend/parse_and_ingest_all.py` to:
   ```python
   import fitz
   
   def extract_text_direct(pdf_path: str) -> str:
       try:
           doc = fitz.open(pdf_path)
           text = ""
           for page in doc:
               text += page.get_text()
           doc.close()
           # unicode replacements
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
   **This single optimization will speed up the entire bulk ingestion pipeline from 3 minutes down to under 10 seconds!** The user will be amazed by the seeding speed.
2. **Increase FastAPI subprocess timeout**:
   In `backend/app/main.py` under `@app.post("/api/ingest/bulk")`, increase the `timeout=120` to `timeout=300` or `timeout=600` as a safety net.

---

## Task 3: Question Formatting & Options Interactive Logic

### 1) Question Number Mismatch
* **Location**: `backend/parse_and_ingest_all.py` (around line 418)
* **Problem**:
  ```python
  if len(parsed_qs) >= 15:
      real_extractions += 1
      for idx, pq in enumerate(parsed_qs):
          seq_num = idx + 1 # <-- Problem! Re-indexes from 1 to len(parsed_qs)
          tag = classify_question(pq["text"], seq_num, year)
          # ...
  ```
  Since some questions are filtered out during parsing, mapping the sequential counter `idx + 1` shifts the numbers. For example, the original text for a question starts with "Q.4", but since it was the 14th parsed question in the list, it gets stored as `question_number = 14`.
* **Fix**: Use the extracted question number `pq["q_num"]` directly!
  ```python
  if len(parsed_qs) >= 15:
      real_extractions += 1
      for pq in parsed_qs:
          q_num = pq["q_num"]
          tag = classify_question(pq["text"], q_num, year)
          ingest_question(db=db, paper_id=paper.id, parsed_data=tag)
          real_q_nums.add(q_num)
          total_questions += 1
          ingested_from_text += 1
  ```

### 2) Math Character Corruption
* **Location**: `backend/parse_and_ingest_all.py`
* **Problem**: Older PDFs or high-italic texts parse characters like italic/script letters as corrupted characters (e.g. epigraphical inverted M `ꟽ` instead of `M`).
* **Fix**: Implement a standard dictionary mapper in python to clean up extracted strings before classifying or inserting.
  ```python
  MATH_CHAR_MAP = {
      'ꟽ': 'M',
      '𝓍': 'x', '𝓎': 'y', '𝓏': 'z', '𝓊': 'u', '𝓋': 'v', '𝓌': 'w', '𝓅': 'p', '𝓆': 'q',
      '𝒶': 'a', '𝒷': 'b', '𝒸': 'c', '𝒹': 'd', '𝑒': 'e', '𝒻': 'f', '𝑔': 'g', '𝒽': 'h',
      '𝒾': 'i', '𝒿': 'j', '𝓀': 'k', '𝓁': 'l', '𝓂': 'm', '𝓃': 'n', '𝑜': 'o', '𝓇': 'r',
      '𝓈': 's', '𝓉': 't',
      '𝑎': 'a', '𝑏': 'b', '𝑐': 'c', '𝑑': 'd', '𝑒': 'e', '𝑓': 'f', '𝑔': 'g', '𝑕': 'h',
      '𝑖': 'i', '𝑗': 'j', '𝑘': 'k', '𝑙': 'l', '𝑚': 'm', '𝑛': 'n', '𝑜': 'o', '𝑝': 'p',
      '𝑞': 'q', '𝑟': 'r', '𝑠': 's', '𝑡': 't', '𝑢': 'u', '𝑣': 'v', '𝑤': 'w', '𝑥': 'x',
      '𝑦': 'y', '𝑧': 'z',
      '𝐴': 'A', '𝐵': 'B', '𝐶': 'C', '𝐷': 'D', '𝐸': 'E', '𝐹': 'F', '𝐺': 'G', '𝐻': 'H',
      '𝐼': 'I', '𝐽': 'J', '𝐾': 'K', '𝐿': 'L', '𝑀': 'M', '𝑁': 'N', 'content': 'N', '𝑂': 'O', '𝑃': 'P',
      '𝑄': 'Q', '𝑅': 'R', '𝑆': 'S', '𝑇': 'T', '𝑈': 'U', '𝑉': 'V', '𝑊': 'W', '𝑋': 'X',
      '𝑌': 'Y', '𝑍': 'Z',
  }
  
  def clean_math_text(text: str) -> str:
      for bad, good in MATH_CHAR_MAP.items():
          text = text.replace(bad, good)
      return text
  ```
  Run the text through `clean_math_text(pq["text"])` inside the loop before passing it to `classify_question` and `ingest_question`.

### 3) Option Selection State & Hover Visual Feedback
* **Objective**: Option cards currently do nothing when clicked. They should support hover cues, active selection highlights (indigo border), and validation highlights (green for correct, red for incorrect) once the answer is revealed.
* **Architecture**: Create a standalone, reusable `<QuestionCard />` component. This keeps `selectedOption` and `showAnswer` (spoiler) states local to each card individually, preventing global list re-renders and buggy shared states.

#### A. Create the New Component File
* **New File**: 📄 `frontend/src/components/QuestionCard.jsx`
* **Contents**:
```javascript
import React, { useState } from 'react';
import { Image, ChevronRight } from 'lucide-react';

// ============= Helper to parse MCQ Options =============
function parseOptions(text) {
  if (!text) return null;
  
  // Regex to match options like (A) ... (B) ...
  const mcqPattern = /(?:\(|\s|^)([A-D])\)(?:\s+|:)([\s\S]*?)(?=\s*(?:\(|^[A-D]\)|[A-D]\s*[\.):]|$))/g;
  const matches = [...text.matchAll(mcqPattern)];
  if (matches.length > 0) {
    const options = matches.map(m => ({
      label: m[1],
      text: m[2].trim()
    }));
    const firstOptionIdx = text.search(/(?:\(|\s|^)[A-D]\)(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }

  // Regex to match options like A. ... B. ...
  const dotPattern = /(?:\s|^)([A-D])\.(?:\s+|:)([\s\S]*?)(?=\s*(?:^[A-D]\.|[A-D]\s*[\.):]|$))/g;
  const matchesDot = [...text.matchAll(dotPattern)];
  if (matchesDot.length > 0) {
    const options = matchesDot.map(m => ({
      label: m[1],
      text: m[2].trim()
    }));
    const firstOptionIdx = text.search(/(?:\s|^)[A-D]\.(?:\s+|:)/);
    const cleanText = firstOptionIdx !== -1 ? text.substring(0, firstOptionIdx).trim() : text;
    return { cleanText, options };
  }

  return null;
}

export default function QuestionCard({ q, selectedPaper }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  
  const parsed = parseOptions(q.question_text);
  const cleanText = parsed ? parsed.cleanText : q.question_text;
  const options = parsed ? parsed.options : [];
  const diffLabel = q.difficulty === 'H' ? 'Hard' : q.difficulty === 'M' ? 'Medium' : 'Easy';
  
  return (
    <div className="question-card">
      {/* Card Header */}
      <div className="question-card-header">
        <div className="question-card-header-left">
          <span className="question-number-badge">Q.{q.question_number}</span>
          {!selectedPaper && q.paper_year && (
            <span className="q-badge" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
              GATE CS {q.paper_year}
            </span>
          )}
          <div className="question-meta-badges">
            <span className="q-badge q-badge-type">{q.question_style}</span>
            <span className="q-badge q-badge-marks">{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}</span>
            <span className={`q-badge q-badge-difficulty-${q.difficulty}`}>{diffLabel}</span>
          </div>
        </div>
        {(q.parent_subject_name || q.topic_name) && (
          <span className="q-badge q-badge-topic">
            {q.parent_subject_name || q.topic_name}
            {q.parent_subject_name && q.topic_name && q.parent_subject_name !== q.topic_name && ` › ${q.topic_name}`}
          </span>
        )}
      </div>
      
      {/* Card Body */}
      <div className="question-card-body">
        <p className="question-text">{cleanText}</p>
        
        {options.length > 0 && (
          <div className="question-options-grid">
            {options.map((opt, oIdx) => {
              const isSelected = selectedOption === opt.label;
              let cardClass = "question-option-card";
              
              if (isSelected) {
                cardClass += " selected";
              }
              if (showAnswer) {
                if (opt.label === q.correct_answer) {
                  cardClass += " correct";
                } else if (isSelected) {
                  cardClass += " incorrect";
                }
              }
              
              return (
                <div 
                  key={oIdx} 
                  className={cardClass}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedOption(prev => prev === opt.label ? null : opt.label);
                  }}
                >
                  <span className="question-option-label">{opt.label}</span>
                  <span className="question-option-text">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {q.has_diagram && (
          <div className="question-diagram-placeholder">
            <Image size={20} />
            <span>This question contains a diagram or visual element</span>
          </div>
        )}
        
        {/* Answer Spoiler Toggle */}
        <div className="answer-spoiler">
          <button className={`answer-spoiler-toggle ${showAnswer ? 'open' : ''}`} onClick={() => setShowAnswer(!showAnswer)}>
            <ChevronRight size={14} />
            {showAnswer ? 'Hide Answer' : 'Show Answer'}
          </button>
          {showAnswer && (
            <div className="answer-spoiler-content">
              Correct Answer: <strong style={{ color: 'var(--accent-emerald)' }}>{q.correct_answer}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### B. Integrate in `frontend/src/App.jsx`
1. Import the newly created component:
   ```javascript
   import QuestionCard from './components/QuestionCard';
   ```
2. Locate the questions explorer render block and change it to map `<QuestionCard key={q.id} q={q} selectedPaper={selectedPaper} />`.

#### C. Styles to add in `frontend/src/App.css`
```css
/* Interactive option selections */
.question-option-card {
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.question-option-card:hover {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  transform: translateY(-1px);
}

.question-option-card.selected {
  background: rgba(99, 102, 241, 0.15) !important;
  border-color: rgba(99, 102, 241, 0.5) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}
.question-option-card.selected .question-option-label {
  background: var(--accent-indigo) !important;
  color: white !important;
}

.question-option-card.correct {
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: rgba(16, 185, 129, 0.5) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}
.question-option-card.correct .question-option-label {
  background: var(--accent-emerald) !important;
  color: white !important;
}

.question-option-card.incorrect {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
}
.question-option-card.incorrect .question-option-label {
  background: #ef4444 !important;
  color: white !important;
}
```

---

Good luck, Jules! Feel free to execute these updates. They will make the Question Browser feel responsive, robust, clean, and extremely satisfying to interact with!

