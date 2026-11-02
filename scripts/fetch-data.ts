/**
 * Stažení referenčních dat z otevřených zdrojů → data/generated/*.json.
 * Spouští se ručně (`npm run fetch-data`) nebo jednou měsíčně GitHub Action.
 * Když zdroj selže, jeho předchozí soubor zůstane beze změny.
 *
 * Zdroje: ČSÚ (DataStat, Sčítání 2021), Wikidata (SPARQL), Eurostat API, ČNB.
 */
import type { RefItem } from '../src/core/types';
import { getJson, sameForms, sparql, streamCsv, TODAY, writeDataset, writeJson } from './lib';
import { plantForms } from './plant-forms';
import { fetchCountries, fetchCsuExtra } from './sources-extra';

type Item = RefItem;

// ---------------------------------------------------------------- ČSÚ: obyvatelé

const OBY02A_CSV = 'https://data.csu.gov.cz/opendata/sady/OBY02A/distribuce/csv';
const OBY02A_DOC = 'https://data.csu.gov.cz/datastat/info/SADA/OBY02A';
/** Do dat se berou obce od této velikosti (menší obce čtenář většinou nezná). */
const MIN_OBEC = 2000;

interface Place {
  code: string;
  name: string;
  level: 'stat' | 'kraj' | 'obec';
  pop: number;
}

/** Vrací obyvatele ČR, krajů a obcí k 1. 1. posledního roku. */
async function csuPopulation(): Promise<{ year: number; places: Place[] }> {
  const byYear = new Map<number, Place[]>();
  await streamCsv(OBY02A_CSV, (r) => {
    if (r.IndicatorType !== '2406P' || r.POHL2 !== '0') return;
    const code = r.UZ01234596C;
    const name = r['Všechna území'];
    let level: Place['level'] | null = null;
    if (code === 'CZ') level = 'stat';
    else if (/^CZ0\d\d$/.test(code)) level = 'kraj';
    else if (/^\d{6}$/.test(code) && name.includes('(okr.')) level = 'obec';
    if (!level) return;
    const year = Number(r.CasR);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ code, name, level, pop: Number(r.Hodnota) });
  });
  const year = Math.max(...byYear.keys());
  return { year, places: byYear.get(year)! };
}

/** „Nové Město (okr. Náchod)“ → „Nové Město“, pokud je jméno mezi vybranými obcemi jedinečné. */
function placeNames(obce: Place[]): Map<string, string> {
  const short = (n: string) => n.replace(/\s*\(okr\..*\)$/, '');
  const count = new Map<string, number>();
  obce.forEach((o) => count.set(short(o.name), (count.get(short(o.name)) ?? 0) + 1));
  return new Map(obce.map((o) => [o.code, count.get(short(o.name))! > 1 ? o.name : short(o.name)]));
}

function familiarityOf(pop: number): 1 | 2 | 3 {
  return pop >= 90_000 ? 3 : pop >= 20_000 ? 2 : 1;
}

// ---------------------------------------------------------------- Wikidata: QID obcí a krajů

async function wikidataIds(): Promise<{ obce: Map<string, string>; kraje: Map<string, string> }> {
  const obce = new Map<string, string>();
  for (const b of await sparql(`SELECT ?o ?kod WHERE { ?o wdt:P7606 ?kod . }`)) {
    obce.set(b.kod.value, b.o.value.split('/').pop()!);
  }
  const kraje = new Map<string, string>();
  for (const b of await sparql(`SELECT ?k ?nuts WHERE { ?k wdt:P31 wd:Q38911 ; wdt:P605 ?nuts . }`)) {
    kraje.set(b.nuts.value, b.k.value.split('/').pop()!);
  }
  return { obce, kraje };
}

