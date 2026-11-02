/**
 * Další automaticky stahované zdroje:
 *  – ČSÚ: průměrné ceny vybraného zboží a pohonných hmot, narození, zemřelí,
 *    dokončené byty, komunální odpad, průměrná plocha bytu;
 *  – Eurostat: evropské státy (obyvatelé, rozloha, HDP).
 */
import type { Forms, RefItem } from '../src/core/types';
import { getJson, streamCsv, TODAY, writeDataset } from './lib';

type Item = RefItem;
const DATASTAT = (code: string) => `https://data.csu.gov.cz/opendata/sady/${code}/distribuce/csv`;
const DATASTAT_DOC = (code: string) => `https://data.csu.gov.cz/datastat/info/SADA/${code}`;

const f = (one: string, few: string, many: string, dec: string, gen = dec): Forms => ({ one, few, many, dec, gen });
const kg = (what: string) => f(`kilogram ${what}`, `kilogramy ${what}`, `kilogramů ${what}`, `kilogramu ${what}`);
const litr = (what: string) => f(`litr ${what}`, `litry ${what}`, `litrů ${what}`, `litru ${what}`);

// ---------------------------------------------------------------- ČSÚ: průměrné ceny

/** Vybrané druhy zboží (kód reprezentanta ČSÚ → popisek a tvary). Množství je dané ČSÚ (v hranatých závorkách). */
const PRODUCTS: Record<string, { id: string; forms: Forms; fam: 1 | 2 | 3 }> = {
  '02130001': { id: 'pivo-lahvove', forms: f('lahvové pivo', 'lahvová piva', 'lahvových piv', 'lahvového piva'), fam: 3 },
  '01113001': { id: 'chleb', forms: kg('chleba'), fam: 3 },
  '01113002': { id: 'pecivo-bile', forms: kg('bílého pečiva'), fam: 3 },
  '01148001': { id: 'vejce-10', forms: f('balení deseti vajec', 'balení deseti vajec', 'balení deseti vajec', 'balení deseti vajec'), fam: 3 },
  '01152001': { id: 'maslo', forms: kg('másla'), fam: 3 },
  '01142002': { id: 'mleko-trvanlive', forms: litr('trvanlivého mléka'), fam: 3 },
  '01175001': { id: 'brambory', forms: kg('brambor'), fam: 3 },
  '01161001': { id: 'banany', forms: kg('banánů'), fam: 3 },
  '01163001': { id: 'jablka', forms: kg('jablek'), fam: 3 },
  '01181001': { id: 'cukr', forms: kg('cukru'), fam: 3 },
  '01185001': { id: 'cokolada', forms: f('tabulka mléčné čokolády', 'tabulky mléčné čokolády', 'tabulek mléčné čokolády', 'tabulky mléčné čokolády'), fam: 3 },
  '01145002': { id: 'hermelin', forms: kg('hermelínu'), fam: 3 },
  '01131002': { id: 'kapr', forms: kg('kapra'), fam: 3 },
  '01122202': { id: 'veprova-krkovice', forms: kg('vepřové krkovice'), fam: 3 },
  '01122402': { id: 'kureci-rizky', forms: kg('kuřecích prsních řízků'), fam: 3 },
  '01125001': { id: 'parky', forms: kg('párků'), fam: 3 },
  '02110001': { id: 'tuzemak', forms: litr('tuzemáku'), fam: 3 },
  '02121001': { id: 'vino-cervene', forms: f('lahev červeného vína', 'lahve červeného vína', 'lahví červeného vína', 'lahve červeného vína'), fam: 3 },
  '01250001': { id: 'minerálka', forms: litr('perlivé minerálky'), fam: 2 },
  '01146001': { id: 'jogurt-bily', forms: f('kelímek bílého jogurtu', 'kelímky bílého jogurtu', 'kelímků bílého jogurtu', 'kelímku bílého jogurtu'), fam: 3 },
  '01183001': { id: 'med', forms: kg('medu'), fam: 2 },
  '01220002': { id: 'kava-zrnkova-100g', forms: f('100 g zrnkové kávy', '100 g zrnkové kávy', '100 g zrnkové kávy', '100 g zrnkové kávy'), fam: 2 },
};

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

