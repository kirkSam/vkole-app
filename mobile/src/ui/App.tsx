import { useEffect, useState } from "react";
import { deletionMessage } from "../account/deletion.ts";
import { createStoreBilling, revenueCatKeyFor, type StoreBilling, type StoreOffer } from "../billing/billing.ts";
import { STORE_PRODUCTS } from "../billing/products.ts";
import { APP_NAME, REVENUECAT_ANDROID_API_KEY, REVENUECAT_IOS_API_KEY } from "../config.ts";
import {
  cancelDailyReminder,
  eraseDeviceRecords,
  listenForSchoolLinks,
  nativePlatform,
  openSchool,
  prepareShell,
  readDeviceKey,
  scheduleDailyReminder,
  shareText,
  writeDeviceKey,
} from "../native/device.ts";
import { gateStillOpen, PARENT_GATE_MATH, parentGatePasses } from "../parent-gate.ts";
import { DATA_INVENTORY, NOT_COLLECTED } from "../privacy/inventory.ts";
import {
  applyAnswers,
  buildWorksheet,
  freshRung,
  practiceShareText,
  SHEET_LENGTH,
  subjectName,
  SUBJECTS,
  type Rung,
  type SubjectId,
  type WorksheetItem,
} from "../practice/worksheets.ts";
import { parseReminder, reminderLabel, type Reminder } from "../reminders.ts";
import { parseSchoolLink, type SchoolLink } from "../school-link.ts";

type Screen = "home" | "practice" | "reminders" | "school" | "privacy" | "terms" | "account" | "purchases";

type SavedPractice = { subject: SubjectId; rung: Rung; seed: number };
type Sheet = { items: WorksheetItem[]; index: number; correct: number; flags: boolean[] };