async function fetchPopulation(ids: Awaited<ReturnType<typeof wikidataIds>> | null) {
  const { year, places } = await csuPopulation();
  const obce = places.filter((p) => p.level === 'obec' && p.pop >= MIN_OBEC);
  const names = placeNames(obce);
  const common = {
    dimension: 'persons' as const,
    unit: 'osoba',
    per: null,
    category: 'geografie' as const,
    source_name: 'ČSÚ – Počet obyvatel podle pohlaví (DataStat OBY02A)',
    source_url: OBY02A_DOC,
    year,
    retrieved_at: TODAY,
    basis: `k 1. 1. ${year}`,
  };
  const items: Item[] = [];
  const cz = places.find((p) => p.level === 'stat')!;
  items.push({
    ...common,
    id: 'obyvatele-cr',
    label: 'obyvatelé ČR',
    forms: { one: 'obyvatelstvo ČR', few: 'obyvatelstva ČR', many: 'obyvatelstev ČR', dec: 'obyvatelstva ČR', gen: 'obyvatel ČR' },
    value: cz.pop,
    kind: 'aggregate',
    source_id: 'OBY02A; území CZ',
    note: 'Počáteční stav k 1. 1. (ukazatel 2406P).',
    familiarity: 3,
    level: 'stat',
    place: 'Česko',
    tags: ['population-cz'],
  });
  for (const k of places.filter((p) => p.level === 'kraj')) {
    const qid = ids?.kraje.get(k.code);
    items.push({
      ...common,
      id: `obyvatele-kraj-${k.code.toLowerCase()}`,
      label: `obyvatelé: ${k.name}`,
      forms: sameForms(`obyvatel – ${k.name}`),
      value: k.pop,
      kind: 'aggregate',
      source_id: `OBY02A; kraj ${k.code}${qid ? `; Wikidata ${qid}` : ''}`,
      note: '',
      familiarity: 3,
      level: 'kraj',
      place: k.name,
    });
  }
  for (const o of obce) {
    const qid = ids?.obce.get(o.code);
    items.push({
      ...common,
      id: `obyvatele-obec-${o.code}`,
      label: `obyvatelé: ${names.get(o.code)}`,
      forms: sameForms(`obyvatel – ${names.get(o.code)}`),
      value: o.pop,
      kind: 'aggregate',
      source_id: `OBY02A; kód obce ${o.code}${qid ? `; Wikidata ${qid}` : ''}`,
      note: '',
      familiarity: familiarityOf(o.pop),
      level: 'obec',
      place: names.get(o.code),
    });
  }
  writeDataset('csu-obyvatele', {
    dataset: 'Obyvatelé ČR, krajů a obcí',
    source_name: common.source_name,
    source_url: OBY02A_CSV,
    retrieved_at: TODAY,
    items,
  });
  return { obce, names, kraje: places.filter((p) => p.level === 'kraj') };
}

// ---------------------------------------------------------------- ČSÚ: Sčítání 2021 (domácnosti, byty)

const SLDB_HOUSEHOLDS = 'https://csu.gov.cz/docs/107508/05638b19-13ea-2ecf-f097-608a80e053eb/sldb2021_domacnosti_clenu_typ.csv';
const SLDB_DWELLINGS = 'https://csu.gov.cz/docs/107508/cd4228aa-2957-1e6a-3e30-7b03c3c8deb7/sldb2021_byty_osoby.csv';
const HH_DEF = 'hospodařící domácnosti, Sčítání lidu, domů a bytů 2021 (stav k 26. 3. 2021)';

