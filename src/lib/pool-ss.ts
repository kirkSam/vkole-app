import { type Cell, choiceCell, choiceStem, decode, KIDS, span } from "./pool-shared.ts";

function facts(
  standard: string,
  note: string,
  rows: readonly { prompt: string; answer: string; wrong: readonly [string, string] }[],
): Cell {
  return choiceCell(standard, note, rows);
}

function timeOrder(): Cell {
  const pairs: [string, string][] = [
    ["Monday", "Friday"],
    ["morning", "evening"],
    ["January", "June"],
    ["a seed", "a flower"],
    ["breakfast", "dinner"],
    ["sunrise", "sunset"],
    ["spring", "summer"],
    ["today", "tomorrow"],
    ["grade 1", "grade 2"],
    ["waking up", "going to school"],
    ["planting", "harvest"],
    ["a question", "an answer"],
  ];
  const sizes = [pairs.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [pairIndex, form, pos] = decode(index, sizes);
      const [first, later] = pairs[pairIndex!]!;
      const choice =
        form === 0
          ? choiceStem(`Which comes first, ${first} or ${later}?`, first, [later, "neither"], pos!)
          : choiceStem(`Which comes later, ${first} or ${later}?`, later, [first, "a calendar square"], pos!);
      return { ...choice, standard: "HSS 1 · time", note: "Grade 1 places events in time order." };
    },
  };
}

function nationalSymbols(): Cell {
  return facts("HSS 1 · symbols", "Symbols stand for a community or a country.", [
    { prompt: "Which is a national symbol of the United States?", answer: "the flag", wrong: ["a denominator", "a pulley"] },
    { prompt: "The United States flag is recognized by which design?", answer: "stars and stripes", wrong: ["a blank circle", "a math sign"] },
    { prompt: "Which bird is a symbol of the United States?", answer: "the bald eagle", wrong: ["a goldfish", "a house cat"] },
    { prompt: "The Liberty Bell is a symbol connected with", answer: "American independence", wrong: ["a spelling rule", "a fraction"] },
    { prompt: "A national anthem is", answer: "a country's song", wrong: ["a bus route", "a verb tense"] },
    { prompt: "The Statue of Liberty stands for", answer: "freedom and welcome", wrong: ["a mountain range", "a multiplication fact"] },
    { prompt: "Which building is a symbol of the U.S. Congress?", answer: "the Capitol", wrong: ["a school gym", "a barn"] },
    { prompt: "Uncle Sam is a symbol of", answer: "the United States", wrong: ["a river delta", "a pronoun"] },
    { prompt: "Red, white, and blue are colors of", answer: "the United States flag", wrong: ["a compass only", "a food chain"] },
    { prompt: "A seal of a country is used to", answer: "mark official papers", wrong: ["replace a map", "end a sentence"] },
    { prompt: "The White House is a symbol of", answer: "the presidency", wrong: ["the Supreme Court alone", "a state park"] },
    { prompt: "Which symbol shows the country rather than one classroom?", answer: "the flag", wrong: ["a desk", "a pencil cup"] },
  ]);
}

function classroomCitizenship(): Cell {
  const rules = ["take turns", "listen when someone speaks", "keep hands to yourself", "walk in the hall", "share the supplies", "tell the truth", "help clean up", "wait for the signal"];
  const sizes = [rules.length, 3, 3];
  return {
    count: span(sizes),
    build(index) {
      const [ruleIndex, form, pos] = decode(index, sizes);
      const rule = rules[ruleIndex!]!;
      const prompts = [
        `A classroom rule to ${rule} is mainly for what?`,
        `Who is helped when the class agrees to ${rule}?`,
        `Why does a class keep a rule to ${rule}?`,
      ];
      const answers = ["keeping people safe and fair", "the whole class", "so people are safe and fair"];
      const choice = choiceStem(prompts[form]!, answers[form]!, ["hiding the calendar", "removing every question"], pos!);
      return { ...choice, standard: "HSS 1 · civics", note: "Citizenship starts with shared rules." };
    },
  };
}

function landforms(): Cell {
  const forms: [string, string][] = [
    ["hill", "raised ground, smaller than a mountain"],
    ["mountain", "very high raised ground"],
    ["valley", "low land between hills or mountains"],
    ["island", "land with water all around it"],
    ["peninsula", "land with water on three sides"],
    ["plain", "wide flat land"],
    ["desert", "a very dry place"],
    ["river", "a large stream of moving water"],
    ["coast", "where the land meets the ocean"],
    ["lake", "water surrounded by land"],
    ["canyon", "a deep narrow valley"],
    ["plateau", "high flat land"],
  ];
  const sizes = [forms.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [formIndex, wording, pos] = decode(index, sizes);
      const [name, meaning] = forms[formIndex!]!;
      const other = forms[(formIndex! + 1) % forms.length]![0];
      const third = forms[(formIndex! + 2) % forms.length]![0];
      const prompt = wording === 0 ? `Which landform is ${meaning}?` : `A place that is ${meaning} is called a`;
      const choice = choiceStem(prompt, name, [other, third], pos!);
      return { ...choice, standard: "HSS 2 · geography", note: "Landforms are shapes of the earth." };
    },
  };
}