async function fetchPrices(): Promise<Item[]> {
  const latest = new Map<string, { month: string; value: number; name: string }>();
  await streamCsv(DATASTAT('CEN0101N'), (r) => {
    if (r.Uz0 !== 'CZ' || !PRODUCTS[r.CENREP4] || r.MJ_SYMBOL !== 'Kč') return;
    const prev = latest.get(r.CENREP4);
    if (!prev || r.CasM > prev.month) latest.set(r.CENREP4, { month: r.CasM, value: Number(r.Hodnota), name: r['Druh zboží'] });
  });
  const items: Item[] = [];
  for (const [code, { month, value, name }] of latest) {
    const p = PRODUCTS[code];
    const [y, m] = month.split('-').map(Number);
    items.push({
      id: `cena-${p.id.normalize('NFD').replace(/[̀-ͯ]/g, '')}`,
      label: `${name} – průměrná cena`,
      forms: p.forms,
      value,
      unit: 'Kč',
      dimension: 'money',
      per: null,
      kind: 'unit',
      basis: `průměrná spotřebitelská cena, ${MONTHS[m - 1]} ${y}; ${name}`,
      category: 'kazdodenni',
      source_name: 'ČSÚ – Průměrné spotřebitelské ceny vybraných druhů zboží (DataStat CEN0101N)',
      source_url: DATASTAT_DOC('CEN0101N'),
      source_id: `CEN0101N; reprezentant ${code}; ${month}`,
      year: y,
      retrieved_at: TODAY,
      note: 'Celostátní průměr cen z cenového šetření ČSÚ za daný měsíc.',
      familiarity: p.fam,
      group: 'ceny-zbozi',
    });
  }
  return items;
}

const FUELS: Record<string, { id: string; forms: Forms }> = {
  '0722201': { id: 'cena-benzin-natural-95', forms: litr('benzínu Natural 95') },
  '0722101': { id: 'cena-nafta', forms: litr('motorové nafty') },
};

async function fetchFuel(): Promise<Item[]> {
  const latest = new Map<string, { week: string; value: number; name: string }>();
  await streamCsv(DATASTAT('CENPHMT'), (r) => {
    if (r.Uz0 !== 'CZ' || r.IndicatorType !== '6621T' || !FUELS[r.CENPHM]) return;
    const prev = latest.get(r.CENPHM);
    if (!prev || r.CASTPHM > prev.week) latest.set(r.CENPHM, { week: r.CASTPHM, value: Number(r.Hodnota), name: r['Druh PHM'] });
  });
  return [...latest].map(([code, { week, value, name }]) => ({
    id: FUELS[code].id,
    label: `${name} – průměrná cena za litr`,
    forms: FUELS[code].forms,
    value,
    unit: 'Kč',
    dimension: 'money',
    per: null,
    kind: 'unit',
    basis: `průměrná cena za litr, týden ${week}`,
    category: 'kazdodenni',
    source_name: 'ČSÚ – Průměrné spotřebitelské ceny pohonných hmot, týdenní (DataStat CENPHMT)',
    source_url: DATASTAT_DOC('CENPHMT'),
    source_id: `CENPHMT; ${code}; ${week}`,
    year: Number(week.slice(0, 4)),
    retrieved_at: TODAY,
    note: '',
    familiarity: 3,
    group: 'ceny-zbozi',
  }));
}

// ---------------------------------------------------------------- ČSÚ: roční toky

/** Poslední rok, pro který řádek projde filtrem. */
async function latestYear(code: string, keep: (r: Record<string, string>) => boolean, yearCol: string) {
  let best: { year: number; value: number } | null = null;
  await streamCsv(DATASTAT(code), (r) => {
    // roční hodnota: „2025“, nebo kumulace „leden–prosinec“ zapsaná jako „2025-12K“
    if (!keep(r) || !/^\d{4}(-12K)?$/.test(r[yearCol])) return;
    const year = Number(r[yearCol].slice(0, 4));
    if (!best || year > best.year) best = { year, value: Number(r.Hodnota) };
  });
  if (!best) throw new Error(`${code}: žádná data`);
  return best as { year: number; value: number };
}

