# Jules Task 3: Question Formatting, Math Symbols & Option Click Interactivity

Hello Jules! Your objective in this task is to fix question formatting issues and make MCQ options in the Question Browser fully interactive with hover visual states, selection highlight, and correct/incorrect validations once answers are shown.

To keep the project clean, modular, and maintainable, you will create a standalone `<QuestionCard />` component in a separate file!

---

## 1. Question Number Mismatch (Backend)
* **File to edit**: `backend/parse_and_ingest_all.py`
* **Problem**: In the ingestion loop inside `main()`, the code assigns a local counter sequence `seq_num = idx + 1` instead of using the actual extracted question number `pq["q_num"]`. If some questions are skipped or filtered, this shifts question indices, causing badge numbers to mismatch (e.g. `Q.14` badge with `Q.4` inside).
* **Fix**: Use `pq["q_num"]` directly inside the loop:
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

---

## 2. Math Character Unicode Correction (Backend)
* **File to edit**: `backend/parse_and_ingest_all.py`
* **Problem**: pyMuPDF extracts mathematical italics/italicized variables as special script unicode equivalents (such as Epigraphical inverted M `ꟽ` for matrices, or script variables `𝓍`, `𝓎`, `𝓏`).
* **Fix**: Implement a standard lookup mapper to normalize these custom symbols back to their clean ASCII letters during ingestion:

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
    '𝐼': 'I', '𝐽': 'J', '𝐾': 'K', '𝐿': 'L', '𝑀': 'M', '𝑁': 'N', '𝑂': 'O', '𝑃': 'P',
    '𝑄': 'Q', '𝑅': 'R', '𝑆': 'S', '𝑇': 'T', '𝑈': 'U', '𝑉': 'V', '𝑊': 'W', '𝑋': 'X',
    '𝑌': 'Y', '𝑍': 'Z',
}

def clean_math_text(text: str) -> str:
    for bad, good in MATH_CHAR_MAP.items():
        text = text.replace(bad, good)
    return text
```

Call `clean_math_text(pq["text"])` inside the loop before passing the text to `classify_question` and `ingest_question`.

---

## 3. MCQ Option Interactive Selection & Custom Component (Frontend)
* **Objective**: Option cards currently do nothing when clicked. They should support hover cues, active selection styles, and correctness validation highlights.
* **Architecture**: Create a standalone, reusable `<QuestionCard />` component. This keeps `selectedOption` and `showAnswer` (spoiler) states local to each card individually, preventing global list re-renders and buggy shared states.

### A. Create the New Component File
* **New File**: 📄 **`frontend/src/components/QuestionCard.jsx`**
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

### B. Integrate in `frontend/src/App.jsx`
1. Import the newly created component at the top:
   ```javascript
   import QuestionCard from './components/QuestionCard';
   ```
2. Locate the historical questions tab mapping block (`activeTab === 'questions'`), and replace the inline rendering loop with:
   ```javascript
   questions.map(q => (
     <QuestionCard key={q.id} q={q} selectedPaper={selectedPaper} />
   ))
   ```
   *(Note: If you already implemented pagination, use `currentQuestions.map(q => ...)`).*

---

### C. Add Premium Styles in `frontend/src/App.css`
Append these classes for interactive selection, hover transitions, and correct/incorrect visual feedback:

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

Good luck, Jules! Creating this component makes the explorer extremely responsive, clean, and highly satisfying to practice on.

