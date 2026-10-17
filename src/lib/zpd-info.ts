/**
 * In-app copy of the school site page
 * https://www.dotheimpossible.ai/zpd
 * ("Zone of proximal development").
 * The Vygotsky ZPD link beside the engine buttons used to open that page.
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
    'The cycle is flexible enough for emotional development and strong enough for every level of academic work. Teachers have used this approach in many countries. The difference here is the starting point. Each learner is calibrated with the Baseline/Growth Test, a baseline and a measure of growth. Assignments then begin at that level and are aligned to the Common Core. Each one is graded instantly and the next is generated immediately, super-intelligence builds from that learner\'s needs and strengths. This "step-by-step" approach is integral to all learning is the key to measurable learning growth.',
  ],
  cards: [
    {
      kicker: "Already independent",
      title: "What the student can do alone",
      body: "This is yesterday's zone. The work is finished without help. Practice can keep a skill warm, but work that is already easy does not grow new thinking. A student parked in review is not being taught.",
    },
    {
      kicker: "The zone",
      title: "Within reach, on a high shelf",
      body: "This is the work the student can do with a hint, a model, a question, or a short meeting with a teacher. The stretch is real. The task is not. Put the cookies within reach, but on a shelf that takes ingenuity.",
    },
    {
      kicker: "Not yet",
      title: "Out of reach for now",
      body: "Work this far away produces guessing, frustration, or a cognitive and emotional shutdown. We do not start there. That shelf comes later, after the one just above today's reach has been climbed.",
    },
  ],
  panel: {
    title: "How this academy uses the zone",
    paragraphs: [
      "We do not guess the shelf. The Baseline/Growth Test, read together with what parents already observe, gives a baseline. Assignment progressions are then written inside the zone: close enough to finish, far enough to require a stretch. Those baby-steps accumulate. That is measurable growth.",
      "Remediation is spiraled in with new information. The student is not parked in review, and not thrown past what they can reach. A certified teacher and the VKOLE/ZPD - Space XSI Integrated Learning Engine hold the part the student cannot yet do, then hand it back. Monday through Friday, a 50-minute live session can clear the one question that is blocking the stretch.",
      "The zone is not a softer curriculum. It is the place where a child does something they could not do yesterday, because the help was fitted to them and then removed.",
    ],
  },
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
    ...zpdInfo.cards.flatMap((card) => [card.kicker, card.title, card.body]),
    zpdInfo.panel.title,
    ...zpdInfo.panel.paragraphs,
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
