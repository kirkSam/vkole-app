import { type Cell, decode, KIDS, numberAliases, span } from "./pool-shared.ts";

function whole(value: number, standard: string, note: string, stem: string): ReturnType<Cell["build"]> {
  return {
    stem,
    answer: String(value),
    aliases: numberAliases(value),
    standard,
    note,
  };
}

function addingWithin20(): Cell {
  const equations = 12 * 8;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      if (index < equations) {
        const a = 1 + (index % 12);
        const b = 1 + Math.floor(index / 12);
        return whole(a + b, "CCSS.MATH.1.OA.C.6", "Grade 1 adds within 20 by joining two groups.", `${a} + ${b} = ?`);
      }
      const inner = index - equations;
      const a = 1 + (inner % 12);
      const b = 1 + (Math.floor(inner / 12) % 8);
      const name = KIDS[Math.floor(inner / 96) % KIDS.length]!;
      return whole(
        a + b,
        "CCSS.MATH.1.OA.C.6",
        "Grade 1 adds within 20 by joining two groups.",
        `${name} has ${a} apples and gets ${b} more. How many apples does ${name} have now?`,
      );
    },
  };
}

function subtractingWithin20(): Cell {
  const equations = 11 * 7;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      if (index < equations) {
        const a = 8 + (index % 11);
        const b = 1 + Math.floor(index / 11);
        return whole(a - b, "CCSS.MATH.1.OA.C.6", "Subtraction within 20 takes some away from the total.", `${a} - ${b} = ?`);
      }
      const inner = index - equations;
      const a = 8 + (inner % 11);
      const b = 1 + (Math.floor(inner / 11) % 7);
      const name = KIDS[Math.floor(inner / 77) % KIDS.length]!;
      return whole(
        a - b,
        "CCSS.MATH.1.OA.C.6",
        "Subtraction within 20 takes some away from the total.",
        `${name} has ${a} stickers and gives away ${b}. How many stickers are left?`,
      );
    },
  };
}

function tensAndOnes(): Cell {
  const sizes = [9, 10, 3];
  return {
    count: span(sizes),
    build(index) {
      const [tenIndex, oneIndex, form] = decode(index, sizes);
      const tens = (1 + tenIndex!) * 10;
      const ones = oneIndex!;
      const value = tens + ones;
      if (form === 1) {
        return whole(tens / 10, "CCSS.MATH.1.NBT.B.2", "A two-digit number is made of tens and ones.", `How many tens are in ${value}?`);
      }
      if (form === 2) {
        return whole(ones, "CCSS.MATH.1.NBT.B.2", "A two-digit number is made of tens and ones.", `How many ones are in ${value}?`);
      }
      return whole(value, "CCSS.MATH.1.NBT.B.2", "A two-digit number is made of tens and ones.", `What number is ${tens} + ${ones}?`);
    },
  };
}

function addingWithin100(): Cell {
  const sizes = [61, 31, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, form] = decode(index, sizes);
      const a = 20 + aIndex!;
      const b = 10 + bIndex!;
      const name = KIDS[(a + b) % KIDS.length]!;
      const stem = form === 0 ? `${a} + ${b} = ?` : `${name} counts ${a} and then ${b} more. What is the total?`;
      return whole(a + b, "CCSS.MATH.2.NBT.B.5", "Grade 2 adds within 100 using tens and ones.", stem);
    },
  };
}

function subtractingWithin100(): Cell {
  const sizes = [60, 21, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, form] = decode(index, sizes);
      const a = 40 + aIndex!;
      const b = 10 + bIndex!;
      const name = KIDS[a % KIDS.length]!;
      const stem = form === 0 ? `${a} - ${b} = ?` : `${name} has ${a} cards and uses ${b} of them. How many cards are left?`;
      return whole(a - b, "CCSS.MATH.2.NBT.B.5", "Subtract within 100 by taking away tens and ones.", stem);
    },
  };
}

function hundredsTensOnes(): Cell {
  const sizes = [800, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nIndex, form] = decode(index, sizes);
      const n = 100 + nIndex!;
      const hundreds = Math.floor(n / 100);
      const tens = Math.floor(n / 10) % 10;
      const ones = n % 10;
      const note = "A three-digit number is hundreds, tens, and ones.";
      if (form === 1) return whole(tens, "CCSS.MATH.2.NBT.A.1", note, `Which digit is in the tens place of ${n}?`);
      if (form === 2) return whole(ones, "CCSS.MATH.2.NBT.A.1", note, `Which digit is in the ones place of ${n}?`);
      return whole(hundreds, "CCSS.MATH.2.NBT.A.1", note, `Which digit is in the hundreds place of ${n}?`);
    },
  };
}

