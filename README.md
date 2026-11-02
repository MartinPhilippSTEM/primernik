# Příměrník

Interní nástroj STEM, Ústavu empirických výzkumů. Do pole zadáte číslo s jednotkou (např. `5 mld. Kč`, `3 MW`, `200 tisíc domácností`) a dostanete několik **přesných a dohledatelných přirovnání** pro prezentaci nebo projev, například:

> 5 mld. Kč ≈ 0,69 % výdajů na důchody 2026
> 5 mld. Kč: stát tolik vydá ze státního rozpočtu za ≈ 18 hodin
> 1 TWh: české jaderné elektrárny vyrobí tolik elektřiny za ≈ 11 dní

Každé číslo má zdroj, rok a datum stažení. U každého návrhu je rozbalovací detail výpočtu a tlačítko **Kopírovat**, které zkopíruje větu i se zdrojem. Zadání se ukládá do adresy stránky (`?q=…`), takže odkaz můžete poslat kolegovi.

Aplikace nic neplatí a nic nevolá: je to statická stránka, data jsou přibalená. Žádná AI, žádný server.

---

## 1. Nasazení na GitHub Pages (jednou)

1. Na GitHubu vytvořte nový repozitář, např. `primernik` (může být soukromý, pokud to vaše organizace u Pages podporuje).
2. Nahrajte do něj obsah této složky. Z příkazové řádky ve složce `primernik`:
   ```bash
   git remote add origin https://github.com/<organizace-nebo-uzivatel>/primernik.git
   ```
   ```bash
   git push -u origin main
   ```
3. Na GitHubu otevřete **Settings → Pages** a v části **Build and deployment → Source** zvolte **GitHub Actions**.
4. Otevřete záložku **Actions**. Workflow **Nasazení na GitHub Pages** proběhne samo, trvá asi 1–2 minuty. Adresa stránky pak bude `https://<organizace-nebo-uzivatel>.github.io/primernik/`.

Každá další změna nahraná do větve `main` se nasadí automaticky. Nejdřív ale musí projít testy; když selžou, stránka zůstane ve staré verzi.

## 2. Aktualizace dat

**Automaticky:** workflow **Aktualizace dat** běží 3. dne v každém měsíci. Stáhne data z ČSÚ, Wikidat, Eurostatu a ČNB, zkontroluje je, spustí testy a změny uloží jako commit. V historii repozitáře tak přesně vidíte, která čísla se změnila. Stránka se pak sama znovu nasadí.

**Ručně:** na GitHubu otevřete **Actions → Aktualizace dat → Run workflow**.

Když některý zdroj nefunguje, jeho předchozí data zůstanou beze změny a běh skončí červeně. V záznamu běhu je vidět, který zdroj selhal.

> Kurátorovaná data (`data/curated.json`) se automaticky **neaktualizují**. Jednou ročně je projděte, hlavně ceny, státní rozpočet a výrobu elektřiny.

## 3. Jak přidat kurátorovanou položku

Kurátorované položky jsou čísla, která nejdou stáhnout automaticky: ceny, pravidla, rozpočet, výroba elektráren… Jsou v souboru [`data/curated.json`](data/curated.json).

1. Na GitHubu otevřete `data/curated.json` a klikněte na tužku (Edit).
2. Zkopírujte existující podobnou položku a upravte ji. Vzor:
   ```json
   {
    "id": "skoda-fabia-cena",
    "label": "nová Škoda Fabia (základní verze)",
    "forms": {
     "one": "nová Škoda Fabia",
     "few": "nové Škody Fabia",
     "many": "nových Škod Fabia",
     "dec": "nové Škody Fabia",
     "gen": "nové Škody Fabia"
    },
    "value": 399900,
    "unit": "Kč",
    "dimension": "money",
    "per": null,
    "kind": "unit",
    "basis": "cena základní verze dle ceníku",
    "category": "kazdodenni",
    "source_name": "Škoda Auto – ceník Škoda Fabia",
    "source_url": "https://…přímý odkaz na stránku nebo PDF…",
    "source_id": null,
    "year": 2026,
    "retrieved_at": "2026-11-02",
    "note": "",
    "familiarity": 3,
    "evidence": "doslovný krátký úryvek ze zdroje s číslem"
   }
   ```
3. Uložte (Commit changes). Testy zkontrolují, že položka má zdroj, rok, dimenzi a věrohodnou hodnotu. Když něco chybí, nasazení se zastaví a v záložce Actions uvidíte, co opravit.

**Co znamenají pole:**

