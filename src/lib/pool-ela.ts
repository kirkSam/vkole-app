import { type Cell, choiceCell, choiceStem, decode, KIDS, span } from "./pool-shared.ts";

function direct(count: number, standard: string, note: string, build: (index: number) => { stem: string; answer: string; aliases?: string[] }): Cell {
  return {
    count,
    build(index) {
      const row = build(index);
      return { stem: row.stem, answer: row.answer, aliases: row.aliases, standard, note };
    },
  };
}

function completeSentences(): Cell {
  const nouns = ["dog", "bird", "child", "fish", "frog", "cat", "kite", "boat"];
  const verbs = ["runs", "sits", "jumps", "waits", "plays", "looks"];
  const sizes = [nouns.length, verbs.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nounIndex, verbIndex, pos] = decode(index, sizes);
      const noun = nouns[nounIndex!]!;
      const verb = verbs[verbIndex!]!;
      const choice = choiceStem(
        "Which sentence is complete?",
        `The ${noun} ${verb}.`,
        [`${verb} fast`, `The ${noun}`],
        pos!,
      );
      return {
        ...choice,
        standard: "CCSS.ELA.L.1.1",
        note: "A complete sentence has a naming part and an action part.",
      };
    },
  };
}

function pluralNouns(): Cell {
  const nouns = ["book", "cat", "dog", "bird", "tree", "shoe", "car", "cup", "hat", "pen", "desk", "frog", "star", "map", "coin"];
  const frames = [
    (noun: string) => `Which word means more than one ${noun}?`,
    (noun: string) => `Choose the plural of ${noun}.`,
    (noun: string) => `More than one ${noun} is written which way?`,
  ];
  const sizes = [nouns.length, frames.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nounIndex, frameIndex, pos] = decode(index, sizes);
      const noun = nouns[nounIndex!]!;
      const choice = choiceStem(frames[frameIndex]!(noun), `${noun}s`, [noun, `${noun}es`, `${noun}z`], pos!);
      return { ...choice, standard: "CCSS.ELA.L.1.1.C", note: "Most nouns add -s to mean more than one." };
    },
  };
}

function verbs(): Cell {
  const subjects = ["Birds", "Dogs", "Children", "Fish", "Horses", "Kids", "Ducks", "Ponies"];
  const actions = ["fly", "run", "read", "swim", "jump", "play", "walk", "sing"];
  const places = ["south", "home", "outside", "away", "together"];
  const sizes = [subjects.length, actions.length, places.length];
  return direct(span(sizes), "CCSS.ELA.L.1.1", "A verb tells the action.", (index) => {
    const [subjectIndex, actionIndex, placeIndex] = decode(index, sizes);
    const subject = subjects[subjectIndex]!;
    const action = actions[actionIndex]!;
    const place = places[placeIndex]!;
    return {
      stem: `Read: ${subject} ${action} ${place}.\n\nQuestion: Which word is the verb? Write the verb.`,
      answer: action,
    };
  });
}

function capitalLetters(): Cell {
  const names = ["Maria", "Jonah", "Priya", "Luis", "Ava", "Noah", "Sofia", "Omar", "Hana", "Leo", "Elena", "Sam"];
  const common = ["park", "small", "river", "pencil", "morning", "yellow", "school", "garden"];
  const sizes = [names.length, common.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nameIndex, commonIndex, pos] = decode(index, sizes);
      const name = names[nameIndex!]!;
      const choice = choiceStem(
        "Which word should start with a capital letter because it is a person's name?",
        name,
        [common[commonIndex]!, common[(commonIndex! + 3) % common.length]!],
        pos!,
      );
      return { ...choice, standard: "CCSS.ELA.L.2.2.A", note: "Names of people are capitalized." };
    },
  };
}

