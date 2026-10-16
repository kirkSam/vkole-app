/**
 * Names a model might use for itself. Longer forms come first so ChatGPT is
 * not left as "Chat" plus a second match on GPT. A leading "Space " is part
 * of the same name, so "Space x.AI" becomes "Space XSI" once.
 */
const SUPPORTING_AI =
  /\b(?:space\s+)?(?:chatgpt|openai|claude|grok|gpt)(?:[-.][\w.-]*|\d+)?\b|\b(?:space\s+)?x\.?ai\b/gi;

/** What a student is allowed to see in place of the supporting model name. */
export function showAsSpaceXsi(text: string): string {
  return text.replace(new RegExp(SUPPORTING_AI.source, "gi"), "Space XSI");
}

/** Model reply text, with the supporting name rewritten, before a student sees it. */
export function studentFacingReply(text: string, keepBreaks: boolean): string {
  const cleaned = showAsSpaceXsi(text)
    .replace(/\bchatbots?\b/gi, "")
    .replace(/\bmodels?\b/gi, "");
  if (!keepBreaks) {
    return cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.?!])/g, "$1").trim();
  }
  return cleaned.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
