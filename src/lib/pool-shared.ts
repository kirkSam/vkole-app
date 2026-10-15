export type Built = {
  stem: string;
  answer: string;
  aliases?: string[];
  standard: string;
  note: string;
};

export type Cell = {
  count: number;
  build: (index: number) => Built;
};

export function decode(index: number, sizes: readonly number[]): number[] {
  const out: number[] = [];
  let n = index;
  for (const size of sizes) {
    out.push(n % size);
    n = Math.floor(n / size);
  }
  return out;
}

export function span(sizes: readonly number[]): number {
  return sizes.reduce((total, size) => total * size, 1);
}

export const KIDS = ["Mia", "Jonah", "Priya", "Luis", "Ava", "Noah", "Sofia", "Omar", "Hana", "Leo"] as const;

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
] as const;

export function numberAliases(value: number): string[] {
  if (!Number.isInteger(value) || value < -20 || value > 20) return [];
  if (value < 0) return [`negative ${ONES[-value]}`];
  return [ONES[value]!];
}

export function choiceStem(intro: string, correct: string, wrongs: readonly string[], pos: number): { stem: string; answer: string; aliases: string[] } {
  const letters = ["A", "B", "C"] as const;
  const slot = ((pos % 3) + 3) % 3;
  const list = wrongs ?? [];
  const first = list[0] ?? "none of these";
  const second = list[1] && list[1] !== first ? list[1] : `${first} today`;
  const shown = ["", "", ""];
  let wrongAt = 0;
  const wrongList = [first, second];
  for (let place = 0; place < 3; place += 1) {
    if (place === slot) shown[place] = correct;
    else shown[place] = wrongList[wrongAt++]!;
  }
  return {
    stem: `${intro}\nA. ${shown[0]}\nB. ${shown[1]}\nC. ${shown[2]}\nWrite A, B, or C.`,
    answer: letters[slot]!,
    aliases: [shown[slot]!],
  };
}

export function choiceCell(standard: string, note: string, facts: readonly { prompt: string; answer: string; wrong: readonly [string, string]; aliases?: string[] }[]): Cell {
  const prefixes = ["", "Choose the best answer.\n"];
  const sizes = [facts.length, prefixes.length, 3];
  return {
    count: span(sizes),
    build(index) {
      const [factIndex, prefixIndex, pos] = decode(index, sizes);
      const fact = facts[factIndex]!;
      const choice = choiceStem(`${prefixes[prefixIndex]}${fact.prompt}`, fact.answer, fact.wrong, pos!);
      return {
        stem: choice.stem,
        answer: choice.answer,
        aliases: [...choice.aliases, ...(fact.aliases ?? [])],
        standard,
        note,
      };
    },
  };
}
