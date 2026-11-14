# Kontrakty API i model danych

Wersja projektowa `v1`. Wszystkie ścieżki poniżej mają prefiks `/api/v1`. REST JSON; zdarzenia czatu jako SSE. Schematy w `packages/contracts` są źródłem typów i walidacji; NestJS publikuje OpenAPI dla REST.

**Status implementacji (14 listopada 2026):** działają sesje, widok, katalog celów, wyszukiwanie IRSA, sekwencje, zadania i anulowanie, autoryzowane PNG, notatki, wiadomości oraz run/SSE/anulowanie agenta. `GET /capabilities` opisuje dostępność agenta; `GET /agent/runs/current` pozwala wznowić stream po odświeżeniu. Operacje ręczne wyszukiwania, sekwencji i notatek wymagają `expectedRevision`. Publiczne share'y, usuwanie sesji, paginacja historii i OpenAPI pozostają specyfikacją. Obecny link w UI odtwarza tylko współrzędne. Dokument opisuje również docelowe elementy niewdrożone; szczegóły obecnego zakresu w [raporcie integracji](12-integracja-live.md).

## Sesja i dostęp

`POST /sessions` tworzy anonimową sesję i ustawia losowy sekret w cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Sekret jest haszowany w bazie; sam UUID zasobu nie daje dostępu. Wszystkie prywatne odczyty i zapisy sprawdzają właściciela. Sesja wygasa po 7 dniach nieaktywności.

Proponowane wdrożenie ma jeden origin dla frontendu i `/api`, z kontrolą `Origin` dla operacji zapisu. Przy podziale domen należy zaprojektować CORS i ochronę CSRF przed publikacją. Publiczny share ma osobny losowy token i tylko wybrane dane; nie ujawnia sesji ani rozmowy.

## Endpointy

| Metoda i ścieżka | Wejście / rezultat |
| --- | --- |
| `POST /sessions` | Utworzenie sesji; `{sessionId, expiresAt}` i cookie |
| `GET /sessions/current` | Identyfikator sesji i jej podsumowanie |
| `DELETE /sessions/current` | Unieważnienie sesji, usunięcie prywatnych danych i jej share'ów |
| `GET /targets` | Sprawdzony katalog przykładów |
| `POST /observation-searches` | Parametry regionu → `searchId`, lista, ostrzeżenia i `truncated` |
| `GET /observation-searches/:id` | Zapisany wynik należący do sesji |
| `POST /sequences` | `searchId`, `observationIds` → HTTP 202, `jobId`, `sequenceId` |
| `GET /jobs/:id` | Stan, postęp, błąd lub identyfikator wyniku |
| `POST /jobs/:id/cancel` | Idempotentne anulowanie przygotowania |
| `GET /sequences/:id` | Manifest klatek, parametry i ostrzeżenia |
| `GET /sequences/:id/frames/:frameId` | Autoryzowany podgląd obrazu |
| `GET /view` | Pełny stan kontrolek i obrazu: wyszukiwanie, wybór obserwacji, zadanie, widok, punkt i rewizja |
| `PATCH /view` | Ręczna zmiana ustawień z `expectedRevision`; rezultat zawiera zatwierdzony stan i zmienione pola |
| `POST /annotations` | Sekwencja, punkt RA/Dec, tekst → zapis notatki |
| `GET /sequences/:id/annotations` | Lista notatek sesji |
| `POST /shares` | Sekwencja, parametry widoku, jawnie wybrane notatki → `shareToken` |
| `GET /shares/:token` | Publiczny, niemodyfikowalny snapshot i podglądy przez ścieżki share |
| `GET /shares/:token/frames/:frameId` | Obraz wyłącznie z manifestu danego share |
| `DELETE /shares/:token` | Odwołanie linku przez właściciela |
| `POST /agent/runs` | `message`, `clientRequestId` → HTTP 202, `runId` |
| `GET /agent/runs/:id/events` | Autoryzowany SSE, wznowienie przez `Last-Event-ID` |
| `POST /agent/runs/:id/cancel` | Anulowanie run |
| `GET /messages` | Historia renderowanych wiadomości sesji, paginacja |
| `GET /health/live`, `GET /health/ready` | Żywotność procesu i gotowość zależności lokalnych |

Wyszukiwanie i przygotowanie wywoływane przez agenta używają tych samych serwisów co REST; agent nie wykonuje żądań HTTP do własnego API.

## Najważniejsze typy

