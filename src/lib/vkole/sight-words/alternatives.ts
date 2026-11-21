/** The transcripts the recognizer offered, capped at the shared alternative count. */
export function sightAlternatives(result: ArrayLike<{ transcript?: string } | undefined>, limit: number): string[] {
  const heard: string[] = [];
  const cap = Math.max(0, limit);
  for (let index = 0; index < result.length && heard.length < cap; index += 1) {
    const transcript = result[index]?.transcript?.trim() ?? "";
    if (transcript) heard.push(transcript);
  }
  return heard;
}