function changeOverTime(): Cell {
  const rows: [string, string][] = [
    ["letters", "email"],
    ["horses", "cars"],
    ["candles", "electric lights"],
    ["well water", "piped water"],
    ["handwritten maps", "phones with maps"],
    ["one-room schools", "larger public schools"],
    ["walking messages", "the telephone"],
    ["wood stoves", "gas heat"],
    ["sailing ships", "steamships"],
    ["farm tools by hand", "tractors"],
  ];
  const sizes = [rows.length, KIDS.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, nameIndex, pos] = decode(index, sizes);
      const [then, now] = rows[rowIndex!]!;
      const name = KIDS[nameIndex!]!;
      const choice = choiceStem(
        `${name} compares long ago and today. People used ${then}, and later they used ${now}. What is ${name} studying?`,
        "how daily life changed",
        ["only shoe colors", "prime factors"],
        pos!,
      );
      return { ...choice, standard: "HSS 2 · history", note: "History asks what changed and what stayed." };
    },
  };
}

function producers(): Cell {
  const jobs: [string, string][] = [
    ["baker", "bread"],
    ["farmer", "vegetables"],
    ["carpenter", "chairs"],
    ["teacher", "lessons"],
    ["mechanic", "repairs"],
    ["weaver", "cloth"],
    ["potter", "bowls"],
    ["nurse", "care"],
    ["builder", "houses"],
    ["musician", "music"],
  ];
  const sizes = [jobs.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [jobIndex, form, pos] = decode(index, sizes);
      const [job, good] = jobs[jobIndex!]!;
      const choice =
        form === 0
          ? choiceStem(`A ${job} who makes ${good} is which kind of person?`, "a producer", ["a punctuation mark", "a landform"], pos!)
          : choiceStem(`Who produces ${good}?`, `a ${job}`, ["a map legend", "a verb"], pos!);
      return { ...choice, standard: "HSS 2 · economics", note: "Producers make goods or services. Consumers use them." };
    },
  };
}

function localGovernment(): Cell {
  const services = ["streets", "parks", "libraries", "water pipes", "fire protection", "trash collection", "crosswalks", "city halls"];
  const sizes = [services.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [serviceIndex, pos] = decode(index, sizes);
      const service = services[serviceIndex!]!;
      const choice = choiceStem(
        `Which level of government most directly handles a city's ${service}?`,
        "local government",
        ["the moon's orbit", "a verb tense"],
        pos!,
      );
      return { ...choice, standard: "HSS 3 · local government", note: "Local government handles city and town services." };
    },
  };
}

function mapDirections(): Cell {
  const rows: [string, string][] = [
    ["sunrise", "east"],
    ["sunset", "west"],
    ["the top of many maps", "north"],
    ["the bottom of many maps", "south"],
    ["a compass rose", "directions"],
    ["the needle that points north", "a compass"],
    ["blue on many maps", "water"],
    ["a line that shows how far", "the scale"],
  ];
  const sizes = [rows.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, form, pos] = decode(index, sizes);
      const [clue, answer] = rows[rowIndex!]!;
      const prompt = form === 0 ? `On a map, ${clue} helps you find which idea?` : `Which map tool or direction matches this clue: ${clue}?`;
      const choice = choiceStem(prompt, answer, ["a rhyme", "a pronoun"], pos!);
      return { ...choice, standard: "HSS 3 · map skills", note: "Directions and symbols orient a map." };
    },
  };
}

function primarySources(): Cell {
  const primary = [
    "a letter written by a settler in 1850",
    "a diary from a Gold Rush miner",
    "a photograph taken in 1906",
    "a speech given by the person who lived it",
    "an official census page from the year being studied",
    "a tool made and used at the time",
    "a newspaper printed the week of the event",
    "a map drawn by someone who was there",
  ];
  const secondary = ["a textbook chapter from this year", "a movie made last summer", "an encyclopedia summary", "a classroom poster"];
  const sizes = [primary.length, secondary.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [primaryIndex, secondaryIndex, pos] = decode(index, sizes);
      const choice = choiceStem(
        "Which source is primary?",
        primary[primaryIndex]!,
        [secondary[secondaryIndex]!, secondary[(secondaryIndex! + 1) % secondary.length]!],
        pos!,
      );
      return { ...choice, standard: "CCSS.ELA.RH.6-8.1", note: "A primary source comes from the time under study." };
    },
  };
}

