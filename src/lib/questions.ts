import type { SubjectId } from "./climb-rules";
import { BAND_LABELS, startBandForGrade } from "./vkole/constants.ts";
import { bandMeta, spellingPrompt, startBand } from "./vkole/spelling/items.ts";
import { bandWords } from "./vkole/sight-words/words.ts";

export type Question = {
  stem: string;
  options: string[];
  answer: string;
  standard: string;
  note: string;
};

function rand(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[rand(0, arr.length - 1)]!;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function mc(
  stem: string,
  correct: string | number,
  wrongs: Array<string | number>,
  standard: string,
  note: string,
): Question {
  const answer = String(correct);
  const uniq: string[] = [];
  const add = (v: string | number) => {
    const s = String(v);
    if (!uniq.includes(s)) uniq.push(s);
  };
  add(answer);
  for (const w of wrongs) add(w);
  let n = 0;
  while (uniq.length < 4) {
    n += 1;
    const numeric = Number(answer);
    if (Number.isFinite(numeric) && String(numeric) === answer) {
      add(String(numeric + n + 2));
      add(String(numeric - n - 2));
    } else {
      add(`${answer} ${"·".repeat(n)}`);
    }
  }
  return { stem, options: shuffle(uniq.slice(0, 4)), answer, standard, note };
}

function smallestFactor(n: number): number {
  if (n < 2) return n;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return i;
  return n;
}

function mathQuestion(level: number, step?: number): Question {
  const L = Math.max(0, level);
  const kind = step == null ? undefined : (Math.abs(step) % 3) + 1;
  if (L === 0) return kMath();
  if (L === 1) return g1(kind);
  if (L === 2) return g2(kind);
  if (L === 3) return g3(kind);
  if (L === 4) return g4(kind);
  if (L === 5) return g5(kind);
  if (L === 6) return g6(kind);
  if (L === 7) return g7(kind);
  if (L === 8) return g8(kind);
  if (L <= 12) return hs(L, kind);
  return hs(12, (Math.abs(L + (step ?? 0)) % 4) + 1);
}

function kMath(): Question {
  const kind = rand(1, 3);
  if (kind === 1) {
    const n = rand(1, 10);
    return mc(
      `Count on. What number comes just after ${n}?`,
      n + 1,
      [n, n + 2, Math.max(0, n - 1)],
      "CCSS.MATH.K.CC.A.2",
      "Kindergarten counting asks for the next number in the known sequence.",
    );
  }
  if (kind === 2) {
    const a = rand(0, 5);
    const b = rand(0, 5);
    return mc(
      `Add within 5. ${a} + ${b} = ?`,
      a + b,
      [a + b + 1, Math.abs(a - b), a + b + 2],
      "CCSS.MATH.K.OA.A.2",
      "Kindergarten addition joins two groups within 5.",
    );
  }
  const a = rand(1, 9);
  const b = rand(1, 9);
  const more = a === b ? "the same" : a > b ? String(a) : String(b);
  return mc(
    `Which is more, ${a} or ${b}?`,
    more,
    [a === b ? String(a + 1) : a > b ? String(b) : String(a), "neither", String(a + b)],
    "CCSS.MATH.K.CC.C.6",
    "Compare two numbers between 1 and 10 by which group has more.",
  );
}

function g1(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(1, 12);
    const b = rand(1, 8);
    return mc(`${a} + ${b} = ?`, a + b, [a + b + 1, a + b - 1, a + b + 10], "CCSS.MATH.1.OA.C.6", "Grade 1 adds within 20.");
  }
  if (kind === 2) {
    const a = rand(8, 18);
    const b = rand(1, 7);
    return mc(`${a} − ${b} = ?`, a - b, [a - b + 1, a + b, Math.max(0, a - b - 1)], "CCSS.MATH.1.OA.C.6", "Subtraction within 20.");
  }
  const tens = rand(1, 9) * 10;
  const ones = rand(0, 9);
  return mc(
    `What number is ${tens} + ${ones}?`,
    tens + ones,
    [tens + ones + 10, ones, tens],
    "CCSS.MATH.1.NBT.B.2",
    "A two-digit number is tens and ones.",
  );
}

function g2(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(20, 80);
    const b = rand(10, 40);
    return mc(`${a} + ${b} = ?`, a + b, [a + b + 10, a + b - 10, a + b + 1], "CCSS.MATH.2.NBT.B.5", "Grade 2 adds within 100 using place value.");
  }
  if (kind === 2) {
    const a = rand(40, 99);
    const b = rand(10, 30);
    return mc(`${a} − ${b} = ?`, a - b, [a - b + 10, a - b - 1, a - b + 2], "CCSS.MATH.2.NBT.B.5", "Subtract within 100 by taking away tens and ones.");
  }
  const n = rand(100, 900);
  return mc(
    `Which digit is in the hundreds place of ${n}?`,
    Math.floor(n / 100),
    [n % 10, Math.floor(n / 10) % 10, n],
    "CCSS.MATH.2.NBT.A.1",
    "Three-digit numbers are hundreds, tens, and ones.",
  );
}

