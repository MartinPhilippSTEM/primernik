/**
 * Parser českého zápisu čísla s jednotkou:
 * „5 mld. Kč“, „3MW“, „5,5 mil.“, „1 200 000 t CO2e“, „200 tisíc domácností“, „120 MWh/rok“.
 * Vrací jeden nebo více výkladů (při nejednoznačnosti si uživatel vybere).
 */
import { fmtExact, fmtQuantity, fmtScientific } from './czech';
import type { Quantity } from './types';
import { toBase, unitDef, UnitError, type Rates } from './units';

export interface Interpretation {
  quantity: Quantity;
  /** Číslo tak, jak bylo zadáno, už vynásobené slovem (tis./mil./…). */
  amount: number;
  /** Kanonická jednotka (klíč do UNITS). */
  unit: string;
  /** Text „Rozumím: …“. */
  explain: string;
  /** Doplňující poznámky (kurz ČNB, převod měsíc → rok …). */
  notes: string[];
}

export type ParseResult =
  | { ok: true; interpretations: Interpretation[] }
  | { ok: false; error: string; suggestions?: string[] };

const LETTER = 'a-záčďéěíňóřšťúůýž';
const word = (alts: string) => new RegExp(`^(?:${alts})(?:\\.|(?![${LETTER}]))\\s*`);

const MULTIPLIERS: [RegExp, number, string][] = [
  [word('tisícovek|tisíce|tisíců|tisíci|tisíc|tis'), 1e3, 'tis.'],
  [word('milionů|miliónů|miliony|milióny|milionu|miliónu|milion|milión|mil'), 1e6, 'mil.'],
  [word('miliardách|miliardy|miliard|miliarda|miliardu|mld'), 1e9, 'mld.'],
  [word('bilionů|biliony|bilionu|bilion|bil'), 1e12, 'bil.'],
];

/** Přípony toku v čase → násobek na „za rok“. */
const PER_SUFFIXES: [RegExp, number, string][] = [
  [/\s*(?:\/\s*(?:rok|r\.?)|\s+ročně|\s+za\s+rok|\s+p\.\s?a\.?)$/, 1, 'za rok'],
  [/\s*(?:\/\s*(?:měsíc|měs\.?)|\s+měsíčně|\s+za\s+měsíc)$/, 12, 'za měsíc → ×12 = za rok'],
  [/\s*(?:\/\s*den|\s+denně|\s+za\s+den)$/, 365, 'za den → ×365 = za rok'],
];

/** Jednotky zapsané slovy či různě → kanonický symbol z UNITS. Klíče jsou malými písmeny. */
const UNIT_ALIASES: [RegExp, string][] = [
  [/^(?:kč|kc|czk|korun[ay]?|korun českých|,-)$/, 'Kč'],
  [/^(?:eur|€|euro|eura)$/, 'EUR'],
  [/^(?:usd|\$|dolar[yů]?|amerických dolarů)$/, 'USD'],
  [/^(?:gbp|£|liber|britských liber)$/, 'GBP'],
  [/^(?:chf|frank[yů]?|švýcarských franků)$/, 'CHF'],
  [/^(?:sek|švédských korun)$/, 'SEK'],
  [/^(?:nok|norských korun)$/, 'NOK'],
  [/^(?:dkk|dánských korun)$/, 'DKK'],
  [/^(?:pln|zł|zlot(?:ý|ých|é))$/, 'PLN'],
  [/^(?:huf|forint[yů]?)$/, 'HUF'],
  [/^(?:jpy|¥|jen[yů]?)$/, 'JPY'],
  [/^(?:cny|jüan[yů]?|juan[yů]?)$/, 'CNY'],
  [/^(?:w|watt[yů]?)$/, 'W'],
  [/^(?:kw|kwp|kilowatt[yů]?)$/, 'kW'],
  [/^(?:mw|mwe|mwp|megawatt[yů]?)$/, 'MW'],
  [/^(?:gw|gwe|gigawatt[yů]?)$/, 'GW'],
  [/^(?:tw|terawatt[yů]?)$/, 'TW'],
  [/^(?:wh|watthodin[ay]?)$/, 'Wh'],
  [/^(?:kwh|kilowatthodin[ay]?)$/, 'kWh'],
  [/^(?:mwh|megawatthodin[ay]?)$/, 'MWh'],
  [/^(?:gwh|gigawatthodin[ay]?)$/, 'GWh'],
  [/^(?:twh|terawatthodin[ay]?)$/, 'TWh'],
  [/^(?:j|joul[eů]?)$/, 'J'],
  [/^kj$/, 'kJ'],
  [/^mj$/, 'MJ'],
  [/^gj$/, 'GJ'],
  [/^tj$/, 'TJ'],
  [/^pj$/, 'PJ'],
  [/^(?:g|gram[yů]?)$/, 'g'],
  [/^(?:kg|kil[ao]|kilogram[yů]?)$/, 'kg'],
  [/^(?:t|tun[ay]?|tuna)$/, 't'],
  [/^(?:kt|kilotun[ay]?)$/, 'kt'],
  [/^(?:mt|megatun[ay]?)$/, 'Mt'],
  [/^(?:m2|metr[yů]? čtvereční(?:ch)?|čtverečních metrů)$/, 'm2'],
  [/^(?:ha|hektar[yů]?)$/, 'ha'],
  [/^(?:km2|kilometr[yů]? čtvereční(?:ch)?|čtverečních kilometrů)$/, 'km2'],
  [/^(?:mm|milimetr[yů]?)$/, 'mm'],
  [/^(?:cm|centimetr[yů]?)$/, 'cm'],
  [/^(?:m|metr[yů]?)$/, 'm'],
  [/^(?:km|kilometr[yů]?)$/, 'km'],
  [/^(?:l|litr[yů]?)$/, 'l'],
  [/^(?:hl|hektolitr[yů]?)$/, 'hl'],
  [/^(?:m3|kubík[yů]?|metr[yů]? krychlov(?:ý|é|ých))$/, 'm3'],
  [/^(?:km3)$/, 'km3'],
  [/^(?:obyvatel[eé]?|osob[ay]?|lidí|lidé|lidi|člověk|lid[ií]|občan[ůé]?)$/, 'osoba'],
  [/^(?:domácnost[ií]?)$/, 'domácnost'],
  [/^(?:byt[yů]?)$/, 'byt'],
  [/^(?:s|sekund[ay]?)$/, 's'],
  [/^(?:min|minut[ay]?)$/, 'min'],
  [/^(?:h|hod|hodin[ay]?)$/, 'h'],
  [/^(?:den|dny|dní|dnů)$/, 'den'],
  [/^(?:týden|týdny|týdnů)$/, 'týden'],
  [/^(?:rok|roky|let|roků)$/, 'rok'],
];

