/**
 * Validace všech dat + náhodný vzorek k ruční kontrole.
 * Použití: npm run validate-data [-- --sample 10]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateItem } from '../src/core/data';
import type { RefItem } from '../src/core/types';
import { ROOT } from './lib';
import { loadCatalog } from './load-catalog';

const read = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf-8'));
const sources: [string, RefItem[]][] = [['data/curated.json', read('data/curated.json')]];
for (const f of readdirSync(resolve(ROOT, 'data/generated')).filter((x) => x.endsWith('.json'))) {
  const d = read(`data/generated/${f}`);
  if (d.items) sources.push([`data/generated/${f}`, d.items]);
}

let errors = 0;
for (const [file, items] of sources) {
  for (const it of items) {
    const e = validateItem(it);
    if (e.length) {
      errors++;
      console.error(`✗ ${file} ${it.id}: ${e.join('; ')}`);
    }
  }
  console.log(`${file}: ${items.length} položek`);
}
const cat = loadCatalog(); // vyhodí chybu i u duplicitních id
console.log(`Celkem v katalogu: ${cat.refs.length}`);
if (errors) {
  console.error(`\n${errors} nevalidních položek.`);
  process.exit(1);
}

const n = Number(process.argv[process.argv.indexOf('--sample') + 1]) || 0;
if (n) {
  console.log(`\nNáhodný vzorek ${n} položek k ruční kontrole:`);
  const all = sources.flatMap(([, items]) => items);
  for (let i = 0; i < n; i++) {
    const it = all[Math.floor(Math.random() * all.length)];
    console.log(`- ${it.id}: ${it.value} ${it.unit} (${it.basis}, ${it.year}) → ${it.source_url}${it.source_id ? ` [${it.source_id}]` : ''}`);
  }
}
