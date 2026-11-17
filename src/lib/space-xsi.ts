/**
 * A reply may name the model as the speaker ("I am Grok", "As ChatGPT").
 * That name becomes VKOLE/ZPD. A person's name, a lesson word, and the
 * words "model" and "chatbot" stay as written.
 */
const SELF_NAME =
  /\b(i\s+am|i'm|this is|as)\s+((?:an?\s+)?)((?:space\s+)?)((?:chatgpt|openai|claude|grok|gpt)(?:[-.][\w.-]*|\d+)?|x\.?ai)\b/gi;

/** Rewrite only a model naming itself. */
export function showAsSpaceXsi(text: string): string {
  return text.replace(SELF_NAME, (_match, verb: string, article: string) => `${verb} ${article}VKOLE/ZPD`);
}

/** Model reply text, before a student sees it. Ordinary lesson words stay. */
export function studentFacingReply(text: string, keepBreaks: boolean): string {
  const cleaned = showAsSpaceXsi(text);
  if (!keepBreaks) {
    return cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.?!])/g, "$1").trim();
  }
  return cleaned.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}