| Pole | Význam |
|---|---|
| `forms` | tvary pro větu: `one` = „1 nová Škoda Fabia“, `few` = „3 nové Škody Fabia“, `many` = „12 nových Škod Fabia“, `dec` = „1,5 nové Škody Fabia“, `gen` = podíl „0,3 % nové Škody Fabia“ |
| `prefix` (nepovinné) | text před číslem, např. `"roční spotřeba elektřiny"` → „≈ roční spotřeba elektřiny 7 100 průměrných bytů“; `forms` jsou pak ve 2. pádě |
| `value`, `unit` | hodnota tak, jak ji uvádí zdroj. Jednotky: `Kč`, `EUR`, `USD`, `W`, `kW`, `MW`, `GW`, `kWh`, `MWh`, `GWh`, `TWh`, `kg`, `t`, `t CO2`, `t CO2e`, `m2`, `ha`, `km2`, `m`, `km`, `m3`, `l`, `osoba`, `domácnost`, `byt`, `s`, `h`, `den` |
| `dimension` | `money`, `power`, `energy`, `mass`, `co2`, `co2e`, `area`, `length`, `volume`, `persons`, `households`, `dwellings`, `time` |
| `per` | `"year"`, pokud jde o roční tok (rozpočet, výroba za rok), jinak `null` |
| `kind` | `"unit"` = věc, kterou jde násobit (auto, hřiště); `"aggregate"` = celek, ze kterého se počítá podíl (rozpočet, emise ČR) |
| `category` | `kazdodenni`, `energetika`, `verejne-finance`, `geografie` |
| `year` | rok, ke kterému hodnota platí (u cen rok ceníku; podle něj se dělá přepočet inflací) |
| `familiarity` | 1–3; 3 = zná každý (Fabia, Temelín, státní rozpočet) |
| `time_phrase` (nepovinné) | u ročních toků věta pro časový ekvivalent, `{t}` se nahradí dobou: `"stát tolik vydá ze státního rozpočtu za {t}"` |

**Pravidla:** jen hodnoty, které jste sami viděli na primárním zdroji (úřad, výrobce, provozovatel). Nic neodhadovat ani nedopočítávat. Wikipedie ani zpravodajské weby nejsou zdroj.

## 4. Spuštění na vlastním počítači (nepovinné)

Potřebujete [Node.js](https://nodejs.org/) verze 20 nebo novější. Ve složce `primernik`:

```bash
npm ci
```
```bash
npm run dev
```

Stránka poběží na `http://localhost:5173`. Další příkazy:

| Příkaz | Co dělá |
|---|---|
| `npm test` | všechny testy (parser, jednotky, skloňování, přirovnání, validace dat) |
| `npm run fetch-data` | stáhne data do `data/generated/` |
| `npm run validate-data -- --sample 10` | zkontroluje data a vypíše 10 náhodných položek k ruční kontrole |
| `npm run examples -- "3 MW" "5 mld. Kč"` | vypíše návrhy pro zadané vstupy včetně výpočtu (kontrola kvality) |
| `npm run build` | sestaví statickou stránku do `dist/` |

## 5. Jak aplikace funguje

```
src/core/units.ts        jednotky a dimenze (vlastní tabulka převodů, pokrytá testy)
src/core/parser.ts       čtení českého zápisu („5,5 mil. Kč“, „3MW“, „120 MWh/rok“)
src/core/czech.ts        čísla (Intl cs-CZ), 2 platné číslice, skloňování, doby
src/core/comparisons.ts  pět typů přirovnání
src/core/ranker.ts       bodování a výběr návrhů
src/core/presets.ts      předvolby převodu výkon → energie
src/main.ts, styles.css  rozhraní
scripts/fetch-data.ts    stahování dat
data/curated.json        ručně ověřené položky
data/generated/*.json    stažená data (needitovat ručně)
```

**Jednotky.** Vše se počítá v základních jednotkách (Kč, W, Wh, kg, kg CO2, kg CO2e, m², m, m³, osoby, domácnosti, byty, s). Porovnává se jen stejná veličina. Jediné výjimky jsou výslovné:

- **Výkon → energie** jen přes předpoklad, který zvolíte a který je vidět i v kopírované větě. Na výběr je nepřetržitý provoz 8 760 h/rok, typické využití FVE, větru nebo jádra, nebo vlastní počet hodin.
- **CO2 → CO2e** je povoleno (1 t CO2 = 1 t CO2e), opačně ne.

Domácnosti jsou vždy hospodařící domácnosti ze Sčítání 2021. Průměrná spotřeba elektřiny podle ČSÚ je na obydlený byt, proto se porovnává s počtem bytů, ne domácností.

**Typy přirovnání:** násobek, podíl celku, na obyvatele nebo domácnost, časový ekvivalent a ekvivalent lokality (nejbližší obec nebo kraj, odchylka nejvýš 15 %).

**Výběr.** Skóre = 0,40 × poměr + 0,30 × známost + 0,15 × kulatost + 0,15 × čerstvost.
- Poměr: násobky ideálně 1–100, podíly 1–50 %.
- Hypotetické návrhy („při plném výkonu“) mají poměr poloviční.
- Na stránku nejvýš 8 návrhů a z každého typu nejvýš 2. Rozpis skóre je v detailu každého návrhu.

**Inflace.** Volitelně lze starší ceny přepočítat indexem spotřebitelských cen ČSÚ na ceny posledního celého roku. U výsledku je pak napsáno „v cenách roku X“. Bez přepočtu nesou ceny starší než loňské ve větě „(ceny roku X)“.

Zdroje a licence jsou v [DATA_SOURCES.md](DATA_SOURCES.md).
