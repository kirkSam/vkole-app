import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { schoolMiddleware } from "@/lib/school-middleware";
import { accountIdOf } from "@/lib/school-account";
import { VOICE_NOT_ASKED, publishVoiceConsent, voiceAnswersAllowed, type VoiceConsent } from "@/lib/voice-consent";

const choice = z.object({
  choice: z.enum(["allowed", "declined"]),
  password: z.string().min(8).max(200),
});

/** The website is the only yes. A failed read does not fall back to a phone copy. */
export const readVoiceConsent = createServerFn({ method: "GET" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }): Promise<VoiceConsent> => {
    try {
      const { readSchoolAccount } = await import("@/lib/school-account.server");
      const profile = await readSchoolAccount(accountIdOf(context.userId), { engineActive: true });
      return profile.voiceConsent ?? VOICE_NOT_ASKED;
    } catch (err) {
      const { SchoolCallError } = await import("@/lib/school-account.server");
      if (err instanceof SchoolCallError && (err.reason === "unauthorized" || err.reason === "gone")) throw err;
      return VOICE_NOT_ASKED;
    }
  });

/** Every change, including the first answer, sends the account password. Nothing is kept only on the phone. */
export const saveVoiceConsent = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .validator((data: unknown) => {
    const parsed = choice.safeParse(data);
    if (!parsed.success) throw new Error("Enter the password of the account that registered.");
    return parsed.data;
  })
  .handler(async ({ context, data }): Promise<VoiceConsent & { listening: boolean }> => {
    const { shareVoiceConsent } = await import("@/lib/school-account.server");
    const voiceConsent = await shareVoiceConsent(accountIdOf(context.userId), data.choice, data.password, {
      engineActive: true,
    });
    if (voiceConsent.status === "not_asked") throw new Error("The website did not store voice answers.");
    return { ...voiceConsent, listening: voiceAnswersAllowed(voiceConsent) };
  });

/** Read the website just before a listen, and when the page is focused again. A failed read does not listen. */
export async function voiceAllowedNow(): Promise<boolean> {
  try {
    const row = await readVoiceConsent();
    publishVoiceConsent(row);
    return voiceAnswersAllowed(row);
  } catch {
    publishVoiceConsent(VOICE_NOT_ASKED);
    return false;
  }
}