function californiaPlace(): Cell {
  const features = ["ports", "trade", "migration", "fishing", "ship routes", "coastal cities"];
  const sizes = [features.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [featureIndex, form, pos] = decode(index, sizes);
      const feature = features[featureIndex!]!;
      const prompt =
        form === 0
          ? `California's place on the Pacific shaped its history through ${feature}. Which ocean is that coast?`
          : `Which idea best explains why Pacific ${feature} mattered to California?`;
      const answer = form === 0 ? "the Pacific Ocean" : "trade, migration, and ports";
      const choice = choiceStem(prompt, answer, ["it has no coastline", "it is east of Maine"], pos!);
      return { ...choice, standard: "HSS 4 · California", note: "California history ties the Pacific coast to settlement and economy." };
    },
  };
}

function goldRush(): Cell {
  const years = [1848, 1849, 1850, 1851, 1852, 1853];
  const groups = ["miners", "merchants", "farm families", "sailors", "shopkeepers", "builders"];
  const sizes = [years.length, groups.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [yearIndex, groupIndex, pos] = decode(index, sizes);
      const year = years[yearIndex]!;
      const group = groups[groupIndex]!;
      const choice = choiceStem(
        `In ${year}, ${group} arrived in California seeking gold. Why did the population grow?`,
        "people came seeking gold",
        ["maps were banned", "farming was made illegal"],
        pos!,
      );
      return { ...choice, standard: "HSS 4.3", note: "The Gold Rush brought a large migration to California." };
    },
  };
}

function stateConstitution(): Cell {
  return facts("HSS 4 · government", "A constitution sets basic law and allocates powers.", [
    { prompt: "A state constitution sets", answer: "basic law for the state", wrong: ["today's weather", "a poem's meter"] },
    { prompt: "Which document is the basic law of a state?", answer: "the state constitution", wrong: ["a lunch menu", "a bus pass"] },
    { prompt: "A constitution limits government by", answer: "writing powers and rights", wrong: ["erasing all courts", "ending maps"] },
    { prompt: "Rights listed in a constitution are meant to", answer: "protect people", wrong: ["replace addition", "name every hill"] },
    { prompt: "Who does a state constitution govern?", answer: "that state", wrong: ["only one classroom", "the ocean tides"] },
    { prompt: "Changing a constitution usually requires", answer: "a formal amendment", wrong: ["a whispered rumor", "a new font"] },
    { prompt: "A constitution is higher than", answer: "an ordinary statute", wrong: ["a mountain", "a verb"] },
    { prompt: "State government gets its plan of powers from", answer: "the state constitution", wrong: ["a weather report", "a rhyme"] },
    { prompt: "Which is a job of a constitution?", answer: "to say who has which powers", wrong: ["to predict rain", "to list synonyms"] },
    { prompt: "A bill of rights inside a constitution lists", answer: "protections for people", wrong: ["only shoe sizes", "only fractions"] },
    { prompt: "Judges look to the constitution when they ask", answer: "whether a law fits the basic law", wrong: ["what rhyme to use", "how tall a hill is"] },
    { prompt: "California, like other states, has", answer: "its own constitution", wrong: ["no laws at all", "only a song"] },
  ]);
}

function declaration(): Cell {
  return facts("HSS 5 · Revolution", "The Declaration says governments get their just powers from the consent of the governed.", [
    { prompt: "The Declaration of Independence says governments derive their just powers from", answer: "the consent of the governed", wrong: ["ocean tides", "spelling rules"] },
    { prompt: "Which document declared the colonies independent?", answer: "the Declaration of Independence", wrong: ["the Magna Carta", "a city map"] },
    { prompt: "The Declaration lists complaints against", answer: "the king", wrong: ["a school bell", "a fraction"] },
    { prompt: "Unalienable rights in the Declaration include", answer: "life, liberty, and the pursuit of happiness", wrong: ["only landforms", "only verbs"] },
    { prompt: "The Declaration argues that people may change a government that", answer: "destroys their rights", wrong: ["prints maps", "teaches rhymes"] },
    { prompt: "Who is named as the author most associated with the draft?", answer: "Thomas Jefferson", wrong: ["a river", "a pronoun"] },
    { prompt: "The Declaration was addressed, in part, so the world would", answer: "know the reasons for independence", wrong: ["learn a times table", "name cloud types"] },
    { prompt: "Consent of the governed means power comes from", answer: "the people", wrong: ["a single household only", "the tides"] },
    { prompt: "Which year is the Declaration associated with?", answer: "1776", wrong: ["1492", "1945"] },
    { prompt: "The Declaration is a statement of", answer: "independence", wrong: ["a state lunch menu", "a geometry proof"] },
    { prompt: "A government that gets its powers from the people is based on", answer: "consent", wrong: ["rhyme", "elevation"] },
    { prompt: "The Declaration says all men are created", answer: "equal", wrong: ["as map symbols", "as verbs"] },
  ]);
}