function multiplication(): Cell {
  const equations = 8 * 8;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      const note = "Multiplication joins equal groups.";
      if (index < equations) {
        const a = 2 + (index % 8);
        const b = 2 + Math.floor(index / 8);
        return whole(a * b, "CCSS.MATH.3.OA.A.1", note, `${a} × ${b} = ?`);
      }
      const inner = index - equations;
      const a = 2 + (inner % 8);
      const b = 2 + (Math.floor(inner / 8) % 8);
      const name = KIDS[Math.floor(inner / 64) % KIDS.length]!;
      return whole(a * b, "CCSS.MATH.3.OA.A.1", note, `${name} has ${a} groups of ${b}. How many are there in all?`);
    },
  };
}

function division(): Cell {
  const equations = 8 * 8;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      const note = "Division shares a total into equal groups.";
      const from = (slot: number) => {
        const divisor = 2 + (slot % 8);
        const quotient = 2 + Math.floor(slot / 8);
        return { divisor, quotient, total: divisor * quotient };
      };
      if (index < equations) {
        const item = from(index);
        return whole(item.quotient, "CCSS.MATH.3.OA.A.2", note, `${item.total} ÷ ${item.divisor} = ?`);
      }
      const inner = index - equations;
      const item = from(inner % equations);
      const name = KIDS[Math.floor(inner / equations) % KIDS.length]!;
      return whole(
        item.quotient,
        "CCSS.MATH.3.OA.A.2",
        note,
        `${name} shares ${item.total} counters into ${item.divisor} equal groups. How many are in each group?`,
      );
    },
  };
}

function unitFractions(): Cell {
  const parts: { n: number; d: number }[] = [];
  for (const d of [2, 3, 4, 6, 8]) {
    for (let n = 1; n < d; n += 1) parts.push({ n, d });
  }
  const sizes = [parts.length, 2, 3];
  return {
    count: span(sizes),
    build(index) {
      const [partIndex, form, pos] = decode(index, sizes);
      const { n, d } = parts[partIndex!]!;
      const answer = `${n}/${d}`;
      const note = "A fraction n/d is n parts when the whole is split into d equal parts.";
      if (form === 0) {
        return {
          stem: `A whole is split into ${d} equal parts. ${n} of those parts is what fraction? Write it as ${n}/${d} with a slash.`,
          answer,
          aliases: [`${n} / ${d}`],
          standard: "CCSS.MATH.3.NF.A.1",
          note,
        };
      }
      const wrongs = [`${n + 1}/${d}`, `${n}/${d + 1}`, `1/${Math.max(1, n)}`];
      const intro = `A whole is split into ${d} equal parts and ${n} parts are shaded. Which fraction is shaded?`;
      const letters = ["A", "B", "C"];
      const slot = pos! % 3;
      const shown = ["", "", ""];
      const options = [wrongs[0]!, wrongs[1]!, answer];
      const ordered = [options[0]!, options[1]!, options[2]!];
      const rotated = [ordered[slot % 3]!, ordered[(slot + 1) % 3]!, ordered[(slot + 2) % 3]!];
      for (let place = 0; place < 3; place += 1) shown[place] = rotated[place]!;
      const answerAt = shown.indexOf(answer);
      return {
        stem: `${intro}\nA. ${shown[0]}\nB. ${shown[1]}\nC. ${shown[2]}\nWrite A, B, or C.`,
        answer: letters[answerAt]!,
        aliases: [answer],
        standard: "CCSS.MATH.3.NF.A.1",
        note,
      };
    },
  };
}

function multiplyOneDigit(): Cell {
  const sizes = [29, 7, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, form] = decode(index, sizes);
      const a = 12 + aIndex!;
      const b = 3 + bIndex!;
      const name = KIDS[a % KIDS.length]!;
      const stem = form === 0 ? `${a} × ${b} = ?` : `${name} packs ${a} boxes with ${b} books in each box. How many books is that?`;
      return whole(a * b, "CCSS.MATH.4.NBT.B.5", "Grade 4 multiplies a two-digit number by a one-digit number.", stem);
    },
  };
}

