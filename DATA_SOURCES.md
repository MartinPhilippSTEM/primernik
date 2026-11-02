# Zdroje dat

Poslední stažení všech zdrojů: **2. 11. 2026**. U každé položky je datum stažení uložené v poli `retrieved_at`; po každé automatické aktualizaci ho najdete i v historii gitu.

## Stahované automaticky (`npm run fetch-data` → `data/generated/`)

| Soubor | Zdroj | Co | Identifikátor | Licence / podmínky |
|---|---|---|---|---|
| `csu-obyvatele.json` | ČSÚ, DataStat – [Počet obyvatel podle pohlaví](https://data.csu.gov.cz/datastat/info/SADA/OBY02A) | obyvatelé ČR, 14 krajů a 731 obcí s alespoň 2 000 obyvateli, k 1. 1. 2026 | sada `OBY02A`, ukazatel `2406P`, kód obce; QID z Wikidat | NKOD: neobsahuje autorská díla, databáze není chráněna (odpovídá CC0); doporučeno uvádět zdroj |
| `csu-domacnosti.json` | ČSÚ, [Sčítání 2021 – Hospodařící domácnosti](https://csu.gov.cz/docs/107508/05638b19-13ea-2ecf-f097-608a80e053eb/sldb2021_domacnosti_clenu_typ.csv) | hospodařící domácnosti: ČR, kraje, stejné obce | ukazatel `2423`, číselník území 97/100/43 | dtto |
| `csu-byty.json` | ČSÚ, [Sčítání 2021 – Obydlené byty](https://csu.gov.cz/docs/107508/cd4228aa-2957-1e6a-3e30-7b03c3c8deb7/sldb2021_byty_osoby.csv) | obydlené byty: ČR, kraje, obce | ukazatel `2607` | dtto |
| `csu-mzdy.json` | ČSÚ, DataStat – [MZDR](https://data.csu.gov.cz/datastat/info/SADA/MZDR) | průměrná hrubá měsíční mzda (2025) | `MZDR`, ukazatel `5958P` | dtto |
| `cpi.json` | ČSÚ, DataStat – [CEN0101A](https://data.csu.gov.cz/datastat/info/SADA/CEN0101A) | index spotřebitelských cen, roční průměr, 2015 = 100 (2018–2025) | `CEN0101A`, `IZ2015`, úhrn | dtto |
| `wikidata-rozloha-obci.json` | [Wikidata](https://www.wikidata.org) (SPARQL) | rozloha 717 obcí, **jen tvrzení s referencí** (většinou „Malý lexikon obcí ČR 2017“, ČSÚ) | QID, vlastnost `P2046`, kód obce `P7606` | CC0 |
| `wikidata-elektrarny.json` | Wikidata | instalovaný výkon elektráren s referencí **a datem** | QID, `P2109` | CC0 |
| `eurostat.json` | Eurostat API – [nrg_d_hhq](https://ec.europa.eu/eurostat/databrowser/view/nrg_d_hhq/default/table), [env_air_gge](https://ec.europa.eu/eurostat/databrowser/view/env_air_gge/default/table) | spotřeba elektřiny domácností ČR (2024); emise skleníkových plynů ČR bez LULUCF (2024) | kódy dimenzí v `source_id` | CC BY 4.0 (Eurostat copyright notice) – uvádět zdroj |
| `rates.json` | [ČNB](https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/) – `api.cnb.cz` | denní kurzy (EUR, USD, GBP, …), 2. 11. 2026 | – | veřejné údaje ČNB, uvádět zdroj |

**Vynecháno záměrně:**

- Ve Wikidatech má většina elektráren výkon s referencí, ale **bez roku** (chybí kvalifikátor data i datum stažení reference). Podle pravidla „každé číslo má rok“ je skript vynechá, prošla jen 1 elektrárna. Výkony hlavních elektráren jsou proto v kurátorovaných datech z výroční zprávy ČEZ.
- Ukazatel „emise na obyvatele“ (`env_air_gge`, jednotka `T_HAB`) Eurostat pro ČR neposkytuje.

## Kurátorované (`data/curated.json`, 78 položek)

Každá položka má přímý odkaz, rok, datum ověření (2. 11. 2026) a doslovný úryvek ze zdroje (`evidence`).

| Kategorie | Počet | Hlavní zdroje |
|---|---|---|
| Energetika | 32 | ERÚ – Roční zpráva o provozu ES ČR 2025; ČEZ – tiskové zprávy a Výroční finanční zpráva 2025; ČSÚ – ENERGO 2021; EU ETS – ověřené emise 2025 (Evropská komise); OTE; Vestas; Škoda Storyboard |
| Veřejné finance | 21 | Zákon č. 38/2026 Sb. o státním rozpočtu (zakonyprolidi.cz); MF ČR; MPSV; ČSÚ; ŘSD; DPP |
| Geografie | 14 | ČSÚ; ČÚZK; IPR Praha; Povodí Vltavy; FIFA; World Aquatics; prague.eu; Praha-příroda |
| Každodenní | 11 | ceníky Škoda Auto; DPP; ČT a ČRo (poplatky); eDálnice; Siemens; Airbus; O2 arena; SK Slavia |

Fakta (čísla) nejsou autorským dílem. Z textů zdrojů jsou převzaty jen krátké citace jako doklad.

### Položky s výhradou (popsáno v poli `note`)

- **Olympijský bazén – objem a plocha, fotbalové hřiště – plocha:** součin rozměrů, které uvádí zdroj (World Aquatics: minimální rozměry; FIFA: 105 × 68 m).
- **Televizní poplatek za rok:** 12 × 150 Kč (zákonný měsíční poplatek).
- **Temelín – instalovaný výkon 2 250 MW** (2 × 1 125 MWe, výroční zpráva ČEZ 2025). Tisková zpráva ČEZ z 14. 7. 2026 uvádí „elektrický výkon“ 2 172 MW.
- **Stromovka** (96,7 ha): stejná stránka uvádí i 88,61 ha (jiné vymezení).
- **Kapacita O2 areny 17 500** = k sezení; na koncerty až 20 000.
- **Metro D, D35:** smluvní ceny bez DPH, ne konečné náklady. D35 v cenách roku 2018.
- **Průměrná spotřeba elektřiny bytu (3 685,5 kWh):** ČSÚ ENERGO 2021, na obydlený byt (ne na odběrné místo).
- **Výroba vodních elektráren 2025:** suchý rok (−39,9 %).

### Dohledáno, ale vyřazeno (nejednoznačné nebo neověřitelné)

Dukovany – instalovaný výkon (ČEZ uvádí 2 048 i 2 096 MW), Lipno I (139 vs. 120 MW), Počerady uhelná (1 050 vs. 1 000 MW) a paroplynová (844,9 vs. 888 MW), Dětmarovice (odstaveno 2025), Chvaletice (citaci nešlo přesně ověřit), Ledvice a Mělník (zdroj uvádí jen bloky, součet by byl dopočet), Pražský hrad (rozloha se liší podle vymezení), Petřínská rozhledna (58,7 vs. 65,5 m), rozpočet Prahy 2026 (praha.eu nešel otevřít), rozpočet SFDI 2026, počet zaměstnaných (jen v nečitelných PDF), baterie Tesla Model Y (výrobce kapacitu neuvádí).

## Předvolby „výkon → energie“

Žádný oficiální zdroj neuvádí typické roční využití výkonu podle zdroje přímo. Aplikace ho proto počítá průhledně: výroba ÷ instalovaný výkon ze dvou citovaných položek, a výpočet se ukazuje u výsledku:

| Předvolba | Hodin/rok | Výpočet |
|---|---|---|
| nepřetržitý provoz | 8 760 | definice |
| fotovoltaika v ČR | 923 | ERÚ 2025: 4 374,8 GWh ÷ 4 740,1 MW (výroba nezahrnuje FVE nehlásící OTE → skutečnost je o něco vyšší) |
| větrné elektrárny v ČR | 1 763 | ERÚ 2025: 666,2 GWh ÷ 377,9 MW |
| jádro (Temelín) | 7 724 | ČEZ 2025: 17,38 TWh ÷ 2 250 MW |

Předvolba pro plyn chybí: nenašli jsme ověřitelnou výrobu a výkon plynových elektráren za stejný rok.