function revolutionaryWar(): Cell {
  return facts("HSS 5.6", "The Revolutionary War came before the Constitution was written.", [
    { prompt: "Which war came before the Constitution was written?", answer: "the American Revolutionary War", wrong: ["World War II", "the Civil War"] },
    { prompt: "The Revolutionary War was fought between the colonies and", answer: "Great Britain", wrong: ["California", "the Moon"] },
    { prompt: "The war for independence ended before", answer: "the Constitution was written", wrong: ["any ships existed", "maps were invented"] },
    { prompt: "A patriot in that war supported", answer: "independence", wrong: ["erasing all towns", "ending numbers"] },
    { prompt: "Yorktown is remembered as", answer: "a decisive American victory", wrong: ["the first Moon landing", "a gold discovery"] },
    { prompt: "The French alliance mattered because it", answer: "aided the American side", wrong: ["banned farming", "removed the ocean"] },
    { prompt: "Valley Forge is remembered for", answer: "a hard winter for the army", wrong: ["a spelling bee", "a new fraction"] },
    { prompt: "The Treaty of Paris in 1783", answer: "recognized American independence", wrong: ["founded Rome", "invented the telephone"] },
    { prompt: "George Washington commanded", answer: "the Continental Army", wrong: ["the Supreme Court in 1776", "a railroad"] },
    { prompt: "The war began after protests about", answer: "British taxes and rule", wrong: ["internet speeds", "airplane routes"] },
    { prompt: "Independence Day marks", answer: "the Declaration in 1776", wrong: ["the Gold Rush", "statehood for Hawaii"] },
    { prompt: "Which came first?", answer: "the Revolutionary War", wrong: ["the Civil War", "World War I"] },
  ]);
}

function greatCompromise(): Cell {
  return facts("HSS 5.7", "The Great Compromise created two houses of Congress.", [
    { prompt: "The Great Compromise gave large and small states", answer: "representation in two houses of Congress", wrong: ["no courts at all", "only one branch"] },
    { prompt: "In the House, representation is based on", answer: "population", wrong: ["the alphabet", "rainfall"] },
    { prompt: "In the Senate, each state gets", answer: "equal representation", wrong: ["no votes", "a king"] },
    { prompt: "The compromise was made at", answer: "the Constitutional Convention", wrong: ["the Gold Rush", "a spelling class"] },
    { prompt: "Large states had wanted representation based on", answer: "population", wrong: ["shoe size", "cloud type"] },
    { prompt: "Small states feared a Congress based only on population because", answer: "they would have little voice", wrong: ["maps would vanish", "verbs would change"] },
    { prompt: "Two houses of Congress means the legislature is", answer: "bicameral", wrong: ["a single person", "a landform"] },
    { prompt: "The Great Compromise is also called", answer: "the Connecticut Compromise", wrong: ["the Missouri Compromise", "the Lunch Compromise"] },
    { prompt: "Which branch did the compromise organize?", answer: "the legislative branch", wrong: ["the weather service", "the post office only"] },
    { prompt: "A bill generally must pass", answer: "both houses", wrong: ["neither house", "only a classroom"] },
    { prompt: "The compromise let the convention", answer: "keep writing the Constitution", wrong: ["cancel all states", "ban elections"] },
    { prompt: "Equal votes in the Senate protect", answer: "smaller states", wrong: ["only rivers", "only nouns"] },
  ]);
}

function riverCivilizations(): Cell {
  const rivers = ["the Nile", "the Tigris", "the Euphrates", "the Indus", "the Huang He", "the Yangtze"];
  const gifts = ["water", "soil", "transport", "food", "trade"];
  const sizes = [rivers.length, gifts.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [riverIndex, giftIndex, pos] = decode(index, sizes);
      const river = rivers[riverIndex]!;
      const gift = gifts[giftIndex]!;
      const choice = choiceStem(
        `Ancient communities along ${river} often grew there because the river provided ${gift}. What did the river supply?`,
        gift,
        ["printed newspapers", "electric grids"],
        pos!,
      );
      return { ...choice, standard: "HSS 6 · ancient civilizations", note: "Early civilizations grew where rivers supplied water, soil, and transport." };
    },
  };
}

