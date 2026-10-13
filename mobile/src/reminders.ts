export type Reminder = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const REMINDER_ID = 2401;

export function defaultReminder(): Reminder {
  return { enabled: false, hour: 16, minute: 0 };
}

export function parseReminder(raw: string | null): Reminder {
  if (!raw) return defaultReminder();
  try {
    const value = JSON.parse(raw) as Partial<Reminder>;
    const hour = Number(value.hour);
    const minute = Number(value.minute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return defaultReminder();
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return defaultReminder();
    return { enabled: value.enabled === true, hour, minute };
  } catch {
    return defaultReminder();
  }
}

export function reminderLabel(reminder: Reminder): string {
  const hour = reminder.hour % 12 || 12;
  const suffix = reminder.hour < 12 ? "AM" : "PM";
  return `${hour}:${String(reminder.minute).padStart(2, "0")} ${suffix}`;
}