async function fetchFlows(): Promise<Item[]> {
  const items: Item[] = [];
  const common = { per: 'year' as const, kind: 'aggregate' as const, retrieved_at: TODAY, familiarity: 3 as const };

  const births = await latestYear('OBY03C', (r) => r.IndicatorType === '4355ZN' && r.POHLNAR === '0' && r.UZ01234B === 'CZ', 'CasR');
  items.push({
    ...common,
    id: 'zive-narozeni-cr',
    label: `živě narozené děti v ČR za rok ${births.year}`,
    forms: f('ročník narozených dětí', 'ročníky narozených dětí', 'ročníků narozených dětí', 'ročníku narozených dětí', `dětí narozených v Česku za rok ${births.year}`),
    value: births.value,
    unit: 'osoba',
    dimension: 'persons',
    basis: `živě narození za rok ${births.year}`,
    category: 'geografie',
    source_name: 'ČSÚ – Živě narození podle pohlaví (DataStat OBY03C)',
    source_url: DATASTAT_DOC('OBY03C'),
    source_id: 'OBY03C; ukazatel 4355ZN; ČR',
    year: births.year,
    note: '',
    time_phrase: `v Česku se tolik dětí narodí za {t} (podle roku ${births.year})`,
  });

  const deaths = await latestYear('OBY04A', (r) => r.VEK15ZX === 'VEKC' && r.POHL2 === '0' && r.UZ01234B === 'CZ', 'CasRB');
  items.push({
    ...common,
    familiarity: 2,
    id: 'zemreli-cr',
    label: `zemřelí v ČR za rok ${deaths.year}`,
    forms: f('roční počet zemřelých v ČR', 'roční počty zemřelých v ČR', 'ročních počtů zemřelých v ČR', 'ročního počtu zemřelých v ČR', `zemřelých v Česku za rok ${deaths.year}`),
    value: deaths.value,
    unit: 'osoba',
    dimension: 'persons',
    basis: `zemřelí za rok ${deaths.year}`,
    category: 'geografie',
    source_name: 'ČSÚ – Zemřelí podle pohlaví a věku (DataStat OBY04A)',
    source_url: DATASTAT_DOC('OBY04A'),
    source_id: 'OBY04A; věk celkem; ČR',
    year: deaths.year,
    note: '',
    time_phrase: `v Česku za {t} zemře tolik lidí (podle roku ${deaths.year})`,
  });

  const flats = await latestYear('STA09A', (r) => r.Ukazatel === 'Dokončené byty' && r.Uz0A === 'CZ', 'CASMKQR');
  items.push({
    ...common,
    id: 'dokoncene-byty-cr',
    label: `dokončené byty v ČR za rok ${flats.year}`,
    forms: f('roční počet dokončených bytů v ČR', 'roční počty dokončených bytů v ČR', 'ročních počtů dokončených bytů v ČR', 'ročního počtu dokončených bytů v ČR', `bytů dokončených v Česku za rok ${flats.year}`),
    value: flats.value,
    unit: 'byt',
    dimension: 'dwellings',
    basis: `dokončené byty za rok ${flats.year}`,
    category: 'geografie',
    source_name: 'ČSÚ – Zahájené a dokončené byty v ČR (DataStat STA09A)',
    source_url: DATASTAT_DOC('STA09A'),
    source_id: 'STA09A; Dokončené byty; ČR',
    year: flats.year,
    note: '',
    time_phrase: `v Česku se tolik bytů dokončí za {t} (podle roku ${flats.year})`,
  });

  const waste = await latestYear(
    'ZPR66',
    (r) => r.ZDRKOMODP === '0' && r['EWC.EWC1'] === '0' && !r['EWC.EWC2'] && r.Uz02 === 'CZ',
    'CasR',
  );
  items.push({
    ...common,
    familiarity: 2,
    id: 'komunalni-odpad-cr',
    label: `komunální odpad vyprodukovaný v ČR za rok ${waste.year}`,
    forms: f('roční produkce komunálního odpadu v ČR', 'roční produkce komunálního odpadu v ČR', 'ročních produkcí komunálního odpadu v ČR', 'roční produkce komunálního odpadu v ČR', `komunálního odpadu vyprodukovaného v Česku za rok ${waste.year}`),
    value: Math.round(waste.value),
    unit: 't',
    dimension: 'mass',
    basis: `produkce komunálního odpadu za rok ${waste.year}`,
    category: 'geografie',
    source_name: 'ČSÚ – Produkce komunálních odpadů dle krajů a původu (DataStat ZPR66)',
    source_url: DATASTAT_DOC('ZPR66'),
    source_id: 'ZPR66; zdroj celkem; ČR',
    year: waste.year,
    note: 'Zaokrouhleno na celé tuny.',
    time_phrase: `Česko vyprodukuje tolik komunálního odpadu za {t} (podle roku ${waste.year})`,
  });

  const area = await latestYear('SLD040', (r) => r['UzCrKr_H.STAT'] === '19' && !r['UzCrKr_H.KRAJ'], 'Rok sčítání');
  items.push({
    id: 'prumerna-plocha-bytu-sldb',
    label: 'průměrná celková plocha obydleného bytu (Sčítání 2021)',
    prefix: 'plocha',
    forms: f('průměrného bytu', 'průměrných bytů', 'průměrných bytů', 'průměrného bytu', 'plochy průměrného bytu'),
    value: Math.round(area.value * 10) / 10,
    unit: 'm2',
    dimension: 'area',
    per: null,
    kind: 'unit',
    basis: 'průměrná celková plocha obydleného bytu, Sčítání 2021',
    category: 'geografie',
    source_name: 'ČSÚ – Průměrná celková plocha bytu (DataStat SLD040)',
    source_url: DATASTAT_DOC('SLD040'),
    source_id: 'SLD040; ukazatel U_2413_1; ČR',
    year: 2021,
    retrieved_at: TODAY,
    note: 'Zaokrouhleno na desetiny m².',
    familiarity: 3,
  });
  return items;
}