function athens(): Cell {
  return facts("HSS 6.4", "Athens is studied as an early example of citizen participation.", [
    { prompt: "Athens is studied as an early example of", answer: "citizen participation in government", wrong: ["a modern freeway", "a satellite"] },
    { prompt: "A citizen assembly in Athens let some people", answer: "speak and vote on public matters", wrong: ["ban all maps", "erase numbers"] },
    { prompt: "Athens is a city in", answer: "Greece", wrong: ["California", "the Arctic"] },
    { prompt: "Sparta is often compared with Athens by", answer: "its form of government and training", wrong: ["its airports", "its subways"] },
    { prompt: "Democracy in Athens was limited because", answer: "many people, including women and enslaved people, could not vote", wrong: ["the city had no people", "voting had not been invented anywhere later"] },
    { prompt: "A polis is", answer: "a Greek city-state", wrong: ["a math sign", "a cloud"] },
    { prompt: "The Acropolis is", answer: "the high fortified part of Athens", wrong: ["a river in California", "a Senate desk"] },
    { prompt: "Pericles is associated with", answer: "Athenian democracy and building", wrong: ["the telephone", "the Gold Rush"] },
    { prompt: "Direct participation means citizens", answer: "vote on decisions themselves", wrong: ["never meet", "only draw maps"] },
    { prompt: "Athens's navy mattered because the city", answer: "depended on the sea", wrong: ["had no coast", "banned boats"] },
    { prompt: "Philosophy in Athens included people asking", answer: "how a person should live and how a city should be ruled", wrong: ["only today's temperature", "only shoe prices"] },
    { prompt: "Comparing Athens and Sparta teaches", answer: "city-states can organize power differently", wrong: ["all cities are identical", "history has one costume"] },
  ]);
}

function historicalMaps(): Cell {
  const topics = ["an empire's borders", "a battle's movement", "a migration route", "a trade road", "a city's growth", "a colony's claims"];
  const sizes = [topics.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [topicIndex, form, pos] = decode(index, sizes);
      const topic = topics[topicIndex]!;
      const prompt =
        form === 0
          ? `A historical map of ${topic} emphasizes which idea?`
          : `How is a historical map of ${topic} different from a map that shows only elevation?`;
      const choice = choiceStem(prompt, "events, places, or change over time", ["only today's temperature", "only rhyme"], pos!);
      return { ...choice, standard: "HSS 6 · geography", note: "Historical maps show place together with time." };
    },
  };
}

function tradeRoutes(): Cell {
  const routes = ["the Silk Road", "Indian Ocean routes", "Mediterranean sea lanes", "Sahara caravan routes", "North Sea routes"];
  const goods = ["silk", "spices", "gold", "ideas", "disease", "tools"];
  const sizes = [routes.length, goods.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [routeIndex, goodIndex, pos] = decode(index, sizes);
      const choice = choiceStem(
        `${routes[routeIndex]} moved ${goods[goodIndex]} between regions. Why did that route matter?`,
        "it moved goods, ideas, and sometimes disease",
        ["it moved only consonants", "it moved only integers"],
        pos!,
      );
      return { ...choice, standard: "HSS 7 · world history", note: "Trade routes connected regions across Afro-Eurasia." };
    },
  };
}

function magnaCarta(): Cell {
  return facts("HSS 7 · rights", "The Magna Carta limited the arbitrary power of the king and influenced later rights documents.", [
    { prompt: "The Magna Carta limited", answer: "the arbitrary power of the king", wrong: ["the boiling point of water", "pi"] },
    { prompt: "The Magna Carta was agreed to in", answer: "England", wrong: ["California", "Athens's harbor only"] },
    { prompt: "A lasting idea from the Magna Carta is that a ruler is", answer: "subject to the law", wrong: ["above every law", "a landform"] },
    { prompt: "Later rights documents looked back to it because it", answer: "put limits in writing", wrong: ["canceled all writing", "invented steam"] },
    { prompt: "Which year is the Magna Carta associated with?", answer: "1215", wrong: ["1776", "1848"] },
    { prompt: "The barons pressed the king to", answer: "accept written limits", wrong: ["ban all farms", "end the ocean"] },
    { prompt: "Rule of law means", answer: "even a ruler must follow the law", wrong: ["only rhyme matters", "maps replace courts"] },
    { prompt: "The Magna Carta is a source for the idea of", answer: "rights against arbitrary power", wrong: ["decimal place value", "photosynthesis"] },
    { prompt: "It did not give the vote to", answer: "every person in England", wrong: ["any later reader", "the paper it was written on"] },
    { prompt: "A charter is", answer: "a written grant or agreement", wrong: ["a cloud type", "a verb mood"] },
    { prompt: "King John is the ruler connected with", answer: "the Magna Carta", wrong: ["the California Gold Rush", "the Moon landing"] },
    { prompt: "Putting a promise in a document lets later people", answer: "point to the words", wrong: ["forget every law", "skip evidence"] },
  ]);
}

