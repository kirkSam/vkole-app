import { type Cell, choiceStem, decode, KIDS, numberAliases, span } from "./pool-shared.ts";

function livingThings(): Cell {
  const living = ["a tree", "a bird", "a fish", "a flower", "a dog", "a child", "a frog", "a seed that can sprout"];
  const notLiving = ["a rock", "a spoon", "a shoe", "a cup", "a brick", "a pencil", "a coin", "a chair"];
  const sizes = [living.length, notLiving.length, 2];
  return {
    count: span(sizes),
    build(index) {
      const [livingIndex, otherIndex, form] = decode(index, sizes);
      const alive = living[livingIndex]!;
      const other = notLiving[otherIndex]!;
      const stem =
        form === 0
          ? `Which one is a living thing, ${alive} or ${other}? Write the living thing.`
          : `Which one needs food and water and can grow, ${alive} or ${other}?`;
      return {
        stem,
        answer: alive,
        standard: "NGSS K-LS1",
        note: "Living things grow and need energy. A rock, a spoon, or a shoe does not.",
      };
    },
  };
}

function statesOfMatter(): Cell {
  const materials = ["water", "juice", "butter", "wax", "chocolate", "ice", "honey", "soap"];
  const prompts = [
    (material: string) => `Ice and liquid ${material} are the same material. What kind of change is melting or freezing?`,
    (material: string) => `${material[0]!.toUpperCase()}${material.slice(1)} can be a solid or a liquid. What changes, the material or the state?`,
    (material: string) => `Heating can melt solid ${material}. What change is that?`,
  ];
  const answers = ["a change of state", "the state", "a change of state"];
  const sizes = [materials.length, prompts.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [materialIndex, promptIndex, pos] = decode(index, sizes);
      const material = materials[materialIndex]!;
      const choice = choiceStem(prompts[promptIndex]!(material), answers[promptIndex]!, ["a change of continent", "a change of tense"], pos!);
      return { ...choice, standard: "NGSS 2-PS1", note: "Heating or cooling can change the state of a material without making it a new material." };
    },
  };
}

function foodChains(): Cell {
  const plants = ["grass", "algae", "oak leaves", "corn", "kelp", "clover", "wheat", "moss"];
  const animals = ["rabbit", "minnow", "deer", "cricket", "mouse", "sparrow", "tadpole", "snail"];
  const sizes = [plants.length, animals.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [plantIndex, animalIndex, form] = decode(index, sizes);
      const plant = plants[plantIndex]!;
      const animal = animals[animalIndex]!;
      if (form === 1) {
        return {
          stem: `Which comes first in this food chain, the ${plant} or the ${animal} that eats it?`,
          answer: `the ${plant}`,
          aliases: [plant],
          standard: "NGSS 5-PS3",
          note: "Producers come before the animals that eat them.",
        };
      }
      if (form === 2) {
        return {
          stem: `A food chain with ${plant} and a ${animal} gets its energy from where first?`,
          answer: "the sun",
          aliases: ["sun", "sunlight"],
          standard: "NGSS 5-PS3",
          note: "Producers capture light energy. Consumers eat.",
        };
      }
      return {
        stem: `If the ${plant} are gone, the ${animal} has less to eat. What does the ${animal} lose?`,
        answer: "food",
        aliases: ["energy", "something to eat"],
        standard: "NGSS 5-PS3",
        note: "If the producers are gone, the animal that eats them loses food.",
      };
    },
  };
}

function atoms(): Cell {
  const elements = ["carbon", "oxygen", "iron", "helium", "sodium", "gold", "nitrogen", "calcium"];
  const sizes = [elements.length, 3, 3];
  return {
    count: span(sizes),
    build(index) {
      const [elementIndex, form, pos] = decode(index, sizes);
      const element = elements[elementIndex]!;
      const prompts = [
        `An atom of ${element} is identified mainly by which particle count?`,
        `What stays the same when an atom is still ${element}?`,
        `Two atoms are both ${element} only if they have the same number of which particle?`,
      ];
      const choice = choiceStem(prompts[form]!, "protons", ["commas", "counties"], pos!);
      return { ...choice, standard: "NGSS MS-PS1", note: "The atomic number is the proton count, and it identifies the element." };
    },
  };
}

function naturalSelection(): Cell {
  const traits = ["a thicker coat", "a longer beak", "a darker shell", "faster legs", "better camouflage", "a stronger bite", "keener hearing", "a wider leaf"];
  const sizes = [traits.length, 3, 3];
  return {
    count: span(sizes),
    build(index) {
      const [traitIndex, form, pos] = decode(index, sizes);
      const trait = traits[traitIndex]!;
      const prompts = [
        `Natural selection can spread ${trait} when that trait changes what?`,
        `A population keeps ${trait} more often when that trait helps what?`,
        `${trait[0]!.toUpperCase()}${trait.slice(1)} becomes more common only if it is passed on and affects what?`,
      ];
      const choice = choiceStem(prompts[form]!, "survival and reproduction", ["ink color on a worksheet", "the spelling of a noun"], pos!);
      return { ...choice, standard: "NGSS HS-LS4", note: "Natural selection spreads heritable traits that help survival and reproduction." };
    },
  };
}