const CO2 = /^(g|kg|t|kt|mt|tun[ay]?|tuna|kilogram[yů]?|gram[yů]?)?\s*co2(e|eq|\s*-?\s*ekv\.?|\s*-?\s*eq\.?|-e)?$/;
const CO2_MASS: Record<string, string> = { g: 'g', kg: 'kg', t: 't', kt: 'kt', mt: 'Mt' };

function normalizeUnit(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/₂/g, '2')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
}

/** Najde kanonickou jednotku; null = neznámá. */
export function resolveUnit(raw: string): string | null {
  const u = normalizeUnit(raw);
  const co2 = u.match(CO2);
  if (co2) {
    const massWord = co2[1] ?? '';
    const mass = CO2_MASS[massWord] ?? (massWord.startsWith('tun') ? 't' : massWord.startsWith('kilogram') ? 'kg' : massWord.startsWith('gram') ? 'g' : null);
    if (!mass) return null; // „50 000 CO2“ bez hmotnostní jednotky
    return `${mass} ${co2[2] ? 'CO2e' : 'CO2'}`;
  }
  for (const [re, sym] of UNIT_ALIASES) if (re.test(u)) return sym;
  return null;
}

interface NumberReading {
  value: number;
  label: string;
}

/**
 * Čtení čísla. Desetinná čárka, mezery v tisících. Tečka je nejednoznačná:
 * „1.200“ může být 1 200 (tečka jako oddělovač tisíců) i 1,2 → vrátí obě čtení.
 */
function readNumber(s: string): NumberReading[] {
  const t = s.replace(/ /g, '');
  if (t.includes(',')) {
    const parts = t.split(',');
    if (parts.length === 2) {
      // „1.234,5“ → tečky jsou tisíce
      return [{ value: Number(parts[0].replace(/\./g, '') + '.' + parts[1]), label: '' }];
    }
    // „1,234,567“ (anglicky) – jen když jsou všechny skupiny po třech
    if (parts.slice(1).every((p) => p.length === 3)) return [{ value: Number(parts.join('')), label: '' }];
    return [];
  }
  const dots = t.split('.');
  if (dots.length === 1) return [{ value: Number(t), label: '' }];
  if (dots.length > 2) {
    return dots.slice(1).every((p) => p.length === 3) ? [{ value: Number(dots.join('')), label: '' }] : [];
  }
  const [int, frac] = dots;
  if (frac.length === 3 && int.length <= 3 && int !== '0') {
    return [
      { value: Number(int + frac), label: 'tečka jako oddělovač tisíců' },
      { value: Number(`${int}.${frac}`), label: 'tečka jako desetinná čárka' },
    ];
  }
  return [{ value: Number(`${int}.${frac}`), label: '' }];
}

const NUMBER = /^([+-]?)\s*(\d+(?: \d{3})*(?:[.,]\d+)*)(?:\s*[eE]([+-]?\d+))?/;
const SUGGESTED_UNITS = ['Kč', 'obyvatel', 'domácností', 'MWh', 't CO2'];