function reformation(): Cell {
  return facts("HSS 7.9", "The Reformation was a dispute over church authority and practice that reshaped European states.", [
    { prompt: "A cause of the Reformation was dispute over", answer: "church authority and practice", wrong: ["railroad gauges", "binary code"] },
    { prompt: "Martin Luther is associated with", answer: "the start of the Protestant Reformation", wrong: ["the telephone", "the California missions only"] },
    { prompt: "The Reformation divided western Christianity into", answer: "Catholic and Protestant churches", wrong: ["maps and verbs", "oceans and hills"] },
    { prompt: "Printing mattered to the Reformation because it", answer: "spread arguments quickly", wrong: ["erased all books", "ended reading"] },
    { prompt: "Indulgences were controversial because critics said", answer: "forgiveness was being sold", wrong: ["they were landforms", "they were fractions"] },
    { prompt: "A Protestant church is one that", answer: "broke with the pope's authority", wrong: ["is a mountain", "is a pronoun"] },
    { prompt: "The Reformation changed states because rulers chose", answer: "which church to support", wrong: ["to ban weather", "to end farming"] },
    { prompt: "Scripture translated into local languages let more people", answer: "read religious arguments themselves", wrong: ["skip every text", "replace maps"] },
    { prompt: "Religious wars after the Reformation show that the dispute", answer: "reached governments, not only churches", wrong: ["never left one classroom", "was only about shoe color"] },
    { prompt: "The Ninety-Five Theses are", answer: "Luther's published objections", wrong: ["a California law", "a geometry set"] },
    { prompt: "The Catholic Reformation was", answer: "the Catholic Church's response", wrong: ["a new ocean", "a math operation"] },
    { prompt: "Studying the Reformation means asking", answer: "how belief and political power changed together", wrong: ["only how to round a number", "only how a compass points"] },
  ]);
}

function separationOfPowers(): Cell {
  const branches: [string, string][] = [
    ["legislative branch", "makes the laws"],
    ["executive branch", "carries out the laws"],
    ["judicial branch", "decides what the laws mean"],
  ];
  const scenes = ["a statute", "a veto", "a court case", "a tax", "a treaty", "a hearing"];
  const sizes = [branches.length, scenes.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [branchIndex, sceneIndex, pos] = decode(index, sizes);
      const [name, does] = branches[branchIndex!]!;
      const choice = choiceStem(
        `Which branch ${does} when the matter is ${scenes[sceneIndex]}?`,
        name,
        branches.filter((_, item) => item !== branchIndex).map((item) => item[0]) as [string, string],
        pos!,
      );
      return {
        ...choice,
        standard: "HSS 8 · Constitution",
        note: "Separation of powers keeps lawmaking, executing, and judging in different branches.",
      };
    },
  };
}

function civilWar(): Cell {
  return facts("HSS 8.10", "The Civil War's central conflict included union, slavery, and federal power.", [
    { prompt: "The Civil War's central conflict included", answer: "union, slavery, and federal power", wrong: ["the shape of sonnets", "decimal place value"] },
    { prompt: "The Union fought to", answer: "keep the United States together", wrong: ["found Athens", "invent the airplane"] },
    { prompt: "The Confederacy formed from", answer: "southern states that seceded", wrong: ["Canadian provinces", "Greek city-states"] },
    { prompt: "Slavery was", answer: "a central cause of the war", wrong: ["unrelated to the war", "a map symbol only"] },
    { prompt: "The Emancipation Proclamation", answer: "declared enslaved people free in rebelling areas", wrong: ["founded Jamestown", "wrote the Magna Carta"] },
    { prompt: "Abraham Lincoln was", answer: "president of the United States during the war", wrong: ["king of England", "a Gold Rush miner"] },
    { prompt: "Gettysburg is remembered as", answer: "a major battle and a famous address", wrong: ["a California port", "a Greek temple"] },
    { prompt: "The Thirteenth Amendment", answer: "abolished slavery", wrong: ["created the Gold Rush", "invented the Senate"] },
    { prompt: "Secession means", answer: "leaving the union", wrong: ["adding a fraction", "drawing a compass rose"] },
    { prompt: "A result of the Union victory was", answer: "the nation remained united and slavery ended in law", wrong: ["the Constitution was erased", "California left the Pacific"] },
    { prompt: "Fort Sumter is associated with", answer: "the start of the fighting", wrong: ["the Moon landing", "the Reformation"] },
    { prompt: "Federal power after the war was argued in", answer: "Reconstruction", wrong: ["ancient Athens", "the Silk Road"] },
  ]);
}

