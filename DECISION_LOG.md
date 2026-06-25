## 2026-06-23

Decision:
Use AIProvider abstraction.

Reason:
Allow switching between Gemini/Claude/local models.

Rejected:
Hard-code Gemini.

Impact:
Future providers can be added without changing app architecture.