function savedPractice(raw: string | null): SavedPractice {
  const fallback: SavedPractice = { subject: "m", rung: freshRung(3), seed: 1 };
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<SavedPractice>;
    const subject = SUBJECTS.some((item) => item.id === value.subject) ? (value.subject as SubjectId) : "m";
    const grade = Number(value.rung?.grade);
    return {
      subject,
      rung: freshRung(Number.isInteger(grade) ? grade : 3),
      seed: Number(value.seed) || 1,
      ...(value.rung
        ? {
            rung: {
              grade: Number(value.rung.grade) || 3,
              step: Number(value.rung.step) || 0,
              correctAtLevel: Number(value.rung.correctAtLevel) || 0,
              incorrectStreak: Number(value.rung.incorrectStreak) || 0,
            },
          }
        : {}),
    };
  } catch {
    return fallback;
  }
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2c5e4a" />
      <circle cx="32" cy="32" r="22" fill="#f3ead7" />
      <rect x="16" y="34" width="32" height="4" rx="1" fill="#2c5e4a" />
      <rect x="18" y="42" width="28" height="4" rx="1" fill="#2c5e4a" />
      <circle cx="40" cy="26" r="4" fill="#e7b15a" />
    </svg>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [practice, setPractice] = useState<SavedPractice>(() => savedPractice(null));
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetNote, setSheetNote] = useState("");
  const [reminder, setReminder] = useState<Reminder>(() => parseReminder(null));
  const [reminderNote, setReminderNote] = useState("");
  const [schoolLink, setSchoolLink] = useState<SchoolLink | null>(null);
  const [billing, setBilling] = useState<StoreBilling>(() => createStoreBilling(""));
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [purchaseNote, setPurchaseNote] = useState("");
  const [gateAt, setGateAt] = useState<number | null>(null);
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [erased, setErased] = useState(false);

  useEffect(() => {
    let stop = () => undefined as void;
    void (async () => {
      await prepareShell();
      const [practiceRaw, reminderRaw, platform] = await Promise.all([
        readDeviceKey("vkole.practice"),
        readDeviceKey("vkole.reminder"),
        nativePlatform(),
      ]);
      setPractice(savedPractice(practiceRaw));
      setReminder(parseReminder(reminderRaw));
      const store = createStoreBilling(
        revenueCatKeyFor(platform, REVENUECAT_ANDROID_API_KEY, REVENUECAT_IOS_API_KEY),
      );
      setBilling(store);
      if (store.configured) setOffers(await store.loadOffers());
      stop = await listenForSchoolLinks((url) => {
        const link = parseSchoolLink(url);
        if (!link) return;
        setSchoolLink(link);
        setScreen("school");
      });
      setReady(true);
    })();
    return () => stop();
  }, []);

  async function savePractice(next: SavedPractice) {
    setPractice(next);
    await writeDeviceKey("vkole.practice", JSON.stringify(next));
  }

  function withParent(action: () => void) {
    if (gateStillOpen(gateAt, Date.now())) action();
    else setPending({ run: action });
  }

  return (
    <div className="app">
      <header className="mast">
        <Mark />
        <div>
          <p className="kicker">VKOLE on this device</p>
          <h1>{APP_NAME}</h1>
        </div>
      </header>

      {screen === "home" ? (
        <Home
          practice={practice}
          onPractice={() => setScreen("practice")}
          onSchool={() => setScreen("school")}
          onPrivacy={() => setScreen("privacy")}
          onTerms={() => setScreen("terms")}
          onAccount={() => setScreen("account")}
          onPurchases={() => setScreen("purchases")}
        />
      ) : null}

      {screen === "practice" ? (
        <Practice
          practice={practice}
          sheet={sheet}
          note={sheetNote}
          ready={ready}
          onChange={(next) => void savePractice({ ...next, seed: practice.seed })}
          onStart={() => {
            const items = buildWorksheet(practice.subject, practice.rung.grade, practice.seed);
            setSheet({ items, index: 0, correct: 0, flags: [] });
            setSheetNote("");
          }}
          onAnswer={(correct) => {
            if (!sheet) return;
            const flags = [...sheet.flags, correct];
            const correctCount = sheet.correct + (correct ? 1 : 0);
            if (sheet.index + 1 >= sheet.items.length) {
              const moved = applyAnswers(practice.rung, flags);
              const next = { ...practice, rung: moved.rung, seed: practice.seed + 1 };
              void savePractice(next);
              setSheet(null);
              setLastScore(correctCount);
              setSheetNote(`${correctCount} of ${SHEET_LENGTH} correct. ${moved.note} Saved on this device only.`);
              return;
            }
            setSheet({ ...sheet, index: sheet.index + 1, correct: correctCount, flags });
          }}
          onShare={
            lastScore == null
              ? null
              : () =>
            withParent(() => {
              void shareText(
                APP_NAME,
                practiceShareText({
                  subjectName: subjectName(practice.subject),
                  grade: practice.rung.grade,
                  correct: lastScore ?? 0,
                  total: SHEET_LENGTH,
                }),
              );
            })
          }
        />
      ) : null}

      {screen === "reminders" ? (
        <Reminders
          reminder={reminder}
          note={reminderNote}
          onSave={(next) => {
            setReminder(next);
            setReminderNote("");
            void writeDeviceKey("vkole.reminder", JSON.stringify(next));
            if (!next.enabled) {
              void cancelDailyReminder();
              setReminderNote("Reminder off.");
              return;
            }
            void scheduleDailyReminder(next.hour, next.minute).then((result) => {
              setReminderNote(
                result === "scheduled"
                  ? `This phone will remind you at ${reminderLabel(next)}.`
                  : result === "denied"
                    ? "Notifications are off in the phone settings."
                    : `Saved for ${reminderLabel(next)}. The installed app rings then. This browser preview does not.`,
              );
            });
          }}
        />
      ) : null}

      {screen === "school" ? (
        <School
          link={schoolLink}
          onOpen={(path) => withParent(() => void openSchool(path))}
        />
      ) : null}

      {screen === "privacy" ? <Privacy onSchool={() => withParent(() => void openSchool("/privacy"))} /> : null}
      {screen === "terms" ? <Terms onSchool={() => withParent(() => void openSchool("/terms"))} /> : null}
      {screen === "account" ? (
        <Account
          erased={erased}
          onDelete={() =>
            withParent(() => {
              void eraseDeviceRecords().then(() => {
                setPractice(savedPractice(null));
                setReminder(parseReminder(null));
                setSheet(null);
                setSheetNote("");
                setLastScore(null);
                setErased(true);
              });
            })
          }
        />
      ) : null}
      {screen === "purchases" ? (
        <Purchases
          billing={billing}
          offers={offers}
          note={purchaseNote}
          onBuy={(productId) =>
            withParent(() => {
              void billing.purchase(productId).then((result) => {
                setPurchaseNote(
                  result.status === "purchased"
                    ? "The store completed that purchase."
                    : result.status === "cancelled"
                      ? "The store cancelled that purchase."
                      : "This build cannot charge a card. No price is shown until the store lists one.",
                );
              });
            })
          }
          onRestore={() =>
            withParent(() => {
              void billing.restore().then((result) => {
                setPurchaseNote(
                  result.productIds.length
                    ? "The store restored a purchase."
                    : "The store did not return a purchase to restore.",
                );
              });
            })
          }
        />
      ) : null}

      <nav className="nav" aria-label="App">
        <button type="button" data-testid="nav-home" aria-current={screen === "home" ? "page" : undefined} onClick={() => setScreen("home")}>Home</button>
        <button type="button" data-testid="nav-practice" aria-current={screen === "practice" ? "page" : undefined} onClick={() => setScreen("practice")}>Practice</button>
        <button type="button" data-testid="nav-reminders" aria-current={screen === "reminders" ? "page" : undefined} onClick={() => setScreen("reminders")}>Remind</button>
        <button type="button" data-testid="nav-school" aria-current={screen === "school" ? "page" : undefined} onClick={() => setScreen("school")}>School</button>
      </nav>

      {pending ? (
        <ParentGate
          onClose={() => setPending(null)}
          onPass={() => {
            const action = pending.run;
            setGateAt(Date.now());
            setPending(null);
            action();
          }}
        />
      ) : null}
    </div>
  );
}

