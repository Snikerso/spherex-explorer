# Źródła, założenia i decyzje

Zweryfikowano 7 listopada 2026. Źródła opisują wymagania i dostępne mechanizmy; nie stanowią dowodu, że integracja aplikacji została już zaimplementowana lub że wybrany obiekt ma odpowiednie obserwacje.

## Źródła

| Źródło | Zastosowanie |
| --- | --- |
| [Oficjalne wyzwanie Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) | Cele, obiekty testowe, kierunki rozszerzeń |
| [HackAthlone — kopia opisu wyzwania](https://hackathlone.com/challenges/planet-x-and-spherex) | Pomocnicze porównanie treści; pierwszeństwo ma strona oficjalna |
| [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html) | Aktualne wydania i narzędzia |
| [IRSA Archive Data Access](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/) | SIA2, kolekcje, dostęp do plików |
| [IRSA Cutout Tool](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html) | Wycinki FITS i zachowanie metadanych |
| [IRSA Data Explorer Overview](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html) | Sposób gromadzenia danych i detektory; datowane informacje o wydaniach sprawdzać na stronie głównej IRSA |
| [IRSA Quick Release Overview](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html) | DOI, informacje o wydaniach i atrybucja |
| [OpenAI Docs — Agents SDK quickstart](https://developers.openai.com/api/docs/guides/agents/quickstart) | SDK TypeScript i function tools |
| [OpenAI Docs — Running agents](https://developers.openai.com/api/docs/guides/agents/running-agents) | Historia, uruchamianie i streaming |
| [OpenAI Docs — Integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability) | Tracing i diagnostyka |
| [Vite](https://vite.dev/guide/) | Konfiguracja projektu frontendowego |
| [NestJS: MongoDB](https://docs.nestjs.com/techniques/mongodb) | Integracja Mongoose przez `@nestjs/mongoose` |
| [MongoDB: atomowość i transakcje](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/) | Aktualizacje dokumentów, współbieżność i replica set |
| [MongoDB: limity](https://www.mongodb.com/docs/manual/reference/limits/) | Limit dokumentu BSON i podział historii na dokumenty |
| [MongoDB Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | Limity darmowego klastra i zarządzana replikacja |
| [Astropy WCS](https://docs.astropy.org/en/stable/wcs/) i [reproject](https://docs.astropy.org/projects/reproject/en/stable/) | Transformacje i wyrównywanie obrazów |

Oficjalna strona wyzwania zwracała błąd w przeglądarce źródeł. Treść odczytano bezpośrednio z HTML, z osadzonego payloadu strony, i porównano z kopią lokalnego wydarzenia. Nie stwierdzono konieczności zmiany zakresu na podstawie kopii.

## Status decyzji

| Decyzja | Status i uzasadnienie |
| --- | --- |
| React + NestJS + MongoDB + tekstowy agent OpenAI Agents SDK | Wymaganie użytkownika |
| MongoDB Atlas na darmowym planie Free | Wybór użytkownika; klaster tworzy użytkownik, URI pozostaje w lokalnym `.env` |
| Interfejs nowoczesnego kokpitu inspirowanego X-wingiem, według szkicu użytkownika | Wymaganie użytkownika; układ i kontrolki opisuje [projekt UI](08-interfejs-kokpit.md) |
| Jeden agent TypeScript w backendzie | Propozycja bazowa: wspólny język z NestJS i bez dodatkowej orkiestracji |
| Publiczna wyszukiwarka obrazów i sekwencja czasowa | Wymaganie wyzwania |
| Mongoose (`@nestjs/mongoose`), monorepo pnpm, Vite | Propozycja do zastosowania przy starcie implementacji |
| Replica set zarządzany przez Atlas; lokalny MongoDB opcjonalny | Decyzja projektowa: krótkie transakcje, indeksy i odtwarzalne środowisko testowe |
| Proces pomocniczy Python do FITS/WCS | Propozycja wymagająca potwierdzenia w D03; publiczny backend pozostaje NestJS |
| QR3 jako startowa kolekcja | Propozycja oparta na stanie IRSA; dostępność i pokrycie sprawdzić w D01/D02 |
| Brak logowania kontem w MVP | Propozycja: anonimowe, odseparowane sesje z własnością zasobów |
| Model, hosting aplikacji, budżet | Otwarte, do zapisania w D04; baza wybrana jako Atlas Free |
| Tolerancja długości fali, WCS i jakości | Otwarte parametry naukowe; ustalić na próbce danych przed odbiorem pipeline |

## Ryzyka wpływające na plan

| Ryzyko | Działanie |
| --- | --- |
| Za mało porównywalnych obserwacji | Najpierw D01–D03; sprawdzony zestaw demonstracyjny i jawny brak danych |
| Obrót, inne pasmo lub kalibracja udają zmianę | Wspólna siatka i selekcja; różnicowanie dopiero po kontroli PSF/tła |
| Duże FITS i opóźnienia archiwum | Cutouts, cache, limity i asynchroniczne przygotowanie |
| Model błędnie interpretuje polecenie | Schematy narzędzi, wspólne serwisy, ewaluacje i aktualny stan widoku |
| Przeciążenie lub koszty publicznego czatu | Limity per sesja, globalny budżet i ograniczona liczba kroków |
| Zmiana SDK lub archiwum | Przypięte wersje, testy kontraktów, smoke test przed prezentacją |

## Atrybucja i materiały końcowe

W aplikacji umieścić sekcję „Dane i źródła”, identyfikatory użytych produktów, link do IRSA oraz DOI właściwego wydania. Oficjalne brzmienie podziękowania skopiować przy implementacji z [IRSA Quick Release Overview](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html), sprawdzając aktualne wymagania. Wybór licencji własnego kodu i potwierdzenie zasad użycia dodatkowych katalogów pozostają zadaniami wdrożeniowymi.
