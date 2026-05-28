# Backend Agent Rules

1. **Code Style & Structure**: Write the most concise, modular, and clean Python code possible. Follow PEP 8 guidelines.
2. **Minimal Edits**: Do not rewrite unchanged files. Only modify the exact lines needed for a task to minimize diffs and regressions.
3. **Commenting**: Avoid verbose, redundant, or obvious comments. Only leave comments that explain *why* a specific approach was taken or to clarify highly complex logic.
4. **Architecture**: Maintain a strict separation of concerns (e.g., keep routing, business logic, and database access separate).
5. **Robustness**: Handle errors gracefully, avoid broad `except:` clauses, and use Python type hints where appropriate.
