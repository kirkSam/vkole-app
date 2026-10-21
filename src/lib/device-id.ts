const DEVICE_KEY = "vkole-device-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One id for this install. Register and sign-in send it to the website.
 * It is never shown on the screen.
 */
export function readDeviceId(): string {
  try {
    if (typeof localStorage === "undefined") return "";
    const saved = localStorage.getItem(DEVICE_KEY)?.trim() ?? "";
    if (UUID.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "";
  }
}