function g3(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(2, 9);
    const b = rand(2, 9);
    return mc(`${a} × ${b} = ?`, a * b, [a * b + a, a + b, a * b - b], "CCSS.MATH.3.OA.A.1", "Multiplication represents equal groups.");
  }
  if (kind === 2) {
    const b = rand(2, 9);
    const q = rand(2, 9);
    const wrongDivisor = b === q ? b + 1 : b;
    return mc(`${b * q} ÷ ${b} = ?`, q, [wrongDivisor, b * q, q + 1], "CCSS.MATH.3.OA.A.2", "Division shares a total into equal groups.");
  }
  const d = pick([2, 3, 4, 8]);
  const n = rand(1, d - 1);
  return mc(
    `A whole is split into ${d} equal parts. ${n} of those parts is`,
    `${n}/${d}`,
    [`${n + 1}/${d}`, `${n}/${d + 1}`, `1/${n}`],
    "CCSS.MATH.3.NF.A.1",
    "A fraction n/d is n parts when the whole is split into d equal parts.",
  );
}

function g4(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(12, 40);
    const b = rand(3, 9);
    return mc(`${a} × ${b} = ?`, a * b, [a * b + 10, a * (b - 1), a + b], "CCSS.MATH.4.NBT.B.5", "Grade 4 multiplies a multi-digit number by a one-digit number.");
  }
  if (kind === 2) {
    const n = rand(1, 5);
    const d = pick([6, 8, 10, 12]);
    return mc(
      `${n}/${d} + ${n}/${d} = ?`,
      `${2 * n}/${d}`,
      [`${n}/${2 * d}`, `${2 * n}/${2 * d}`, String(2 * n)],
      "CCSS.MATH.4.NF.B.3",
      "Add fractions with the same denominator by adding the numerators.",
    );
  }
  const n = rand(11, 89);
  const rounded = Math.round(n / 10) * 10;
  const down = Math.floor(n / 10) * 10;
  return mc(
    `Round ${n} to the nearest ten.`,
    rounded,
    [n + 1, down === rounded ? rounded + 10 : down, n],
    "CCSS.MATH.4.NBT.A.3",
    "Look at the ones digit. 5 or more rounds the tens up.",
  );
}

function g5(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(1, 9);
    const b = rand(1, 9);
    const prod = (a * b) / 100;
    return mc(
      `0.${a} × 0.${b} = ?`,
      prod,
      [a * b, prod * 10, (a + b) / 10],
      "CCSS.MATH.5.NBT.B.7",
      "Multiplying tenths by tenths gives hundredths.",
    );
  }
  if (kind === 2) {
    const a = rand(1, 4);
    const b = rand(1, 4);
    return mc(
      `${a}/8 + ${b}/8 = ?`,
      `${a + b}/8`,
      [`${a}/${b}`, `${a + b}/16`, String(a + b)],
      "CCSS.MATH.5.NF.A.1",
      "Same-denominator sums keep the denominator and add the numerators.",
    );
  }
  const s = rand(2, 9);
  return mc(
    `A cube has side length ${s}. What is its volume in cubic units?`,
    s * s * s,
    [s * s, 6 * s * s, s * 3],
    "CCSS.MATH.5.MD.C.5",
    "Volume of a cube is side × side × side.",
  );
}

function g6(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(2, 6);
    const b = rand(2, 8);
    return mc(
      `The ratio ${a}:${a * b} is equivalent to 1:?`,
      b,
      [a, a * b, b + 1],
      "CCSS.MATH.6.RP.A.1",
      "Equivalent ratios scale both terms by the same factor.",
    );
  }
  if (kind === 2) {
    const x = rand(2, 9);
    const c = rand(1, 8);
    return mc(`Solve x + ${c} = ${x + c}. x = ?`, x, [c, x + c, x + 1], "CCSS.MATH.6.EE.B.7", "Subtract the added amount from both sides.");
  }
  const n = rand(1, 12);
  return mc(`What is the opposite of ${n}?`, -n, [n, n + 1, 0], "CCSS.MATH.6.NS.C.6", "Opposite numbers are the same distance from 0 on opposite sides.");
}

function g7(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(2, 6);
    const b = a * rand(2, 5);
    const k = rand(2, 5);
    const den = b * k;
    const num = a * k;
    return mc(
      `If ${a}/${b} = ?/${den}, the missing numerator is`,
      num,
      [a, den, num + a],
      "CCSS.MATH.7.RP.A.2",
      "Scale both terms of the ratio by the same factor.",
    );
  }
  if (kind === 2) {
    const x = rand(-6, 8);
    if (x === 0) return g7();
    const m = rand(2, 5);
    return mc(`Solve ${m}x = ${m * x}. x = ?`, x, [m * x, m, x + m], "CCSS.MATH.7.EE.B.4", "Divide both sides by the coefficient.");
  }
  const p = rand(2, 8);
  return mc(
    `A bag has ${p} red and ${10 - p} blue of 10 marbles. P(red) = ?`,
    `${p}/10`,
    [`${10 - p}/10`, `${p}/100`, `1/${p}`],
    "CCSS.MATH.7.SP.C.7",
    "Probability is favorable outcomes over total outcomes.",
  );
}

function g8(kind = rand(1, 3)): Question {
  if (kind === 1) {
    const a = rand(3, 8);
    const b = rand(3, 8);
    return mc(
      `A right triangle has legs ${a} and ${b}. a² + b² = ?`,
      a * a + b * b,
      [a * b, a + b, Math.abs(a * a - b * b)],
      "CCSS.MATH.8.G.B.7",
      "Pythagorean theorem: a² + b² = c².",
    );
  }
  if (kind === 2) {
    const slope = rand(2, 6);
    return mc(
      `The slope of the line through (0, 1) and (2, ${1 + 2 * slope}) is`,
      slope,
      [1, 2, slope + 2],
      "CCSS.MATH.8.EE.B.6",
      "Slope is rise over run.",
    );
  }
  const n = rand(2, 5);
  const e = rand(2, 4);
  let val = 1;
  for (let i = 0; i < e; i++) val *= n;
  return mc(
    `${n} to the power ${e} equals`,
    val,
    [n * e, val * n, e],
    "CCSS.MATH.8.EE.A.1",
    "An exponent counts repeated multiplication of the base.",
  );
}

