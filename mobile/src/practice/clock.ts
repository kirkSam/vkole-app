import { DAY_LIMIT_SECONDS, IDLE_STOP_SECONDS, localDayKey, PACIFIC, projectClock } from "../../../src/lib/day-clock-math.ts";

export { DAY_LIMIT_SECONDS, IDLE_STOP_SECONDS, PACIFIC };

export type DeviceClock = {
  dayKey: string;
  usedSeconds: number;
  lastActivityAt: number | null;
  armed: boolean;
};

export function freshClock(now: number): DeviceClock {
  return {
    dayKey: localDayKey(PACIFIC, new Date(now)),
    usedSeconds: 0,
    lastActivityAt: null,
    armed: false,
  };
}

function projection(clock: DeviceClock, now: number) {
  return projectClock(
    {
      used_seconds: clock.usedSeconds,
      last_tick_at:
        clock.armed && clock.lastActivityAt != null ? new Date(clock.lastActivityAt).toISOString() : null,
      armed: clock.armed,
    },
    now,
  );
}

export function displayClock(clock: DeviceClock, now: number) {
  if (clock.dayKey !== localDayKey(PACIFIC, new Date(now))) {
    return { used: 0, remaining: DAY_LIMIT_SECONDS, closed: false, armed: false, idleStopped: false };
  }
  return projection(clock, now);
}

/** A tap starts the timer, or adds only the active gap. Five quiet minutes are not counted. */
export function noteActivity(clock: DeviceClock, now: number): DeviceClock {
  const dayKey = localDayKey(PACIFIC, new Date(now));
  const base = clock.dayKey === dayKey ? clock : freshClock(now);
  const face = projection(base, now);
  if (face.closed) {
    return { dayKey, usedSeconds: DAY_LIMIT_SECONDS, lastActivityAt: null, armed: false };
  }
  const used = face.idleStopped ? base.usedSeconds : face.used;
  if (used >= DAY_LIMIT_SECONDS) {
    return { dayKey, usedSeconds: DAY_LIMIT_SECONDS, lastActivityAt: null, armed: false };
  }
  return { dayKey, usedSeconds: used, lastActivityAt: now, armed: true };
}