function adjectives(): Cell {
  const adjectives = ["red", "small", "bright", "cold", "soft", "loud", "quick", "green", "tall", "round"];
  const nouns = ["wagon", "ball", "bird", "hat", "drum", "kite", "boat", "lamp"];
  const sizes = [adjectives.length, nouns.length, 2];
  return direct(span(sizes), "CCSS.ELA.L.2.1.E", "An adjective describes a noun.", (index) => {
    const [adjectiveIndex, nounIndex, form] = decode(index, sizes);
    const adjective = adjectives[adjectiveIndex]!;
    const noun = nouns[nounIndex]!;
    const stem =
      form === 0
        ? `Read: The ${adjective} ${noun} rolled.\n\nQuestion: Which word is the adjective? Write that word.`
        : `Which word describes the ${noun} in this sentence: The ${adjective} ${noun} rolled.`;
    return { stem, answer: adjective };
  });
}

function contractions(): Cell {
  const pairs: [string, string][] = [
    ["do not", "don't"],
    ["is not", "isn't"],
    ["cannot", "can't"],
    ["we are", "we're"],
    ["it is", "it's"],
    ["they are", "they're"],
    ["I am", "I'm"],
    ["she is", "she's"],
    ["will not", "won't"],
    ["are not", "aren't"],
    ["did not", "didn't"],
    ["was not", "wasn't"],
  ];
  const sizes = [pairs.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [pairIndex, form, pos] = decode(index, sizes);
      const [words, contraction] = pairs[pairIndex!]!;
      const choice =
        form === 0
          ? choiceStem(`Which is a contraction for ${words}?`, contraction, [words, `${words.split(" ")[0]}'nt`], pos!)
          : choiceStem(`Which two words make the contraction ${contraction}?`, words, [contraction, `${contraction} not`], pos!);
      return { ...choice, standard: "CCSS.ELA.L.2.2.C", note: "A contraction joins words and uses an apostrophe for the missing letters." };
    },
  };
}

const CAUSES: [string, string][] = [
  ["The trail was steep", "walked slowly"],
  ["The rain was heavy", "went inside"],
  ["The bag was heavy", "stopped to rest"],
  ["The room was dark", "turned on a lamp"],
  ["The bell rang", "lined up"],
  ["The soup was hot", "waited to eat"],
  ["The bus was early", "hurried outside"],
  ["The pencil broke", "asked for another"],
  ["The page was long", "read it twice"],
  ["The ice was thin", "stayed off the pond"],
  ["The map was torn", "asked for help"],
  ["The stairs were crowded", "walked on the right"],
];

function readingForAReason(): Cell {
  const sizes = [CAUSES.length, KIDS.length];
  return direct(span(sizes), "CCSS.ELA.RI.3.1", "The cause is the part of the sentence that tells why.", (index) => {
    const [causeIndex, nameIndex] = decode(index, sizes);
    const [cause, effect] = CAUSES[causeIndex]!;
    const name = KIDS[nameIndex]!;
    return {
      stem: `Read: ${cause}, so ${name} ${effect}.\n\nQuestion: Why did ${name} ${effect}?`,
      answer: cause,
      aliases: [cause.replace(/^The /, "the ")],
    };
  });
}

function pronouns(): Cell {
  const pronouns = ["They", "She", "He", "We", "It"];
  const actions = ["walked to school", "read the map", "opened the door", "shared the crayons", "found the key", "waited outside"];
  const sizes = [pronouns.length, actions.length, 2];
  return direct(span(sizes), "CCSS.ELA.L.3.1.A", "A pronoun stands in for a noun.", (index) => {
    const [pronounIndex, actionIndex, form] = decode(index, sizes);
    const pronoun = pronouns[pronounIndex]!;
    const action = actions[actionIndex]!;
    const stem =
      form === 0
        ? `Read: ${pronoun} ${action}.\n\nQuestion: Which word is the pronoun? Write it.`
        : `In the sentence "${pronoun} ${action}," which word stands in for a person or group?`;
    return { stem, answer: pronoun, aliases: [pronoun.toLowerCase()] };
  });
}

