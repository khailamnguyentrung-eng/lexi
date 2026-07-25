# LEXI — Docs Index

Every file in `docs/`, what it is, and whether it is **live** (still governs current work) or
**historical** (a finished phase's record, kept as evidence per the Engineering Constitution's
M7 — repo history *is* architectural evidence).

**Different job from [`DOCUMENT_HIERARCHY.md`](DOCUMENT_HIERARCHY.md)**, which ranks docs by
*authority* (which ones define semantics vs. merely reflect them). This one is a plain file
census: what exists, in one place. Read `DOCUMENT_HIERARCHY.md` to know what may be edited;
read this to find a file.

**Nothing here has been moved.** Historical docs stay in place because 11 of them are actively
cross-referenced (`BASELINE_ARCHITECTURE.md` alone has 11 inbound links) — relocating them would
break ~30 links across the doc set for cosmetic tidiness. Classification, not relocation, is the
fix.

---

## Start here

| Doc | What it is |
|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Current state of every workstream — **read first** |
| [HOW_INFORMATION_FLOWS.md](HOW_INFORMATION_FLOWS.md) | The whole system in one picture |
| [DOCUMENT_HIERARCHY.md](DOCUMENT_HIERARCHY.md) | Which docs are authoritative vs derived |
| [GLOSSARY.md](GLOSSARY.md) | One definition per term |

## Authoritative — define the rules (frozen; change only by amendment)

| Doc | What it is |
|---|---|
| [LEXI_FOUNDATION.md](LEXI_FOUNDATION.md) | Product Constitution |
| [LEXI_SYSTEM.md](LEXI_SYSTEM.md) | Ch.1 Ontology · Ch.2 Learning Engine · Ch.3 Decision Policy · Ch.4 Communication Boundary |
| [LEXI_ENGINEERING_CONSTITUTION.md](LEXI_ENGINEERING_CONSTITUTION.md) | How engineering work must be done |
| [SYSTEM_INVARIANTS_MATRIX.md](SYSTEM_INVARIANTS_MATRIX.md) | Every invariant, and where it is enforced |

## Live decisions — govern current and upcoming work

| Doc | What it is |
|---|---|
| [V1_V2_RECONCILIATION.md](V1_V2_RECONCILIATION.md) | **The v1→v2 ruling.** Per-entity migrate/drop; the 122/122 migration gate |
| [DECISION_ENGINE_OPTIONS.md](DECISION_ENGINE_OPTIONS.md) | D-1…D-6 rulings. ⚠️ D-1/D-2 were corrected — see its notice |
| [KU1_PARTB_DESIGN.md](KU1_PARTB_DESIGN.md) | Source → Pending KU → review queue (built) |
| [QUESTION_MODEL_REFORM.md](QUESTION_MODEL_REFORM.md) | QM-1 — the five `ResponseFormat`s (built) |
| [MOCKTESTTAB_DESIGN.md](MOCKTESTTAB_DESIGN.md) | Thi thử tab design. ⚠️ Its parallel-`Question` schema was **deliberately not** followed — see `DECISION_LOG` |
| [DECISION_LOG.md](DECISION_LOG.md) | Every non-obvious choice, its reason, and what was rejected |
| [DISCOVERY_BACKLOG.md](DISCOVERY_BACKLOG.md) | Open architectural questions |
| [ARCHITECTURAL_DISCOVERY_METHOD.md](ARCHITECTURAL_DISCOVERY_METHOD.md) | How discovery is conducted |
| [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) | Handoff notes |
| [TIMELINE.md](TIMELINE.md) | Development timeline |

## Reference & external

| Doc | What it is |
|---|---|
| [LEXI_LENS_DESIGN_REVIEW.md](LEXI_LENS_DESIGN_REVIEW.md) | Lens (visual AI assistant) design |
| [RV1_REVIEW_EVIDENCE_DESIGN.md](RV1_REVIEW_EVIDENCE_DESIGN.md) | Review action as Evidence |
| [YOUPASS_COMPETITIVE_RESEARCH_AND_PLAN.md](YOUPASS_COMPETITIVE_RESEARCH_AND_PLAN.md) | Competitor research |
| [COLLABORATOR_ONBOARDING_NONTECHNICAL.md](COLLABORATOR_ONBOARDING_NONTECHNICAL.md) | 🇻🇳 Phân công cho cộng tác viên phi kỹ thuật |
| [LEXI_DOCUMENTATION_ARCHITECTURE_VI.md](LEXI_DOCUMENTATION_ARCHITECTURE_VI.md) | 🇻🇳 Kiến trúc hệ thống tài liệu |
| `LEXI_FIGJAM_REVIEW_VI.docx` | 🇻🇳 Review of the FigJam — named the two blockers (both now closed) |

## Historical — finished phases, kept as evidence

Still cross-referenced; do not delete or move without fixing inbound links.

| Doc | Phase |
|---|---|
| [BASELINE_ARCHITECTURE.md](BASELINE_ARCHITECTURE.md) | Baseline v1 — **11 inbound links** |
| [ADR-001-baseline-v1.md](ADR-001-baseline-v1.md) | Baseline v1 decisions |
| [BASELINE_CERTIFICATION.md](BASELINE_CERTIFICATION.md) | Baseline v1 + Ch.4 certification |
| [ARCHITECTURE_RETROSPECTIVE.md](ARCHITECTURE_RETROSPECTIVE.md) | Baseline v1 + Ch.4 retrospective |
| [ONBOARDING_AUDIT_PACKAGE.md](ONBOARDING_AUDIT_PACKAGE.md) | Onboarding audit |
| [PHASE2_FINAL_DESIGN.md](PHASE2_FINAL_DESIGN.md) · [PHASE2_ARCHITECTURE_BOUNDARY.md](PHASE2_ARCHITECTURE_BOUNDARY.md) · [PHASE2_IMPLEMENTATION_PLAN.md](PHASE2_IMPLEMENTATION_PLAN.md) · [PHASE2_SCHEMA_AUDIT.md](PHASE2_SCHEMA_AUDIT.md) · [CLAUDE_PHASE2_EXECUTION_GUIDE.md](CLAUDE_PHASE2_EXECUTION_GUIDE.md) | Phase 2 — Companion Intelligence |
| [M2.2](M2.2_BEHAVIOR_ENGINE_IMPLEMENTATION_PLAN.md) · [M2.3](M2.3_ADAPTIVE_PRACTICE_IMPLEMENTATION_PLAN.md) · [M2.4](M2.4_LEARNING_SIGNAL_ENGINE_IMPLEMENTATION_PLAN.md) · [M2.5](M2.5_STUDENT_LEARNING_PROFILE_V2_IMPLEMENTATION_PLAN.md) | Phase 2 milestone plans |
| [PHASE3_CONTENT_INTELLIGENCE_DESIGN_REVIEW.md](PHASE3_CONTENT_INTELLIGENCE_DESIGN_REVIEW.md) · [PHASE3_PRODUCT_DECISION_TENSION_INVENTORY.md](PHASE3_PRODUCT_DECISION_TENSION_INVENTORY.md) | Phase 3 — Content Intelligence |
| [PHASE5_LEARNER_MODEL_DESIGN_REVIEW.md](PHASE5_LEARNER_MODEL_DESIGN_REVIEW.md) | Phase 5 — Learner Model |
| [PHASE6_LEXI_LENS_DESIGN_REVIEW.md](PHASE6_LEXI_LENS_DESIGN_REVIEW.md) | Phase 6 — Lens |
| `archive/PROJECT_STATUS_FULL.md` · `archive/DECISION_LOG_FULL.md` | Pre-condensation full versions |
