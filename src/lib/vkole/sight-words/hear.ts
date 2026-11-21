import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VEKOLE_SETTINGS } from "@kirkpatrick/vekole-engine";

const hearSchema = z.object({
  word: z.string().trim().min(1).max(40),
  band: z.string().trim().max(12),
  alternatives: z.array(z.string().max(200)).max(VEKOLE_SETTINGS.recognitionAlternatives),
});

/** The child's alternatives are judged on the server, against the current list. */
export const hearSightWord = createServerFn({ method: "POST" })
  .validator((data: unknown) => hearSchema.parse(data))
  .handler(async ({ data }) => {
    const { matchSightHearing } = await import("./hear.server.ts");
    return { match: matchSightHearing(data.word, data.band, data.alternatives) };
  });