export async function fetchCsuExtra() {
  const parts = await Promise.allSettled([fetchPrices(), fetchFuel(), fetchFlows()]);
  const items = parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []));
  parts.forEach((p) => p.status === 'rejected' && console.warn('  –', (p.reason as Error).message));
  writeDataset('csu-ceny-a-toky', {
    dataset: 'ČSÚ – ceny zboží a pohonných hmot, narození, zemřelí, byty, odpady',
    source_name: 'ČSÚ (DataStat)',
    source_url: 'https://data.csu.gov.cz/',
    retrieved_at: TODAY,
    items,
  });
  if (parts.some((p) => p.status === 'rejected')) throw new Error('některé sady ČSÚ se nepodařilo stáhnout');
}

// ---------------------------------------------------------------- Eurostat: evropské státy

/** Česká jména (1. a 2. pád) a známost. */
const COUNTRIES: Record<string, [string, string, 1 | 2 | 3]> = {
  BE: ['Belgie', 'Belgie', 2], BG: ['Bulharsko', 'Bulharska', 2], DK: ['Dánsko', 'Dánska', 2], DE: ['Německo', 'Německa', 3],
  EE: ['Estonsko', 'Estonska', 2], IE: ['Irsko', 'Irska', 2], EL: ['Řecko', 'Řecka', 3], ES: ['Španělsko', 'Španělska', 3],
  FR: ['Francie', 'Francie', 3], HR: ['Chorvatsko', 'Chorvatska', 3], IT: ['Itálie', 'Itálie', 3], CY: ['Kypr', 'Kypru', 2],
  LV: ['Lotyšsko', 'Lotyšska', 2], LT: ['Litva', 'Litvy', 2], LU: ['Lucembursko', 'Lucemburska', 2], HU: ['Maďarsko', 'Maďarska', 3],
  MT: ['Malta', 'Malty', 2], NL: ['Nizozemsko', 'Nizozemska', 3], AT: ['Rakousko', 'Rakouska', 3], PL: ['Polsko', 'Polska', 3],
  PT: ['Portugalsko', 'Portugalska', 2], RO: ['Rumunsko', 'Rumunska', 2], SI: ['Slovinsko', 'Slovinska', 2], SK: ['Slovensko', 'Slovenska', 3],
  FI: ['Finsko', 'Finska', 2], SE: ['Švédsko', 'Švédska', 2], IS: ['Island', 'Islandu', 2], LI: ['Lichtenštejnsko', 'Lichtenštejnska', 2],
  NO: ['Norsko', 'Norska', 2], CH: ['Švýcarsko', 'Švýcarska', 3], UK: ['Spojené království', 'Spojeného království', 3],
  ME: ['Černá Hora', 'Černé Hory', 2], MK: ['Severní Makedonie', 'Severní Makedonie', 1], AL: ['Albánie', 'Albánie', 2],
  RS: ['Srbsko', 'Srbska', 2], TR: ['Turecko', 'Turecka', 2], UA: ['Ukrajina', 'Ukrajiny', 3], MD: ['Moldavsko', 'Moldavska', 1],
  BA: ['Bosna a Hercegovina', 'Bosny a Hercegoviny', 2], XK: ['Kosovo', 'Kosova', 1], GE: ['Gruzie', 'Gruzie', 1],
  AM: ['Arménie', 'Arménie', 1], AZ: ['Ázerbájdžán', 'Ázerbájdžánu', 1], BY: ['Bělorusko', 'Běloruska', 2],
};

interface JsonStatGeo {
  value: Record<string, number>;
  size: number[];
  id: string[];
  dimension: Record<string, { category: { index: Record<string, number> } }>;
}

