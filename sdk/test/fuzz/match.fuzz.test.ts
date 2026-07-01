import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { matches } from "../../src/match.js";
import type { HeartPrefs } from "../../src/types.js";
import { matchSelfArb, seekArb } from "./arbitraries.js";

const RUNS = 2500;

/** A doc carrying just the fields `matches` reads. */
const partialDocArb = fc.record(
  {
    self: fc.option(matchSelfArb, { nil: undefined }),
    seek: fc.option(seekArb, { nil: undefined }),
  },
  { requiredKeys: [] },
) as fc.Arbitrary<Partial<HeartPrefs>>;

describe("matches — fuzz (pure bilateral matcher)", () => {
  it("never throws on arbitrary (possibly partial) docs", () => {
    fc.assert(
      fc.property(partialDocArb, partialDocArb, (a, b) => {
        const r = matches(a as HeartPrefs, b as HeartPrefs);
        expect(typeof r.match).toBe("boolean");
        expect(Array.isArray(r.reasons)).toBe(true);
        // match <=> zero reasons is the documented contract.
        expect(r.match).toBe(r.reasons.length === 0);
      }),
      { numRuns: RUNS },
    );
  });

  it("verdict is symmetric: matches(a,b).match === matches(b,a).match", () => {
    fc.assert(
      fc.property(partialDocArb, partialDocArb, (a, b) => {
        const ab = matches(a as HeartPrefs, b as HeartPrefs).match;
        const ba = matches(b as HeartPrefs, a as HeartPrefs).match;
        // A match is bilateral by construction, so the verdict cannot depend
        // on argument order.
        expect(ab).toBe(ba);
      }),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: a dealbreaker equal to the target's gender always excludes", () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            gender: fc.constantFrom("man", "woman", "nonbinary", "Trans", "  MAN  "),
            age: fc.integer({ min: 18, max: 99 }),
          },
          { requiredKeys: ["gender", "age"] },
        ),
        (targetSelf) => {
          const target = { self: targetSelf } as unknown as HeartPrefs;
          // Seeker whose dealbreaker is exactly the (case/space-varied) gender.
          const seeker = {
            self: { age: 30 },
            seek: { dealbreakers: [` ${targetSelf.gender.toUpperCase()} `] },
          } as unknown as HeartPrefs;
          const r = matches(seeker, target);
          // dealbreakers are case-insensitive + trimmed → must reject.
          expect(r.match).toBe(false);
          expect(r.reasons.join(" ")).toMatch(/dealbreaker/);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: an out-of-range age is never matched (hard filter both directions)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 99 }),
        fc.integer({ min: 18, max: 99 }),
        fc.integer({ min: 18, max: 99 }),
        (targetAge, min, max) => {
          fc.pre(min <= max);
          fc.pre(targetAge < min || targetAge > max);
          const seeker = { self: { age: 30 }, seek: { ageRange: { min, max } } } as unknown as HeartPrefs;
          const target = { self: { age: targetAge }, seek: {} } as unknown as HeartPrefs;
          const r = matches(seeker, target);
          expect(r.match).toBe(false);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("empty seek on both sides always matches (no constraints)", () => {
    fc.assert(
      fc.property(matchSelfArb, matchSelfArb, (sa, sb) => {
        const a = { self: sa, seek: {} } as unknown as HeartPrefs;
        const b = { self: sb, seek: {} } as unknown as HeartPrefs;
        expect(matches(a, b).match).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});