function pastTense(): Cell {
  const verbs = ["walk", "play", "jump", "help", "clean", "ask", "show", "call", "look", "work", "start", "paint"];
  const sizes = [verbs.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [verbIndex, form, pos] = decode(index, sizes);
      const verb = verbs[verbIndex!]!;
      const prompt = form === 0 ? `Choose the past-tense form of ${verb}.` : `Yesterday, which word tells that someone already did ${verb}?`;
      const choice = choiceStem(prompt, `${verb}ed`, [`${verb}s`, `${verb}ing`], pos!);
      return { ...choice, standard: "CCSS.ELA.L.3.1.E", note: "Regular past tense adds -ed." };
    },
  };
}

function inference(): Cell {
  const scenes: [string, string, [string, string]][] = [
    ["Jonah checked the sky before the game. Dark clouds piled up.", "Rain might delay the game.", ["The game already ended.", "Clouds are always white."]],
    ["The lunch bell rang and the line was still at the door.", "Some students may be late to lunch.", ["Lunch was yesterday.", "Bells cannot ring."]],
    ["Ava packed a coat and boots before the hike.", "She expects cold or wet weather.", ["She is going swimming.", "Coats are food."]],
    ["The library lights stayed on after the clubs ended.", "Someone may still be in the building.", ["The sun is a lamp.", "Lights are verbs."]],
    ["Leo's plant leaned toward the window.", "The plant is growing toward the light.", ["The plant left the room.", "Windows are roots."]],
    ["Priya put a finger to her lips when the baby slept.", "She wanted the room to stay quiet.", ["The baby was playing drums.", "Lips are maps."]],
    ["The baker set the pies on the rack to cool.", "The pies were too hot to eat right away.", ["The pies were frozen.", "Racks are stories."]],
    ["Noah checked the clock and started to run.", "He was worried about being late.", ["He had already finished.", "Clocks are shoes."]],
    ["The trail sign said 'Bridge out.'", "Hikers need a different way across.", ["The bridge is brand new.", "Signs are rivers."]],
    ["Sofia saved the last cookie for her brother.", "She was keeping it to share.", ["She does not know him.", "Cookies are books."]],
    ["The classroom hamster wheel was spinning, but the cage was empty.", "The hamster was somewhere else.", ["Wheels are always food.", "The cage is a verb."]],
    ["Omar closed the window when the wind picked up.", "He wanted to keep the wind out.", ["He wanted more wind.", "Windows are verbs."]],
  ];
  return choiceCell(
    "CCSS.ELA.RL.4.1",
    "An inference uses the details in the text.",
    scenes.map(([read, answer, wrong]) => ({
      prompt: `Read: ${read}\n\nQuestion: What is a reasonable inference?`,
      answer,
      wrong,
    })),
  );
}

function prepositionalPhrases(): Cell {
  const phrases = [
    "under the bridge",
    "across the field",
    "behind the door",
    "near the river",
    "inside the box",
    "along the path",
    "over the fence",
    "beside the desk",
    "through the gate",
    "between the trees",
    "above the shelf",
    "around the pond",
  ];
  const sizes = [phrases.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [phraseIndex, form, pos] = decode(index, sizes);
      const phrase = phrases[phraseIndex!]!;
      const prompt = form === 0 ? "Which is a prepositional phrase?" : `Which phrase starts with a preposition and tells where?`;
      const choice = choiceStem(prompt, phrase, ["she ran quickly", "because the bell rang"], pos!);
      return { ...choice, standard: "CCSS.ELA.L.4.1.E", note: "A prepositional phrase starts with a preposition and ends with its object." };
    },
  };
}

function relativeAdverbs(): Cell {
  const rows = [
    ["where", "the park where we play"],
    ["when", "the day when the fair opens"],
    ["why", "the reason why the bell rang"],
    ["where", "the room where the maps are kept"],
    ["when", "the hour when the bus leaves"],
    ["why", "the reason why the trail closed"],
    ["where", "the town where Jonah was born"],
    ["when", "the winter when the river froze"],
    ["why", "the cause why the lamp went out"],
    ["where", "the harbor where the boats dock"],
  ];
  const sizes = [rows.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, pos] = decode(index, sizes);
      const [word, phrase] = rows[rowIndex!]!;
      const choice = choiceStem(`Which relative adverb is in "${phrase}"?`, word, ["dog", "blue"], pos!);
      return { ...choice, standard: "CCSS.ELA.L.4.1.A", note: "Where, when, and why can introduce a clause." };
    },
  };
}