function addingLikeFractions(): Cell {
  const denoms = [6, 8, 10, 12];
  const sizes = [5, 5, denoms.length, 2];
  return {
    count: span(sizes),
    build(index) {
      const [nIndex, mIndex, dIndex, form] = decode(index, sizes);
      const n = 1 + nIndex!;
      const m = 1 + mIndex!;
      const d = denoms[dIndex!]!;
      const answer = `${n + m}/${d}`;
      const stem =
        form === 0
          ? `${n}/${d} + ${m}/${d} = ? Write the sum as a fraction with denominator ${d}.`
          : `Add ${n}/${d} and ${m}/${d}. Keep the denominator ${d} and add the numerators.`;
      return {
        stem,
        answer,
        aliases: [`${n + m} / ${d}`],
        standard: "CCSS.MATH.4.NF.B.3",
        note: "Fractions with the same denominator add by adding the numerators.",
      };
    },
  };
}

function rounding(): Cell {
  const sizes = [79, 2];
  return {
    count: span(sizes),
    build(index) {
      const [nIndex, form] = decode(index, sizes);
      const n = 11 + nIndex!;
      const rounded = Math.round(n / 10) * 10;
      const stem = form === 0 ? `Round ${n} to the nearest ten.` : `Which ten is closest to ${n}?`;
      return whole(rounded, "CCSS.MATH.4.NBT.A.3", "Look at the ones digit. 5 or more rounds the tens digit up.", stem);
    },
  };
}

function formatTenths(value: number): string {
  if (value >= 10) return `1.${value - 10}`;
  return `0.${value}`;
}

function formatHundredths(value: number): string {
  if (value < 10) return `0.0${value}`;
  return `0.${value}`;
}

function decimalOperations(): Cell {
  const sizes = [9, 9, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, form] = decode(index, sizes);
      const a = 1 + aIndex!;
      const b = 1 + bIndex!;
      if (form === 0) {
        const product = a * b;
        return {
          stem: `0.${a} × 0.${b} = ?`,
          answer: formatHundredths(product),
          aliases: [String(product / 100)],
          standard: "CCSS.MATH.5.NBT.B.7",
          note: "Tenths times tenths are hundredths.",
        };
      }
      const sum = a + b;
      return {
        stem: `0.${a} + 0.${b} = ?`,
        answer: formatTenths(sum),
        aliases: [String(sum / 10)],
        standard: "CCSS.MATH.5.NBT.B.7",
        note: "Add tenths by adding the digits after the decimal point.",
      };
    },
  };
}

function addingFractions(): Cell {
  const denoms = [5, 6, 8, 10, 12];
  const sizes = [4, 4, denoms.length];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, dIndex] = decode(index, sizes);
      const a = 1 + aIndex!;
      const b = 1 + bIndex!;
      const d = denoms[dIndex!]!;
      return {
        stem: `${a}/${d} + ${b}/${d} = ? Write the sum with denominator ${d}.`,
        answer: `${a + b}/${d}`,
        aliases: [`${a + b} / ${d}`],
        standard: "CCSS.MATH.5.NF.A.1",
        note: "Same-denominator sums keep the denominator and add the numerators.",
      };
    },
  };
}

function volume(): Cell {
  const cubes: { stem: string; answer: number }[] = [];
  for (let side = 2; side <= 12; side += 1) {
    cubes.push({ stem: `A cube has side length ${side}. What is its volume in cubic units?`, answer: side * side * side });
  }
  for (let length = 2; length <= 6; length += 1) {
    for (let width = 2; width <= 6; width += 1) {
      for (let height = 2; height <= 5; height += 1) {
        cubes.push({
          stem: `A box is ${length} by ${width} by ${height}. What is its volume in cubic units?`,
          answer: length * width * height,
        });
      }
    }
  }
  return {
    count: cubes.length,
    build(index) {
      const item = cubes[index]!;
      return whole(item.answer, "CCSS.MATH.5.MD.C.5", "Volume counts the unit cubes that fill a solid. A cube is side × side × side.", item.stem);
    },
  };
}

function ratios(): Cell {
  const equations = 7 * 8;
  const words = equations * KIDS.length;
  return {
    count: equations + words,
    build(index) {
      const note = "Equivalent ratios scale both terms by the same factor.";
      const from = (slot: number) => {
        const a = 2 + (slot % 7);
        const b = 2 + Math.floor(slot / 7);
        return { a, b };
      };
      if (index < equations) {
        const item = from(index);
        return whole(item.b, "CCSS.MATH.6.RP.A.1", note, `The ratio ${item.a}:${item.a * item.b} is equivalent to 1:?`);
      }
      const inner = index - equations;
      const item = from(inner % equations);
      const name = KIDS[Math.floor(inner / equations) % KIDS.length]!;
      return whole(
        item.b,
        "CCSS.MATH.6.RP.A.1",
        note,
        `${name} uses ${item.a} cups of juice for every ${item.a * item.b} cups of water. How many cups of water go with 1 cup of juice?`,
      );
    },
  };
}