function hs(level: number, kind = rand(1, 4)): Question {
  if (kind === 1) {
    const m = rand(2, 6);
    const b = rand(-4, 6);
    const x = rand(-3, 5);
    return mc(
      `f(x) = ${m}x + ${b}. f(${x}) = ?`,
      m * x + b,
      [m * x, x + b, m + b],
      "CCSS.MATH.HSF.IF.A.2",
      "Evaluate a linear function by substituting x.",
    );
  }
  if (kind === 2) {
    const r = rand(2, 9);
    return mc(
      `A circle has radius ${r}. Its area is π times`,
      r * r,
      [2 * r, r, 2 * r * r],
      "CCSS.MATH.CONTENT.7.G.B.4",
      "Area of a circle is πr². The question asks for the number multiplying π.",
    );
  }
  if (kind === 3) {
    const a = rand(2, 5);
    const x = rand(2, 6);
    return mc(
      `Solve ${a}(x − 1) = ${a * (x - 1)}. x = ?`,
      x,
      [1, a, x + 1],
      "CCSS.MATH.HSA.REI.B.3",
      "Divide by the factor, then add 1.",
    );
  }
  const n = rand(20, 80);
  const mean = Math.round(((4 + 6 + n) / 3) * 100) / 100;
  return mc(
    `The mean of 4, 6, and ${n} is`,
    mean,
    [n, 4 + 6 + n, (4 + 6) / 2],
    "CCSS.MATH.HSS.ID.A.2",
    "Mean is the sum divided by how many values.",
  );
}

function beyond(level: number): Question {
  const band = level - 12;
  const kind = rand(1, 4);
  if (kind === 1) {
    const n = rand(2, 12);
    return mc(
      `Climb ${band}. d/dx (${n}x²) = ?`,
      `${2 * n}x`,
      [`${n}x`, `${n * n}x`, String(2 * n)],
      `Beyond CCSS · calculus climb ${band}`,
      "Power rule: the derivative of a x² is 2a x. There is no ceiling on this climb.",
    );
  }
  if (kind === 2) {
    const p = rand(1, 5);
    const val = 10 ** p;
    return mc(
      `Climb ${band}. log10(${val}) = ?`,
      p,
      [val, p + 1, 1],
      `Beyond CCSS · logarithms climb ${band}`,
      "log10 of a power of ten is the exponent.",
    );
  }
  if (kind === 3) {
    const n = rand(8, 35);
    return mc(
      `Climb ${band}. Smallest prime factor of ${n} is`,
      smallestFactor(n),
      [n, 1, Math.max(2, n - 1)],
      `Beyond CCSS · number theory climb ${band}`,
      "The smallest prime factor is the first prime that divides the number. 1 is not prime.",
    );
  }
  const a = rand(1, 5);
  const r = rand(2, 4);
  const n = rand(3, 5);
  let term = a;
  for (let i = 1; i < n; i++) term *= r;
  return mc(
    `Climb ${band}. A geometric sequence starts at ${a} with ratio ${r}. Term ${n} is`,
    term,
    [a + r * n, a * r, term + r],
    `Beyond CCSS · sequences climb ${band}`,
    "Multiply by the ratio once for each step after the first term.",
  );
}

type BankItem = [string, string, string[], string, string];