function figurativeLanguage(): Cell {
  const rows: [string, string, [string, string]][] = [
    ["The author calls the river a silver ribbon.", "metaphor", ["glossary", "caption"]],
    ["The wind whispered through the pines.", "personification", ["index", "footnote"]],
    ["The classroom was a beehive before the bell.", "metaphor", ["a map scale", "a verb chart"]],
    ["Her smile was a lamp in the dark hall.", "metaphor", ["a table of contents", "a heading"]],
    ["The old house groaned in the storm.", "personification", ["a caption", "a glossary"]],
    ["The moon was a coin on black cloth.", "metaphor", ["an index", "a diagram"]],
    ["Time crawled during the last mile.", "personification", ["a footnote", "a subtitle"]],
    ["The goalie was a wall.", "metaphor", ["a bibliography", "a caption"]],
    ["The kettle sang when the water boiled.", "personification", ["a heading", "a label"]],
    ["The stars were diamonds on the water.", "metaphor", ["a glossary", "an appendix"]],
    ["The city never sleeps.", "personification", ["a caption", "an index"]],
    ["His voice was thunder.", "metaphor", ["a footnote", "a chart"]],
  ];
  return choiceCell(
    "CCSS.ELA.RL.5.4",
    "A metaphor compares without like or as. Personification gives human action to something that is not human.",
    rows.map(([text, answer, wrong]) => ({
      prompt: `Read: ${text}\n\nQuestion: What device is that?`,
      answer,
      wrong,
    })),
  );
}

function compoundSentences(): Cell {
  const pairs: [string, string, string][] = [
    ["Lena studied", "Mateo built the model", "and"],
    ["The rain stopped", "the game began", "and"],
    ["Jonah packed lunch", "Priya brought the map", "and"],
    ["The lamp flickered", "we kept reading", "but"],
    ["Ava finished early", "Noah checked the work", "and"],
    ["The door was open", "nobody was inside", "but"],
    ["Sofia wrote the claim", "Luis found the source", "and"],
    ["The trail was steep", "the view was worth it", "but"],
    ["Hana measured the box", "Leo recorded the number", "and"],
    ["The bus was late", "the class still arrived", "but"],
  ];
  const sizes = [pairs.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [pairIndex, pos] = decode(index, sizes);
      const [left, right, join] = pairs[pairIndex!]!;
      const choice = choiceStem(
        "Which sentence uses a comma before a coordinating conjunction that joins two complete thoughts?",
        `${left}, ${join} ${right}.`,
        [`${left} ${join} ${right}.`, `After school ${left.toLowerCase()}.`],
        pos!,
      );
      return { ...choice, standard: "CCSS.ELA.L.5.2.A", note: "A compound sentence often takes a comma before and, but, or or." };
    },
  };
}

function wordMeaning(): Cell {
  const rows: [string, string, string, [string, string]][] = [
    ["Water was scarce on the trail.", "scarce", "hard to find", ["very cold", "easy to carry"]],
    ["The answer was obvious to the class.", "obvious", "easy to see", ["hidden on purpose", "written in rhyme"]],
    ["Please be precise about the measurement.", "precise", "exact", ["sleepy", "rough"]],
    ["The captain remained calm in the storm.", "calm", "quiet and steady", ["angry and loud", "lost"]],
    ["The evidence was sufficient for the claim.", "sufficient", "enough", ["missing", "rhyming"]],
    ["A brief note explained the delay.", "brief", "short", ["endless", "musical"]],
    ["The path was narrow between the rocks.", "narrow", "not wide", ["very loud", "already frozen"]],
    ["They postponed the game until Monday.", "postponed", "put off until later", ["played immediately", "erased"]],
    ["The witness gave a reluctant answer.", "reluctant", "unwilling", ["eager", "rhyming"]],
    ["The experiment produced a similar result.", "similar", "almost the same", ["the opposite", "a place name"]],
    ["The mayor proposed a cautious plan.", "cautious", "careful", ["reckless", "invisible"]],
    ["The archive keeps fragile letters.", "fragile", "easy to damage", ["made of stone", "very loud"]],
  ];
  return choiceCell(
    "CCSS.ELA.L.5.4",
    "Use the sentence around the word to decide what it means.",
    rows.map(([sentence, word, answer, wrong]) => ({
      prompt: `Read: ${sentence}\n\nQuestion: What does ${word} mean here?`,
      answer,
      wrong,
    })),
  );
}

