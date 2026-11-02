/**
 * Vypíše návrhy pro vzorové vstupy (kontrola věcné správnosti a srozumitelnosti).
 * Použití: npm run examples [-- "3 MW" "5 mld. Kč"]
 */
import { compare, copyText } from '../src/core/comparisons';
import { parse } from '../src/core/parser';
import { powerPresets } from '../src/core/presets';
import { rankPages } from '../src/core/ranker';
import { loadCatalog } from './load-catalog';

const cat = loadCatalog();
const inputs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['3 MW', '5 miliard Kč', '200 tisíc domácností', '1 TWh', '50 000 t CO2', '300 ha'];
const presets = powerPresets(cat.refs);

for (const input of inputs) {
  const p = parse(input, cat.rates ?? undefined);
  console.log(`\n=== ${input}`);
  if (!p.ok) {
    console.log(`  CHYBA: ${p.error}`);
    continue;
  }
  const it = p.interpretations[0];
  console.log(`  Rozumím: ${it.explain}`);
  const variants = it.quantity.dim === 'power' ? [null, presets[0]] : [null];
  for (const power of variants) {
    if (power) console.log(`  -- s předpokladem: ${power.label}`);
    const pages = rankPages(compare(it.quantity, input, cat.refs, { power, cpi: null }), { currentYear: 2026 });
    pages.slice(0, 2).forEach((page, i) => {
      console.log(`  [stránka ${i + 1}]`);
      for (const s of page) {
        console.log(`   ${s.score.total.toFixed(2)} ${s.type.padEnd(10)} ${copyText(input, s).replace(/\(zdroj: .*\)$/, `(${s.refs.map((r) => `${r.source_name}, ${r.year}`).join('; ')})`)}`);
        for (const step of s.steps) console.log(`        · ${step}`);
        for (const a of s.assumptions) console.log(`        ! ${a}`);
      }
    });
  }
}