function oneStepEquations(): Cell {
  const sizes = [11, 9, 2];
  return {
    count: span(sizes),
    build(index) {
      const [xIndex, cIndex, form] = decode(index, sizes);
      const x = 2 + xIndex!;
      const c = 1 + cIndex!;
      const stem = form === 0 ? `Solve x + ${c} = ${x + c}. x = ?` : `A number plus ${c} is ${x + c}. What is the number?`;
      return whole(x, "CCSS.MATH.6.EE.B.7", "Subtract the added amount from both sides.", stem);
    },
  };
}

function positiveAndNegative(): Cell {
  const sizes = [30, 3];
  return {
    count: span(sizes),
    build(index) {
      const [nIndex, form] = decode(index, sizes);
      const n = 1 + nIndex!;
      const note = "Opposite numbers are the same distance from 0 on opposite sides.";
      if (form === 1) return whole(n, "CCSS.MATH.6.NS.C.6", note, `Which is greater, ${n} or ${-n}?`);
      if (form === 2) return whole(0, "CCSS.MATH.6.NS.C.6", "A number plus its opposite is 0.", `What is ${n} + (${-n})?`);
      return whole(-n, "CCSS.MATH.6.NS.C.6", note, `What is the opposite of ${n}?`);
    },
  };
}

function proportions(): Cell {
  const sizes = [5, 4, 5, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, mIndex, kIndex, form] = decode(index, sizes);
      const a = 2 + aIndex!;
      const multiple = 2 + mIndex!;
      const scale = 2 + kIndex!;
      const b = a * multiple;
      const den = b * scale;
      const num = a * scale;
      const stem =
        form === 0
          ? `If ${a}/${b} = ?/${den}, the missing numerator is`
          : `${a} out of ${b} is the same ratio as how many out of ${den}? Write the missing numerator.`;
      return whole(num, "CCSS.MATH.7.RP.A.2", "Scale both terms of a ratio by the same factor.", stem);
    },
  };
}

function coefficientEquations(): Cell {
  const xs = [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8];
  const sizes = [xs.length, 8, 2];
  return {
    count: span(sizes),
    build(index) {
      const [xIndex, mIndex, form] = decode(index, sizes);
      const x = xs[xIndex!]!;
      const m = 2 + mIndex!;
      const product = m * x;
      const stem = form === 0 ? `Solve ${m}x = ${product}. x = ?` : `${m} times a number is ${product}. What is the number?`;
      return whole(x, "CCSS.MATH.7.EE.B.4", "Divide both sides by the coefficient.", stem);
    },
  };
}

function probability(): Cell {
  const bags: { red: number; total: number }[] = [];
  for (const total of [10, 12, 20]) {
    for (let red = 1; red < total; red += 1) bags.push({ red, total });
  }
  const sizes = [bags.length, 2];
  return {
    count: span(sizes),
    build(index) {
      const [bagIndex, form] = decode(index, sizes);
      const bag = bags[bagIndex!]!;
      const favorable = form === 0 ? bag.red : bag.total - bag.red;
      const color = form === 0 ? "red" : "blue";
      const other = form === 0 ? bag.total - bag.red : bag.red;
      return {
        stem: `A bag has ${bag.red} red and ${other} blue marbles, ${bag.total} in all. P(${color}) = ? Write the fraction.`,
        answer: `${favorable}/${bag.total}`,
        aliases: [`${favorable} / ${bag.total}`, String(favorable / bag.total)],
        standard: "CCSS.MATH.7.SP.C.7",
        note: "Probability is the number of favorable outcomes over the total.",
      };
    },
  };
}

function pythagorean(): Cell {
  const sizes = [10, 10, 2];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, form] = decode(index, sizes);
      const a = 3 + aIndex!;
      const b = 3 + bIndex!;
      const sum = a * a + b * b;
      const stem =
        form === 0
          ? `A right triangle has legs ${a} and ${b}. a² + b² = ?`
          : `Square the legs ${a} and ${b}, then add those squares. What is the sum?`;
      return whole(sum, "CCSS.MATH.8.G.B.7", "The Pythagorean theorem says a² + b² = c².", stem);
    },
  };
}

