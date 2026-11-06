import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { schoolMiddleware } from "@/lib/school-middleware";
import { accountIdOf } from "@/lib/school-account";
import { mayListen, recordVoiceConsent, type VoiceConsentRecord } from "@/lib/voice-consent";

const choice = z.object({
  choice: z.enum(["allowed", "declined"]),
  password: z.string().min(8).max(80).optional(),
});

export const readVoiceConsent = createServerFn({ method: "GET" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }): Promise<VoiceConsentRecord> => {
    const { getSql } = await import("@/lib/db");
    const { readSchoolMirror } = await import("@/lib/school-mirror.server");
    const mirror = await readSchoolMirror(await getSql(), accountIdOf(context.userId));
    return {
      voiceConsent: mirror?.voiceConsent ?? "not-asked",
      voiceConsentAt: mirror?.voiceConsentAt ?? null,
      voiceConsentVersion: mirror?.voiceConsentVersion ?? null,
    };
  });

export const saveVoiceConsent = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .validator((data: unknown) => {
    const parsed = choice.safeParse(data);
    if (!parsed.success) throw new Error("Choose allow or not now.");
    return parsed.data;
  })
  .handler(async ({ context, data }): Promise<VoiceConsentRecord & { listening: boolean; shared: boolean }> => {
    if (data.password != null) {
      const { accountPasswordMatches } = await import("@/lib/climbs");
      const { getSql } = await import("@/lib/db");
      const matches = await accountPasswordMatches(await getSql(), context.userId, data.password);
      if (!matches) throw new Error("That is not the password for the account that registered.");
    }
    const record = recordVoiceConsent(data.choice, new Date());
    const { getSql } = await import("@/lib/db");
    const { saveVoiceConsentRow } = await import("@/lib/school-mirror.server");
    const sql = await getSql();
    await saveVoiceConsentRow(sql, context.userId, record);
    let shared = false;
    try {
      const { shareVoiceConsent } = await import("@/lib/school-account.server");
      await shareVoiceConsent(accountIdOf(context.userId), record);
      shared = true;
    } catch (err) {
      const { SchoolCallError } = await import("@/lib/school-account.server");
      if (err instanceof SchoolCallError && (err.reason === "unauthorized" || err.reason === "gone")) throw err;
      shared = false;
    }
    return { ...record, listening: mayListen(record), shared };
  });