function countingOn(): Cell {
  const sizes = [61, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nIndex, form] = decode(index, sizes);
      const n = nIndex!;
      const next = n + 1;
      const stems = [`What number comes just after ${n}?`, `Count on by one from ${n}. What number do you land on?`, `What is ${n} + 1?`];
      return {
        stem: stems[form]!,
        answer: String(next),
        aliases: numberAliases(next),
        standard: "CCSS.MATH general",
        note: "Counting on by one names the next number.",
      };
    },
  };
}

function equalGroups(): Cell {
  const equations = 8 * 8;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      const note = "Equal groups are a multiplication.";
      const from = (slot: number) => {
        const a = 2 + (slot % 8);
        const b = 2 + Math.floor(slot / 8);
        return { a, b, product: a * b };
      };
      if (index < equations) {
        const item = from(index);
        return { stem: `${item.a} × ${item.b} = ?`, answer: String(item.product), aliases: numberAliases(item.product), standard: "CCSS.MATH general", note };
      }
      const inner = index - equations;
      const item = from(inner % equations);
      const name = KIDS[Math.floor(inner / equations) % KIDS.length]!;
      return {
        stem: `${name} makes ${item.a} equal groups of ${item.b}. How many are there?`,
        answer: String(item.product),
        aliases: numberAliases(item.product),
        standard: "CCSS.MATH general",
        note,
      };
    },
  };
}

function numberPatterns(grade: number): Cell {
  const starts = 11;
  const steps = [2, 3, 4, 5, 10];
  const sizes = [starts, steps.length, 2];
  return {
    count: span(sizes),
    build(index) {
      const [startIndex, stepIndex, form] = decode(index, sizes);
      const start = 2 + startIndex! + Math.max(0, grade - 6);
      const step = steps[stepIndex!]!;
      const next = start + step;
      const stem =
        form === 0
          ? `A pattern adds ${step} each time and starts at ${start}. The next term is`
          : `Start at ${start} and add ${step} once. What number do you get?`;
      return {
        stem,
        answer: String(next),
        aliases: numberAliases(next),
        standard: "CCSS.MATH.PRACTICE general",
        note: "Read the rule, then apply it once.",
      };
    },
  };
}

function classroomRules(): Cell {
  const rules = ["take turns", "listen when someone speaks", "keep hands to yourself", "walk in the hall", "share the supplies", "use quiet voices", "wait for a turn", "tell the truth", "put tools back", "line up safely"];
  const sizes = [rules.length, 3, 3];
  return {
    count: span(sizes),
    build(index) {
      const [ruleIndex, form, pos] = decode(index, sizes);
      const rule = rules[ruleIndex!]!;
      const prompts = [
        `A classroom rule to ${rule} is mainly for what?`,
        `Who is helped when everyone agrees to ${rule}?`,
        `Why keep a rule to ${rule}?`,
      ];
      const choice = choiceStem(prompts[form]!, "keeping people safe and fair", ["hiding the calendar", "removing every question"], pos!);
      return { ...choice, standard: "C3 / HSS early general", note: "Rules coordinate a group so people are safe and treated fairly." };
    },
  };
}

function responsibility(): Cell {
  const jobs = [
    "serving on a jury when called, at adult age",
    "following a law",
    "voting when of age",
    "telling the truth in class",
    "taking care of shared supplies",
    "showing up for a duty you accepted",
    "reporting a hazard",
    "returning a found wallet",
  ];
  const sizes = [jobs.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [jobIndex, form, pos] = decode(index, sizes);
      const job = jobs[jobIndex!]!;
      const prompt = form === 0 ? "Which is a responsibility, not only a right?" : `Which action is a duty: ${job}, or ignoring a rule?`;
      const choice = choiceStem(prompt, job, ["ignoring every law", "erasing a ballot"], pos!);
      return { ...choice, standard: "HSS civics general", note: "A responsibility is something a person is asked to do, not only something they may do." };
    },
  };
}

function checksAndBalances(): Cell {
  const limits: [string, string][] = [
    ["the legislature passes a bill", "the president may veto it"],
    ["the president appoints a judge", "the Senate may refuse to confirm"],
    ["a law is challenged", "a court may say it does not fit the Constitution"],
    ["a court interprets a statute", "Congress may rewrite the statute"],
    ["the president commands the military", "Congress declares war and funds it"],
    ["a house passes a bill", "the other house may reject it"],
    ["officials spend money", "Congress controls the budget"],
    ["a treaty is negotiated", "the Senate must consent"],
  ];
  const sizes = [limits.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [limitIndex, form, pos] = decode(index, sizes);
      const [action, limit] = limits[limitIndex!]!;
      const prompt =
        form === 0
          ? `Checks and balances: if ${action}, what can another part of government do?`
          : `Which idea matches this limit: ${limit}?`;
      const answer = form === 0 ? limit : "each branch can limit the others";
      const choice = choiceStem(prompt, answer, ["only one branch exists", "courts command the army alone"], pos!);
      return { ...choice, standard: "HSS civics general", note: "Checks and balances let each branch limit the others." };
    },
  };
}

export function genCell(grade: number, step: number): Cell {
  if (step === 0) {
    if (grade <= 1) return livingThings();
    if (grade <= 3) return statesOfMatter();
    if (grade <= 5) return foodChains();
    if (grade <= 8) return atoms();
    return naturalSelection();
  }
  if (step === 1) {
    if (grade <= 1) return countingOn();
    if (grade <= 4) return equalGroups();
    return numberPatterns(grade);
  }
  if (grade <= 2) return classroomRules();
  if (grade <= 5) return responsibility();
  return checksAndBalances();
}
