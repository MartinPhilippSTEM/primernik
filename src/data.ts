/** Data přibalená k buildu (žádné načítání za běhu, žádné API). */
import curated from '../data/curated.json';
import { buildCatalog } from './core/catalog';
import type { RefItem } from './core/types';

const files = Object.values(import.meta.glob('../data/generated/*.json', { eager: true, import: 'default' }));

export const catalog = buildCatalog(curated as RefItem[], files);