function evidenceFromText(grade: number): Cell {
  const places = ["bridge", "library", "pool", "market", "trail", "museum", "station", "harbor"];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const actors = grade >= 11 ? ["The council", "The editor", "The curator", "The agency"] : ["The city", "The school", "The park", "The county"];
  const sizes = [places.length, days.length, actors.length];
  return direct(span(sizes), `CCSS.ELA.RI.${grade}.1`, "The supporting detail is the sentence that states the fact.", (index) => {
    const [placeIndex, dayIndex, actorIndex] = decode(index, sizes);
    const place = places[placeIndex]!;
    const day = days[dayIndex]!;
    const actor = actors[actorIndex]!;
    const sentence = `${actor} closed the ${place} on ${day}.`;
    return {
      stem: `Read: ${sentence}\n\nQuestion: Which sentence supports that the ${place} was closed? Write that sentence.`,
      answer: sentence,
    };
  });
}

function intensivePronouns(): Cell {
  const rows = [
    ["myself", "I finished the model myself"],
    ["yourself", "You can check the map yourself"],
    ["himself", "Jonah fixed the lamp himself"],
    ["herself", "Priya wrote the caption herself"],
    ["ourselves", "We timed the experiment ourselves"],
    ["themselves", "The players stretched themselves"],
    ["myself", "I copied the chart myself"],
    ["herself", "Ava labeled the jars herself"],
    ["himself", "Noah carried the crate himself"],
    ["themselves", "The judges decided themselves"],
  ];
  const sizes = [rows.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, pos] = decode(index, sizes);
      const [word, sentence] = rows[rowIndex!]!;
      const choice = choiceStem(`Which word is the intensive pronoun in "${sentence}"?`, word, ["city", "before"], pos!);
      return { ...choice, standard: "CCSS.ELA.L.6.1.B", note: "Intensive pronouns end in -self or -selves and emphasize a noun." };
    },
  };
}

function personification(): Cell {
  const rows = [
    "The house remembered every argument.",
    "The clock scolded us for being late.",
    "The river complained over the stones.",
    "The notebook waited patiently on the desk.",
    "The storm knocked at the windows.",
    "The garden celebrated the first warm day.",
    "The bridge sighed under the trucks.",
    "The moon watched the empty field.",
    "The kettle muttered on the stove.",
    "The trail invited us farther up.",
    "The camera blinked in the dark.",
    "The old bell refused to stay quiet.",
  ];
  return choiceCell(
    "CCSS.ELA.RL.6.4",
    "Personification gives a human action to something that is not human.",
    rows.map((row) => ({
      prompt: `Read: ${row}\n\nQuestion: Giving the thing a human action is which device?`,
      answer: "personification",
      wrong: ["a caption", "a footnote"] as [string, string],
    })),
  );
}

function contrastSignals(): Cell {
  const words: [string, string][] = [
    ["although", "contrast"],
    ["but", "contrast"],
    ["however", "contrast"],
    ["yet", "contrast"],
    ["because", "a cause"],
    ["since", "a cause"],
    ["so", "a result"],
    ["therefore", "a result"],
    ["if", "a condition"],
    ["unless", "a condition"],
    ["and", "addition"],
    ["also", "addition"],
    ["while", "two things happening together"],
    ["until", "a time limit"],
    ["after", "time order"],
    ["before", "time order"],
  ];
  return choiceCell(
    "CCSS.ELA.RI.7.5",
    "A connecting word tells how two ideas are related.",
    words.map(([word, meaning]) => ({
      prompt: `What does "${word}" signal between two ideas?`,
      answer: meaning,
      wrong: ["a math operation", "a place name"] as [string, string],
    })),
  );
}

