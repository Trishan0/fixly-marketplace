/**
 * schemas.js — Structural validation for the JSON an LLM agent hands back.
 *
 * Gemini's final text response is parsed as JSON (see gemini.js's
 * parseJsonFromText) but nothing previously checked its shape before it was
 * used to write agent_recommendations rows and rendered to the client. These
 * schemas turn a malformed/hallucinated response into an explicit, loggable
 * validation failure that the caller can treat the same as "Gemini returned
 * nothing" — i.e. fall back to deterministic scoring — instead of trusting
 * arbitrary parsed JSON.
 */

const { z } = require('zod');

const recommendationBase = {
  rank: z.number().int().positive(),
  score: z.number().min(0).max(1),
  ai_rationale: z.string().min(1),
  key_strengths: z.array(z.string()).default([]),
};

const matchRecommendationSchema = z.object({
  worker_id: z.string().uuid(),
  ...recommendationBase,
});

const proposalRecommendationSchema = z.object({
  job_id: z.string().uuid(),
  proposal_draft: z.string().optional(),
  ...recommendationBase,
});

const matchAgentOutputSchema = z.object({
  overall_reasoning: z.string().min(1),
  recommendations: z.array(matchRecommendationSchema),
});

const proposalAgentOutputSchema = z.object({
  overall_reasoning: z.string().min(1),
  recommendations: z.array(proposalRecommendationSchema),
});

module.exports = { matchAgentOutputSchema, proposalAgentOutputSchema };
