// Fixture 2 — The Chores Fight (the "feelings are not facts" dishes example).
//
// Spec §4.9 contract: VALUE/FACT split clean, absolutes detected.
// Every claim.quote is a verbatim substring of the corresponding intake text.
// No adjudication language anywhere.

import type { Analysis, IntakeAnswers } from "../types";

export const choresIntakeA: IntakeAnswers = {
  whatHappened:
    "I got home Tuesday night and the dishes from breakfast were still in the sink. I had asked Sunday for us to keep the kitchen clean during the week. I did the dishes that night without saying anything.",
  whatIFelt:
    "I felt invisible. I felt like my request on Sunday had not registered at all. I felt resentful that I was the one who always ends up doing the dishes.",
  whatIMadeItMean:
    "I made it mean that my requests do not matter. I made it mean that I have to do everything myself if I want it done. I made it mean that we are not actually a team.",
  whatIWant:
    "I want the dishes done during the week without me having to ask again. I want to feel like asking once is enough. I want to stop being the one who keeps the kitchen running.",
};

export const choresIntakeB: IntakeAnswers = {
  whatHappened:
    "Tuesday was a hard day at work. I came home and sat down for twenty minutes before doing anything. The breakfast dishes were in the sink. I planned to do them after I rested. She did them before I got up.",
  whatIFelt:
    "I felt tired. I felt like I could not even sit down for twenty minutes without it being held against me. I felt judged before I had a chance to act.",
  whatIMadeItMean:
    "I made it mean that nothing I do counts unless it is on her timeline. I made it mean that rest is not allowed in this house. I made it mean that I am being scored constantly.",
  whatIWant:
    "I want to be able to rest when I get home without it becoming evidence. I want a fair split of chores that we agree on together. I want to be trusted to follow through without being monitored.",
};

export const choresAnalysis: Analysis = {
  claims: [
    {
      id: "a1",
      person: "A",
      layer: "FACT",
      quote: "the dishes from breakfast were still in the sink.",
    },
    {
      id: "a2",
      person: "A",
      layer: "FACT",
      quote: "I had asked Sunday for us to keep the kitchen clean during the week.",
    },
    {
      id: "a3",
      person: "A",
      layer: "INTERPRETATION",
      quote: "I felt like my request on Sunday had not registered at all.",
      absolutes: [
        {
          word: "at all",
          rewrite: "the request did not seem to change what happened Tuesday",
        },
      ],
    },
    {
      id: "a4",
      person: "A",
      layer: "VALUE",
      quote: "I want to feel like asking once is enough.",
    },
    {
      id: "a5",
      person: "A",
      layer: "INTERPRETATION",
      quote: "I made it mean that we are not actually a team.",
    },
    {
      id: "a6",
      person: "A",
      layer: "REQUEST",
      quote: "I want the dishes done during the week without me having to ask again.",
    },
    {
      id: "b1",
      person: "B",
      layer: "FACT",
      quote: "The breakfast dishes were in the sink.",
    },
    {
      id: "b2",
      person: "B",
      layer: "FACT",
      quote: "I planned to do them after I rested.",
    },
    {
      id: "b3",
      person: "B",
      layer: "INTERPRETATION",
      quote: "I felt like I could not even sit down for twenty minutes without it being held against me.",
    },
    {
      id: "b4",
      person: "B",
      layer: "VALUE",
      quote: "I want to be trusted to follow through without being monitored.",
    },
    {
      id: "b5",
      person: "B",
      layer: "INTERPRETATION",
      quote: "I made it mean that I am being scored constantly.",
      absolutes: [
        {
          word: "constantly",
          rewrite: "I felt scored on most evenings this week",
        },
      ],
    },
    {
      id: "b6",
      person: "B",
      layer: "REQUEST",
      quote: "I want a fair split of chores that we agree on together.",
    },
  ],
  alignments: [
    {
      type: "AGREE",
      claims: ["a1", "b1"],
      note: "Both accounts describe the same dishes in the same sink.",
    },
    {
      type: "DISCONNECT",
      claims: ["a2", "b2"],
      note: "One account centers a Sunday request; the other centers a plan to rest first. The two frames describe the same Tuesday evening differently.",
    },
    {
      type: "CONTRADICT",
      claims: ["a4", "b4"],
      note: "Different values about follow-through: one wants asking once to be enough; the other wants space to follow through without monitoring.",
    },
    {
      type: "DISCONNECT",
      claims: ["a5", "b5"],
      note: "Each person reads the same evening as evidence of being let down by the other.",
    },
  ],
  proxies: [
    {
      surface: "whether the dishes got done Tuesday night",
      root: {
        person: "A",
        layer: "VALUE",
        text: "I want to feel like asking once is enough.",
      },
      evidence: ["a4", "a5", "b4", "b5"],
    },
  ],
  handback: {
    opening:
      "What I heard you say was, \"I want to feel like asking once is enough\" — is that right? I want to check before we go on.",
    order: ["a1", "b1", "a2", "b2", "a4", "b4", "a5", "b5"],
    reframe:
      "You and me versus the problem: the dishes are the surface. What is underneath is that one of you is asking for the asking to be enough, and the other is asking for the resting to be allowed — and the two needs have been arriving in the same kitchen at the same time.",
  },
};