const ELA: Record<number, BankItem[]> = {
  0: [
    ["Which word names a person?", "teacher", ["run", "blue", "under"], "CCSS.ELA.L.K.1.B", "Kindergarten language sorts nouns that name people."],
    ["The cat sat. Which word is the naming word?", "cat", ["sat", "the", "."], "CCSS.ELA.L.K.1", "A noun names a person, animal, place, or thing."],
    ["Which letter is a vowel?", "A", ["B", "T", "M"], "CCSS.ELA.RF.K.3", "Vowels are a, e, i, o, u."],
    ["Choose the word that rhymes with cat.", "hat", ["cup", "dog", "sun"], "CCSS.ELA.RF.K.2.A", "Rhyming words share ending sounds."],
  ],
  1: [
    ["Which sentence is complete?", "The dog runs.", ["Runs fast", "The big", "Dog."], "CCSS.ELA.L.1.1.J", "A complete sentence has a naming part and an action part."],
    ["Pick the plural of book.", "books", ["bookes", "book", "bookz"], "CCSS.ELA.L.1.1.C", "Most nouns add -s to mean more than one."],
    ["Which word is a verb in: Birds fly south.", "fly", ["Birds", "south", "."], "CCSS.ELA.L.1.1", "A verb tells the action."],
  ],
  2: [
    ["Which name should start with a capital letter?", "Maria", ["park", "small", "and"], "CCSS.ELA.L.2.2.A", "Names of people are capitalized."],
    ["Choose the adjective in: The red wagon rolled.", "red", ["wagon", "rolled", "The"], "CCSS.ELA.L.2.1.E", "An adjective describes a noun."],
    ["Which is a contraction for do not?", "don't", ["do'nt", "dont", "do not't"], "CCSS.ELA.L.2.2.C", "A contraction joins words and marks omitted letters with an apostrophe."],
  ],
  3: [
    ["Read: The trail was steep, so Mia walked slowly. Why did Mia walk slowly?", "The trail was steep.", ["She was late.", "The trail was flat.", "Mia ran."], "CCSS.ELA.RI.3.1", "The sentence gives the cause before so."],
    ["Which word is a pronoun?", "they", ["school", "quickly", "because"], "CCSS.ELA.L.3.1.A", "Pronouns stand in for nouns."],
    ["Choose the past-tense verb of walk.", "walked", ["walks", "walking", "will walk"], "CCSS.ELA.L.3.1.E", "Regular past tense adds -ed."],
  ],
  4: [
    ["Read: Jonah checked the sky before the game. Dark clouds piled up. What is a reasonable inference?", "Rain might delay the game.", ["The game already ended.", "Jonah dislikes sports.", "Clouds are always white."], "CCSS.ELA.RL.4.1", "Inference uses details in the text plus what the reader knows."],
    ["Which is a prepositional phrase?", "under the bridge", ["she ran", "bright lantern", "because"], "CCSS.ELA.L.4.1.E", "A prepositional phrase starts with a preposition and ends with its object."],
    ["Pick the relative adverb.", "where", ["dog", "jumped", "blue"], "CCSS.ELA.L.4.1.A", "Where, when, and why can introduce relative clauses."],
  ],
  5: [
    ["Read: The author calls the river a silver ribbon. What device is that?", "metaphor", ["glossary", "index", "caption"], "CCSS.ELA.RL.5.4", "A metaphor compares without like or as."],
    ["Which sentence uses a comma before a coordinating conjunction joining two independent clauses?", "Lena studied, and Mateo built the model.", ["Lena studied and built.", "After school Lena studied.", "The small red model."], "CCSS.ELA.L.5.2.A", "Compound sentences often take a comma before and, but, or or."],
    ["Choose the best meaning of scarce in: Water was scarce on the trail.", "hard to find", ["very cold", "easy to carry", "already frozen"], "CCSS.ELA.L.5.4", "Context shows water was limited."],
  ],
  6: [
    ["Read: The city closed the bridge on Tuesday. Which detail supports that?", "The city closed the bridge on Tuesday.", ["I think bridges are old.", "Everyone knows this.", "It felt true."], "CCSS.ELA.RI.6.1", "The answer uses the sentence that was just given."],
    ["Pick the intensive pronoun.", "myself", ["them", "city", "before"], "CCSS.ELA.L.6.1.B", "Intensive pronouns end in -self or -selves and emphasize a noun."],
    ["Read: The narrator says the house remembered every argument. The house is given human memory. That device is", "personification", ["a caption", "a table of contents", "a footnote"], "CCSS.ELA.RL.6.4", "Personification gives human action to something that is not human."],
  ],
  7: [
    ["Read: Although the plan was risky, the council voted yes. What does although signal?", "contrast", ["addition of a list", "a place name", "a math operation"], "CCSS.ELA.RI.7.5", "Although introduces a concession or contrast."],
    ["Which word is the connotative odd one out for a careful leader?", "reckless", ["steady", "measured", "deliberate"], "CCSS.ELA.L.7.5", "Connotation is the feeling a word carries beyond its dictionary sense."],
    ["Choose the correctly punctuated dialogue.", '"We leave at dawn," said Priya.', ['"We leave at dawn said Priya."', 'We leave at dawn, "said Priya."', '"We leave at dawn" said, Priya.'], "CCSS.ELA.L.7.2", "Comma and end punctuation sit inside the quotation when the tag follows."],
  ],
  8: [
    ["Read: The editorial claims bus cuts save money, then gives no figures. Strongest critique?", "The claim lacks evidence.", ["Editorials cannot have claims.", "Buses are always costly.", "Figures are adjectives."], "CCSS.ELA.RI.8.8", "Grade 8 evaluates whether reasoning is supported."],
    ["Which is a verbal phrase used as a noun?", "Winning the match", ["very quickly", "under the bench", "and then"], "CCSS.ELA.L.8.1.A", "A gerund phrase can act as a noun."],
    ["Choose the active-voice sentence.", "The team repaired the pump.", ["The pump was repaired by the team.", "The pump was broken.", "Repairs were needed."], "CCSS.ELA.L.8.1.B", "Active voice puts the actor before the verb."],
  ],
};

function fromBank(item: BankItem): Question {
  return mc(item[0], item[1], item[2], item[3], item[4]);
}

function elaPassage(level: number): Question {
  const grade = Math.min(Math.max(level, 3), 12);
  const topics: BankItem[] = [
    [
      "A student reporter notes that the library lights stay on after clubs end. Why might the reporter mention the lights?",
      "They are evidence about building use.",
      ["They prove the sun sets early.", "They replace a bibliography.", "They are a verb tense."],
      `CCSS.ELA.RI.${grade}.1`,
      "Answer from the passage, not from an outside guess.",
    ],
    [
      "In the story, Amar returns the found wallet before the game. What does the action show?",
      "He chooses honesty over convenience.",
      ["He dislikes games.", "Wallets cannot be returned.", "The narrator is a wallet."],
      `CCSS.ELA.RL.${grade}.3`,
      "Character is shown by what the person does.",
    ],
    [
      "The article contrasts coastal fog with inland heat on the same afternoon. What structure is the author using?",
      "comparison",
      ["a rhyme scheme", "a multiplication table", "a cast list"],
      `CCSS.ELA.RI.${grade}.5`,
      "Contrast places two conditions side by side.",
    ],
  ];
  return fromBank(pick(topics));
}

