/**
 * One server check per sight word.
 * A running guess is remembered and not sent.
 * The final result is sent once.
 * If the 20-second window ends with no final, the last guess is sent once.
 */
export function sightServerCheck(input: {
  sent: boolean;
  heard: readonly string[];
  alternatives: readonly string[];
  final: boolean;
  windowEnded: boolean;
}): { sent: boolean; heard: string[]; send: boolean; reason: "final" | "window" | "" } {
  const incoming = input.alternatives.map((line) => line.trim()).filter(Boolean);
  const heard = incoming.length > 0 ? incoming : [...input.heard];
  if (input.sent) return { sent: true, heard, send: false, reason: "" };
  if (input.final && incoming.length > 0) return { sent: true, heard: incoming, send: true, reason: "final" };
  if (input.windowEnded && heard.length > 0) return { sent: true, heard, send: true, reason: "window" };
  return { sent: false, heard, send: false, reason: "" };
}