function Home(props: {
  practice: SavedPractice;
  onPractice: () => void;
  onSchool: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
  onAccount: () => void;
  onPurchases: () => void;
}) {
  return (
    <>
      <section className="card">
        <h2>Worksheets live here</h2>
        <p className="muted">
          Mathematics, English language arts, social studies, and general practice are stored in the app.
          They open with no network. They do not change the school office.
        </p>
        <p className="muted">
          Next sheet: {subjectName(props.practice.subject)}, grade {props.practice.rung.grade}, standard{" "}
          {props.practice.rung.step + 1}.
        </p>
        <div className="stack">
          <button className="btn" type="button" data-testid="go-practice" onClick={props.onPractice}>
            Practice offline
          </button>
          <button className="btn-quiet" type="button" data-testid="go-school" onClick={props.onSchool}>
            Open the school office
          </button>
        </div>
      </section>
      <section className="card">
        <h2>For a parent</h2>
        <div className="stack">
          <button className="btn-quiet" type="button" data-testid="open-privacy" onClick={props.onPrivacy}>Privacy</button>
          <button className="btn-quiet" type="button" data-testid="open-terms" onClick={props.onTerms}>Terms</button>
          <button className="btn-quiet" type="button" data-testid="open-purchases" onClick={props.onPurchases}>Store purchases</button>
          <button className="btn-quiet" type="button" data-testid="open-account" onClick={props.onAccount}>Delete account data</button>
        </div>
      </section>
    </>
  );
}

