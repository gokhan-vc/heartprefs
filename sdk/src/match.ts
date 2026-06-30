import type { HeartPrefs, Self, Seek, UnsignedHeartPrefs } from "./types.js";

export interface MatchResult {
  match: boolean;
  /** human-readable reasons a candidate pairing was rejected (empty on match) */
  reasons: string[];
}

type Doc = HeartPrefs | UnsignedHeartPrefs;

function lower(s: string): string {
  return s.trim().toLowerCase();
}

function lowerSet(arr: string[] | undefined): Set<string> {
  return new Set((arr ?? []).map(lower));
}

/**
 * Collect the searchable "terms" of a document that a counterpart's
 * dealbreakers are matched against: every self attribute plus the seek
 * dealbreaker terms themselves, flattened and lowercased.
 *
 * This makes dealbreakers like "smoking" hit `self.substances.tobacco: "yes"`
 * (via the value and the key), and tag-style dealbreakers like "wants-no-kids"
 * hit a `self.kids` of "none-want-none".
 */
const EMPTY_SELF: Self = { age: 0 };

function documentTerms(doc: Doc): Set<string> {
  const self: Self = doc.self ?? EMPTY_SELF;
  const terms = new Set<string>();

  if (self.gender) terms.add(lower(self.gender));
  if (self.kids) terms.add(lower(self.kids));
  for (const e of self.ethnicity ?? []) terms.add(lower(e));
  for (const l of self.languages ?? []) terms.add(lower(l));
  for (const [k, v] of Object.entries(self.substances ?? {})) {
    // "tobacco" present and not "never"/"no" => the person uses it.
    const val = lower(String(v));
    if (val !== "no" && val !== "never" && val !== "") {
      terms.add(lower(k));
      // common alias: tobacco use => "smoking"
      if (lower(k) === "tobacco") terms.add("smoking");
    }
    terms.add(`${lower(k)}:${val}`);
  }
  return terms;
}

/** Hard-filter one direction: does `seeker.seek` accept `target` (their self)? */
function directionalReasons(
  seekerSeek: Seek | undefined,
  target: Doc,
  label: string,
): string[] {
  const reasons: string[] = [];
  const seek: Seek = seekerSeek ?? {};
  const targetSelf: Self = target.self ?? EMPTY_SELF;

  // gender filter
  const wantGenders = lowerSet(seek.genders);
  if (wantGenders.size > 0) {
    const g = targetSelf.gender ? lower(targetSelf.gender) : undefined;
    if (!g || !wantGenders.has(g)) {
      reasons.push(`${label}: gender ${g ?? "(unset)"} not in sought genders`);
    }
  }

  // age range filter
  if (seek.ageRange) {
    const age = targetSelf.age;
    if (typeof age !== "number") {
      reasons.push(`${label}: target age unset, but an ageRange was sought`);
    } else {
      if (typeof seek.ageRange.min === "number" && age < seek.ageRange.min) {
        reasons.push(`${label}: age ${age} below min ${seek.ageRange.min}`);
      }
      if (typeof seek.ageRange.max === "number" && age > seek.ageRange.max) {
        reasons.push(`${label}: age ${age} above max ${seek.ageRange.max}`);
      }
    }
  }

  // language filter (non-empty => target must share at least one)
  const wantLangs = lowerSet(seek.languages);
  if (wantLangs.size > 0) {
    const have = lowerSet(targetSelf.languages);
    const shares = [...wantLangs].some((l) => have.has(l));
    if (!shares) {
      reasons.push(`${label}: no shared sought language`);
    }
  }

  // ethnicity filter (non-empty => target must match at least one)
  const wantEth = lowerSet(seek.ethnicities);
  if (wantEth.size > 0) {
    const have = lowerSet(targetSelf.ethnicity);
    const shares = [...wantEth].some((e) => have.has(e));
    if (!shares) {
      reasons.push(`${label}: ethnicity not in sought ethnicities`);
    }
  }

  // dealbreakers: HARD, ANDed. If ANY of seeker's dealbreakers appears in the
  // target's document terms, reject.
  const targetTerms = documentTerms(target);
  for (const db of seek.dealbreakers ?? []) {
    if (targetTerms.has(lower(db))) {
      reasons.push(`${label}: dealbreaker "${db}" present in target`);
    }
  }

  return reasons;
}

/**
 * Bilateral match check (SPEC §6). A match is mutual and constraint-checked,
 * not one-directional:
 *   - A.seek is checked against B.self AND B.seek against A.self.
 *   - Dealbreakers are HARD and ANDed: any of one side's dealbreakers present
 *     in the other's document => no match.
 *   - ageRange, genders, and non-empty languages/ethnicities are hard filters.
 *   - Free-text / soft preferences are NOT consulted here (ranking only).
 *
 * Returns `{ match, reasons }`; `match` is true only when neither direction
 * produces a rejection reason.
 */
export function matches(a: Doc, b: Doc): MatchResult {
  const reasons = [
    ...directionalReasons(a.seek, b, "A→B"),
    ...directionalReasons(b.seek, a, "B→A"),
  ];
  return { match: reasons.length === 0, reasons };
}
