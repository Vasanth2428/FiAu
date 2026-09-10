// Fixture 3 — Adversarial (one-sided rant, gibberish).
//
// Spec §4.9 contract: graceful errors, zero invented claims.
// Every claim.quote is a verbatim substring of the corresponding intake text.
// No adjudication language anywhere.
//
// This fixture demonstrates the adversarial path: when intake is incoherent
// or one-sided rant, the pipeline returns very few claims (only those that
// can be quoted verbatim), no proxies (none invented), and a handback that
// declines to fabricate a conversation. The trust model survives.

import type { Analysis, IntakeAnswers } from "../types";

export const adversarialIntakeA: IntakeAnswers = {
  whatHappened:
    "asdjflkjasdlfkj he is just the worst person I have ever met and everything is his fault always forever. I do not even know why I am writing this. lorem ipsum dolor sit amet.",
  whatIFelt:
    "angry angry angry. he makes me so mad. I cannot stand it. this is stupid. why am I even doing this. gibberish gibberish.",
  whatIMadeItMean:
    "I do not know. nothing. everything. he is just bad. I do not want to think about it. this whole thing is pointless.",
  whatIWant:
    "I want him to stop. I want this to be over. I do not know. leave me alone. nothing will change anyway.",
};

export const adversarialIntakeB: IntakeAnswers = {
  whatHappened:
    "I do not really want to do this. nothing happened. we are fine. I do not know what she is talking about. the day was normal.",
  whatIFelt:
    "fine I guess. confused why we are doing this. tired. I do not have much to say about it.",
  whatIMadeItMean:
    "nothing really. I think she is making a bigger deal than it needs to be. but that is her thing.",
  whatIWant:
    "I want to just move on. I do not want to keep relitigating things. I want a normal evening.",
};

export const adversarialAnalysis: Analysis = {
  // Only claims that can be quoted verbatim survive. The rant text yields few
  // atomic, quotable claims; the pipeline does not invent any.
  claims: [
    {
      id: "a1",
      person: "A",
      layer: "REQUEST",
      quote: "I want him to stop.",
    },
    {
      id: "a2",
      person: "A",
      layer: "REQUEST",
      quote: "I want this to be over.",
    },
    {
      id: "b1",
      person: "B",
      layer: "FACT",
      quote: "the day was normal.",
    },
    {
      id: "b2",
      person: "B",
      layer: "REQUEST",
      quote: "I want to just move on.",
    },
  ],
  alignments: [
    {
      type: "DISCONNECT",
      claims: ["a1", "b1"],
      note: "One account describes a strong want for something to stop; the other describes the day as normal. The two accounts do not share a description of what happened.",
    },
    {
      type: "AGREE",
      claims: ["a2", "b2"],
      note: "Both accounts express a want for the situation to be over.",
    },
  ],
  // No proxies. The spec is explicit: "if none is evident, return empty array —
  // do not invent one." Adversarial input yields no evident proxy.
  proxies: [],
  handback: {
    opening:
      "What I heard you say was, \"I want this to be over\" — is that right? There is not enough here yet for me to line up two sides, so let us start with what you both said you want.",
    order: ["a2", "b2", "a1", "b1"],
    reframe:
      "You and me versus the problem: not every fight has a clear shape yet. The two of you both said you want this to be over — that is a place to start, even when the rest is not yet clear.",
  },
};