```typescript
type SearchInput = {
  raDeg: number;
  decDeg: number;
  fovDeg: number; // szerokość pola, nie promień
  fromUtc: string | null;
  toUtc: string | null;
  release: 'dr1' | 'qr3';
};

type Observation = {
  id: string;
  sourceId: string;
  release: 'dr1' | 'qr3';
  observedAtUtc: string;
  originalTime: { value: string; format: string; scale: string };
  detector: string;
  spectralRangeUm: [number, number] | null;
  calibrationVersion: string | null;
  qualityFlags: string[];
  sourceUrl: string;
};

type ViewState = {
  targetId: string | null;
  searchInput: SearchInput | null;
  searchId: string | null;
  searchRequestId: string | null;
  selectedObservationIds: string[];
  jobId: string | null;
  sequenceId: string | null;
  frameIds: string[];
  mode: 'single' | 'blink' | 'side_by_side';
  playing: boolean;
  fps: number;
  selectedPoint: { raDeg: number; decDeg: number } | null;
  viewRevision: number;
  lastChangedBy: 'user' | 'agent' | 'system';
};
```

`ViewState` jest wspólnym stanem całego stanowiska, łącznie z parametrami formularza. Parametry rzeczywiście użyte do pobrania danych są zachowane osobno w `ObservationSearch`, a do renderowania w `Sequence`. Zmiana formularza nie zmienia istniejących obrazów: UI oznacza ustawienia jako zmodyfikowane i pozwala ponowić wyszukanie/przygotowanie. Ponowne wyszukanie unieważnia wybór obserwacji ze starego wyniku.

Po uruchomieniu strony React pobiera `GET /view` i odtwarza kontrolki. Po operacji agenta robi to ze zdarzenia `view.updated`, po ręcznej zmianie z odpowiedzi REST. Formularze są kontrolowane z tego stanu, a nie tylko inicjalizowane przez `defaultValue`. Lokalny szkic wpisywanego pola pozostaje oddzielony od stanu zatwierdzonego, aby zachować niedokończoną edycję.

Współrzędne adnotacji są w ICRS, a nie w pikselach ekranu. Konwersję kliknięcia realizuje zatwierdzona transformacja siatki wynikowej. Manifest zawiera parametry WCS tej siatki, rozmiar obrazu, maskę pokrycia, ustawienia renderowania i listę źródeł. Prawidłowość transformacji trzeba sprawdzić testem kontrolnych punktów.

## Zdarzenia SSE

Każde zdarzenie ma `id`, nazwę `event` i JSON `data`. Wspólna koperta: `schemaVersion`, `runId`, rosnący `seq`, `timestamp`, `payload`.

| Event | Payload |
| --- | --- |
| `run.started` | Identyfikator wiadomości i rewizja początkowa |
| `message.delta` | `messageId`, fragment tekstu |
| `tool.started` | `toolCallId`, nazwa i bezpieczny opis |
| `tool.completed` | `toolCallId`, status, ewentualne `jobId/sequenceId` |
| `view.updated` | `state`: pełny zatwierdzony `ViewState`, `changedFields`: lista zmienionych pól; źródło zmiany określa `state.lastChangedBy` |
| `annotation.created` | Identyfikator i treść zapisanej adnotacji |
| `run.completed` | `messageId`, końcowy tekst i referencje do źródeł |
| `run.failed` | Kod błędu, bezpieczny opis i `retryable` |
| `run.cancelled` | Stan końcowy anulowania |

Heartbeat jako komentarz SSE co 15 s. Najpierw zapisać event, potem go wysłać. Po reconnect odtworzyć brakujące zdarzenia; klient deduplikuje po `id`. Event końcowy zamyka stream. Treść z `run.completed` zastępuje szkic tekstu, aby nie dublować odpowiedzi. Zdarzenia zadania obrazowego są odczytywane z `/jobs`, zgodnie z [architekturą](02-architektura-i-dane.md).

## Kolekcje MongoDB

Schematy Mongoose mają jawne nazwy kolekcji, `schemaVersion` i znaczniki czasu. `_id` przechowuje UUID jako string, a API mapuje go na `id`. Referencje między kolekcjami są identyfikatorami; własność i istnienie zasobów weryfikuje backend. Daty techniczne są typu BSON Date; oryginalny czas astronomiczny pozostaje w metadanych.

