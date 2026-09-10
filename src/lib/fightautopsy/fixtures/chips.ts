// Fixture 1 — The Chips Fight (anonymized from Reddit).
//
// Spec §4.9 contract: proxy fires, ≥1 CONTRADICT, reflective opening.
// Every claim.quote is a verbatim substring of the corresponding intake text.
// No adjudication language anywhere.
//
// This fixture is the primary demo (spec §6 demo script pastes "the prepared
// chips-fight input") and the primary demo fallback (spec §4.8).

import type { Analysis, IntakeAnswers } from "../types";

export const chipsIntakeA: IntakeAnswers = {
  whatHappened:
    "Last Sunday I came home from work and Alex was on the couch. The chips were on the counter. I asked if he had eaten any and he said no. The bag was clearly half empty.",
  whatIFelt:
    "I felt dismissed. I felt like he thought I was stupid enough to believe the bag was full when I could see it was not. I felt angry that he would lie about something so small.",
  whatIMadeItMean:
    "I made it mean that he does not respect me enough to tell the truth about a bag of chips. I made it mean that if he will lie about this, he will lie about bigger things. I made it mean I cannot trust him.",
  whatIWant:
    "I want him to tell me the truth even when it is small. I want to be able to believe what he says. I want to stop feeling like I have to check whether his words match reality.",
};

export const chipsIntakeB: IntakeAnswers = {
  whatHappened:
    "She came home Sunday and immediately asked about the chips. I had eaten a few while watching the game. I said I had not eaten any because I did not want to start a fight over chips. The bag was half empty.",
  whatIFelt:
    "I felt cornered. I felt like anything I said was going to become a whole thing. I felt tired of being interrogated about small things at the end of a long day.",
  whatIMadeItMean:
    "I made it mean she is always looking for something to be upset about. I made it mean nothing I do is ever enough. I made it mean she does not trust me at all.",
  whatIWant:
    "I want her to give me the benefit of the doubt. I want to come home and not be questioned. I want to be able to eat a few chips without it becoming a referendum on our relationship.",
};

export const chipsAnalysis: Analysis = {
  claims: [
    {
      id: "a1",
      person: "A",
      layer: "FACT",
      quote: "The chips were on the counter.",
    },
    {
      id: "a2",
      person: "A",
      layer: "FACT",
      quote: "The bag was clearly half empty.",
    },
    {
      id: "a3",
      person: "A",
      layer: "INTERPRETATION",
      quote: "I felt like he thought I was stupid enough to believe the bag was full",
    },
    {
      id: "a4",
      person: "A",
      layer: "VALUE",
      quote: "I want him to tell me the truth even when it is small.",
    },
    {
      id: "a5",
      person: "A",
      layer: "INTERPRETATION",
      quote: "I made it mean that if he will lie about this, he will lie about bigger things.",
      absolutes: [
        {
          word: "bigger things",
          rewrite: "the next time something larger is at stake, like money or plans with friends",
        },
      ],
    },
    {
      id: "a6",
      person: "A",
      layer: "REQUEST",
      quote: "I want to stop feeling like I have to check whether his words match reality.",
    },
    {
      id: "b1",
      person: "B",
      layer: "FACT",
      quote: "I had eaten a few while watching the game.",
    },
    {
      id: "b2",
      person: "B",
      layer: "FACT",
      quote: "The bag was half empty.",
    },
    {
      id: "b3",
      person: "B",
      layer: "INTERPRETATION",
      quote: "I felt like anything I said was going to become a whole thing.",
    },
    {
      id: "b4",
      person: "B",
      layer: "VALUE",
      quote: "I want her to give me the benefit of the doubt.",
    },
    {
      id: "b5",
      person: "B",
      layer: "INTERPRETATION",
      quote: "I made it mean she is always looking for something to be upset about.",
      absolutes: [
        {
          word: "always",
          rewrite: "she has been looking for things to be upset about most evenings this month",
        },
      ],
    },
    {
      id: "b6",
      person: "B",
      layer: "REQUEST",
      quote: "I want to be able to eat a few chips without it becoming a referendum on our relationship.",
    },
  ],
  alignments: [
    {
      type: "AGREE",
      claims: ["a2", "b2"],
      note: "Both accounts describe the bag as half empty.",
    },
    {
      type: "CONTRADICT",
      claims: ["a1", "b1"],
      note: "Different recollections of the same evening: one account centers the chips on the counter, the other centers the eating during the game.",
    },
    {
      type: "DISCONNECT",
      claims: ["a3", "b3"],
      note: "Each person describes a feeling of being misread by the other; the feelings point at each other rather than at the chips.",
    },
    {
      type: "CONTRADICT",
      claims: ["a4", "b4"],
      note: "Different framings of trust: one asks for truth at any scale, the other asks for the benefit of the doubt.",
    },
  ],
  proxies: [
    {
      surface: "whether Alex ate the chips",
      root: {
        person: "A",
        layer: "VALUE",
        text: "I want him to tell me the truth even when it is small.",
      },
      evidence: ["a4", "a5", "b4", "b5"],
    },
  ],
  handback: {
    opening:
      "What I heard you say was, \"I want him to tell me the truth even when it is small\" — is that right? I want to make sure I have it before we go further.",
    order: ["a2", "b2", "a1", "b1", "a3", "b3", "a4", "b4"],
    reframe:
      "You and me versus the problem: the chips are the surface. What is underneath is that one of you is asking for truth at any scale and the other is asking for the benefit of the doubt — and those two requests have been talking past each other.",
  },
};