function elaHS(level: number): Question {
  const items: BankItem[] = [
    ["Read: The speech praises sacrifice, then asks the audience to vote. Primary purpose?", "move the audience to act", ["list spelling words", "define a triangle", "report only a temperature"], `CCSS.ELA.RI.${level}.6`, "Purpose is what the text is trying to do to the reader."],
    ["Which revision keeps parallel structure? to read, to write, and editing.", "to read, to write, and to edit", ["reading, to write, and editing", "to read, wrote, edit", "read, to writing, and edited"], `CCSS.ELA.L.${level}.1`, "Parallel items share the same grammatical form."],
    ["A theme is different from a topic because a theme", "is a claim the work develops about life", ["is only the setting name", "must be one word", "is the page count"], `CCSS.ELA.RL.${level}.2`, "Topic is the subject; theme is the idea the whole work develops."],
    ["Seminal U.S. documents are read in high school so students can", "trace how later texts answer earlier claims", ["skip argument", "replace evidence with tone", "memorize fonts"], `CCSS.ELA.RI.${level}.9`, "Cross-text reading compares founding documents with later arguments."],
  ];
  return fromBank(pick(items));
}

function elaBeyond(level: number): Question {
  const band = level - 12;
  const items: BankItem[] = [
    [`Climb ${band}. A writer defines a term, gives a case, then answers a counterclaim. Rhetorical aim?`, "reasoned argument", ["pure inventory", "stage directions", "spelling list"], `Beyond CCSS · argument climb ${band}`, "Argument builds a claim with evidence and a response to objection."],
    [`Climb ${band}. Which revision most tightens: The thing that he did was leave.`, "He left.", ["The thing that he did was the act of leaving the place.", "Leave was what was done by him in a manner.", "He was the person who did leaving."], `Beyond CCSS · syntax climb ${band}`, "Prefer the finite verb over an empty nominal shell."],
    [`Climb ${band}. With an unreliable narrator, the reader should`, "test the narrator against other evidence in the text", ["accept every claim as fact", "ignore the plot", "count the paragraphs only"], `Beyond CCSS · narrative climb ${band}`, "Unreliability is judged from contradictions and limited knowledge."],
  ];
  return fromBank(pick(items));
}

function elaQuestion(level: number, step?: number): Question {
  const L = Math.max(0, level);
  const highSchool: BankItem[] = [
    ["Read: The speech praises sacrifice, then asks the audience to vote. Primary purpose?", "move the audience to act", ["list spelling words", "define a triangle", "report only a temperature"], "CCSS.ELA.RI.12.6", "Purpose is what the text is trying to do to the reader."],
    ["Which revision keeps parallel structure? to read, to write, and editing.", "to read, to write, and to edit", ["reading, to write, and editing", "to read, wrote, edit", "read, to writing, and edited"], "CCSS.ELA.L.12.1", "Parallel items share the same grammatical form."],
    ["A theme is different from a topic because a theme", "is a claim the work develops about life", ["is only the setting name", "must be one word", "is the page count"], "CCSS.ELA.RL.12.2", "Topic is the subject; theme is the idea the whole work develops."],
    ["Seminal U.S. documents are read in high school so students can", "trace how later texts answer earlier claims", ["skip argument", "replace evidence with tone", "memorize fonts"], "CCSS.ELA.RI.12.9", "Cross-text reading compares founding documents with later arguments."],
  ];
  if (L >= 13) return fromBank(highSchool[Math.abs(L + (step ?? 0)) % highSchool.length]!);
  if (L >= 9) {
    if (step == null) return elaHS(L);
    const items = [
      ["Read: The speech praises sacrifice, then asks the audience to vote. Primary purpose?", "move the audience to act", ["list spelling words", "define a triangle", "report only a temperature"], `CCSS.ELA.RI.${L}.6`, "Purpose is what the text is trying to do to the reader."],
      ["Which revision keeps parallel structure? to read, to write, and editing.", "to read, to write, and to edit", ["reading, to write, and editing", "to read, wrote, edit", "read, to writing, and edited"], `CCSS.ELA.L.${L}.1`, "Parallel items share the same grammatical form."],
      ["A theme is different from a topic because a theme", "is a claim the work develops about life", ["is only the setting name", "must be one word", "is the page count"], `CCSS.ELA.RL.${L}.2`, "Topic is the subject; theme is the idea the whole work develops."],
    ] as const;
    const item = items[Math.abs(step) % items.length]!;
    return mc(item[0], item[1], [...item[2]], item[3], item[4]);
  }
  if (step != null && ELA[Math.min(L, 8)]) {
    const band = ELA[Math.min(L, 8)]!;
    return fromBank(band[Math.abs(step) % band.length]!);
  }
  if (L >= 3 && Math.random() < 0.45) return elaPassage(L);
  const band = Math.min(L, 8);
  return fromBank(pick(ELA[band]!));
}

