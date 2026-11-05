/**
 * Čtení čísel napsaných česky slovy: „deset milionů“, „pět set tisíc“, „dvě stě padesát“,
 * „pětadvacet“, „jeden a půl milionu“, „půl miliardy“, „jedna celá pět“, „tisíc“.
 * Funguje i bez diakritiky („deset milionu“).
 */

/** Odstraní diakritiku a převede na malá písmena. */
export function deaccent(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const SMALL: Record<string, number> = {
  nula: 0,
  jedna: 1, jeden: 1, jedno: 1, jednoho: 1, jedne: 1,
  dva: 2, dve: 2, dvou: 2,
  tri: 3, trech: 3,
  ctyri: 4, ctyr: 4,
  pet: 5, sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10,
  jedenact: 11, dvanact: 12, trinact: 13, ctrnact: 14, patnact: 15,
  sestnact: 16, sedmnact: 17, osmnact: 18, devatenact: 19,
  dvacet: 20, tricet: 30, ctyricet: 40, padesat: 50, sedesat: 60, sedmdesat: 70, osmdesat: 80, devadesat: 90,
};

/** „sto / stě / sta / set“ násobí předchozí číslo stem. */
const HUNDRED = new Set(['sto', 'ste', 'sta', 'set']);

const SCALES: [RegExp, number][] = [
  [/^(?:tisic|tisice|tisicu|tisici|tisicovek|tis)$/, 1e3],
  [/^(?:milion|milionu|miliony|milionech|mil)$/, 1e6],
  [/^(?:miliarda|miliardy|miliard|miliardu|miliardach|mld)$/, 1e9],
  [/^(?:bilion|bilionu|biliony|bil)$/, 1e12],
];

const FRACTIONS: Record<string, number> = { pul: 0.5, ctvrt: 0.25 };
const DECIMAL = new Set(['cela', 'cele', 'celych']);

type Word =
  | { kind: 'small'; value: number }
  | { kind: 'hundred' }
  | { kind: 'scale'; value: number }
  | { kind: 'fraction'; value: number }
  | { kind: 'decimal' }
  | { kind: 'and' };

function single(t: string): Word | null {
  if (t in SMALL) return { kind: 'small', value: SMALL[t] };
  if (HUNDRED.has(t)) return { kind: 'hundred' };
  for (const [re, v] of SCALES) if (re.test(t)) return { kind: 'scale', value: v };
  if (t in FRACTIONS) return { kind: 'fraction', value: FRACTIONS[t] };
  if (DECIMAL.has(t)) return { kind: 'decimal' };
  return null;
}

const UNITS_INV = ['jedna', 'dva', 'tri', 'ctyri', 'pet', 'sest', 'sedm', 'osm', 'devet'];
const TENS = ['dvacet', 'tricet', 'ctyricet', 'padesat', 'sedesat', 'sedmdesat', 'osmdesat', 'devadesat'];
const INVERTED = new RegExp(`^(${UNITS_INV.join('|')})a(${TENS.join('|')})$`);

/** Slovo → posloupnost číselných slov („dvacetpet“, „pětadvacet“, „dvěstě“), nebo null. */
function decompose(token: string): Word[] | null {
  const t = deaccent(token).replace(/\.$/, '');
  const one = single(t);
  if (one) return [one];
  const inv = t.match(INVERTED);
  if (inv) return [{ kind: 'small', value: SMALL[inv[1]] + SMALL[inv[2]] }];
  // srostlice typu „dvacetpět“, „třistapadesát“: nejdelší shoda zleva
  const out: Word[] = [];
  let rest = t;
  const keys = [...Object.keys(SMALL), ...HUNDRED].sort((a, b) => b.length - a.length);
  while (rest) {
    const key = keys.find((k) => rest.startsWith(k));
    if (!key) return null;
    out.push(single(key)!);
    rest = rest.slice(key.length);
  }
  return out.length > 1 ? out : null;
}

export interface WordNumber {
  value: number;
  /** Přečtený text (pro poznámku „deset milionů = 10 000 000“). */
  text: string;
  /** Zbytek vstupu za číslem (jednotka). */
  rest: string;
}

/** Přečte číslo slovy ze začátku řetězce. Vrací null, když řetězec číslem slovy nezačíná. */
export function readNumberWords(input: string): WordNumber | null {
  const tokens = [...input.matchAll(/[^\s-]+/g)];
  let total = 0;
  let current = 0;
  let used = 0; // počet spotřebovaných tokenů
  let any = false;
  let decimal: { int: number } | null = null;

  const closeDecimal = () => {
    if (!decimal) return;
    const frac = current === 0 ? 0 : current / 10 ** String(Math.round(current)).length;
    current = decimal.int + frac;
    decimal = null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i][0];
    const t = deaccent(tok);
    if (t === 'a') {
      // spojka „jeden a půl“, „sto a deset“ – jen když za ní pokračuje číslo
      const next = tokens[i + 1] && decompose(tokens[i + 1][0]);
      if (!any || !next) break;
      used = i + 1;
      continue;
    }
    const words = decompose(tok);
    if (!words) break;
    for (const w of words) {
      if (w.kind === 'small') {
        current += w.value;
      } else if (w.kind === 'hundred') current = (current || 1) * 100;
      else if (w.kind === 'fraction') current += w.value;
      else if (w.kind === 'decimal') {
        decimal = { int: current };
        current = 0;
      } else if (w.kind === 'scale') {
        closeDecimal();
        total += (current || 1) * w.value;
        current = 0;
      }
    }
    any = true;
    used = i + 1;
  }
  if (!any) return null;
  closeDecimal();
  const end = used < tokens.length ? tokens[used].index! : input.length;
  return {
    value: total + current,
    text: input.slice(0, end).trim(),
    rest: input.slice(end).trim(),
  };
}