async function fetchCensus(pop: Awaited<ReturnType<typeof fetchPopulation>>) {
  const wanted = new Set(pop.obce.map((o) => o.code));
  const krajNames = new Set(pop.kraje.map((k) => k.name));
  const famByCode = new Map(pop.obce.map((o) => [o.code, familiarityOf(o.pop)]));

  async function collect(url: string, keep: (r: Record<string, string>) => boolean) {
    const rows: Record<string, string>[] = [];
    await streamCsv(url, (r) => {
      if (!keep(r)) return;
      const t = r.uzemi_typ;
      if (t === 'stát' || (t === 'kraj' && krajNames.has(r.uzemi_txt)) || (t === 'obec' && wanted.has(r.uzemi_kod)) || (!t && (r.uzemi_cis === '97' || r.uzemi_cis === '100' || (r.uzemi_cis === '43' && wanted.has(r.uzemi_kod))))) rows.push(r);
    });
    return rows;
  }

  const levelOf = (r: Record<string, string>) =>
    r.uzemi_cis === '97' ? 'stat' : r.uzemi_cis === '100' ? 'kraj' : 'obec';

  // domácnosti
  const hh = await collect(SLDB_HOUSEHOLDS, (r) => r.ukaz_kod === '2423' && !r.typ_kod && !r.clenu_kod);
  const hhItems: Item[] = hh.map((r) => {
    const level = levelOf(r);
    const place = level === 'obec' ? pop.names.get(r.uzemi_kod)! : level === 'stat' ? 'Česko' : r.uzemi_txt;
    return {
      id: `domacnosti-${level}-${r.uzemi_kod}`,
      label: level === 'stat' ? 'hospodařící domácnosti v ČR' : `domácnosti: ${place}`,
      forms:
        level === 'stat'
          ? { one: 'všechny domácnosti v ČR', few: 'všechny domácnosti v ČR', many: 'všech domácností v ČR', dec: 'všech domácností v ČR', gen: 'domácností v ČR' }
          : sameForms(`domácností – ${place}`),
      value: Number(r.hodnota),
      unit: 'domácnost',
      dimension: 'households',
      per: null,
      kind: 'aggregate',
      basis: 'Sčítání 2021, hospodařící domácnosti',
      category: 'geografie',
      source_name: 'ČSÚ – Sčítání 2021: Hospodařící domácnosti podle velikosti a typu',
      source_url: SLDB_HOUSEHOLDS,
      source_id: `SLDB 2021; ukazatel 2423; číselník ${r.uzemi_cis}, kód ${r.uzemi_kod}`,
      year: 2021,
      retrieved_at: TODAY,
      note: 'Hospodařící domácnost = osoby, které spolu bydlí a společně hradí výdaje domácnosti.',
      familiarity: level === 'obec' ? famByCode.get(r.uzemi_kod) ?? 1 : 3,
      level,
      place,
      household_definition: HH_DEF,
      tags: level === 'stat' ? ['households-cz'] : undefined,
    } as Item;
  });
  writeDataset('csu-domacnosti', {
    dataset: 'Hospodařící domácnosti (Sčítání 2021)',
    source_name: 'ČSÚ – Sčítání 2021',
    source_url: SLDB_HOUSEHOLDS,
    retrieved_at: TODAY,
    items: hhItems,
  });

  // obydlené byty
  const dw = await collect(SLDB_DWELLINGS, (r) => r.ukaz_kod === '2607' && !r.osob_kod);
  const dwItems: Item[] = dw.map((r) => {
    const level = levelOf(r);
    const place = level === 'obec' ? pop.names.get(r.uzemi_kod)! : level === 'stat' ? 'Česko' : r.uzemi_txt;
    return {
      id: `byty-${level}-${r.uzemi_kod}`,
      label: level === 'stat' ? 'obydlené byty v ČR' : `obydlené byty: ${place}`,
      forms:
        level === 'stat'
          ? { one: 'všechny obydlené byty v ČR', few: 'všechny obydlené byty v ČR', many: 'všech obydlených bytů v ČR', dec: 'všech obydlených bytů v ČR', gen: 'obydlených bytů v ČR' }
          : sameForms(`obydlených bytů – ${place}`),
      value: Number(r.hodnota),
      unit: 'byt',
      dimension: 'dwellings',
      per: null,
      kind: 'aggregate',
      basis: 'Sčítání 2021, obydlené byty',
      category: 'geografie',
      source_name: 'ČSÚ – Sčítání 2021: Obydlené byty podle počtu osob v bytě',
      source_url: SLDB_DWELLINGS,
      source_id: `SLDB 2021; ukazatel 2607; číselník ${r.uzemi_cis}, kód ${r.uzemi_kod}`,
      year: 2021,
      retrieved_at: TODAY,
      note: '',
      familiarity: level === 'obec' ? famByCode.get(r.uzemi_kod) ?? 1 : 3,
      level,
      place,
      tags: level === 'stat' ? ['dwellings-cz'] : undefined,
    } as Item;
  });
  writeDataset('csu-byty', {
    dataset: 'Obydlené byty (Sčítání 2021)',
    source_name: 'ČSÚ – Sčítání 2021',
    source_url: SLDB_DWELLINGS,
    retrieved_at: TODAY,
    items: dwItems,
  });
}

// ---------------------------------------------------------------- Wikidata: rozloha obcí

const AREA_UNITS: Record<string, string> = {
  Q712226: 'km2', // čtvereční kilometr
  Q35852: 'ha', // hektar
  Q25343: 'm2', // metr čtvereční
};

interface Stmt {
  value: number;
  unit: string;
  rank: string;
  date: string | null;
  refdate: string | null;
  refurl: string | null;
  stated: string | null;
}

