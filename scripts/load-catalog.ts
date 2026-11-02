/** Načtení katalogu ze souborů (pro skripty běžící v Node, mimo Vite). */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCatalog } from '../src/core/catalog';
import { ROOT } from './lib';

export function loadCatalog() {
  const read = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf-8'));
  const files = readdirSync(resolve(ROOT, 'data/generated'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => read(`data/generated/${f}`));
  return buildCatalog(read('data/curated.json'), files);
}
