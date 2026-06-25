/**
 * Canonical topic normalization.
 *
 * The Question.topic field is free text entered at import time. Variant
 * spellings of the same concept ("relative_clause" vs "relative_clauses")
 * must collapse to one canonical key before analytics groups by topic.
 *
 * Two-step process:
 *   1. Algorithmic normalization — lowercase, collapse whitespace/hyphens/dots
 *      to underscores, strip non-alphanumeric characters.
 *   2. Alias resolution — a hardcoded table maps known semantic variants
 *      to their canonical form.
 *
 * Phase 1: aliases are a hardcoded constant (TOPIC_ALIASES).
 * Phase 2 migration trigger: when TOPIC_ALIASES exceeds ~60 entries OR
 *   import cadence exceeds 4 docs/month, move to a TopicCanonical DB table.
 *   Migration path: add an optional `aliasMap` parameter — call sites that
 *   pass it use DB-sourced aliases; those that don't fall back to TOPIC_ALIASES.
 *   The function signature stays stable across that transition.
 */

/**
 * Normalise a raw topic string algorithmically:
 * - lowercase
 * - collapse runs of whitespace, hyphens, and dots into a single underscore
 * - strip everything that isn't a-z, 0-9, or underscore
 * - trim leading/trailing underscores
 */
function algorithmicNormalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Known semantic aliases.
 *
 * Keys are algorithmically normalized forms that would otherwise remain
 * distinct. Values are the single canonical form all analytics use.
 *
 * Last audited: 2026-06-25 against 73 distinct Question.topic values in dev.db.
 * Do NOT add entries speculatively — only add variants that actually appear
 * in Question.topic values in the database.
 *
 * How to update: run `SELECT DISTINCT topic FROM "Question" ORDER BY topic`
 * then compare against the values here. Add only confirmed variants.
 */
const TOPIC_ALIASES: Record<string, string> = {
  // Relative clauses — singular/plural input variants
  relative_clause: "relative_clauses",
  relative_clause_defining: "relative_clauses_defining",
  relative_clause_non_defining: "relative_clauses_non_defining",

  // Conditionals — with/without 's' prefix and with/without underscore before digit
  conditional: "conditionals",
  conditional_type_0: "conditionals_type_0",
  conditional_type_1: "conditionals_type_1",
  conditional_type_2: "conditionals_type_2",
  conditional_type_3: "conditionals_type_3",
  conditional_type2: "conditionals_type_2",
  conditional_type1: "conditionals_type_1",
  conditionals_type1: "conditionals_type_1",
  conditionals_type2: "conditionals_type_2",

  // Passive voice — shorthand forms
  passive: "passive_voice",
  passive_sentences: "passive_voice",

  // Present perfect for/since — both orderings exist in live data (audit 2026-06-25)
  present_perfect_since_for: "present_perfect_for_since",
};

/**
 * Return the canonical form of a raw topic string.
 *
 * @param raw - the raw value from Question.topic or ErrorNotebookEntry.concept
 * @param aliasMap - optional override map (Phase 2: loaded from TopicCanonical table)
 */
export function canonicalTopic(raw: string, aliasMap?: ReadonlyMap<string, string>): string {
  const normalized = algorithmicNormalize(raw);
  return aliasMap?.get(normalized) ?? TOPIC_ALIASES[normalized] ?? normalized;
}
