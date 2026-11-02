/** Pomocné funkce pro scripts/fetch-data.ts (Node ≥ 20, vestavěný fetch). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset } from '../src/core/data';
import { validateItem } from '../src/core/data';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATED = resolve(ROOT, 'data/generated');
export const UA = 'Primernik/1.0 (STEM, Ustav empirickych vyzkumu; interni nastroj; https://www.stem.cz)';
export const TODAY = new Date().toISOString().slice(0, 10);

export async function get(url: string, accept = '*/*', tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept } });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status} ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw last;
}

export async function getJson<T = any>(url: string): Promise<T> {
  return (await get(url, 'application/json')).json() as Promise<T>;
}

export async function sparql<T = Record<string, { value: string }>>(query: string): Promise<T[]> {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  const data = await getJson<{ results: { bindings: T[] } }>(url);
  return data.results.bindings;
}

/** Rozdělí řádek CSV s poli v uvozovkách. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Proudově čte CSV z URL a volá `onRow` pro každý řádek jako objekt (hlavička = klíče). */
export async function streamCsv(url: string, onRow: (row: Record<string, string>) => void): Promise<void> {
  const res = await get(url, 'text/csv');
  const reader = res.body!.pipeThrough(new TextDecoderStream('utf-8')).getReader();
  let buf = '';
  let header: string[] | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const cells = splitCsv(line.replace(/\r$/, ''));
    if (!header) {
      header = cells.map((h) => h.replace(/^﻿/, ''));
      return;
    }
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    onRow(row);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  handle(buf);
}

/** Zvaliduje a zapíše datovou sadu. Nevalidní položky vyřadí a vypíše. */
export function writeDataset(name: string, ds: Dataset): number {
  const ok = ds.items.filter((it) => {
    const errors = validateItem(it);
    if (errors.length) console.warn(`  ✗ ${name}/${it.id}: ${errors.join('; ')}`);
    return errors.length === 0;
  });
  if (ok.length === 0) throw new Error(`${name}: žádná platná položka – soubor nepřepisuji`);
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(resolve(GENERATED, `${name}.json`), JSON.stringify({ ...ds, items: ok }, null, 1) + '\n');
  console.log(`  ✓ ${name}: ${ok.length} položek`);
  return ok.length;
}

export function writeJson(name: string, data: unknown): void {
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(resolve(GENERATED, `${name}.json`), JSON.stringify(data, null, 1) + '\n');
  console.log(`  ✓ ${name}`);
}

/** Stejné tvary pro všechny pády – pro lokality, kde se popisek ve větách neskloňuje. */
export function sameForms(gen: string) {
  return { one: gen, few: gen, many: gen, dec: gen, gen };
}