function connotation(): Cell {
  const rows: [string, string, [string, string]][] = [
    ["Which word is the odd one out for a careful leader?", "reckless", ["steady", "measured"]],
    ["Which word suggests a kind crowd, not a harsh one?", "welcoming", ["hostile", "sneering"]],
    ["Which word makes a small house sound pleasant?", "cozy", ["cramped", "dingy"]],
    ["Which word makes a plan sound careless?", "rash", ["deliberate", "thoughtful"]],
    ["Which word praises a speaker?", "eloquent", ["rambling", "harsh"]],
    ["Which word criticizes a cheap repair?", "shoddy", ["sturdy", "careful"]],
    ["Which word makes a smell sound pleasant?", "fragrant", ["reeking", "putrid"]],
    ["Which word suggests an unfair rule?", "arbitrary", ["just", "even"]],
    ["Which word makes waiting sound unbearable?", "endless", ["brief", "short"]],
    ["Which word suggests a brave choice?", "courageous", ["timid", "fearful"]],
    ["Which word makes a group sound united?", "allied", ["scattered", "split"]],
    ["Which word suggests a secret plan to harm?", "plot", ["schedule", "agenda"]],
  ];
  return choiceCell(
    "CCSS.ELA.L.7.5",
    "Connotation is the feeling a word carries beyond its dictionary sense.",
    rows.map(([prompt, answer, wrong]) => ({ prompt, answer, wrong })),
  );
}

function dialoguePunctuation(): Cell {
  const quotes = ["We leave at dawn", "The map is ready", "Hold the lantern", "The bridge is closed", "Start the timer", "Save the last page"];
  const sizes = [KIDS.length, quotes.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nameIndex, quoteIndex, pos] = decode(index, sizes);
      const name = KIDS[nameIndex!]!;
      const quote = quotes[quoteIndex!]!;
      const choice = choiceStem(
        "Which dialogue is punctuated correctly?",
        `"${quote}," said ${name}.`,
        [`"${quote} said ${name}."`, `${quote}, "said ${name}."`],
        pos!,
      );
      return { ...choice, standard: "CCSS.ELA.L.7.2", note: "When the speaker tag follows, the comma sits inside the quotation marks." };
    },
  };
}

function evaluatingArgument(): Cell {
  const claims = [
    ["bus cuts save money", "no figures"],
    ["the new park will cut traffic", "no counts of cars"],
    ["longer recess raises test scores", "no scores"],
    ["the well water is safe", "no test results"],
    ["the bridge repair is cheap", "no prices"],
    ["the club doubled in size", "no membership list"],
    ["the storm did no damage", "no inspection"],
    ["the recipe feeds twenty", "no amounts"],
    ["the trail is the shortest", "no distances"],
    ["the battery lasts all day", "no timing"],
    ["the soil is rich enough", "no soil test"],
    ["the hall is quiet enough for a library", "no sound reading"],
  ];
  return choiceCell(
    "CCSS.ELA.RI.8.8",
    "A claim needs evidence a reader can check.",
    claims.map(([claim, missing]) => ({
      prompt: `Read: The editorial claims ${claim}, then gives ${missing}.\n\nQuestion: What is the strongest critique?`,
      answer: "The claim lacks evidence.",
      wrong: ["Editorials cannot have claims.", "Figures are adjectives."] as [string, string],
    })),
  );
}

function verbalPhrases(): Cell {
  const phrases = [
    "Winning the match",
    "Reading the map",
    "Fixing the pump",
    "Writing the caption",
    "Checking the evidence",
    "Opening the gate",
    "Measuring the room",
    "Planting the oaks",
    "Sorting the letters",
    "Building the model",
    "Closing the trail",
    "Lighting the lamp",
  ];
  return choiceCell(
    "CCSS.ELA.L.8.1.A",
    "A gerund phrase can act as a noun.",
    phrases.map((phrase) => ({
      prompt: "Which phrase is used as a noun?",
      answer: phrase,
      wrong: ["very quickly", "under the bench"] as [string, string],
    })),
  );
}

