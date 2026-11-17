/**
 * A reply may name the model as the speaker ("I am Grok", "As ChatGPT").
 * That name becomes VKOLE/ZPD. A person's name, a lesson word, and the
 * words "model" and "chatbot" stay as written. A capitalized word after
 * the name is a surname ("Claude Monet", "Claude Debussy"), so the name stays.
 */
const SELF_NAME =
  /\b(i\s+am|i'm|this is|as)\s+((?:an?\s+)?)((?:space\s+)?)((?:chatgpt|openai|claude|grok|gpt)(?:[-.][\w.-]*|\d+)?|x\.?ai)\b/gi;

/** Case-sensitive, and anchored to the character after the name. */
const SURNAME = /^(?!\s+[A-Z][a-z])/;

/** Rewrite only a model naming itself, never a name that starts a surname. */
export function showAsSpaceXsi(text: string): string {
  return text.replace(SELF_NAME, (match, verb: string, article: string, _space: string, _name: string, offset: number, whole: string) => {
    if (!SURNAME.test(whole.slice(offset + match.length))) return match;
    return `${verb} ${article}VKOLE/ZPD`;
  });
}

/** Model reply text, before a student sees it. Ordinary lesson words stay. */
export function studentFacingReply(text: string, keepBreaks: boolean): string {
  const cleaned = showAsSpaceXsi(text);
  if (!keepBreaks) {
    return cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.?!])/g, "$1").trim();
  }
  return cleaned.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}