const SS: Record<number, BankItem[]> = {
  0: [
    ["Which place is a home?", "a house", ["a minus sign", "a vowel", "a centimeter"], "HSS K · community", "Kindergarten social studies names familiar places."],
    ["A map symbol for water is often colored", "blue", ["ruled", "silent", "past"], "HSS K · geography", "Map colors are a shared symbol system."],
    ["Who helps keep a school safe and orderly?", "staff and students together", ["only a river", "a fraction", "a rhyme"], "HSS K · civics", "Rules and roles are early civic ideas."],
  ],
  1: [
    ["A calendar groups days into", "weeks and months", ["verbs", "products", "rhymes"], "HSS 1 · time", "Grade 1 places events in time order."],
    ["Which is a national symbol of the United States?", "the flag", ["a denominator", "a metaphor", "a pulley"], "HSS 1 · symbols", "Symbols stand for a community or country."],
    ["A good citizen in a classroom", "follows agreed rules", ["hides shared supplies", "skips every vote", "erases the map"], "HSS 1 · civics", "Citizenship starts with shared rules."],
  ],
  2: [
    ["Which landform is raised ground, smaller than a mountain?", "a hill", ["a verb", "a decade", "a senate"], "HSS 2 · geography", "Landforms are shapes of the earth."],
    ["Long ago and today are compared by looking at", "how daily life changed", ["only shoe color words", "prime factors", "quotation marks"], "HSS 2 · history", "History asks what changed and what stayed."],
    ["A producer is someone who", "makes a good or service", ["only reads maps", "is a punctuation mark", "measures angles"], "HSS 2 · economics", "Producers make; consumers use."],
  ],
  3: [
    ["Local government most directly handles", "city services such as streets", ["the moon's orbit", "verb tense", "exponent rules"], "HSS 3 · local government", "Grade 3 studies the local community and its government."],
    ["A compass rose on a map shows", "directions", ["population only", "rhyme", "mean"], "HSS 3 · map skills", "Cardinal directions orient a map."],
    ["Which source is primary?", "a letter written by a settler in 1850", ["a textbook chapter from this year", "a movie poster", "a word problem"], "CCSS.ELA.RH · primary source", "A primary source comes from the time under study."],
  ],
  4: [
    ["California’s location on the Pacific shaped its history mainly through", "trade, migration, and ports", ["its lack of coastline", "having no rivers", "being east of Maine"], "HSS 4 · California", "Grade 4 California history ties place to settlement and economy."],
    ["The Gold Rush increased California’s population because", "people came seeking gold", ["gold removed all roads", "maps were banned", "farming ended forever"], "HSS 4.3", "The 1848–1855 migration is a core Grade 4 topic."],
    ["A state constitution sets", "basic law for the state", ["today’s weather", "a poem’s meter", "a fraction’s denominator"], "HSS 4 · government", "Constitutions allocate powers and rights."],
  ],
  5: [
    ["The Declaration of Independence states that governments derive just powers from", "the consent of the governed", ["a single household", "ocean tides", "spelling rules"], "HSS 5 · Revolution", "Grade 5 U.S. history centers the founding documents."],
    ["Which war came before the Constitution was written?", "the American Revolutionary War", ["World War II", "the Civil War", "the Spanish-American War"], "HSS 5.6", "The Constitution followed independence."],
    ["A compromise in the Constitutional Convention gave large and small states", "representation in two houses of Congress", ["no courts at all", "only one branch", "optional maps"], "HSS 5.7", "The Great Compromise created two houses of Congress."],
  ],
  6: [
    ["Ancient river civilizations often grew where they did because rivers provided", "water, soil, and transport", ["only deserts with no flood", "printed newspapers", "electric grids"], "HSS 6 · ancient civilizations", "Grade 6 world history starts with early river societies."],
    ["Athens is studied as an early example of", "citizen participation in government", ["a modern freeway", "a decimal system only", "a satellite"], "HSS 6.4", "Greek city-states are compared by government form."],
    ["A historical map differs from a physical map because it emphasizes", "events, empires, or change over time", ["only elevation", "only rhyme", "only today's temperature"], "HSS 6 · geography", "Historical maps encode time as well as place."],
  ],
  7: [
    ["Medieval trade routes mattered because they moved", "goods, ideas, and disease", ["only consonants", "only integers", "only state flags"], "HSS 7 · world history", "Grade 7 connects regions across Afro-Eurasia."],
    ["The Magna Carta limited", "the arbitrary power of the king", ["the boiling point of water", "verb agreement", "pi"], "HSS 7 · rights", "It is an ancestor of later rights documents."],
    ["A cause of the Reformation was dispute over", "church authority and practice", ["railroad gauges", "binary code", "jet streams"], "HSS 7.9", "Religious change reshaped European states."],
  ],
  8: [
    ["The U.S. Constitution separates powers so that", "no one branch holds all lawmaking, executing, and judging", ["states cannot exist", "courts write statutes alone", "presidents serve for life by rule"], "HSS 8 · Constitution", "Separation of powers is a Grade 8 U.S. history anchor."],
    ["The Civil War’s central conflict included", "union, slavery, and federal power", ["the shape of sonnets", "decimal place value", "coastal fog"], "HSS 8.10", "Causes and consequences of the Civil War are required content."],
    ["Reconstruction refers to the period of", "rejoining the nation and defining rights after the Civil War", ["building the pyramids", "founding Jamestown", "the Moon landing"], "HSS 8.11", "Amendments 13–15 are part of that story."],
  ],
};

