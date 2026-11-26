/**
 * The one Grok model both sides call.
 * grok-4-1-fast-non-reasoning was retired on May 15, 2026.
 * xAI's current low-cost model for that work is grok-4.3
 * at $1.25 / 1M input tokens and $2.50 / 1M output tokens.
 * Reasoning effort none keeps the call from spending reasoning tokens.
 */
export const GROK_MODEL = "grok-4.3";
export const GROK_REASONING_EFFORT = "none";
