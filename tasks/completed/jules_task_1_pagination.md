# Jules Task 1: Historical Question Explorer Pagination UI/UX

Hello Jules! Your objective in this task is to implement a high-performance, elegant client-side pagination system inside the historical **Question Explorer** tab.

Currently, the explorer renders an endless list of all fetched questions (up to 1,395 questions when fully seeded!). Renders of this scale cause significant browser lag and a poor user experience.

---

## Requirements

1. **Default Page Size**: Limit the displayed list to **10 questions** by default.
2. **Page Size Dropdown**: Provide a clean dropdown selector allowing the user to select from: `10`, `25`, `50`, `100` questions per page, or `Show All`.
3. **Pagination Controls**: Add a premium glassmorphic pagination control overlay at the bottom of the list featuring:
   - A "Previous" button (disabled on page 1).
   - **Page Windowing / Smart Range Range Navigation**: Do NOT render a flat row of 140 buttons (which will break the UI). Instead, implement page windowing. Display:
     - Page 1
     - Left ellipsis (`...`) if the current page is far from the start (e.g. `currentPage > 3`)
     - Surrounding pages: `currentPage - 1`, `currentPage`, `currentPage + 1` (bounded by boundaries)
     - Right ellipsis (`...`) if the current page is far from the end (e.g. `currentPage < totalPages - 2`)
     - Last page (e.g. `140`)
   - A "Next" button (disabled on the last page).
   - Info text indicating: `Showing 11 to 20 of 1395 questions`.
4. **State Reset**: Reset `currentPage` back to `1` automatically whenever the user changes the search keyword, paper selector, or subject filter.

---

## Files to Edit
* 📄 **`frontend/src/App.jsx`** (or your Question component)
* 📄 **`frontend/src/App.css`** (for premium pagination classes)

---

## Implementation Blueprint

### 1. Add Pagination States
In `frontend/src/App.jsx` inside the `App` component, add:
```javascript
const [currentPage, setCurrentPage] = useState(1);
const [questionsPerPage, setQuestionsPerPage] = useState(10);
```

### 2. Reset Page on Filter Trigger
Ensure the page resets when search text or filters change:
```javascript
useEffect(() => {
  setCurrentPage(1);
}, [selectedPaper, questionSubjectFilter, questionSearch]);
```

### 3. Slicing the Questions List
Locate the questions array inside the rendering block for `activeTab === 'questions'`. Slice the array dynamically:
```javascript
const totalQuestions = questions.length;
const totalPages = Math.ceil(totalQuestions / questionsPerPage);
const indexOfLastQuestion = currentPage * questionsPerPage;
const indexOfFirstQuestion = indexOfLastQuestion - questionsPerPage;

// Slice questions based on current pagination size
const currentQuestions = questionsPerPage === 'all' 
  ? questions 
  : questions.slice(indexOfFirstQuestion, indexOfLastQuestion);
```

Render `currentQuestions.map(...)` instead of mapping the full `questions` array.

### 4. Smart Page Numbers Windowing Logic
Add a helper function to construct the page list gracefully:
```javascript
const getPageNumbers = () => {
  const pages = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // Always include page 1
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push('...');
    }
    
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    
    // Always include last page
    pages.push(totalPages);
  }
  return pages;
};
```

### 5. Render Pagination Controls
Render the pagination controls at the bottom of the list cleanly using glassmorphic styling:
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
          return (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
              ...
            </span>
          );
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

### 6. Styles in `frontend/src/App.css`
Append these classes for high-end styling of pagination:
```css
/* Pagination Styling */
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

.pagination-info {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.pagination-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
}

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

.pagination-number:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.pagination-number.active {
  background: rgba(99, 102, 241, 0.2) !important;
  border-color: var(--accent-indigo) !important;
  color: white !important;
  font-weight: 600;
}

.pagination-arrow {
  padding: 6px 12px;
  font-size: 0.8rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.pagination-ellipsis {
  padding: 0 4px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.pagination-select {
  margin: 0;
  padding: 6px 12px;
  font-size: 0.8rem;
}
```

---

Good luck! This will make the historical explorer load instantly, look incredibly polished, and work flawlessly even with thousands of questions.