function hsSS(): Question {
  const items: BankItem[] = [
    ["Which branch interprets whether a law fits the Constitution?", "judicial", ["only postal clerks", "a school bell schedule", "the census form itself"], "HSS 12 · government", "Judicial review is the court’s checking function."],
    ["A midterm election fills", "seats in Congress between presidential elections", ["only the Supreme Court", "only city trash routes", "only treaty texts"], "HSS 12.3", "House terms are two years."],
    ["Opportunity cost means", "the next best alternative given up", ["the price tag only", "a map scale", "a verb mood"], "HSS 12 economics", "Scarcity forces a choice; cost is the forgone option."],
    ["A credible historical claim cites", "sources a reader can check", ["only a feeling", "a rhyme", "an unnamed everyone"], "CCSS.ELA.RH.11-12.1", "History writing is evidence-bearing argument."],
    ["Federalism divides authority between", "national and state governments", ["nouns and verbs", "oceans and commas", "exponents and slopes"], "HSS 12.1", "Some powers are delegated, some reserved, some shared."],
    ["An export is a good", "sold to buyers in another country", ["only used inside one kitchen", "illegal by definition", "a type of pronoun"], "HSS 12 economics", "Exports and imports are the trade pair."],
  ];
  return fromBank(pick(items));
}

function beyondSS(level: number): Question {
  const band = level - 12;
  const items: BankItem[] = [
    [`Climb ${band}. Comparative government: a parliamentary system usually fuses`, "executive leadership with the legislative majority", ["courts with the postal service", "maps with metaphors", "taxes with vowels"], `Beyond HSS · comparative government climb ${band}`, "The prime minister is typically drawn from parliament."],
    [`Climb ${band}. A historian treats a memoir as`, "a situated source, not an automatic fact sheet", ["always false", "always complete", "a math identity"], `Beyond CCSS RH · historiography climb ${band}`, "Memoirs have viewpoint, memory limits, and purpose."],
    [`Climb ${band}. Inflation is best described as`, "a general rise in the price level over time", ["any single sale price", "a compass bearing", "a constitutional amendment"], `Beyond HSS · economics climb ${band}`, "Measure it with a price index, not one item."],
  ];
  return fromBank(pick(items));
}

function ssQuestion(level: number, step?: number): Question {
  const L = Math.max(0, level);
  const highSchool: BankItem[] = [
    ["Which branch interprets whether a law fits the Constitution?", "judicial", ["only postal clerks", "a school bell schedule", "the census form itself"], "HSS 12 · government", "Judicial review is the court’s checking function."],
    ["A midterm election fills", "seats in Congress between presidential elections", ["only the Supreme Court", "only city trash routes", "only treaty texts"], "HSS 12.3", "House terms are two years."],
    ["Opportunity cost means", "the next best alternative given up", ["the price tag only", "a map scale", "a verb mood"], "HSS 12 economics", "Scarcity forces a choice; cost is the forgone option."],
    ["A credible historical claim cites", "sources a reader can check", ["only a feeling", "a rhyme", "an unnamed everyone"], "CCSS.ELA.RH.11-12.1", "History writing is evidence-bearing argument."],
    ["Federalism divides authority between", "national and state governments", ["nouns and verbs", "oceans and commas", "exponents and slopes"], "HSS 12.1", "Some powers are delegated, some reserved, some shared."],
    ["An export is a good", "sold to buyers in another country", ["only used inside one kitchen", "illegal by definition", "a type of pronoun"], "HSS 12 economics", "Exports and imports are the trade pair."],
  ];
  if (L >= 13) return fromBank(highSchool[Math.abs(L + (step ?? 0)) % highSchool.length]!);
  if (L >= 9) return fromBank(pick(highSchool));
  const band = SS[L];
  if (step != null && band) return fromBank(band[Math.abs(step) % band.length]!);
  return fromBank(pick(SS[L]!));
}

function genSci(level: number): Question {
  if (level <= 1) return mc("Which is a living thing?", "a tree", ["a rock", "a shoe", "a spoon"], "NGSS K-LS1", "Living things grow and need energy.");
  if (level <= 3) return mc("Water can be solid ice or liquid water. This is a change of", "state", ["continent", "tense", "office"], "NGSS 2-PS1", "Heating or cooling can change state.");
  if (level <= 5) return mc("A food chain starts with energy from", "the sun, captured by producers", ["a pronoun", "a senator", "a denominator"], "NGSS 5-PS3", "Producers convert light energy; consumers eat.");
  if (level <= 8) return mc("An atom of one element is distinguished mainly by its number of", "protons", ["commas", "counties", "stanzas"], "NGSS MS-PS1", "Atomic number is the proton count.");
  return mc("Natural selection acts when heritable traits affect", "survival and reproduction", ["only ink color on a worksheet", "the spelling of a noun", "a map legend"], "NGSS HS-LS4", "Differential reproductive success shifts traits in a population.");
}

function genQuant(level: number): Question {
  if (level <= 1) {
    const n = rand(2, 9);
    return mc(`What is ${n} + 1?`, n + 1, [n, n + 2, 1], "CCSS.MATH general", "Count on by one.");
  }
  if (level <= 4) {
    const a = rand(3, 9);
    const b = rand(3, 9);
    return mc(`${a} × ${b}`, a * b, [a + b, a * b + 1, a * b - a], "CCSS.MATH general", "Equal groups.");
  }
  const x = rand(2, 12);
  return mc(
    `If a pattern adds 3 each time and starts at ${x}, the next term is`,
    x + 3,
    [x + 1, x * 3, x],
    "CCSS.MATH.PRACTICE general",
    "Read the rule, then apply it once.",
  );
}

