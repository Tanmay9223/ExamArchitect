# Jules Task 3 (v2): MCQ Options Interactive QuestionCard Component

Hello Jules! Your previous PR #8 had several breaking issues, so we're starting fresh from the latest `main` branch which now includes pagination (PR #10) and bulk seeding optimizations (PR #9).

Your objective: Create a standalone `<QuestionCard />` component with interactive MCQ option selection, and integrate it into `App.jsx`.

---

## CRITICAL RULES — Read Before Starting

1. **Do NOT modify any backend files.** No changes to `backend/app/main.py` or `backend/parse_and_ingest_all.py`. Those files are already correct on `main`.
2. **Do NOT modify `frontend/src/components/AdminPanel.jsx`.** Leave it exactly as-is.
3. **Do NOT change the lucide-react imports in App.jsx.** Only ADD new imports if needed. Do not remove any existing icon imports — other tabs use them.
4. **Do NOT remove any existing state variables** from App.jsx (like `selectedTopicFilter`).
5. **Do NOT include any verification/test scripts** (no `verify_mcq.py`, no Playwright scripts) in your commit.
6. **Make sure you are working on the latest `main` branch.**

---

## Step 1: Create `frontend/src/components/QuestionCard.jsx` (NEW FILE)

Create this new file with the following contents:

```jsx
import { useState } from 'react';
import { Image, ChevronRight } from 'lucide-react';

function parseOptions(text) {
  if (!text) return null;
  const mcqPattern = /(?:\(|\s|^)([A-D])\)(?:\s+|:)([\s\S]*?)(?=\s*(?:\(|^[A-D]\)|[A-D]\s*[.):]\s|$))/g;
  const matches = [...text.matchAll(mcqPattern)];
  if (matches.length > 0) {
    const options = matches.map(m => ({ label: m[1], text: m[2].trim() }));
    const idx = text.search(/(?:\(|\s|^)[A-D]\)(?:\s+|:)/);
    const cleanText = idx !== -1 ? text.substring(0, idx).trim() : text;
    return { cleanText, options };
  }
  const dotPattern = /(?:\s|^)([A-D])\.(?:\s+|:)([\s\S]*?)(?=\s*(?:^[A-D]\.|[A-D]\s*[.):]\s|$))/g;
  const matchesDot = [...text.matchAll(dotPattern)];
  if (matchesDot.length > 0) {
    const options = matchesDot.map(m => ({ label: m[1], text: m[2].trim() }));
    const idx = text.search(/(?:\s|^)[A-D]\.(?:\s+|:)/);
    const cleanText = idx !== -1 ? text.substring(0, idx).trim() : text;
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

      <div className="question-card-body">
        <p className="question-text">{cleanText}</p>

        {options.length > 0 && (
          <div className="question-options-grid">
            {options.map((opt, oIdx) => {
              const isSelected = selectedOption === opt.label;
              let cardClass = "question-option-card";
              if (isSelected) cardClass += " selected";
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
                  onClick={() => setSelectedOption(prev => prev === opt.label ? null : opt.label)}
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

---

## Step 2: Modify `frontend/src/App.jsx` (MINIMAL CHANGES ONLY)

Make exactly these 2 changes and nothing else:

### Change 1: Add Import
At the top of the file, add this import alongside the existing imports:
```javascript
import QuestionCard from './components/QuestionCard';
```

### Change 2: Replace the Question Rendering Loop
Find the block inside the `activeTab === 'questions'` section where questions are mapped. It currently looks like:
```javascript
currentQuestions.map(q => {
    const diffLabel = ...
    const parsed = parseOptions(q.question_text);
    ...
    return (
      <div key={q.id} className="question-card">
        ...
      </div>
    );
  })
```

Replace that entire mapping block with:
```javascript
currentQuestions.map(q => (
  <QuestionCard key={q.id} q={q} selectedPaper={selectedPaper} />
))
```

**Important**: The variable is `currentQuestions` (not `questions`) because pagination is already implemented on `main`.

**Do NOT remove the `parseOptions` function from App.jsx** — just leave it in place. It may be used by other code. The `QuestionCard` component has its own copy.

---

## Step 3: Add CSS Styles to `frontend/src/App.css`

Append these classes at the **end** of the file (after the existing pagination styles):

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

## Verification

After making the changes, run `npm run build` in the `frontend/` directory to confirm there are no compilation errors.

## Summary of files changed

| File | Action |
|------|--------|
| `frontend/src/components/QuestionCard.jsx` | **NEW** — Create this file |
| `frontend/src/App.jsx` | **MODIFY** — Add 1 import + replace 1 mapping block |
| `frontend/src/App.css` | **MODIFY** — Append interactive option CSS |

**Files NOT to touch**: `backend/*`, `AdminPanel.jsx`, `verify_*.py`

Good luck Jules! This is a focused, clean task with no backend changes needed.
