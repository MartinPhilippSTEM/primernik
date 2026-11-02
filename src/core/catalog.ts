/** Sestavení katalogu referencí z kurátorovaných a stažených dat. */
import type { CpiTable } from './comparisons';
import { toRefs, type Dataset } from './data';
import type { Ref, RefItem } from './types';
import type { Rates } from './units';

export interface RatesFile extends Rates {
  source_name: string;
  source_url: string;
}

export interface CpiFile extends CpiTable {
  retrieved_at: string;
}

export interface Catalog {
  refs: Ref[];
  rates: RatesFile | null;
  cpi: CpiFile | null;
  /** Poslední rok s celoročním průměrem CPI. */
  cpiYear: number | null;
}

/** `files` = obsah všech JSON v data/generated (datové sady, rates.json, cpi.json). */
export function buildCatalog(curated: RefItem[], files: unknown[]): Catalog {
  const datasets = files.filter((f): f is Dataset => !!f && Array.isArray((f as Dataset).items));
  const rates = (files.find((f) => f && typeof f === 'object' && 'rates' in f) as RatesFile) ?? null;
  const cpi = (files.find((f) => f && typeof f === 'object' && 'index' in f) as CpiFile) ?? null;
  const items = [...curated, ...datasets.flatMap((d) => d.items)];
  const years = cpi ? Object.keys(cpi.index).map(Number) : [];
  return {
    refs: toRefs(items, rates ?? undefined),
    rates,
    cpi,
    cpiYear: years.length ? Math.max(...years) : null,
  };
}