/** Vybere jedno tvrzení: preferované, pak nejnovější. Nejednoznačné (různé hodnoty) → null. */
function pickStatement(stmts: Stmt[]): Stmt | null {
  const rankOrder = (r: string) => (r.endsWith('PreferredRank') ? 0 : 1);
  const sorted = [...stmts].sort(
    (a, b) => rankOrder(a.rank) - rankOrder(b.rank) || (b.date ?? '').localeCompare(a.date ?? ''),
  );
  const best = sorted[0];
  const tied = sorted.filter((s) => rankOrder(s.rank) === rankOrder(best.rank) && s.date === best.date);
  if (new Set(tied.map((s) => `${s.value} ${s.unit}`)).size > 1) return null;
  return best;
}

function stmtYear(s: Stmt): number | null {
  const d = s.date ?? s.refdate;
  return d ? Number(d.slice(0, 4)) : null;
}

function refNote(s: Stmt): string {
  const parts = [s.stated && `uvedeno v: ${s.stated}`, s.refurl && `odkaz: ${s.refurl}`].filter(Boolean);
  return parts.length ? `Reference ve Wikidatech – ${parts.join('; ')}.` : 'Tvrzení ve Wikidatech má referenci.';
}

async function statements(query: string): Promise<Map<string, { label: string; extra: string; stmts: Stmt[] }>> {
  const map = new Map<string, { label: string; extra: string; stmts: Stmt[] }>();
  for (const b of await sparql(query)) {
    const qid = b.item.value.split('/').pop()!;
    const entry = map.get(qid) ?? { label: b.itemLabel?.value ?? qid, extra: b.extra?.value ?? '', stmts: [] };
    const st: Stmt = {
      value: Number(b.amount.value),
      unit: b.unit.value.split('/').pop()!,
      rank: b.rank.value,
      date: b.date?.value ?? null,
      refdate: b.refdate?.value ?? null,
      refurl: b.refurl?.value ?? null,
      stated: b.statedLabel?.value ?? null,
    };
    if (!entry.stmts.some((s) => s.value === st.value && s.unit === st.unit && s.date === st.date)) entry.stmts.push(st);
    map.set(qid, entry);
  }
  return map;
}

const REF_PART = `
  ?st prov:wasDerivedFrom ?ref .
  OPTIONAL { ?st pq:P585 ?date }
  OPTIONAL { ?ref pr:P813 ?refdate }
  OPTIONAL { ?ref pr:P854 ?refurl }
  OPTIONAL { ?ref pr:P248 ?stated . ?stated rdfs:label ?statedLabel FILTER(lang(?statedLabel) = "cs") }`;

async function fetchAreas(pop: Awaited<ReturnType<typeof fetchPopulation>>) {
  const wanted = new Map(pop.obce.map((o) => [o.code, o]));
  const map = await statements(`
SELECT ?item ?extra ?amount ?unit ?rank ?date ?refdate ?refurl ?statedLabel WHERE {
  ?item wdt:P7606 ?extra ; p:P2046 ?st .
  ?st psv:P2046 [ wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit ] ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank) ${REF_PART}
}`);
  const items: Item[] = [];
  for (const [qid, e] of map) {
    const obec = wanted.get(e.extra);
    if (!obec) continue;
    const s = pickStatement(e.stmts.filter((x) => AREA_UNITS[x.unit]));
    const year = s && stmtYear(s);
    if (!s || !year) continue;
    const place = pop.names.get(obec.code)!;
    items.push({
      id: `rozloha-obec-${obec.code}`,
      label: `rozloha obce ${place}`,
      forms: sameForms(`rozlohy obce ${place}`),
      value: s.value,
      unit: AREA_UNITS[s.unit],
      dimension: 'area',
      per: null,
      kind: 'aggregate',
      basis: 'rozloha obce',
      category: 'geografie',
      source_name: 'Wikidata',
      source_url: `https://www.wikidata.org/wiki/${qid}`,
      source_id: `${qid}; P2046; kód obce ${obec.code}`,
      year,
      retrieved_at: TODAY,
      note: refNote(s),
      familiarity: familiarityOf(obec.pop),
      level: 'obec',
      place,
    });
  }
  writeDataset('wikidata-rozloha-obci', {
    dataset: 'Rozloha obcí (jen tvrzení s referencí)',
    source_name: 'Wikidata',
    source_url: 'https://query.wikidata.org/',
    retrieved_at: TODAY,
    items,
  });
}

// ---------------------------------------------------------------- Wikidata: elektrárny