function slopeValue(rise: number, run: number): { answer: string; aliases: string[] } {
  if (rise % run === 0) return { answer: String(rise / run), aliases: [`${rise}/${run}`, String(rise / run)] };
  return { answer: `${rise}/${run}`, aliases: [String(rise / run), `${rise} / ${run}`] };
}

function slope(): Cell {
  const sizes = [9, 6, 2];
  return {
    count: span(sizes),
    build(index) {
      const [riseIndex, runIndex, form] = decode(index, sizes);
      const rise = 1 + riseIndex!;
      const run = 1 + runIndex!;
      const value = slopeValue(rise, run);
      const stem =
        form === 0
          ? `The slope of the line through (0, 0) and (${run}, ${rise}) is`
          : `The slope of the line through (0, 1) and (${run}, ${1 + rise}) is`;
      return {
        stem,
        answer: value.answer,
        aliases: value.aliases,
        standard: "CCSS.MATH.8.EE.B.6",
        note: "Slope is rise over run.",
      };
    },
  };
}

function exponents(): Cell {
  const sizes = [11, 4, 2];
  return {
    count: span(sizes),
    build(index) {
      const [baseIndex, expIndex, form] = decode(index, sizes);
      const base = 2 + baseIndex!;
      const exp = 2 + expIndex!;
      let value = 1;
      for (let i = 0; i < exp; i += 1) value *= base;
      const stem = form === 0 ? `${base} to the power ${exp} equals` : `${base}^${exp} = ?`;
      return whole(value, "CCSS.MATH.8.EE.A.1", "An exponent counts how many times the base is multiplied.", stem);
    },
  };
}

function evaluatingFunctions(grade: number): Cell {
  const sizes = [5 + (grade - 9), 11 + (grade - 9), 9 + (grade - 9)];
  return {
    count: span(sizes),
    build(index) {
      const [mIndex, bIndex, xIndex] = decode(index, sizes);
      const m = 2 + mIndex!;
      const b = -5 + bIndex!;
      const x = -4 + xIndex!;
      const signed = b < 0 ? `- ${-b}` : `+ ${b}`;
      return whole(m * x + b, "CCSS.MATH.HSF.IF.A.2", "Evaluate a linear function by substituting the value of x.", `f(x) = ${m}x ${signed}. f(${x}) = ?`);
    },
  };
}

function linearEquations(grade: number): Cell {
  const sizes = [8 + (grade - 9), 6, 8];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, xIndex] = decode(index, sizes);
      const a = 2 + aIndex!;
      const b = bIndex!;
      const x = 2 + xIndex! + (grade - 9);
      const right = a * x + b;
      const stem = b === 0 ? `Solve ${a}x = ${right}. x = ?` : `Solve ${a}x + ${b} = ${right}. x = ?`;
      return whole(x, "CCSS.MATH.HSA.REI.B.3", "Undo the added amount, then divide by the coefficient.", stem);
    },
  };
}

function mean(grade: number): Cell {
  const sizes = [8, 8, 6];
  return {
    count: span(sizes),
    build(index) {
      const [aIndex, bIndex, meanIndex] = decode(index, sizes);
      const shift = grade - 9;
      const a = 2 + aIndex! + shift;
      const b = 3 + bIndex! + shift;
      const value = Math.max(a, b) + 1 + meanIndex!;
      const c = 3 * value - a - b;
      return whole(value, "CCSS.MATH.HSS.ID.A.2", "The mean is the sum divided by how many values there are.", `The mean of ${a}, ${b}, and ${c} is`);
    },
  };
}

const MIDDLE: Record<number, [() => Cell, () => Cell, () => Cell]> = {
  1: [addingWithin20, subtractingWithin20, tensAndOnes],
  2: [addingWithin100, subtractingWithin100, hundredsTensOnes],
  3: [multiplication, division, unitFractions],
  4: [multiplyOneDigit, addingLikeFractions, rounding],
  5: [decimalOperations, addingFractions, volume],
  6: [ratios, oneStepEquations, positiveAndNegative],
  7: [proportions, coefficientEquations, probability],
  8: [pythagorean, slope, exponents],
};

export function mathCell(grade: number, step: number): Cell {
  if (grade >= 9) {
    if (step === 0) return evaluatingFunctions(grade);
    if (step === 1) return linearEquations(grade);
    return mean(grade);
  }
  const row = MIDDLE[grade] ?? MIDDLE[1]!;
  return row[step]!();
}