| Kolekcja / model | Kluczowe pola |
| --- | --- |
| `sessions` / `Session` | id, tokenHash, createdAt, lastSeenAt, expiresAt, revokedAt |
| `targets` / `Target` | id, nazwa, RA/Dec, układ, epoka, sourceUrl |
| `observationSearches` / `ObservationSearch` | id, sessionId, parametry, ograniczona lista observationIds, createdAt |
| `observations` / `Observation` | id, sourceId, wydanie, calibrationVersion, czas, metadane, sourceUrl |
| `sequences` / `Sequence` | id, sessionId, searchId, status, config, pipelineVersion |
| `sequenceFrames` / `SequenceFrame` | id, sequenceId, observationId, order, renderKey, WCS |
| `jobs` / `Job` | id, sessionId, sequenceId, status, active, progress, leaseToken, leaseUntil, attempts, error |
| `views` / `View` | sessionId, wspólny stan kontrolek i obrazu, revision mapowana na `viewRevision` w API |
| `agentRuns` / `AgentRun` | id, sessionId, clientRequestId, status, active, model, tokens, startedAt |
| `agentHistories` / `AgentHistory` | sessionId, version, committedItemCount |
| `agentHistoryItems` / `AgentHistoryItem` | sessionId, runId, position, kompletny element historii SDK |
| `messages` / `Message` | id, sessionId, runId, rola, treść, źródła, createdAt |
| `runEvents` / `RunEvent` | runId, seq, typ, payload, createdAt |
| `annotations` / `Annotation` | id, sessionId, sequenceId, RA/Dec, tekst, idempotencyKey |
| `shares` / `Share` | tokenHash, sessionId, snapshot dokumentu, createdAt, revokedAt |

Indeksy unikalne: `sessions.tokenHash`, `shares.tokenHash`, `observations(sourceId, release, calibrationVersion)`, `agentRuns(sessionId, clientRequestId)`, `runEvents(runId, seq)`, `agentHistoryItems(sessionId, position)`, `sequenceFrames(sequenceId, order)`, `views.sessionId`, `agentHistories.sessionId` oraz `annotations(sessionId, idempotencyKey)`. Częściowy indeks unikalny po `sessionId` z filtrem `{active: true}` w `agentRuns` oraz osobno w `jobs` ogranicza każdą sesję do jednego aktywnego run i jednego przygotowania. Stany końcowe ustawiają `active=false`.

Indeksy odczytu: `jobs(status, leaseUntil, createdAt)`, `messages(sessionId, createdAt, _id)`, `annotations(sessionId, sequenceId)` i `sessions.expiresAt`. Wszystkie powstają przez wersjonowany skrypt inicjalizacji; produkcja nie polega na automatycznym tworzeniu indeksów przy starcie Mongoose.

Nie osadzać rosnącej historii, zdarzeń ani obrazów w dokumencie sesji. MongoDB ogranicza dokument BSON do 16 MiB; aplikacja ustala niższy limit rozmiaru elementu historii i wyniku narzędzia. FITS i podglądy pozostają w cache plików. [MongoDB: limity dokumentów](https://www.mongodb.com/docs/manual/reference/limits/).

Sekwencja zachowuje kolejność przez `SequenceFrame`. Usunięcie lub wygaśnięcie sesji najpierw blokuje dostęp, następnie jawnie usuwa prywatne dokumenty i odwołuje share'y. MongoDB nie wykonuje kaskadowego usuwania referencji; aplikacja ma ponawialną procedurę sprzątania. Cache źródłowych produktów może być współdzielony, bez danych osobowych.

## Błędy i współbieżność

Format błędu: `{error: {code, message, retryable, requestId}}`.

- `400 INVALID_COORDINATES` lub `INVALID_FILTER`: błędne dane.
- `401 SESSION_REQUIRED`: brak ważnej sesji.
- `404 RESOURCE_NOT_FOUND`: także dla zasobu innej sesji.
- `409 RUN_IN_PROGRESS` lub `VIEW_CONFLICT`: konflikt aktualnego stanu.
- `422 NO_COMPARABLE_FRAMES`: brak wystarczającej porównywalnej sekwencji.
- `429 RATE_LIMITED`: przekroczony limit.
- `502 DATA_SOURCE_ERROR`, `504 DATA_SOURCE_TIMEOUT`: problem dostawcy.

Pusty wynik wyszukiwania to `200` z pustą listą, nie awaria. Idempotentne ponowienie `POST /agent/runs` z tym samym `clientRequestId` zwraca istniejący run. Limity równoległości egzekwują indeksy częściowe i atomowe aktualizacje. Zmiana widoku używa filtra `{sessionId, revision: expectedRevision}` i zwiększa `revision`; brak dopasowania oznacza konflikt. MongoDB gwarantuje atomowość pojedynczego dokumentu. [MongoDB: atomowość i transakcje](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

Spójne zapisy wielu dokumentów, np. zatwierdzenie historii wraz z zakończeniem run, używają krótkiej transakcji. Wymagany jest MongoDB jako replica set lokalnie i na serwerze; lokalnie wystarczy jednoelementowy replica set. Transakcje nie obejmują pobierania plików, modelu ani długich obliczeń. Po awarii mechanizm odzyskiwania zamyka osierocone run i zwalnia `active`.