const POWER_UNITS: Record<string, string> = {
  Q6982035: 'MW',
  Q6517513: 'kW',
  Q2289227: 'GW',
  Q25236: 'W',
};

/** Plants with annual production in curated.json – full-power time phrase would duplicate it. */
const SKIP_TIME_PHRASE = new Set(['Q1502091', 'Q687033']); // Temelín, Dukovany

async function fetchPowerPlants() {
  const map = await statements(`
SELECT ?item ?itemLabel ?amount ?unit ?rank ?date ?refdate ?refurl ?statedLabel WHERE {
  ?item wdt:P17 wd:Q213 ; p:P2109 ?st .
  ?item wdt:P31/wdt:P279* wd:Q159719 .
  FILTER NOT EXISTS { ?item wdt:P576 [] }
  FILTER NOT EXISTS { ?item wdt:P3999 [] }
  ?st psv:P2109 [ wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit ] ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank) ${REF_PART}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "cs" . }
}`);
  const items: Item[] = [];
  for (const [qid, e] of map) {
    const s = pickStatement(e.stmts.filter((x) => POWER_UNITS[x.unit]));
    const year = s && stmtYear(s);
    const forms = plantForms(e.label);
    if (!s || !year || !forms) {
      console.warn(`  – ${qid} ${e.label}: vynecháno (${!s ? 'nejednoznačná hodnota' : !year ? 'bez roku' : 'název nelze skloňovat'})`);
      continue;
    }
    const watts = s.value * { W: 1, kW: 1e3, MW: 1e6, GW: 1e9 }[POWER_UNITS[s.unit]]!;
    if (watts < 1e6) continue; // menší než 1 MW – nezajímavé a málo známé
    const capital = forms.one[0].toUpperCase() + forms.one.slice(1);
    items.push({
      id: `elektrarna-${qid.toLowerCase()}`,
      label: forms.one,
      forms,
      value: s.value,
      unit: POWER_UNITS[s.unit],
      dimension: 'power',
      per: null,
      kind: 'unit',
      basis: 'instalovaný výkon',
      category: 'energetika',
      source_name: 'Wikidata',
      source_url: `https://www.wikidata.org/wiki/${qid}`,
      source_id: `${qid}; P2109`,
      year,
      retrieved_at: TODAY,
      note: refNote(s),
      familiarity: watts >= 500e6 ? 3 : watts >= 100e6 ? 2 : 1,
      time_phrase: SKIP_TIME_PHRASE.has(qid) ? undefined : `${capital} by to při plném výkonu vyrobila za {t}`,
    });
  }
  writeDataset('wikidata-elektrarny', {
    dataset: 'Elektrárny v ČR – instalovaný výkon (jen tvrzení s referencí)',
    source_name: 'Wikidata',
    source_url: 'https://query.wikidata.org/',
    retrieved_at: TODAY,
    items,
  });
}

// ---------------------------------------------------------------- Eurostat

interface JsonStat {
  value: Record<string, number>;
  dimension: { time: { category: { index: Record<string, number> } } };
  updated: string;
}