function genCivic(level: number): Question {
  if (level <= 2) return mc("A rule in a classroom is mainly for", "keeping people safe and fair", ["hiding the calendar", "removing all questions", "ending maps"], "C3 / HSS early general", "Rules coordinate a group.");
  if (level <= 5) return mc("Which is a responsibility, not only a right?", "serving on a jury when called, at adult age", ["ignoring every law", "erasing a ballot", "skipping all evidence"], "HSS civics general", "Rights come with civic duties.");
  if (level <= 8) return mc("Checks and balances means", "each branch can limit the others", ["only one branch exists", "states print their own physics", "courts command the army alone"], "HSS civics general", "Shared power is a design against concentration.");
  return mc("A reliable news claim can be checked against", "named sources and documents", ["how loud the headline is", "whether it rhymes", "how many exclamation marks it uses"], "CCSS RH/RST general", "Verification looks for traceable evidence.");
}

function genWord(level: number): Question {
  const pairs: BankItem[] =
    level < 4
      ? [
          ["Which word means more than one child?", "children", ["child", "childs", "childing"], "General academic language", "General climb mixes words students need across subjects."],
          ["Pick the opposite of hot.", "cold", ["tall", "early", "round"], "General academic language", "Opposites are a kindergarten and early-grade language skill."],
        ]
      : level < 8
        ? [
            ["Precise means", "exact", ["sleepy", "lateral", "silent"], "General academic language", "Precise means exact, not approximate."],
            ["A hypothesis is", "a testable explanation", ["a finished law with no test", "a map scale", "a pronoun"], "General academic language", "A hypothesis can be checked against evidence."],
          ]
        : [
            ["Empirical means based on", "observation or measurement", ["rhyme alone", "a wish", "a title only"], "General academic language", "Empirical claims rest on observation."],
            ["A variable you change on purpose in a test is", "independent", ["decorative", "parliamentary", "past perfect"], "General academic language", "The independent variable is the one the test changes."],
          ];
  return fromBank(pick(pairs));
}

function genBeyond(level: number): Question {
  const band = level - 12;
  const kind = rand(1, 4);
  if (kind === 1) return mc(`Climb ${band}. A control group in an experiment`, "receives no treatment or a comparison treatment", ["is hidden from the data table", "replaces the question", "must be the largest country"], `Beyond NGSS · experiment design climb ${band}`, "Controls help isolate the variable under test.");
  if (kind === 2) return mc(`Climb ${band}. If price rises and nothing else changes, quantity demanded usually`, "falls", ["becomes a branch of government", "equals the atomic number", "rhymes"], `Beyond general · reasoning climb ${band}`, "That inverse movement is the ordinary demand relationship.");
  if (kind === 3) return mc(`Climb ${band}. Correlation means`, "two measures vary together, not that one must cause the other", ["proof of cause in every case", "a part of speech", "a landform"], `Beyond general · reasoning climb ${band}`, "Cause needs a mechanism and a design that can rule out alternatives.");
  return mc(`Climb ${band}. The strongest reading of a hard passage begins by`, "stating what the text actually says", ["replacing it with a preference", "counting the fonts", "skipping the claim"], `Beyond CCSS · general literacy climb ${band}`, "Comprehension precedes critique.");
}

function genQuestion(level: number, step?: number): Question {
  const L = Math.max(0, level);
  if (L >= 13) {
    const kind = (Math.abs(L + (step ?? 0)) % 4) + 1;
    if (kind === 1) return genSci(12);
    if (kind === 2) return genQuant(12);
    if (kind === 3) return genCivic(12);
    return genWord(12);
  }
  if (step === 3) return genWord(L);
  const kind = step == null ? rand(1, 4) : (Math.abs(step) % 3) + 1;
  if (kind === 1) return genSci(L);
  if (kind === 2) return genQuant(L);
  if (kind === 3) return genCivic(L);
  return genWord(L);
}

function sightWordQuestion(level: number, step?: number): Question {
  const band = startBandForGrade(level);
  const words = bandWords(band);
  const index = words.length === 0 ? 0 : Math.abs(step ?? rand(0, words.length - 1)) % words.length;
  const answer = words[index] ?? "";
  return {
    stem: answer,
    options: [],
    answer,
    standard: band,
    note: `${BAND_LABELS[band]}. Read the word aloud.`,
  };
}

function spellingQuestion(level: number, step?: number): Question {
  const band = startBand();
  const count = Math.max(1, bandMeta(band).count);
  const index = step == null ? rand(0, count - 1) : Math.max(0, Math.round(step));
  const prompt = spellingPrompt(band, index, level);
  return {
    stem: prompt.stem,
    options: [],
    answer: prompt.answer,
    standard: prompt.standard,
    note: prompt.note,
  };
}

export function makeQuestion(subject: SubjectId, level: number, step?: number): Question {
  if (subject === "m") return mathQuestion(level, step);
  if (subject === "ela") return elaQuestion(level, step);
  if (subject === "ss") return ssQuestion(level, step);
  if (subject === "sw") return sightWordQuestion(level, step);
  if (subject === "sp") return spellingQuestion(level, step);
  return genQuestion(level, step);
}

export function grade12QuestionBank(subject: SubjectId): { prompt: string; code: string; label: string }[] {
  const items: { prompt: string; code: string; label: string }[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < 36; n += 1) {
    const question = makeQuestion(subject, 12, n % 3);
    const key = question.stem.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({ prompt: question.stem, code: question.standard, label: question.note });
  }
  return items;
}

export function makeAssignment(subject: SubjectId, level: number, count = 8): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 12) {
    guard += 1;
    const question = makeQuestion(subject, level);
    if (seen.has(question.stem)) continue;
    seen.add(question.stem);
    out.push(question);
  }
  while (out.length < count) out.push(makeQuestion(subject, level));
  return out;
}