function reconstruction(): Cell {
  return facts("HSS 8.11", "Reconstruction was the period of rejoining the nation and defining rights after the Civil War.", [
    { prompt: "Reconstruction refers to the period of", answer: "rejoining the nation and defining rights after the Civil War", wrong: ["building the pyramids", "the Moon landing"] },
    { prompt: "The Thirteenth Amendment", answer: "abolished slavery", wrong: ["started the Gold Rush", "wrote the Declaration"] },
    { prompt: "The Fourteenth Amendment", answer: "addressed citizenship and equal protection", wrong: ["named a landform", "set a times table"] },
    { prompt: "The Fifteenth Amendment", answer: "addressed voting rights for Black men", wrong: ["ended all elections", "closed the Senate"] },
    { prompt: "The Freedmen's Bureau helped", answer: "formerly enslaved people with practical needs", wrong: ["only railroad owners in 1848", "only Greek sailors"] },
    { prompt: "Black Codes were", answer: "laws that tried to restrict freedpeople", wrong: ["a kind of map scale", "a poetry form"] },
    { prompt: "Sharecropping often left farmers", answer: "in debt and dependent", wrong: ["in the Senate automatically", "outside history"] },
    { prompt: "Reconstruction governments in the South included", answer: "Black officeholders for a time", wrong: ["no voters at all", "only kings"] },
    { prompt: "The Compromise of 1877 is tied to", answer: "the end of Reconstruction", wrong: ["the start of Athens", "the Magna Carta"] },
    { prompt: "A constitutional amendment is", answer: "a formal change to the Constitution", wrong: ["a weather forecast", "a fraction"] },
    { prompt: "Equal protection means a state should not", answer: "deny people the equal protection of the laws", wrong: ["print any map", "teach reading"] },
    { prompt: "Studying Reconstruction means asking", answer: "whose rights the reunited nation would protect", wrong: ["how to round 27", "which vowel is first"] },
  ]);
}

function judicialBranch(): Cell {
  const matters = ["a statute", "an executive order", "a state law", "a search", "a school rule challenged in court", "a federal regulation"];
  const sizes = [matters.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [matterIndex, form, pos] = decode(index, sizes);
      const matter = matters[matterIndex]!;
      const prompt =
        form === 0
          ? `Which branch interprets whether ${matter} fits the Constitution?`
          : `If the question is what ${matter} means under the Constitution, which branch decides?`;
      const choice = choiceStem(prompt, "the judicial branch", ["the postal service", "a school bell schedule"], pos!);
      return { ...choice, standard: "HSS 12 · government", note: "The judicial branch interprets the law, including whether it fits the Constitution." };
    },
  };
}

function elections(): Cell {
  return facts("HSS 12.3", "Elections fill offices. House terms are two years, so a midterm falls between presidential elections.", [
    { prompt: "A midterm election fills", answer: "seats in Congress between presidential elections", wrong: ["only the Supreme Court", "only city trash routes"] },
    { prompt: "Members of the House of Representatives serve", answer: "two-year terms", wrong: ["life terms", "twenty-year terms"] },
    { prompt: "A presidential election is held every", answer: "four years", wrong: ["year", "twenty years"] },
    { prompt: "Senators serve", answer: "six-year terms", wrong: ["one-week terms", "life terms by the original Constitution"] },
    { prompt: "The candidate who wins an election is chosen by", answer: "the voters under the election rules", wrong: ["a coin toss in every race", "the loudest headline"] },
    { prompt: "A ballot is", answer: "the way a voter records a choice", wrong: ["a landform", "a verb tense"] },
    { prompt: "Voter registration is used to", answer: "check who is eligible to vote", wrong: ["replace the Constitution", "measure rainfall"] },
    { prompt: "A primary election", answer: "helps a party choose its nominee", wrong: ["amends the Constitution by itself", "appoints judges for life"] },
    { prompt: "Congressional elections matter because Congress", answer: "makes federal law", wrong: ["commands the tides", "edits dictionaries only"] },
    { prompt: "An incumbent is", answer: "the person who already holds the office", wrong: ["a map scale", "a new voter automatically"] },
    { prompt: "Turnout means", answer: "how many eligible people vote", wrong: ["how loud a speech is", "how many hills a state has"] },
    { prompt: "A free election requires", answer: "a real choice and a count people can trust", wrong: ["a single name on the ballot by rule", "no record of the count"] },
  ]);
}

