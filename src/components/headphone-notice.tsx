import { HEADPHONE_NOTICE } from "@/lib/headphone-notice";

export function HeadphoneNotice() {
  return (
    <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">{HEADPHONE_NOTICE}</p>
  );
}
