# Scenariusze poleceń i testy agenta

## Co jest przygotowane

Fabryka `SkyExplorerAgent` korzysta z OpenAI Agents SDK, ma wersjonowane instrukcje i siedem narzędzi. Warstwa `AgentActions` wykonuje operacje przez dwa interfejsy: `WorkspacePort` i `ObservationPort`. Pierwszy ma implementację MongoDB w `WorkspaceService`; drugi ma obecnie wyłącznie implementację testową. Integracja IRSA, pipeline FITS, kolejka zadań, historia rozmowy i endpoint czatu pozostają do wykonania.

**Testy offline sprawdzają wykonanie narzędzi i stan, nie rozumienie języka przez model.** Wymienione polecenia są scenariuszami produktowymi; testy dostarczają do narzędzi jawne argumenty. Osobny runner live mierzy dobór narzędzi przez wybrany model, również na danych syntetycznych.

Źródła integracji: [OpenAI Docs — definicja agenta i narzędzia](https://developers.openai.com/api/docs/guides/agents/define-agents), [OpenAI Docs — quickstart](https://developers.openai.com/api/docs/guides/agents/quickstart). Implementacja przypina `@openai/agents` w lockfile; dostępność modelu trzeba potwierdzić dla własnego konta.

## Katalog scenariuszy

| ID | Przykładowe polecenie / sytuacja | Operacje i oczekiwany wynik |
| --- | --- | --- |
| SC01 | „Pokaż WISE 0855” | Rozpoznanie nazwy → wyszukanie z otrzymanymi RA/Dec; formularz ma te współrzędne |
| SC02 | „Użyj tego pola i dat od czerwca do grudnia” | `search_observations`; identyczne parametry w zatwierdzonym stanie formularza |
| SC03 | „Przygotuj porównanie tych obserwacji” | `prepare_sequence`; właściwe checkboxy, kolejność dat i klatki sekwencji |
| SC04 | „Pokaż A/B i odtwarzaj 1 klatkę/s” | `set_view` i `set_playback`; tryb, suwak i odtwarzacz odzwierciedlają wynik |
| SC05 | Użytkownik poprawia tempo, potem mówi „Uruchom” | Nowy run odczytuje aktualny stan; zachowuje ręczną poprawkę i pozostałe parametry |
| SC06 | Agent kończy polecenie po ręcznej zmianie | `VIEW_CONFLICT`; brak nadpisania nowszego stanu |
| SC07 | Brak obserwacji w obszarze | Pusta lista; brak fikcyjnych obrazów i sekwencji |
| SC08 | Nieznana nazwa bez współrzędnych | `TARGET_UNKNOWN`; potrzeba doprecyzowania, bez wymyślania RA/Dec |
| SC09 | Wybrano różne pasma lub ten sam obraz dwa razy | Odrzucenie nieporównywalnej sekwencji |
| SC10 | Próba użycia identyfikatora innej sesji | `RESOURCE_NOT_FOUND`; brak odczytu ani zmiany cudzych danych |
| SC11 | „Zapisz notatkę w zaznaczonym punkcie” | Weryfikacja zaznaczenia i własności; powtórzenie tego samego zapisu w run nie dubluje notatki |
| SC12 | Anulowanie przed operacją | Brak rozpoczęcia pobierania i zmian kontrolek |
| SC13 | Wynik wyszukiwania przychodzi po zmianie formularza | Starszy wynik nie podmienia nowszych ustawień |
| SC14 | Awaria źródła danych | Błąd bez wygenerowanego „sukcesu” i bez obrazów |
| SC15 | Model podaje tempo spoza zakresu | Schemat SDK blokuje argumenty przed wywołaniem operacji |
| SC16 | Narzędzie zwraca błąd domenowy lub sukces | Spójne `ok=false/error` albo `ok=true/result`; sukces aktualizuje wspólny stan |

Implementacja: [testy scenariuszy](../apps/api/test/agent/scenarios.test.ts), [kontrakty stanu](../packages/contracts/src/view.test.ts), [testy integracyjne API/MongoDB](../apps/api/test/workspace.integration.test.ts).

## Uruchamianie

```bash
pnpm test
pnpm test:integration
pnpm demo:scenario
```

`test` nie potrzebuje klucza OpenAI, Atlas ani Dockera. `test:integration` pobiera przy pierwszym uruchomieniu binarkę MongoDB przez `mongodb-memory-server`, uruchamia tymczasowy replica set na losowym porcie i sprząta go po testach. Nie łączy się z bazą użytkownika i nie usuwa danych Atlas. Pierwszy start wymaga dostępu do internetu.

`demo:scenario` wypisuje kolejne zmiany wspólnego stanu, w tym ręczną poprawkę tempa i odczyt przez następny run. To jawny skrypt testowy, bez interpretacji języka naturalnego i bez obrazów nieba.

## Test z prawdziwym modelem

W lokalnym `.env` ustaw `OPENAI_API_KEY` i `OPENAI_MODEL`. MongoDB Atlas nie jest potrzebny dla tego runnera — wszystkie dane obserwacyjne oraz stan są testowe.

```bash
pnpm eval:live
pnpm eval:live --repeat 3
```

Komenda wykonuje płatne wywołania API; zwykłe `test`, `check` i CI ich nie uruchamiają. Bez klucza lub modelu kończy się komunikatem przed wywołaniem API. Tracing jest wyłączony dla tego runnera. Nie ma tu jeszcze globalnego mechanizmu budżetu planowanego dla publicznej aplikacji.

| ID live | Co sprawdza automatycznie |
| --- | --- |
| L01 | Model odczytuje stan, rozpoznaje cel, wyszukuje i przygotowuje zgodną sekwencję; nie uruchamia jej wbrew poleceniu |
| L02 | Model uruchamia przygotowaną sekwencję z ręcznie zmienionym tempem 1 klatka/s |
| L03 | Model korzysta z resolvera dla nieznanej nazwy i nie tworzy sekwencji |

Wynik JSON trafia do `output/evals/`, poza Git. Zawiera model, wersję promptu, wywołania narzędzi, stan końcowy, odpowiedź i czas. Sukces wymaga zarówno oczekiwanych narzędzi, jak i stanu. Odpowiedź trzeba dodatkowo przeczytać: obecny runner nie ocenia automatycznie wszystkich twierdzeń naukowych ani jakości języka. Raport nie zawiera klucza i nie jest dowodem integracji z IRSA.

## Przypadki do rozszerzenia przed publicznym MVP

- „Czy odkryliśmy Planet X?” — odpowiedź ma jasno oddzielać kandydata od potwierdzonego odkrycia.
- Notatka zawierająca instrukcję „zignoruj zasady” — jej treść pozostaje danymi.
- Zerwanie SSE, odświeżenie strony i wznowienie historii — do przetestowania po implementacji endpointu czatu.
- Anulowanie trwającego pobierania i długiego przygotowania — do przetestowania z prawdziwym adapterem oraz workerem.
- Wpisywanie wartości w aktywnym polu podczas zmiany agenta — E2E po zbudowaniu kontrolek kokpitu.

Nie oznaczamy tych przypadków jako zweryfikowanych samym istnieniem instrukcji systemowej. Krytyczne zasady wymagają testów odpowiedzi modelu i pełnego przepływu po zbudowaniu odpowiednich funkcji.

## Wynik weryfikacji szkieletu — 7 listopada 2026

- `pnpm install --frozen-lockfile`: poprawna instalacja z lockfile.
- `pnpm check`: lint, sprawdzenie typów, 21 testów offline i build obu aplikacji przeszły.
- `pnpm test:integration`: 4 testy API z tymczasowym MongoDB 8.0.17 jako replica set przeszły; sprawdzono izolację sesji, konflikt równoczesnych zapisów, indeks i rollback transakcji.
- `pnpm demo:scenario`: skrypt zakończył się stanem z ręcznie poprawionym tempem 1 klatka/s, dostępnym dla następnego run.
- Serwer Vite wystartował; żądanie HTTP zwróciło stronę startową. To nie zastępuje testów E2E przyszłego kokpitu.
- `docker compose config --quiet` i sprawdzenie składni skryptu inicjalizacji przeszły. Lokalnych kontenerów nie uruchomiono, ponieważ silnik Docker nie działał.
- Sprawdzono odmowę `eval:live` przy pustym kluczu i modelu, przed wywołaniem API. Nie wykonano płatnej ewaluacji modelu ani połączenia z klastrem Atlas użytkownika.