function opportunityCost(): Cell {
  const choices: [string, string, string][] = [
    ["an hour of study", "an hour of practice", "the practice given up"],
    ["buying a book", "buying a ticket", "the ticket given up"],
    ["saving the dollar", "spending the dollar", "what the dollar would have bought"],
    ["a public park", "a parking lot on the same land", "the park given up"],
    ["a year of work", "a year of school", "the wages given up"],
    ["repairing the bridge", "building a new pool with the same funds", "the pool given up"],
  ];
  const sizes = [choices.length, KIDS.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [choiceIndex, nameIndex, pos] = decode(index, sizes);
      const [pick, other, cost] = choices[choiceIndex!]!;
      const name = KIDS[nameIndex!]!;
      const choice = choiceStem(
        `${name} chooses ${pick} instead of ${other}. The opportunity cost is`,
        cost,
        ["the price tag only", "a map scale"],
        pos!,
      );
      return { ...choice, standard: "HSS 12 economics", note: "Opportunity cost is the next best alternative given up." };
    },
  };
}

function federalism(): Cell {
  const national = ["printing money", "declaring war", "making treaties", "regulating interstate commerce"];
  const state = ["running public schools", "issuing marriage licenses", "setting many traffic rules", "drawing local districts under state law"];
  const shared = ["collecting taxes", "building roads", "enforcing laws", "protecting public health"];
  const rows: { prompt: string; answer: string }[] = [
    ...national.map((item) => ({ prompt: `Who has the main power of ${item}?`, answer: "the national government" })),
    ...state.map((item) => ({ prompt: `Who has the main power of ${item}?`, answer: "state governments" })),
    ...shared.map((item) => ({ prompt: `Collecting or doing ${item} is often`, answer: "shared by national and state governments" })),
  ];
  const sizes = [rows.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [rowIndex, pos] = decode(index, sizes);
      const row = rows[rowIndex!]!;
      const choice = choiceStem(row.prompt, row.answer, ["nouns and verbs", "oceans and commas"], pos!);
      return { ...choice, standard: "HSS 12.1", note: "Federalism divides authority between national and state governments." };
    },
  };
}

function trade(): Cell {
  const goods = ["wheat", "cars", "lumber", "software", "medicine", "aircraft", "fruit", "steel"];
  const countries = ["Canada", "Mexico", "Japan", "Germany", "Brazil", "Kenya"];
  const sizes = [goods.length, countries.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [goodIndex, countryIndex, form, pos] = decode(index, sizes);
      const good = goods[goodIndex]!;
      const country = countries[countryIndex]!;
      const prompt =
        form === 0
          ? `The United States sells ${good} to buyers in ${country}. That sale is`
          : `${country} sells ${good} to buyers in the United States. For the United States, that good is`;
      const answer = form === 0 ? "an export" : "an import";
      const choice = choiceStem(prompt, answer, ["a pronoun", "a landform"], pos!);
      return { ...choice, standard: "HSS 12 economics", note: "Exports are sold to another country. Imports are bought from another country." };
    },
  };
}

function evidenceInHistory(): Cell {
  const claims = [
    "a diary from a witness",
    "a government record from that year",
    "a photograph of the event",
    "a letter between the people involved",
    "a newspaper printed that week",
    "a treaty text",
    "a census table",
    "an object used at the time",
  ];
  const sizes = [claims.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [claimIndex, form, pos] = decode(index, sizes);
      const source = claims[claimIndex]!;
      const prompt =
        form === 0
          ? `A historical claim that cites ${source} is stronger because the reader can`
          : `Which source lets a reader check a claim about the past: ${source}, or an unnamed rumor?`;
      const answer = form === 0 ? "check the source" : source;
      const choice = choiceStem(prompt, answer, ["trust a feeling only", "an unnamed everyone"], pos!);
      return { ...choice, standard: "CCSS.ELA.RH.11-12.1", note: "A credible historical claim cites sources a reader can check." };
    },
  };
}

export function ssCell(grade: number, step: number): Cell {
  const ladder: Record<number, [() => Cell, () => Cell, () => Cell]> = {
    1: [timeOrder, nationalSymbols, classroomCitizenship],
    2: [landforms, changeOverTime, producers],
    3: [localGovernment, mapDirections, primarySources],
    4: [californiaPlace, goldRush, stateConstitution],
    5: [declaration, revolutionaryWar, greatCompromise],
    6: [riverCivilizations, athens, historicalMaps],
    7: [tradeRoutes, magnaCarta, reformation],
    8: [separationOfPowers, civilWar, reconstruction],
    9: [judicialBranch, elections, opportunityCost],
    10: [judicialBranch, federalism, trade],
    11: [evidenceInHistory, federalism, trade],
    12: [evidenceInHistory, federalism, trade],
  };
  const row = ladder[grade] ?? ladder[1]!;
  return row[step]!();
}
