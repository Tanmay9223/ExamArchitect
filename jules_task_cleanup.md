# Task: Repository Cleanup & Organization

**Assignee**: Jules (Subagent / Co-worker)
**Goal**: Organize the repository by deleting temporary scratch/test files and archiving completed task markdown documents.

---

## 🗑️ Stale/Temporary Files to Delete

Please delete the following temporary search, test, and dump files from the root of the workspace:
1. `scratch_find.py` — Temporary database search script
2. `scratch_find_out.txt` — Output text file from queries
3. `scratch_find_out_bst.txt` — Output text file from BST query
4. `scratch_seed_2011.py` — Database seeding script for GATE 2011 routing questions
5. `scratch_clean_prefixes.py` — Database script used to clean synthetic prefixes
6. `check_2019_questions.py` — Temporary verification script for 2019 papers
7. `check_db_details.py` — Temporary db diagnostic script
8. `check_db_questions.py` — Stale database verification script
9. `test_parse.py` — Stale PDF parsing testing script
10. `full_log.txt` — Large 1.1MB logs dump file
11. `log_patch.txt` — Stale logs patch record
12. `parsed_2019_questions.txt` — Raw parsed text from 2019 questions dump
13. `questions_2019_dump.txt` — Stale text dump from 2019 questions
14. `exam_architect.db` (Root copy only) — **CAUTION**: Do NOT delete `backend/exam_architect.db` as that is the active database. The copy in the root directory is stale and unused.
15. Any `scratch_diff*.txt` files in the root directory.

---

## 📂 Archiving Completed Tasks

To keep the root of the repository neat, please move the completed task markdown files into a dedicated subdirectory `tasks/completed/`:
- `jules_task_1_pagination.md`
- `jules_task_2_seeding.md`
- `jules_task_3_question_card.md`
- `jules_task_3_v2_question_card.md`
- `jules_tasks_phase_3.md`

## ⚙️ Additional Recommendations
- Ensure `.gitignore` ignores all local python virtual environment files (`venv/`), python cache (`__pycache__/`), and user settings.
- Run a quick `git status` after cleanups to verify that only essential files remain tracked.
