# SPHEREx Explorer — dokumentacja projektu

Aplikacja webowa do porównywania obserwacji nieba w czasie, przygotowywana pod [NASA Space Apps 2026: Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

Użytkownik wybiera obszar nieba współrzędnymi lub poleceniem tekstowym. Agent wyszukuje obserwacje SPHEREx, przygotowuje sekwencję obrazów i steruje jej odtwarzaniem. Użytkownik może obejrzeć zmiany, zaznaczyć interesujące miejsce i udostępnić widok.

**Wymagany stos:** React + NestJS + MongoDB + OpenAI Agents SDK dla TypeScript. Integracja bazy przez Mongoose. Dokumentacja po polsku; proponowany interfejs PL/EN. Nazwa robocza: SPHEREx Explorer.

**Baza aplikacji: MongoDB Atlas Free**, tworzona przez użytkownika. Lokalny MongoDB w Dockerze jest wariantem opcjonalnym.

## Działający zakres

- React: wyszukiwanie pięciu celów i dowolnego pola RA/Dec, wybór obserwacji, odtwarzanie Blink oraz porównanie A/B ze wspólnym zoomem i przesunięciem.
- NestJS + MongoDB: prywatne sesje, zapis widoku z rewizją, wyniki wyszukiwania, zadania obrazowe, sekwencje i notatki.
- Rzeczywiste produkty IRSA SIA2, wydania DR1/QR3. Puste wyniki nie są zastępowane obrazami demonstracyjnymi.
- Worker Python: wycinki FITS, WCS TAN, kontrola WCS-WAVE i masek, odjęcie ZODI, wspólny kontrast asinh i PNG. Podgląd służy porównaniu wizualnemu, bez dopasowania PSF i bez fotometrii.
- Copilot OpenAI Agents SDK: streaming SSE, historia SDK w MongoDB, anulowanie i te same operacje co ręczne kontrolki. Klucz jest dostępny wyłącznie backendowi.
- Kliknięcie obrazu wyznacza RA/Dec; notatki zapisują się w sesji. Link do współrzędnych nie udostępnia obrazów ani czatu.

Publiczne snapshoty, przełącznik PL/EN, wdrożenie HTTPS, wygaszanie cache i rozproszona kolejka pozostają poza obecnym zakresem. Lokalna kolejka wymaga **jednego procesu API**. Restart oznacza jawny błąd niezakończonych zadań; gotowe obrazy i ustawienia pozostają zapisane.

## Uruchomienie

Wymagania: Node 22.12+ z gałęzi 22 lub Node 24, pnpm 11.25.0, Python 3.11–3.13 i uv. MongoDB musi działać jako replica set (Atlas lub lokalnie).

```bash
pnpm install --frozen-lockfile
uv sync --project workers/imaging --locked
cp .env.example .env # tylko przy pierwszej konfiguracji; zachowaj własny .env
pnpm db:up          # opcjonalny lokalny MongoDB
```

Ustaw `MONGODB_URI` (Atlas lub lokalny URI podany w `.env.example`) i `APP_ORIGIN=http://127.0.0.1:5173`. Aby użyć copilota, ustaw na backendzie `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6.1-sol` i opcjonalnie `OPENAI_REASONING_EFFORT=low`.

```bash
pnpm db:init
pnpm dev
```

W środowisku użytkownika sekrety są w Doppler `sphere_x / dev`:

```bash
doppler run --project sphere_x --config dev -- pnpm db:init
doppler run --project sphere_x --config dev -- pnpm dev
```

Frontend: http://127.0.0.1:5173. Gotowość API: http://127.0.0.1:3000/api/v1/health/ready. Bez klucza OpenAI wyszukiwanie i obrazy działają, a czat pokazuje brak konfiguracji.

Przykład: wybierz WISE 0855 → DR1 → Szukaj → detektor SPHEREx-D1 → Wybierz do 24 → Przygotuj sekwencję → Blink → Odtwórz. Pobranie FITS może trwać kilka minut; postęp i anulowanie są dostępne w kokpicie. Nie każda para tego samego detektora przechodzi kontrolę długości fali. Worker wybiera zgodny podzbiór i opisuje wykluczenia.

```bash
pnpm check             # lint, typy, testy offline, build
pnpm test:integration  # tymczasowy MongoDB replica set; nie korzysta z Atlas/IRSA/OpenAI
pnpm demo:scenario     # jawny skrypt narzędzi na danych syntetycznych
pnpm eval:live         # płatny test modelu; dane obserwacyjne w tym runnerze są syntetyczne
```

Szczegóły endpointów: [API](docs/04-api-i-model-danych.md). Stan wdrożenia i weryfikacja: [raport integracji](docs/12-integracja-live.md).

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

## Organizacja kodu

Frontend jest podzielony według funkcji aplikacji:

```text
apps/web/src/
  App.tsx                    # układ i połączenie modułów
  app/components/            # nagłówek, zakładki, status operacji, stopka
  features/
    explorer/                # sesja, synchronizacja API i zdarzenia agenta
    navigation/              # formularz, kontroler orbity, odczyt orientacji FITS
      model/                 # obliczenia pozycji, oświetlenia i efemeryd
      scene/                 # renderer 3D oraz fabryki Ziemi i satelity
    sky/
      components/            # siatka pasm, viewport, RGB, oś czasu i źródła
      hooks/                 # odtwarzanie, kompozycja, interakcje, eksport
    instruments/             # telemetria, jakość danych i notatki
    analysis/                # widma, stacki i porównania epok
    copilot/                 # czat, fokus i prezentacja wiadomości
  shared/
    api/                     # klient HTTP i wspólne typy odpowiedzi
    i18n/                    # język, katalog tłumaczeń i testy
    lib/                     # wspólne formatowanie
  styles/                    # baza, układ, motyw misji i panel instrumentów
```

Stan nieba pozostaje w hookach wywoływanych przez `App`, więc przełączanie zakładek nie resetuje ustawień RGB ani odtwarzania. Komponenty prezentacyjne otrzymują jawne propsy; obliczenia orbitalne i zarządzanie zasobami GPU są oddzielone od Reacta. Testy frontendowe znajdują się przy testowanym module.

`apps/api/src/modules/observations/imaging/` zawiera pobieranie wycinków, ścieżki cache i wspólny mechanizm uruchamiania workerów. `ObservationsService` odpowiada za sesję, własność zasobów, kolejkę i zapis wyników. Limity rozmiaru, timeouty, retry i anulowanie są zachowane.

`pnpm format:web` formatuje frontend. `pnpm format:check` sprawdza format frontendu i modułów obserwacji API. Pozostałe polecenia weryfikacji (`pnpm check`, `pnpm test:integration`, `pnpm test:imaging`) pozostają bez zmian. Style są importowane w kolejności: baza → układ → motyw → instrumenty; zachowaj tę kolejność przy dalszych zmianach.

### Automatyczne sprzątanie

API uruchamia sprzątanie przy starcie i co godzinę (`CLEANUP_INTERVAL_MS`, minimum minuta).
Sesje wygasają po 7 dniach bez aktywności; po dodatkowych 24 godzinach bufora API usuwa
sesję i powiązane widoki, wyszukiwania, sekwencje, zadania, notatki oraz historię copilota.
Aktywne zadania i uruchomienia agenta wstrzymują usuwanie swojej sesji. Rekord sesji jest
usuwany na końcu, aby błąd częściowego sprzątania można było ponowić.

Sprzątanie dysku obejmuje wyłącznie zarządzane katalogi `sequences`, `fits`, `analyses`
i `exports` wewnątrz `CACHE_ROOT`. Usuwa osierocone sekwencje oraz nieużywane FITS i
pozostałości plików tymczasowych starsze niż `CACHE_RETENTION_HOURS` (domyślnie 24,
minimum 24). Zachowuje sekwencje obecne w bazie i FITS wskazane przez manifesty gotowych
sekwencji. Nie podąża za dowiązaniami symbolicznymi. Brak lub uszkodzenie manifestu
zachowanej gotowej sekwencji wstrzymuje usuwanie współdzielonych FITS. Sprzątanie cache
nie działa równolegle z pobieraniem, analizą lub eksportem w procesie API. Mechanizm
zakłada jeden proces API zarządzający lokalnym cache, tak jak kolejka przygotowywania.
W środowisku testowym harmonogram jest wyłączony; sprzątanie można wywołać jawnie.