function Practice(props: {
  practice: SavedPractice;
  sheet: Sheet | null;
  note: string;
  ready: boolean;
  onChange: (next: SavedPractice) => void;
  onStart: () => void;
  onAnswer: (correct: boolean) => void;
  onShare: (() => void) | null;
}) {
  const current = props.sheet?.items[props.sheet.index];
  return (
    <section className="card">
      <h2>Offline worksheet</h2>
      <div className="row">
        <label className="grow">
          Subject
          <select
            data-testid="subject"
            value={props.practice.subject}
            onChange={(event) =>
              props.onChange({ ...props.practice, subject: event.target.value as SubjectId })
            }
          >
            {SUBJECTS.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </label>
        <label className="grow">
          Grade
          <select
            data-testid="grade"
            value={props.practice.rung.grade}
            onChange={(event) =>
              props.onChange({ ...props.practice, rung: freshRung(Number(event.target.value)) })
            }
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{index + 1}</option>
            ))}
          </select>
        </label>
      </div>
      {!props.sheet ? (
        <div className="stack">
          <button className="btn" type="button" data-testid="start-sheet" disabled={!props.ready} onClick={props.onStart}>
            Start worksheet
          </button>
          {props.note ? <p data-testid="sheet-note">{props.note}</p> : null}
          {props.note && props.onShare ? (
            <button className="btn-quiet" type="button" data-testid="share-score" onClick={props.onShare}>
              Share the score
            </button>
          ) : null}
        </div>
      ) : current ? (
        <div className="stack">
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(props.sheet.index / SHEET_LENGTH) * 100}%` }} />
          </div>
          <p data-testid="stem">{current.stem}</p>
          {current.options.map((option, optionIndex) => (
            <button
              key={`${current.id}-${optionIndex}`}
              className="choice"
              type="button"
              data-testid="choice"
              onClick={() => props.onAnswer(option === current.answer)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Reminders(props: { reminder: Reminder; note: string; onSave: (next: Reminder) => void }) {
  return (
    <section className="card">
      <h2>Daily reminder</h2>
      <p className="muted">
        The reminder is scheduled on this phone. It is not sent through a push service, and it does not include a child's name.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const [hour, minute] = String(data.get("time") || "16:00").split(":");
          props.onSave({
            enabled: data.get("enabled") === "on",
            hour: Number(hour),
            minute: Number(minute),
          });
        }}
      >
        <label>
          Time
          <input
            data-testid="reminder-time"
            name="time"
            type="time"
            defaultValue={`${String(props.reminder.hour).padStart(2, "0")}:${String(props.reminder.minute).padStart(2, "0")}`}
          />
        </label>
        <label className="row">
          <input data-testid="reminder-on" name="enabled" type="checkbox" defaultChecked={props.reminder.enabled} />
          Turn the reminder on
        </label>
        <button className="btn" type="submit">Save reminder</button>
      </form>
      {props.note ? <p>{props.note}</p> : null}
    </section>
  );
}

function School(props: { link: SchoolLink | null; onOpen: (path: string) => void }) {
  return (
    <section className="card">
      <h2>The school office</h2>
      <p className="muted">
        Live offices, the four engines, and teacher sessions are on www.dotheimpossible.ai.
        A parent opens that site. The worksheets in this app stay here.
      </p>
      {props.link ? (
        <p data-testid="pending-link">A link is waiting: {props.link.path}</p>
      ) : null}
      <div className="stack">
        <button className="btn" type="button" data-testid="school-offices" onClick={() => props.onOpen(props.link?.path || "/home")}>
          Open student offices
        </button>
        <button className="btn-quiet" type="button" onClick={() => props.onOpen("/parents")}>
          How the school works
        </button>
      </div>
      <p className="fine muted">The pay page on the website is not linked here. A digital plan inside this app uses the store.</p>
    </section>
  );
}

function Privacy(props: { onSchool: () => void }) {
  const local = DATA_INVENTORY.filter((row) => row.collectedBy === "this app");
  const site = DATA_INVENTORY.filter((row) => row.collectedBy !== "this app");
  return (
    <section className="card">
      <h2>Privacy</h2>
      <p className="muted">This app does not show ads and does not use a tracking tool. A child is not asked for a name.</p>
      <h2>On this device</h2>
      <ul>
        {local.map((row) => (
          <li key={row.id}><strong>{row.what}.</strong> {row.where}. {row.purpose}.</li>
        ))}
      </ul>
      <p>Not collected by this app: {NOT_COLLECTED.join(", ")}.</p>
      <h2>If a parent opens the school site</h2>
      <ul>
        {site.map((row) => (
          <li key={row.id}><strong>{row.what}.</strong> {row.where}.</li>
        ))}
      </ul>
      <button className="btn-quiet" type="button" onClick={props.onSchool}>Read the school privacy page</button>
    </section>
  );
}

function Terms(props: { onSchool: () => void }) {
  return (
    <section className="card">
      <h2>Terms</h2>
      <p className="muted">
        A parent is responsible for the child who uses this app. Offline practice is a worksheet on the device.
        It is not the school office, and it does not enroll a student. A worksheet on this device has no daily time limit.
      </p>
      <p className="muted">
        This app does not show a price. If a purchase is offered, the App Store or Google Play shows the price and charges the parent.
        Website plans stay on the website.
      </p>
      <button className="btn-quiet" type="button" onClick={props.onSchool}>Read the school terms</button>
    </section>
  );
}

function Account(props: { erased: boolean; onDelete: () => void }) {
  const [copied, setCopied] = useState("");
  return (
    <section className="card">
      <h2>Delete account data</h2>
      <p className="muted">
        This app does not create the school login. Erasing the device removes the worksheet progress and the reminder.
      </p>
      <button className="btn" type="button" data-testid="delete-device" onClick={props.onDelete}>
        Erase this device
      </button>
      {props.erased ? <p data-testid="erased">The records on this device are erased.</p> : null}
      <p className="muted">{deletionMessage()}</p>
      <button
        className="btn-quiet"
        type="button"
        data-testid="copy-deletion"
        onClick={() => {
          void navigator.clipboard?.writeText(deletionMessage()).then(
            () => setCopied("Copied. It is not sent."),
            () => setCopied("Copy is unavailable on this device. The note is on the screen."),
          );
        }}
      >
        Copy the note
      </button>
      {copied ? <p>{copied}</p> : null}
    </section>
  );
}

function Purchases(props: {
  billing: StoreBilling;
  offers: StoreOffer[];
  note: string;
  onBuy: (productId: string) => void;
  onRestore: () => void;
}) {
  return (
    <section className="card">
      <h2>Store purchases</h2>
      <p className="muted">
        {props.billing.configured
          ? "Prices below came back from the store."
          : "Purchases are not turned on in this build. No price is shown, and nothing is charged."}
      </p>
      <div className="stack">
        {STORE_PRODUCTS.map((product) => {
          const offer = props.offers.find((item) => item.productId === product.productId);
          return (
            <button
              key={product.productId}
              className="btn-quiet"
              type="button"
              data-testid={`buy-${product.productId}`}
              disabled={!props.billing.configured}
              onClick={() => props.onBuy(product.productId)}
            >
              {product.title}
              {offer ? ` — ${offer.priceLabel}` : ""}
            </button>
          );
        })}
        <button className="linkish" type="button" data-testid="restore" onClick={props.onRestore}>
          Restore purchases
        </button>
      </div>
      {props.note ? <p data-testid="purchase-note">{props.note}</p> : null}
    </section>
  );
}

function ParentGate(props: { onClose: () => void; onPass: () => void }) {
  const [mathAnswer, setMathAnswer] = useState("");
  const [word, setWord] = useState("");
  const [missed, setMissed] = useState(false);
  return (
    <div className="gate">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (parentGatePasses(mathAnswer, word)) props.onPass();
          else setMissed(true);
        }}
      >
        <h2 id="gate-title">A parent goes on</h2>
        <p className="muted">What is {PARENT_GATE_MATH}? Then type the word parent.</p>
        <div className="stack">
          <label>
            Answer
            <input data-testid="gate-math" inputMode="numeric" value={mathAnswer} onChange={(event) => setMathAnswer(event.target.value)} />
          </label>
          <label>
            Word
            <input data-testid="gate-word" value={word} onChange={(event) => setWord(event.target.value)} autoCapitalize="none" />
          </label>
          {missed ? <p className="warn">That did not open. Ask a parent.</p> : null}
          <button className="btn" type="submit" data-testid="gate-submit">Continue</button>
          <button className="btn-quiet" type="button" onClick={props.onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