async function eurostatLatest(dataset: string, filter: string): Promise<{ year: number; value: number; updated: string; url: string }> {
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?format=JSON&lang=EN&geo=CZ&${filter}`;
  const d = await getJson<JsonStat>(url);
  const idx = d.dimension.time.category.index;
  const years = Object.keys(idx).filter((y) => d.value[idx[y]] !== undefined).sort();
  const year = years[years.length - 1];
  return { year: Number(year), value: d.value[idx[year]], updated: d.updated, url };
}

async function fetchEurostat() {
  const items: Item[] = [];
  const common = { retrieved_at: TODAY, per: 'year' as const, kind: 'aggregate' as const };

  const hh = await eurostatLatest('nrg_d_hhq', 'siec=E7000&nrg_bal=FC_OTH_HH_E&unit=GWH');
  items.push({
    ...common,
    id: 'eurostat-domacnosti-elektrina',
    label: `roční spotřeba elektřiny všech domácností v ČR (${hh.year})`,
    forms: {
      one: 'roční spotřeba elektřiny všech domácností v ČR',
      few: 'roční spotřeby elektřiny všech domácností v ČR',
      many: 'ročních spotřeb elektřiny všech domácností v ČR',
      dec: 'roční spotřeby elektřiny všech domácností v ČR',
      gen: 'roční spotřeby elektřiny všech domácností v ČR',
    },
    value: hh.value,
    unit: 'GWh',
    dimension: 'energy',
    basis: `konečná spotřeba elektřiny v domácnostech, ${hh.year}`,
    category: 'energetika',
    source_name: 'Eurostat – Households energy consumption (nrg_d_hhq)',
    source_url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_d_hhq/default/table',
    source_id: 'nrg_d_hhq; siec=E7000; nrg_bal=FC_OTH_HH_E; unit=GWH; geo=CZ',
    year: hh.year,
    note: `Data aktualizována Eurostatem ${hh.updated.slice(0, 10)}. API: ${hh.url}`,
    familiarity: 2,
    time_phrase: 'domácnosti v ČR tolik elektřiny spotřebují za {t}',
  });

  const ghg = await eurostatLatest('env_air_gge', 'airpol=GHG&src_crf=TOTX4_MEMO&unit=MIO_T');
  items.push({
    ...common,
    id: 'eurostat-emise-sklenikovych-plynu-cr',
    label: `roční emise skleníkových plynů ČR (${ghg.year})`,
    forms: {
      one: 'roční emise skleníkových plynů celého Česka',
      few: 'roční emise skleníkových plynů celého Česka',
      many: 'ročních emisí skleníkových plynů celého Česka',
      dec: 'ročních emisí skleníkových plynů celého Česka',
      gen: 'ročních emisí skleníkových plynů Česka',
    },
    value: ghg.value * 1e6,
    unit: 't CO2e',
    dimension: 'co2e',
    basis: `celkové emise bez LULUCF, ${ghg.year}`,
    category: 'energetika',
    source_name: 'Eurostat – Greenhouse gas emissions by source sector (env_air_gge)',
    source_url: 'https://ec.europa.eu/eurostat/databrowser/view/env_air_gge/default/table',
    source_id: 'env_air_gge; airpol=GHG; src_crf=TOTX4_MEMO; unit=MIO_T; geo=CZ',
    year: ghg.year,
    note: `Celkem bez LULUCF a bez memo položek (mezinárodní letectví a lodní doprava). Eurostat přebírá národní inventuru (ČHMÚ). Aktualizace ${ghg.updated.slice(0, 10)}.`,
    familiarity: 2,
    time_phrase: 'Česko vypustí tolik skleníkových plynů za {t}',
  });

  // Pozn.: emise na obyvatele (unit=T_HAB) Eurostat pro ČR v env_air_gge neposkytuje.

  writeDataset('eurostat', {
    dataset: 'Eurostat – spotřeba elektřiny domácností, emise skleníkových plynů',
    source_name: 'Eurostat',
    source_url: 'https://ec.europa.eu/eurostat/web/main/data/web-services',
    retrieved_at: TODAY,
    items,
  });
}

// ---------------------------------------------------------------- ČSÚ: CPI a mzdy

const CPI_CSV = 'https://data.csu.gov.cz/opendata/sady/CEN0101A/distribuce/csv';
const MZDR_CSV = 'https://data.csu.gov.cz/opendata/sady/MZDR/distribuce/csv';

async function fetchCpi() {
  const index: Record<number, number> = {};
  await streamCsv(CPI_CSV, (r) => {
    if (r.UZ02P !== 'CZ' || r['ECOICOP.COP1'] !== '00' || r['ECOICOP.COP23'] || r.EKAKTIOCDS !== '0') return;
    if (r.TYPUDAJE4F !== 'IZ2015' || !/^\d{4}$/.test(r.CASMKMQRM12)) return;
    index[Number(r.CASMKMQRM12)] = Number(r.Hodnota);
  });
  if (Object.keys(index).length < 3) throw new Error('CPI: málo let');
  writeJson('cpi', {
    dataset: 'Index spotřebitelských cen – úhrn, roční průměr, bazický index 2015 = 100',
    source_name: 'ČSÚ – Indexy spotřebitelských cen (DataStat CEN0101A)',
    source_url: 'https://data.csu.gov.cz/datastat/info/SADA/CEN0101A',
    source_id: 'CEN0101A; TYPUDAJE IZ2015; ECOICOP 00; domácnosti celkem',
    retrieved_at: TODAY,
    index,
  });
}

async function fetchWages() {
  const byYear = new Map<number, number>();
  await streamCsv(MZDR_CSV, (r) => {
    if (r.IndicatorType !== '5958P' || r.CZNACEMZDY !== 'A-S' || r.KATPMZD !== '0' || r.ZJIST !== '0') return;
    if (r['ISEKTORMZDH.ISEKTOR2'] !== '0' || r['ISEKTORMZDH.ISEKTOR5'] || r['Uz0123vm.STAT'] !== 'CZ') return;
    if (r['Uz0123vm.REGION'] || r['Uz0123vm.KRAJ']) return;
    byYear.set(Number(r.CasR), Number(r.Hodnota));
  });
  const year = Math.max(...byYear.keys());
  writeDataset('csu-mzdy', {
    dataset: 'Průměrná hrubá měsíční mzda',
    source_name: 'ČSÚ',
    source_url: MZDR_CSV,
    retrieved_at: TODAY,
    items: [
      {
        // přepočtový koeficient: peníze ↔ doba práce průměrného zaměstnance
        id: 'prumerna-hruba-mzda',
        label: `průměrná hrubá měsíční mzda (${year})`,
        forms: { one: '-', few: '-', many: '-', dec: '-', gen: '-' },
        value: Math.round(byYear.get(year)!),
        unit: 'Kč',
        dimension: 'money',
        per: null,
        kind: 'rate',
        rate_value: 1,
        rate_unit: 'měsíc',
        rate_dimension: 'time',
        rate_phrase: `průměrný zaměstnanec si tolik (hrubého) vydělá za {n} (mzda ${year})`,
        reverse_phrase: `průměrná hrubá mzda za takovou dobu (kalendářně) činí {n} (mzda ${year})`,
        basis: `průměrná hrubá měsíční mzda ${year}, na přepočtené počty zaměstnanců`,
        category: 'verejne-finance',
        source_name: 'ČSÚ – Průměrná hrubá měsíční mzda (DataStat MZDR)',
        source_url: 'https://data.csu.gov.cz/datastat/info/SADA/MZDR',
        source_id: 'MZDR; ukazatel 5958P; CZ-NACE A-S; ČR',
        year,
        retrieved_at: TODAY,
        note: 'Měsíční částka; zaokrouhleno na celé koruny. Hrubá mzda, ne čistá.',
        familiarity: 3,
      },
    ],
  });
}

// ---------------------------------------------------------------- ČNB

async function fetchRates() {
  const d = await getJson<{ rates: { validFor: string; currencyCode: string; amount: number; rate: number }[] }>(
    'https://api.cnb.cz/cnbapi/exrates/daily?lang=CZ',
  );
  const rates: Record<string, number> = {};
  for (const r of d.rates) rates[r.currencyCode] = r.rate / r.amount;
  if (!rates.EUR || !rates.USD) throw new Error('ČNB: chybí EUR/USD');
  writeJson('rates', {
    date: d.rates[0].validFor,
    rates,
    source_name: 'ČNB – kurzy devizového trhu',
    source_url: 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/',
    retrieved_at: TODAY,
  });
}

// ---------------------------------------------------------------- běh

async function step(name: string, fn: () => Promise<unknown>): Promise<boolean> {
  console.log(`→ ${name}`);
  try {
    await fn();
    return true;
  } catch (e) {
    console.error(`  ✗ ${name} selhal, předchozí data zůstávají: ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  const failures: string[] = [];
  const run = async (name: string, fn: () => Promise<unknown>) => {
    if (!(await step(name, fn))) failures.push(name);
  };
  let ids: Awaited<ReturnType<typeof wikidataIds>> | null = null;
  await run('Wikidata: QID obcí a krajů', async () => (ids = await wikidataIds()));
  let pop: Awaited<ReturnType<typeof fetchPopulation>> | null = null;
  await run('ČSÚ: obyvatelé', async () => (pop = await fetchPopulation(ids)));
  if (pop) {
    await run('ČSÚ: Sčítání 2021', () => fetchCensus(pop!));
    await run('Wikidata: rozloha obcí', () => fetchAreas(pop!));
  }
  await run('Wikidata: elektrárny', fetchPowerPlants);
  await run('Eurostat', fetchEurostat);
  await run('ČSÚ: CPI', fetchCpi);
  await run('ČSÚ: mzdy', fetchWages);
  await run('ČNB: kurzy', fetchRates);
  await run('ČSÚ: ceny, narození, úmrtí, byty, odpady', fetchCsuExtra);
  await run('Eurostat: evropské státy', fetchCountries);
  if (failures.length) {
    console.error(`\nSelhalo: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else console.log('\nHotovo.');
}

main();