/** Poslední dostupná hodnota pro každý stát (geo × time; ostatní dimenze mají velikost 1). */
async function eurostatByGeo(dataset: string, filter: string) {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?format=JSON&lang=EN&${filter}`;
  const d = await getJson<JsonStatGeo>(url);
  const geo = d.dimension.geo.category.index;
  const time = d.dimension.time.category.index;
  const nTime = Object.keys(time).length;
  const out = new Map<string, { year: number; value: number }>();
  for (const [g, gi] of Object.entries(geo)) {
    if (!COUNTRIES[g]) continue;
    for (const [t, ti] of Object.entries(time).sort((a, b) => b[1] - a[1])) {
      const v = d.value[String(gi * nTime + ti)];
      if (v !== undefined && v !== null) {
        out.set(g, { year: Number(t), value: v });
        break;
      }
    }
  }
  return { out, url };
}

export async function fetchCountries() {
  const items: Item[] = [];
  const pop = await eurostatByGeo('tps00001', 'indic_de=JAN');
  for (const [g, { year, value }] of pop.out) {
    const [nom, , fam] = COUNTRIES[g];
    items.push({
      id: `stat-obyvatele-${g.toLowerCase()}`,
      group: 'staty-obyvatele',
      label: `obyvatelé: ${nom}`,
      forms: f(`obyvatel – ${nom}`, `obyvatel – ${nom}`, `obyvatel – ${nom}`, `obyvatel – ${nom}`),
      value,
      unit: 'osoba',
      dimension: 'persons',
      per: null,
      kind: 'aggregate',
      basis: `k 1. 1. ${year}`,
      category: 'geografie',
      source_name: 'Eurostat – Population on 1 January (tps00001)',
      source_url: 'https://ec.europa.eu/eurostat/databrowser/view/tps00001/default/table',
      source_id: `tps00001; geo=${g}`,
      year,
      retrieved_at: TODAY,
      note: '',
      familiarity: fam,
      level: 'zeme',
      place: nom,
    });
  }
  const area = await eurostatByGeo('reg_area3', 'landuse=TOTAL&unit=KM2');
  for (const [g, { year, value }] of area.out) {
    const [nom, , fam] = COUNTRIES[g];
    items.push({
      id: `stat-rozloha-${g.toLowerCase()}`,
      group: 'staty-rozloha',
      label: `rozloha: ${nom}`,
      forms: f(`rozloha – ${nom}`, `rozlohy – ${nom}`, `rozloh – ${nom}`, `rozlohy – ${nom}`),
      value,
      unit: 'km2',
      dimension: 'area',
      per: null,
      kind: 'aggregate',
      basis: `celková rozloha, ${year}`,
      category: 'geografie',
      source_name: 'Eurostat – Area by NUTS 3 region (reg_area3)',
      source_url: 'https://ec.europa.eu/eurostat/databrowser/view/reg_area3/default/table',
      source_id: `reg_area3; landuse=TOTAL; geo=${g}`,
      year,
      retrieved_at: TODAY,
      note: '',
      familiarity: fam,
      level: 'zeme',
      place: nom,
    });
  }
  const gdp = await eurostatByGeo('nama_10_gdp', 'na_item=B1GQ&unit=CP_MEUR');
  for (const [g, { year, value }] of gdp.out) {
    const [nom, gen, fam] = COUNTRIES[g];
    items.push({
      id: `stat-hdp-${g.toLowerCase()}`,
      group: 'staty-hdp',
      label: `HDP: ${nom} (${year})`,
      forms: f(`roční HDP ${gen}`, `roční HDP ${gen}`, `ročních HDP ${gen}`, `ročního HDP ${gen}`, `HDP ${gen} za rok ${year}`),
      value: value * 1e6,
      unit: 'EUR',
      dimension: 'money',
      per: 'year',
      kind: 'aggregate',
      basis: `HDP v běžných cenách, ${year}`,
      category: 'verejne-finance',
      source_name: 'Eurostat – GDP and main components (nama_10_gdp)',
      source_url: 'https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table',
      source_id: `nama_10_gdp; B1GQ; CP_MEUR; geo=${g}`,
      year,
      retrieved_at: TODAY,
      note: 'V eurech; na koruny se přepočítává aktuálním kurzem ČNB (viz rates.json), ne průměrným kurzem roku.',
      familiarity: fam,
      time_phrase: `${nom} vytvoří tolik HDP za {t} (podle roku ${year})`,
    });
  }
  writeDataset('eurostat-staty', {
    dataset: 'Evropské státy – obyvatelé, rozloha, HDP',
    source_name: 'Eurostat',
    source_url: 'https://ec.europa.eu/eurostat/web/main/data/web-services',
    retrieved_at: TODAY,
    items,
  });
}
