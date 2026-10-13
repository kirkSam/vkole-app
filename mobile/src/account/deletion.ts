export const DEVICE_STORAGE_KEYS = ["vkole.practice", "vkole.reminder", "vkole.clock"] as const;

export const DELETION_EMAIL = "kirksam.alpha@dotheimpossible.ai";

export function deletionNote(): { subject: string; body: string } {
  return {
    subject: "Delete my family's record.",
    body: [
      "Please delete the school account and the records for this family.",
      "This note was prepared in the Do the Impossible app.",
      "The app does not send it. A parent sends it from their own email.",
    ].join(" "),
  };
}

export function deletionMessage(): string {
  const note = deletionNote();
  return `To: ${DELETION_EMAIL}\nSubject: ${note.subject}\n\n${note.body}`;
}