function activeVoice(): Cell {
  const rows: [string, string, string][] = [
    ["The team", "repaired", "pump"],
    ["The curator", "labeled", "map"],
    ["The class", "tested", "water"],
    ["The city", "closed", "bridge"],
    ["The editor", "checked", "claim"],
    ["The crew", "cleared", "trail"],
    ["The jury", "heard", "case"],
    ["The scientist", "recorded", "temperature"],
    ["The council", "passed", "rule"],
    ["The author", "revised", "ending"],
    ["The gardener", "pruned", "tree"],
    ["The captain", "turned", "wheel"],
  ];
  const sizes = [rows.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, pos] = decode(index, sizes);
      const [actor, verb, object] = rows[rowIndex!]!;
      const choice = choiceStem(
        "Which sentence is in the active voice?",
        `${actor} ${verb} the ${object}.`,
        [`The ${object} was ${verb} by ${actor.toLowerCase()}.`, `The ${object} was broken.`],
        pos!,
      );
      return { ...choice, standard: "CCSS.ELA.L.8.1.B", note: "Active voice puts the actor before the verb." };
    },
  };
}

function authorsPurpose(grade: number): Cell {
  const rows: { text: string; answer: string; wrong: [string, string] }[] = [
    { text: "The speech praises sacrifice, then asks the audience to vote.", answer: "move the audience to act", wrong: ["list spelling words", "define a triangle"] },
    { text: "The poster gives the time, place, and cost of the concert.", answer: "inform the reader", wrong: ["tell a fairy tale", "solve an equation"] },
    { text: "The editorial urges the council to keep the library open.", answer: "persuade the council", wrong: ["label a diagram", "count syllables"] },
    { text: "The recipe lists ingredients and then the steps.", answer: "explain how to make something", wrong: ["compare two wars", "define a metaphor"] },
    { text: "The review warns that the bridge scene gives away the ending.", answer: "advise the reader", wrong: ["teach long division", "name a landform"] },
    { text: "The letter thanks the firefighters and asks neighbors to donate.", answer: "move readers to help", wrong: ["chart a mean", "identify a vowel"] },
    { text: "The caption tells what the 1910 photograph shows.", answer: "explain an image", wrong: ["write a rhyme", "solve for x"] },
    { text: "The pamphlet describes how to purify river water.", answer: "give instructions", wrong: ["tell a joke only", "name a pronoun"] },
    { text: "The speech recalls a promise and asks the crowd to keep it.", answer: "move the audience to act", wrong: ["list state capitals only", "define slope"] },
    { text: "The article compares two plans and recommends one.", answer: "argue for a choice", wrong: ["spell a contraction", "count tens"] },
    { text: "The journal records what the hiker saw each day.", answer: "recount events", wrong: ["advertise a sale", "solve a ratio"] },
    { text: "The warning sign tells hikers to turn back.", answer: "direct the reader", wrong: ["describe a character's childhood", "define a fraction"] },
  ];
  const band = rows.filter((_, index) => grade < 11 || index % 2 === 0).concat(grade >= 11 ? rows.slice(0, 6) : []);
  const usable = band.length >= 8 ? band : rows;
  return choiceCell(
    `CCSS.ELA.RI.${grade}.6`,
    "Purpose is what the text is trying to do to the reader.",
    usable.map((row) => ({ prompt: `Read: ${row.text}\n\nQuestion: What is the primary purpose?`, answer: row.answer, wrong: row.wrong })),
  );
}

