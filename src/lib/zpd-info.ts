/**
 * In-app Vygotsky ZPD page. The website page at
 * https://www.dotheimpossible.ai/zpd is a separate copy and is not edited here.
 */

export const ZPD_INFO_PATH = "/zpd" as const;

/** Set while leaving the home screen, so Return can skip the opening splash. */
export const ZPD_RETURN_FLAG = "vkole-return-app";

export const ZPD_INFO_SOURCE = "https://www.dotheimpossible.ai/zpd";

type FlagStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const zpdInfo = {
  documentTitle: "Zone of proximal development · Do the Impossible Alpha Academy",
  description:
    "Vygotsky's zone: the work a child can do with a hint, not the work already easy and not the work still out of reach.",
  kicker: "The idea underneath the work",
  title:
    "Vygotsky's Zone of Proximal Development: Amplified by VKOLE/ZPD - Space XSI Integrated Learning Engine.",
  lede: [
    "In Mind in Society (1978), Lev Vygotsky named the distance between two levels of a child's work. One level is what the child can already do alone. The other is what that child can do with guidance from an adult, or with a more capable peer. That distance is the Zone of Proximal Development.",
    "What is in the Zone of Proximal Development today becomes what the learner can do independently tomorrow.",
    "Learning is not one assignment, and not one snapshot of behavior. It is the cycle. Our in-house AI, VKOLE/ZPD - Space XSI Integrated Learning Engine, grades the work in real time. The next assignment is written at once. It remediates what is not yet secure, spirals prior knowledge back in, and raises the challenge where the learner is already strong.",
    "The cycle is flexible enough for emotional development and strong enough for every level of academic work. Teachers have used this approach in many countries. On the engine parents enter a starting age and grade level. From that starting point the VKOLE ZPD Online Learning Engine, in conjunction with Space XSI super-intelligence calibrates the questions and measures the answers to issue, diagnose, adapt and reissue the next question, tailored to the student needs (ADOL). This establishes a calibrated working level without a baseline while giving the parent the leeway to experiment with levels without losing the calibrated working level. For the most precise VKOLE ZPD Learning Engine calibration, baseline measurements can be arranged on the Do the Impossible Alpha Academy website. Assignments then begin at that level and are measured against demonstrated grade levels on the Common Core Curriculum. Each one is graded instantly and the next is generated immediately (ADOL), super-intelligence builds from that learner's needs and strengths. This \"step-by-step\" approach is integral to all learning and is the key to measurable learning growth.",
  ],
  image: {
    src: "/splash-laptop.jpg",
    alt: "ADOL with VKOLE/ZPD - Space XSI Integrated Learning Engine",
    width: 1792,
    height: 1008,
  },
} as const;

export function zpdInfoText(): string {
  return [
    zpdInfo.kicker,
    zpdInfo.title,
    ...zpdInfo.lede,
  ].join("\n");
}

/** Remember a return to the home screen. Other routes already live in the address. */
export function markZpdReturn(pathname: string, storage: FlagStore): void {
  if (pathname !== "/") return;
  storage.setItem(ZPD_RETURN_FLAG, "1");
}

/** Read and clear the home-screen return flag. */
export function takeZpdReturn(storage: FlagStore): boolean {
  let value: string | null = null;
  try {
    value = storage.getItem(ZPD_RETURN_FLAG);
  } catch {
    return false;
  }
  if (value !== "1") return false;
  try {
    storage.removeItem(ZPD_RETURN_FLAG);
  } catch {
    /* the flag can stay; the screen still resumes */
  }
  return true;
}

/** Back through app history, or the home screen when this page was opened directly. */
export function zpdReturnPlan(history: { canGoBack?: () => boolean }): "back" | "home" {
  return history.canGoBack?.() ? "back" : "home";
}
