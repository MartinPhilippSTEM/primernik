/**
 * Společné typy jádra Příměrníku.
 *
 * Každá veličina se interně ukládá v základní jednotce své dimenze
 * (viz BASE_UNIT v units.ts) a nese případný příznak toku „za rok“.
 */

export type Dimension =
  | 'money' // Kč
  | 'power' // W
  | 'energy' // Wh
  | 'mass' // kg
  | 'co2' // kg CO2
  | 'co2e' // kg CO2e
  | 'area' // m²
  | 'length' // m
  | 'volume' // m³
  | 'persons' // osoby
  | 'households' // domácnosti
  | 'dwellings' // byty
  | 'time'; // s

/** `year` = roční tok (Kč/rok, MWh/rok); `null` = stav nebo jednorázové množství. */
export type Per = 'year' | null;

/** Tok tak, jak ho uvádí zdroj; při načtení se převede na „za rok“ (viz PER_FACTORS v units.ts). */
export type DataPer = 'year' | 'month' | 'day' | 'second' | null;

export interface Quantity {
  /** Hodnota v základní jednotce dimenze. */
  value: number;
  dim: Dimension;
  per: Per;
  /** Kód měny, ze které byla peněžní hodnota převedena (jen informačně). */
  currency?: string;
}

export type Category = 'kazdodenni' | 'energetika' | 'verejne-finance' | 'geografie';

export const CATEGORY_LABELS: Record<Category, string> = {
  kazdodenni: 'Každodenní',
  energetika: 'Energetika',
  'verejne-finance': 'Veřejné finance',
  geografie: 'Geografie a obyvatelstvo',
};

/** Tvary popisku pro větu „≈ N <tvar>“ a pro podíl „X % <gen>“. */
export interface Forms {
  one: string; // 1
  few: string; // 2–4
  many: string; // 5+ (a 0)
  dec: string; // desetinné číslo (2. pád j. č.)
  gen: string; // 2. pád pro podíl („0,25 % výdajů …“)
}

/** Referenční položka tak, jak je uložena v JSON datech. */
export interface RefItem {
  id: string;
  label: string;
  forms: Forms;
  /** Text před číslem u násobku: „≈ <prefix> 5 100 <forms>“ (forms jsou pak ve 2. pádě). */
  prefix?: string;
  value: number;
  unit: string;
  dimension: Dimension;
  per: DataPer;
  /**
   * unit = věc k násobení, aggregate = celek pro podíl,
   * rate = přepočtový koeficient: `value unit` připadá na `rate_value rate_unit`.
   */
  kind: 'unit' | 'aggregate' | 'rate';
  basis: string;
  category: Category;
  source_name: string;
  source_url: string;
  source_id: string | null;
  year: number;
  retrieved_at: string;
  note: string;
  familiarity: 1 | 2 | 3;
  evidence?: string;
  /** Skupina podobných položek (např. HDP států, ceny potravin) – na stránce se ukáže nejvýš jedna. */
  group?: string;
  /** Zvláštní role položky (jmenovatel „na obyvatele“, lokalita apod.). */
  tags?: string[];
  /** Územní úroveň u lokalit (zeme = jiný stát Evropy). */
  level?: 'stat' | 'kraj' | 'obec' | 'zeme';
  /** Název lokality v 1. pádě (pro věty „tolik obyvatel má X“). */
  place?: string;
  /** Definice domácnosti (ČSÚ rozlišuje hospodařící, cenzové …). */
  household_definition?: string;
  /** Věta pro časový ekvivalent; {t} se nahradí dobou, např. „Temelín by to vyrobil za {t}“. */
  time_phrase?: string;
  /** Jen u kind = rate: jmenovatel koeficientu (např. 100 km). */
  rate_value?: number;
  rate_unit?: string;
  rate_dimension?: Dimension;
  /** Věta pro přepočet dimension → rate_dimension; {n} = převedené množství. */
  rate_phrase?: string;
  /** Věta pro opačný směr; {n} = množství v `unit`. */
  reverse_phrase?: string;
}

/** Položka po načtení: hodnota převedená na základní jednotky. */
export interface Ref extends RefItem {
  q: Quantity;
  /** Jen u kind = rate: jmenovatel v základních jednotkách. */
  rq?: Quantity;
}