function parallelStructure(): Cell {
  const verbs = ["read", "write", "edit", "draw", "count", "measure", "plant", "sort", "label", "check"];
  const sizes = [verbs.length, verbs.length, verbs.length];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, cIndex] = decode(index, sizes);
      const a = verbs[aIndex!]!;
      const b = verbs[bIndex!]!;
      const c = verbs[(cIndex! + 3) % verbs.length]!;
      const choice = choiceStem(
        `Which revision keeps parallel structure? to ${a}, to ${b}, and ${c}ing.`,
        `to ${a}, to ${b}, and to ${c}`,
        [`${a}ing, to ${b}, and ${c}ing`, `to ${a}, ${b}ed, ${c}`],
        (aIndex! + bIndex! + cIndex!) % 3,
      );
      return { ...choice, standard: "CCSS.ELA.L.9-10.1", note: "Parallel items share the same grammatical form." };
    },
  };
}

function theme(grade: number): Cell {
  const topics = ["friendship", "courage", "honesty", "home", "work", "change", "justice", "curiosity"];
  const claims = [
    "loyalty can cost something and still be worth it",
    "fear does not have to decide the choice",
    "telling the truth can repair a break",
    "a place becomes home through the people there",
    "careful work outlasts a shortcut",
    "change is hard and still possible",
    "fair rules protect the person with less power",
    "questions are how a person learns",
  ];
  const sizes = [topics.length, claims.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [topicIndex, claimIndex, pos] = decode(index, sizes);
      const topic = topics[topicIndex]!;
      const claim = claims[claimIndex]!;
      const choice = choiceStem(
        `A story's topic is ${topic}. Which sentence is a theme rather than only the topic?`,
        claim,
        [claims[(claimIndex! + 1) % claims.length]!, claims[(claimIndex! + 2) % claims.length]!],
        pos!,
      );
      return {
        ...choice,
        standard: `CCSS.ELA.RL.${grade}.2`,
        note: "A topic is the subject. A theme is the idea the work develops about life.",
      };
    },
  };
}

function comparingTexts(grade: number): Cell {
  const earlier = [
    ["a speech that says the town must share the well", "later writers argue about who pays for the water"],
    ["a letter that says every vote should count", "a modern essay asks who is still turned away"],
    ["a pamphlet that says the harbor belongs to the public", "a new article asks who the new docks serve"],
    ["a petition that says the school must stay open", "a board report asks which programs were cut"],
  ];
  const sizes = [earlier.length, KIDS.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, nameIndex, pos] = decode(index, sizes);
      const [first, later] = earlier[rowIndex!]!;
      const name = KIDS[nameIndex!]!;
      const choice = choiceStem(
        `Read: An earlier text is ${first}. ${name} notices that ${later}.\n\nQuestion: Why read the two texts together?`,
        "to see how a later text answers an earlier claim",
        ["to copy the fonts", "to skip the evidence"],
        pos!,
      );
      return {
        ...choice,
        standard: `CCSS.ELA.RI.${grade}.9`,
        note: "Comparing texts shows how a later argument answers an earlier one.",
      };
    },
  };
}

export function elaCell(grade: number, step: number): Cell {
  if (grade === 1) return [completeSentences, pluralNouns, verbs][step]!();
  if (grade === 2) return [capitalLetters, adjectives, contractions][step]!();
  if (grade === 3) return [readingForAReason, pronouns, pastTense][step]!();
  if (grade === 4) return [inference, prepositionalPhrases, relativeAdverbs][step]!();
  if (grade === 5) return [figurativeLanguage, compoundSentences, wordMeaning][step]!();
  if (grade === 6) return [() => evidenceFromText(6), intensivePronouns, personification][step]!();
  if (grade === 7) return [contrastSignals, connotation, dialoguePunctuation][step]!();
  if (grade === 8) return [evaluatingArgument, verbalPhrases, activeVoice][step]!();
  if (grade === 9) return [() => authorsPurpose(9), parallelStructure, () => theme(9)][step]!();
  if (grade === 10) return [() => authorsPurpose(10), parallelStructure, () => theme(10)][step]!();
  if (grade === 11) return [() => authorsPurpose(11), () => comparingTexts(11), () => theme(11)][step]!();
  const senior = [() => authorsPurpose(12), () => comparingTexts(12), () => theme(12)];
  return senior[step]!();
}
