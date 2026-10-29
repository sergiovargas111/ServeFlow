import { complaintLink } from "@/lib/labor/lookup";
import { DISCLAIMER, type LaborRule } from "@/lib/labor/types";
import type { CoachOutput } from "./schema";

/**
 * Server-side checks on the model's answer before the user sees it. The model
 * is told to cite only provided rules; this enforces it:
 * - cited ids that weren't provided are dropped (never shown as sources)
 * - an uncovered legal answer, or one marked covered with no valid citation,
 *   becomes the fixed "no verified info" reply, so an unsourced legal claim
 *   never reaches the user
 * - sources shown to the user come from our rules, not from the model's text
 */

export interface CoachSource {
  id: string;
  jurisdiction: string;
  answer: LaborRule["answer"];
  sourceUrl: string;
  legalBasis: string;
  lastVerifiedAt: string;
}

export interface CoachReply {
  kind: CoachOutput["kind"];
  covered: boolean;
  reply: string;
  sources: CoachSource[];
  /** Shown under legal replies. */
  disclaimer: string | null;
  /** Where to get help when a legal question isn't covered. */
  helpLink: { label: string; url: string } | null;
  /** The guard replaced the model's text (for evals and monitoring; never logged with content). */
  guarded: boolean;
}

export function noVerifiedInfoReply(state: string | null): string {
  const link = complaintLink(state);
  return `I don't have verified information on that, so I won't guess. The ${link.label} can give you an answer you can rely on.`;
}

export function guardReply(output: CoachOutput, provided: readonly LaborRule[], state: string | null): CoachReply {
  const byId = new Map(provided.map((r) => [r.id, r]));
  const cited = [...new Set(output.cited_rule_ids)].filter((id) => byId.has(id));
  const reply = output.reply.trim();

  if (output.kind !== "legal") {
    // Serving or off-topic answers carry no legal sources, whatever the model listed.
    return { kind: output.kind, covered: false, reply, sources: [], disclaimer: null, helpLink: null, guarded: output.cited_rule_ids.length > 0 };
  }

  if (!output.covered || cited.length === 0) {
    // Always our own wording here, never the model's: an uncovered legal answer
    // must not carry any legal claim, however carefully phrased.
    return {
      kind: "legal",
      covered: false,
      reply: noVerifiedInfoReply(state),
      sources: [],
      disclaimer: DISCLAIMER,
      helpLink: complaintLink(state),
      guarded: output.covered,
    };
  }

  return {
    kind: "legal",
    covered: true,
    reply,
    sources: cited.map((id) => {
      const r = byId.get(id)!;
      return { id, jurisdiction: r.jurisdiction, answer: r.answer, sourceUrl: r.sourceUrl, legalBasis: r.legalBasis, lastVerifiedAt: r.lastVerifiedAt };
    }),
    disclaimer: DISCLAIMER,
    helpLink: null,
    guarded: cited.length !== output.cited_rule_ids.length,
  };
}
