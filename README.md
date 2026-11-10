# SPHEREx Explorer — dokumentacja projektu

Aplikacja webowa do porównywania obserwacji nieba w czasie, przygotowywana pod [NASA Space Apps 2026: Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

Użytkownik wybiera obszar nieba współrzędnymi lub poleceniem tekstowym. Agent wyszukuje obserwacje SPHEREx, przygotowuje sekwencję obrazów i steruje jej odtwarzaniem. Użytkownik może obejrzeć zmiany, zaznaczyć interesujące miejsce i udostępnić widok.

**Wymagany stos:** React + NestJS + MongoDB + OpenAI Agents SDK dla TypeScript. Integracja bazy przez Mongoose. Dokumentacja po polsku; proponowany interfejs PL/EN. Nazwa robocza: SPHEREx Explorer.

**Baza aplikacji: MongoDB Atlas Free**, tworzona przez użytkownika. Lokalny MongoDB w Dockerze jest wariantem opcjonalnym.

## Co jest już przygotowane

- Szkielet monorepo: `apps/web` (React/Vite), `apps/api` (NestJS/Mongoose), `packages/contracts` (Zod/TypeScript).
- Startowy ekran w motywie kokpitu, healthcheck API/bazy, anonimowe sesje i zapis ustawień z kontrolą rewizji.
- Fabryka agenta SDK i siedem narzędzi, testy wykonania scenariuszy oraz osobny runner live na danych testowych.
- Lockfile, `.env.example`, inicjalizacja indeksów MongoDB, opcjonalny Compose i workflow CI.
- [Scenariusze i testy agenta](docs/09-scenariusze-i-testy-agenta.md) oraz [plan demonstracji konkursowej](docs/10-plan-demonstracji.md).

Obecny kod to fundament projektu. Integracja IRSA, renderowanie obrazów, pełny kokpit i czat HTTP/SSE pozostają do wykonania. Testowe obserwacje są syntetyczne; nie stanowią danych NASA.

## Uruchomienie

Wymagania: Node 22.12+ z gałęzi 22 lub Node 24 oraz pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

W lokalnym `.env` uzupełnij `MONGODB_URI` z Atlas, z nazwą bazy `/spherex`. Następnie:

```bash
pnpm db:init
pnpm dev
```

Frontend: `http://localhost:5173`. Gotowość API: `http://127.0.0.1:3000/api/v1/health/ready`.

Klucz OpenAI nie jest potrzebny do uruchomienia szkieletu. Instrukcje Atlas, opcjonalnej bazy lokalnej i prób zapisu: [uruchomienie](docs/11-uruchomienie-i-atlas.md).

```bash
pnpm check             # lint, typy, testy offline, build
pnpm test:integration  # tymczasowy MongoDB replica set; nie korzysta z Atlas
pnpm demo:scenario     # jawny skrypt narzędzi bez modelu i IRSA
```

`pnpm eval:live` uruchamia płatny test modelu dopiero po ustawieniu `OPENAI_API_KEY` i `OPENAI_MODEL`. Nie jest częścią zwykłych testów ani CI.

## Dokumenty

| Dokument | Zawartość |
| --- | --- |
| [01 — Zakres i wymagania](docs/01-zakres.md) | Cel, scenariusze, MVP, rozszerzenia, kryteria odbioru |
| [02 — Architektura i dane](docs/02-architektura-i-dane.md) | Moduły, repozytorium, IRSA, obrazy FITS, porównywanie obserwacji |
| [03 — Agent tekstowy](docs/03-agent.md) | Rola, narzędzia, pamięć, sterowanie UI, ograniczenia |
| [04 — API i model danych](docs/04-api-i-model-danych.md) | Endpointy, zdarzenia SSE, typy, własność sesji |
| [05 — Lista zadań](docs/05-backlog.md) | Kolejność wdrożenia, checklisty, zależności i rezultaty |
| [06 — Testy, uruchomienie i demo](docs/06-testy-i-wdrozenie.md) | Plan weryfikacji, konfiguracja, wdrożenie, scenariusz prezentacji |
| [07 — Źródła i decyzje](docs/07-zrodla-i-decyzje.md) | Zweryfikowane źródła, założenia, otwarte kwestie |
| [08 — Interfejs kokpitu](docs/08-interfejs-kokpit.md) | Układ ze szkicu, styl nowoczesnego myśliwca, kontrolki i responsywność |
| [09 — Scenariusze i testy agenta](docs/09-scenariusze-i-testy-agenta.md) | Przypadki użycia, testy offline, ewaluacja live i ograniczenia |
| [10 — Plan demonstracji](docs/10-plan-demonstracji.md) | Przebieg 3 minut, przygotowanie, plan awaryjny i materiały |
| [11 — Uruchomienie i Atlas](docs/11-uruchomienie-i-atlas.md) | Konfiguracja MongoDB Atlas Free, komendy i działające endpointy |

## Kolejność budowy

1. Potwierdzić pobieranie rzeczywistych obserwacji i przygotować dwie porównywalne klatki.
2. Zbudować wyszukiwarkę oraz odtwarzacz w React.
3. Udostępnić te same operacje agentowi przez narzędzia w NestJS.
4. Dodać zapis, udostępnianie, obsługę błędów i demonstrację.

Dokumenty 01–08 opisują docelowy system. Aktualnie dostępny zakres i działające komendy opisano powyżej oraz w dokumencie 11. Checklisty backlogu wymagają ukończenia całych kryteriów, a nie samego istnienia szkieletu.

Stan źródeł: **7 listopada 2026**. Wymagania wyzwania pochodzą z oficjalnej strony; szczegóły implementacji są propozycją projektową.
