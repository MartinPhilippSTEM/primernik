# Zdroje dat

Poslední stažení všech zdrojů: **2. 11. 2026**. U každé položky je datum stažení uložené v poli `retrieved_at`; po každé automatické aktualizaci ho najdete i v historii gitu.

## Stahované automaticky (`npm run fetch-data` → `data/generated/`)

| Soubor | Zdroj | Co | Identifikátor | Licence / podmínky |
|---|---|---|---|---|
| `csu-obyvatele.json` | ČSÚ, DataStat – [Počet obyvatel podle pohlaví](https://data.csu.gov.cz/datastat/info/SADA/OBY02A) | obyvatelé ČR, 14 krajů a 731 obcí s alespoň 2 000 obyvateli, k 1. 1. 2026 | sada `OBY02A`, ukazatel `2406P`, kód obce; QID z Wikidat | NKOD: neobsahuje autorská díla, databáze není chráněna (odpovídá CC0); doporučeno uvádět zdroj |
| `csu-domacnosti.json` | ČSÚ, [Sčítání 2021 – Hospodařící domácnosti](https://csu.gov.cz/docs/107508/05638b19-13ea-2ecf-f097-608a80e053eb/sldb2021_domacnosti_clenu_typ.csv) | hospodařící domácnosti: ČR, kraje, stejné obce | ukazatel `2423`, číselník území 97/100/43 | dtto |
| `csu-byty.json` | ČSÚ, [Sčítání 2021 – Obydlené byty](https://csu.gov.cz/docs/107508/cd4228aa-2957-1e6a-3e30-7b03c3c8deb7/sldb2021_byty_osoby.csv) | obydlené byty: ČR, kraje, obce | ukazatel `2607` | dtto |
| `csu-mzdy.json` | ČSÚ, DataStat – [MZDR](https://data.csu.gov.cz/datastat/info/SADA/MZDR) | průměrná hrubá měsíční mzda (2025) – jako přepočet peníze ↔ doba práce | `MZDR`, ukazatel `5958P` | dtto |
| `cpi.json` | ČSÚ, DataStat – [CEN0101A](https://data.csu.gov.cz/datastat/info/SADA/CEN0101A) | index spotřebitelských cen, roční průměr, 2015 = 100 (2018–2025) | `CEN0101A`, `IZ2015`, úhrn | dtto |
| `wikidata-rozloha-obci.json` | [Wikidata](https://www.wikidata.org) (SPARQL) | rozloha 717 obcí, **jen tvrzení s referencí** (většinou „Malý lexikon obcí ČR 2017“, ČSÚ) | QID, vlastnost `P2046`, kód obce `P7606` | CC0 |
| `wikidata-elektrarny.json` | Wikidata | instalovaný výkon elektráren s referencí **a datem** | QID, `P2109` | CC0 |
| `eurostat.json` | Eurostat API – [nrg_d_hhq](https://ec.europa.eu/eurostat/databrowser/view/nrg_d_hhq/default/table), [env_air_gge](https://ec.europa.eu/eurostat/databrowser/view/env_air_gge/default/table) | spotřeba elektřiny domácností ČR (2024); emise skleníkových plynů ČR bez LULUCF (2024) | kódy dimenzí v `source_id` | CC BY 4.0 (Eurostat copyright notice) – uvádět zdroj |
| `csu-ceny-a-toky.json` | ČSÚ, DataStat – [CEN0101N](https://data.csu.gov.cz/datastat/info/SADA/CEN0101N), [CENPHMT](https://data.csu.gov.cz/datastat/info/SADA/CENPHMT), [OBY03C](https://data.csu.gov.cz/datastat/info/SADA/OBY03C), [OBY04A](https://data.csu.gov.cz/datastat/info/SADA/OBY04A), [STA09A](https://data.csu.gov.cz/datastat/info/SADA/STA09A), [ZPR66](https://data.csu.gov.cz/datastat/info/SADA/ZPR66), [SLD040](https://data.csu.gov.cz/datastat/info/SADA/SLD040) | průměrné ceny 22 druhů zboží (pivo, chléb, máslo, vejce…, poslední měsíc), benzín a nafta (poslední týden), živě narození a zemřelí za rok, dokončené byty za rok, komunální odpad za rok, průměrná plocha bytu | kódy sad a reprezentantů v `source_id` | dtto ČSÚ |
| `eurostat-staty.json` | Eurostat – [tps00001](https://ec.europa.eu/eurostat/databrowser/view/tps00001/default/table), [reg_area3](https://ec.europa.eu/eurostat/databrowser/view/reg_area3/default/table), [nama_10_gdp](https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table) | obyvatelé, rozloha a HDP evropských států (EU, EFTA, kandidátské země) | `geo` kód v `source_id` | CC BY 4.0 |
| `rates.json` | [ČNB](https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/) – `api.cnb.cz` | denní kurzy (EUR, USD, GBP, …), 2. 11. 2026 | – | veřejné údaje ČNB, uvádět zdroj |

**Vynecháno záměrně:**

- Ve Wikidatech má většina elektráren výkon s referencí, ale **bez roku** (chybí kvalifikátor data i datum stažení reference). Podle pravidla „každé číslo má rok“ je skript vynechá, prošla jen 1 elektrárna. Výkony hlavních elektráren jsou proto v kurátorovaných datech z výroční zprávy ČEZ.
- Ukazatel „emise na obyvatele“ (`env_air_gge`, jednotka `T_HAB`) Eurostat pro ČR neposkytuje.

## Kurátorované (`data/curated.json`, 370 položek)

Každá položka má přímý odkaz, rok, datum ověření (2. 11. 2026) a doslovný úryvek ze zdroje (`evidence`). Položky dohledali a otevřeli pomocní výzkumní agenti. Náhodné vzorky ověřil ručně hlavní běh ve třech vlnách: 15, 6 a 5 položek, všechny odpovídaly zdroji.

| Okruh | Příklady | Hlavní zdroje |
|---|---|---|
| Energetika | výroba Temelína a Dukovan, výkony elektráren, ERÚ 2025, emise EU ETS, výhřevnost a emisní faktory paliv, cena elektřiny, Elroq, dotace NZÚ na tepelné čerpadlo | ERÚ, ČEZ, MŽP (NIR 2026), MPO, OTE, Eurostat, Škoda |
| Veřejné finance | státní rozpočet 2026 a kapitoly (vč. Kanceláře prezidenta, Sněmovny, Senátu), HDP, dluh, Dukovany II, F-35, Leopard 2A8, CV90, Vltavská filharmonie, odměna za olympijské zlato | zákon č. 38/2026 Sb., MF, MO, Praha, ČOV |
| Lidé a toky | Letiště Praha, metro, ČD, ZOO Praha, NPÚ, Národní muzeum, hasiči, Sokol, Junák, Sněmovna; kapacity railjetu, ComfortJetu, Pendolina, autobusů DPP | provozovatelé, ČSÚ, MV, MZ |
| Svět a zajímavosti | Tokyo Skytree, Big Ben, šikmá věž v Pise, Golden Gate, tunel pod Gotthardem a Lamanšským průlivem, LHC, Wembley, Louvre, Šinkansen, ICE, Emirates A380, Saturn V, Bagger 293, rychlost světla, ISS, Mariánský příkop, Bajkal, Velký bariérový útes, kostra plejtvaka, rekordní dýně, Nobelova cena, Wimbledon, MS ve fotbale 2026, Liga mistrů, Salvator Mundi, Webbův teleskop, Super Bowl, Eurovize, Oktoberfest | oficiální weby staveb a provozovatelů, NASA, ESA, BIPM, NOAA, UNESCO, CERN, Guinness World Records, FIFA, UEFA, NASA OIG, GAO |
| Geografie | Pražský hrad (Guinness), katedrála sv. Víta, tunel Blanka, Macocha, Punkevní jeskyně, Orlík, národní parky, chmel, pivo, kapr, víno | ČSÚ, TSK, Správa jeskyní, Povodí Vltavy, MZe |
| Každodenní | iPhone, LEGO Millennium Falcon, Netflix, Spotify, Tesla Model 3, Škoda Kodiaq a Superb, vstupné do ZOO a na Hrad, kino, ceníky MHD | apple.com/cz, lego.com, výrobci, ZOO Praha, hrad.cz, Unie filmových distributorů |

**Přepočtové koeficienty** (`kind: "rate"`, 36 položek) propojují veličiny:
- emise a spotřeba Škody Fabia a Octavia (WLTP), spotřeba Elroqu a Enyaqu;
- výhřevnost a emisní faktory benzínu, nafty, hnědého uhlí a zemního plynu (MŽP), hustota benzínu;
- emisní faktor české elektřiny 2025 (MPO);
- cena elektřiny a plynu pro domácnosti (Eurostat, 1. pololetí 2026);
- minimální hodinová mzda (MPSV);
- energie v Horalkách, Pilsner Urquell a Kofole (údaje z obalu na rohlik.cz);
- rychlosti: světlo (BIPM), Země kolem Slunce, rotace Země, Měsíc, ISS, Parker Solar Probe, Apollo 10, Thrust SSC, rekordní TGV, Šinkansen, pražské metro, Usain Bolt.

Automaticky se k nim přidává průměrná hrubá mzda (ČSÚ).

Fakta (čísla) nejsou autorským dílem. Z textů zdrojů jsou převzaty jen krátké citace jako doklad.

### Položky s výhradou (popsáno v poli `note`)

- **Rozsahy hodnot:** WLTP údaje Škody jsou v ceníku uvedené jako rozsah. Uložena je dolní mez a celý rozsah je v poznámce.
- **Přejmenované jednotky se stejným číslem:** 44,40 TJ/kt = 44,40 GJ/t; 70,10 t CO2/TJ = 70,10 kg CO2/GJ; 34,992 TJ/mil. m³ = 34,992 MJ/m³.
- **Hodnoty „přes / přibližně“:** u Sokola, dárců krve, Rock for People a nově zapsaných vysokoškoláků je uložené číslo dolní mez nebo zaokrouhlení podle zdroje.
- **Dárci krve 348 000** = lidé, kteří v roce 2025 skutečně darovali. Evidovaných dárců je přes 430 000.
- **Uchazeči o zaměstnání a zlaté rezervy ČNB** jsou měsíční nebo čtvrtletní údaje a rychle stárnou.

- **Olympijský bazén – objem a plocha, fotbalové hřiště – plocha:** součin rozměrů, které uvádí zdroj (World Aquatics: minimální rozměry; FIFA: 105 × 68 m).
- **Televizní poplatek za rok:** 12 × 150 Kč (zákonný měsíční poplatek).
- **Temelín – instalovaný výkon 2 250 MW** (2 × 1 125 MWe, výroční zpráva ČEZ 2025). Tisková zpráva ČEZ z 14. 7. 2026 uvádí „elektrický výkon“ 2 172 MW.
- **Stromovka** (96,7 ha): stejná stránka uvádí i 88,61 ha (jiné vymezení).
- **Kapacita O2 areny 17 500** = k sezení; na koncerty až 20 000.
- **Metro D, D35:** smluvní ceny bez DPH, ne konečné náklady. D35 v cenách roku 2018.
- **Průměrná spotřeba elektřiny bytu (3 685,5 kWh):** ČSÚ ENERGO 2021, na obydlený byt (ne na odběrné místo).
- **Výroba vodních elektráren 2025:** suchý rok (−39,9 %).

### Dohledáno, ale vyřazeno (nejednoznačné nebo neověřitelné)

Ve třetí vlně: Petřínská rozhledna a Pančavský vodopád (zdroje se liší), Pravčická brána (26 vs. 26,5 m), produkce vína a sklizeň hroznů 2025 (zdroj si sám odporuje), vstupenky KVIFF (počítají lístky, ne lidi), cena Elbphilharmonie (neoficiální zdroj), Koloseum, Sagrada Família (výška), Burj Khalifa (web blokuje přístup), hmotnosti a délky jen v librách, stopách a akrech (Socha svobody, Hoover Dam, Central Park), Big Mac a PlayStation (oficiální cena nešla otevřít).

Dříve: Kapacita tramvaje 15T (zdroj uvádí jen 139 + 60), návštěvnost Pražského hradu (rok nebyl v dokumentu uveden), Petřínská rozhledna a zvon Zikmund (zdroje se liší), Pendolino – délka a hmotnost, délka D1, Central Park (jen v akrech), Lednicko-valtický areál (143 vs. 283 km²), sedadla letadel Smartwings, kapacita Národního divadla, Dukovany – instalovaný výkon (ČEZ uvádí 2 048 i 2 096 MW), Lipno I (139 vs. 120 MW), Počerady uhelná (1 050 vs. 1 000 MW) a paroplynová (844,9 vs. 888 MW), Dětmarovice (odstaveno 2025), Chvaletice (citaci nešlo přesně ověřit), Ledvice a Mělník (zdroj uvádí jen bloky, součet by byl dopočet), Pražský hrad (rozloha se liší podle vymezení; nyní doplněna hodnota Guinnessovy knihy rekordů 7,28 ha), Petřínská rozhledna (58,7 vs. 65,5 m), rozpočet Prahy 2026 (praha.eu nešel otevřít), rozpočet SFDI 2026, počet zaměstnaných (jen v nečitelných PDF), baterie Tesla Model Y (výrobce kapacitu neuvádí).

## Předvolby „výkon → energie“

Žádný oficiální zdroj neuvádí typické roční využití výkonu podle zdroje přímo. Aplikace ho proto počítá průhledně: výroba ÷ instalovaný výkon ze dvou citovaných položek, a výpočet se ukazuje u výsledku:

| Předvolba | Hodin/rok | Výpočet |
|---|---|---|
| nepřetržitý provoz | 8 760 | definice |
| fotovoltaika v ČR | 923 | ERÚ 2025: 4 374,8 GWh ÷ 4 740,1 MW (výroba nezahrnuje FVE nehlásící OTE → skutečnost je o něco vyšší) |
| větrné elektrárny v ČR | 1 763 | ERÚ 2025: 666,2 GWh ÷ 377,9 MW |
| jádro (Temelín) | 7 724 | ČEZ 2025: 17,38 TWh ÷ 2 250 MW |

Předvolba pro plyn chybí: nenašli jsme ověřitelnou výrobu a výkon plynových elektráren za stejný rok.
