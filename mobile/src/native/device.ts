import { DEVICE_STORAGE_KEYS, RETIRED_DEVICE_KEYS } from "../account/deletion.ts";
import { REMINDER_ID } from "../reminders.ts";
import { schoolHref } from "../school-link.ts";

export async function nativePlatform(): Promise<"ios" | "android" | "web"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") return platform;
  } catch {
    /* The browser build has no native bridge. */
  }
  return "web";
}

export async function readDeviceKey(key: string): Promise<string | null> {
  if ((await nativePlatform()) !== "web") {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeDeviceKey(key: string, value: string): Promise<void> {
  if ((await nativePlatform()) !== "web") {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function eraseDeviceRecords(): Promise<void> {
  const keys = [...DEVICE_STORAGE_KEYS, ...RETIRED_DEVICE_KEYS];
  const native = (await nativePlatform()) !== "web";
  if (native) {
    const { Preferences } = await import("@capacitor/preferences");
    await Promise.all(keys.map((key) => Preferences.remove({ key })));
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel(pending);
    } catch {
      /* Notifications may be unavailable. */
    }
    return;
  }
  for (const key of keys) localStorage.removeItem(key);
}

export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "unavailable"> {
  if ((await nativePlatform()) !== "web") {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, dialogTitle: title });
    return "shared";
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share({ title, text });
    return "shared";
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  return "unavailable";
}

export async function openSchool(path: string): Promise<boolean> {
  const href = schoolHref(path);
  if (!href) return false;
  if ((await nativePlatform()) !== "web") {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: href });
    return true;
  }
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<"scheduled" | "denied" | "web"> {
  if ((await nativePlatform()) === "web") return "web";
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return "denied";
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REMINDER_ID,
            title: "Time to practice",
            body: "A worksheet is ready on this device. The school office is separate.",
            schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          },
        ],
      });
  return "scheduled";
}

export async function cancelDailyReminder(): Promise<void> {
  if ((await nativePlatform()) === "web") return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}

export async function listenForSchoolLinks(onLink: (url: string) => void): Promise<() => void> {
  if ((await nativePlatform()) === "web") return () => undefined;
  const { App } = await import("@capacitor/app");
  const launch = await App.getLaunchUrl();
  if (launch?.url) onLink(launch.url);
  const handle = await App.addListener("appUrlOpen", (event) => {
    if (event.url) onLink(event.url);
  });
  return () => {
    void handle.remove();
  };
}

export async function prepareShell(): Promise<void> {
  if ((await nativePlatform()) === "web") return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* Splash is optional in the browser. */
  }
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#2c5e4a" });
  } catch {
    /* iOS draws the status bar from the web view. */
  }
}