export function parse(input: string, rates?: Rates): ParseResult {
  let s = input
    .replace(/[   ]/g, ' ')
    .replace(/[−–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return { ok: false, error: 'Zadejte číslo s jednotkou, např. „5 mld. Kč“ nebo „3 MW“.' };

  let numbers: NumberReading[];
  let sign = '';
  const m = s.match(NUMBER);
  if (m) {
    sign = m[1];
    numbers = readNumber(m[2]);
    if (m[3]) numbers = numbers.map((n) => ({ ...n, value: n.value * 10 ** Number(m[3]) }));
    s = s.slice(m[0].length).trim();
  } else if (MULTIPLIERS.some(([re]) => re.test(s.toLowerCase()))) {
    numbers = [{ value: 1, label: '' }]; // „milion Kč“
  } else {
    return { ok: false, error: 'Nenašel jsem číslo. Zkuste např. „5 mld. Kč“, „3 MW“ nebo „200 tisíc domácností“.' };
  }
  if (numbers.length === 0 || numbers.some((n) => !Number.isFinite(n.value))) {
    return { ok: false, error: 'Číslu nerozumím – zkontrolujte oddělovače (desetinná čárka, mezery v tisících).' };
  }
  if (sign === '-') {
    return { ok: false, error: 'Zadejte kladné číslo. U schodku nebo poklesu zadejte jeho velikost (např. „286 mld. Kč“).' };
  }

  // násobitel slovem
  let mult = 1;
  let multLabel = '';
  const lower = s.toLowerCase();
  for (const [re, value, label] of MULTIPLIERS) {
    const mm = lower.match(re);
    if (mm) {
      mult = value;
      multLabel = label;
      s = s.slice(mm[0].length).trim();
      break;
    }
  }

  // tok v čase
  let perFactor = 1;
  let perNote = '';
  let per: Quantity['per'] = null;
  for (const [re, factor, note] of PER_SUFFIXES) {
    const pm = s.toLowerCase().match(re);
    if (pm) {
      per = 'year';
      perFactor = factor;
      perNote = factor === 1 ? '' : `Převod toku: ${note}.`;
      s = s.slice(0, s.length - pm[0].length).trim();
      break;
    }
  }

  if (!s) {
    const base = numbers[0].value;
    const shown = `${fmtExact(base)}${multLabel ? ' ' + multLabel : ''}`;
    return {
      ok: false,
      error: 'Chybí jednotka. Co číslo vyjadřuje?',
      suggestions: SUGGESTED_UNITS.map((u) => `${shown} ${u}`),
    };
  }

  const unit = resolveUnit(s);
  if (!unit) {
    return { ok: false, error: `Jednotce „${s}“ nerozumím. Podporované jsou např. Kč, EUR, MW, MWh, t, t CO2, t CO2e, ha, km², m³, obyvatel, domácností, bytů.` };
  }
  const def = unitDef(unit);
  if (per === 'year' && (def.dim === 'power' || def.dim === 'time')) {
    return {
      ok: false,
      error:
        def.dim === 'power'
          ? 'Výkon už je veličina za čas. Myslíte energii za rok, např. „MWh/rok“?'
          : 'Čas za rok neumím porovnávat.',
    };
  }

  const interpretations: Interpretation[] = [];
  for (const n of numbers) {
    const amount = n.value * mult;
    if (amount === 0) return { ok: false, error: 'Nulu nemá smysl k ničemu přirovnávat.' };
    let q: Quantity;
    try {
      q = toBase(amount * perFactor, unit, per, rates);
    } catch (e) {
      if (e instanceof UnitError) return { ok: false, error: e.message };
      throw e;
    }
    const notes: string[] = [];
    if (n.label) notes.push(`Čtení čísla: ${n.label}.`);
    if (perNote) notes.push(perNote);
    if (def.currency && rates) {
      notes.push(
        `Převedeno kurzem ČNB ze dne ${rates.date}: 1 ${def.currency} = ${fmtExact(rates.rates[def.currency])} Kč.`,
      );
    }
    if (/^(?:mwp|kwp)$/i.test(s.trim())) notes.push('kWp/MWp = špičkový (instalovaný) výkon fotovoltaiky.');
    const unitShown = unit.replace('m2', 'm²').replace('m3', 'm³').replace('CO2', 'CO₂');
    const countUnit = def.dim === 'persons' || def.dim === 'households' || def.dim === 'dwellings';
    const raw = countUnit
      ? fmtQuantity({ value: amount * perFactor, dim: def.dim, per }, true)
      : `${fmtScientific(amount * perFactor)} ${unitShown}${per ? '/rok' : ''}`;
    const explain = def.currency ? `${raw} ≈ ${fmtQuantity(q)}` : raw;
    interpretations.push({ quantity: q, amount, unit, explain, notes });
  }
  return { ok: true, interpretations };
}
