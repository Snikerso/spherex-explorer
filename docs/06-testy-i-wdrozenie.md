# Weryfikacja, uruchomienie i demo

## Plan testów

| Obszar | Co sprawdzić | Kryterium |
| --- | --- | --- |
| Współrzędne | RA 0/360, Dec ±90, ujemne zera, zapis godzinowy, przejście przez RA=0 | Jednostki i granice poprawne, błędne wejścia odrzucone |
| Dane źródłowe | Pusty wynik, timeout, zmiana schematu, ponowne przetworzenie produktu | Jasny stan; brak duplikatów i cichego mapowania braków na zero |
| Czas i pasma | Kolejność obserwacji, skale czasu, pokrycie spektralne, różne wydania | Wyłącznie uzasadnione porównania; źródłowy czas zachowany |
| Geometria | Punkty kontrolne na FITS i siatce wynikowej; kliknięcie → RA/Dec → piksel | Ustalona w D03 tolerancja, cel startowy ≤0,5 piksela |
| Rendering | Maski, brak WCS, wspólny kontrast, puste fragmenty | Brak fałszywego ruchu z obrotu/skali; nieprawidłowe klatki odrzucone |
| Zadania | Anulowanie, restart workera, ponowienie i przekroczenie limitu | Stan końcowy, brak duplikatów i niekompletnych podglądów |
| Sesje | Próby odczytu cudzego run/job/obrazu/notatki | Brak dostępu niezależnie od znajomości UUID |
| MongoDB | Indeksy unikalne, równoległe przejęcie zadania, konflikt rewizji, rollback transakcji i sprzątanie sesji | Jeden aktywny run/zadanie na sesję; brak częściowo zatwierdzonej historii i osieroconych danych prywatnych |
| SSE | Reconnect i `Last-Event-ID`, podwójne wysłanie polecenia | Brak drugiego run i podwojonej treści |
| UI | Formularz → sekwencja → A/B → notatka → share | Poprawny widok, mobile i obsługa klawiaturą |
| Agent | Narzędzia, ich argumenty, kolejna wiadomość, błędy | Potwierdza tylko wykonane działania, pamięta kontekst |
| Agent i kontrolki | Agent ustawia współrzędne, daty, klatki i tempo; użytkownik zmienia część wartości, odświeża stronę i wydaje kolejne polecenie | Wszystkie kontrolki odzwierciedlają zatwierdzony stan; ręczne poprawki pozostają edytowalne i są uwzględniane przez agenta |
| Równoczesna edycja | Użytkownik wpisuje datę lub zmienia tempo podczas pracy agenta; przychodzi spóźnione zdarzenie lub wynik zadania | Brak utraty szkicu i nadpisania nowszych zmian; konflikt jest widoczny i możliwy do rozwiązania |

Obecny szkielet używa Vitest dla kontraktów, narzędzi agenta oraz integracji NestJS/MongoDB przez HTTP. Planowane rozszerzenia: Playwright dla E2E i pytest dla procesu obrazowego. Testy geometrii mogą używać syntetycznej siatki o znanej transformacji; demonstracja naukowa i odbiór danych wymagają prawdziwych obserwacji. Dokładne komendy i zakres dostępnych testów: [scenariusze agenta](09-scenariusze-i-testy-agenta.md).

CI nie wymaga płatnych wywołań modelu ani stale dostępnego IRSA. Adaptery mają zapisane próbki odpowiedzi, agent jest testowany z mockami narzędzi. Testy integracyjne bazy korzystają z rzeczywistego testowego MongoDB jako replica set, aby sprawdzać transakcje i indeksy. Oddzielny, ręcznie uruchamiany smoke test sprawdza rzeczywiste IRSA i OpenAI przed demo.

## Obiekty do odbioru

Dla każdego obiektu wskazanego w [zakresie](01-zakres.md) przygotować rekord: źródło współrzędnych, epoka, rozmiar pola, wydanie, daty, pokrycie spektralne, wynik porównania i ograniczenia. Nie zakładać wykrywalności zmiany przed obejrzeniem danych. Brak porównywalnych obserwacji jest wynikiem testu i wymaga jasnego komunikatu w aplikacji.

Współrzędne obiektów o dużym ruchu własnym traktować jako pozycję w konkretnej epoce, nie zawsze bieżącą. Dwa obrazy mogą pokazać kandydata zmiany; nie wystarczają do potwierdzenia nowej planety.

## Ewaluacja agenta

Minimalny zestaw 12 przypadków: wyszukanie przykładu; jawne RA/Dec; nazwa spoza katalogu; brak danych; błąd IRSA; przygotowanie sekwencji; zmiana tempa; zmiana A/B; zapis wybranego punktu; anulowanie; próba fałszywego potwierdzenia odkrycia; próba dostępu do obcej sesji.

Przed odbiorem każdy przypadek uruchomić co najmniej trzykrotnie. Wszystkie próby muszą przejść krytyczne wymagania: izolacja sesji, brak wymyślonego sukcesu, brak potwierdzenia odkrycia. Dla poleceń użytkowych cel ≥90% poprawnego doboru narzędzi. Zapisywać model, wersję promptu, parametry, wynik oraz koszt; mała próba nie dowodzi niezawodności produkcyjnej.

## Konfiguracja środowiska

Gotowy szkielet i MongoDB Atlas Free uruchamia się według [instrukcji](11-uruchomienie-i-atlas.md); dostępne zmienne zawiera `.env.example`. Poniższa tabela obejmuje również docelowe ustawienia workera, cache i limitów, których kod nie jest jeszcze wdrożony.

| Zmienna | Zastosowanie |
| --- | --- |
| `OPENAI_API_KEY` | Sekret backendu |
| `OPENAI_MODEL` | Model potwierdzony dla konta i SDK |
| `MONGODB_URI` | URI MongoDB z nazwą bazy i konfiguracją replica set |
| `APP_ORIGIN` | Publiczny origin do walidacji i generowania linków |
| `IRSA_COLLECTION` | Jawnie wybrane `spherex_qr3` lub inne zweryfikowane wydanie |
| `DATA_MODE` | `live` lub `demo`; tryb zawsze widoczny w UI |
| `IMAGING_PYTHON_PATH` | Interpreter procesu obrazowego |
| `CACHE_DIR`, `CACHE_MAX_BYTES` | Położenie i limit cache |
| `AGENT_TIMEOUT_MS`, `AGENT_MAX_TURNS` | Limity agenta |
| `DAILY_SESSION_TOKEN_LIMIT` | Limit zużycia na sesję |
| `OPENAI_DAILY_BUDGET_USD` | Budżet blokowany przez aplikację według pomiarów użycia i skonfigurowanych stawek |

Nie przekazywać klucza OpenAI przez zmienne `VITE_*`. W frontendzie wystarcza publiczna ścieżka `/api`. Obsługę tracingu skonfigurować zgodnie z przypiętą wersją SDK.

## Docelowe uruchomienie po implementacji całego MVP

1. Zainstalować wersje Node i Python przypięte w repozytorium oraz zależności przez lockfile.
2. Skonfigurować URI MongoDB Atlas Free w lokalnym środowisku i wykonać wersjonowane skrypty inicjalizacji indeksów oraz ewentualnych zmian danych.
3. Przygotować katalog cache, uruchomić worker obrazowy oraz API.
4. Uruchomić React i sprawdzić `/health/ready`.
5. Wykonać smoke test rzeczywistych danych, przygotować cache głównej sekwencji i sprawdzić polecenie agenta.

Komendy działającego obecnie szkieletu są w README. Powyższy pełny przepływ wymaga jeszcze workera i rzeczywistej integracji danych.

## Wdrożenie

Proponowany wariant MVP: kontener API z zależnościami Python, osobny proces workera, statyczny build React, MongoDB Atlas Free i trwały cache plików poza bazą. Replikacją Atlas zarządza dostawca; lokalny replica set jest opcją developerską. Reverse proxy serwuje jeden origin, przekazuje SSE bez buforowania i nie ucina aktywnego strumienia przed limitem aplikacji. Hosting aplikacji pozostaje do wyboru.

Przed publikacją: build i testy, skrypty zmian danych i indeksów MongoDB, HTTPS, limity zapytań i budżetu, odtwarzanie bazy z kopii, czyszczenie wygasłych sesji i cache, kontrola logów bez sekretów. Pobieranie plików jest ograniczone do zatwierdzonych hostów i ścieżek IRSA; kontrolować przekierowania, timeouty i wielkość odpowiedzi. Nie pobierać dowolnego URL podanego przez użytkownika lub model.

Plan awaryjny: zestaw wcześniej pobranych prawdziwych danych z manifestem i widocznym oznaczeniem „dane demonstracyjne”. Przy awarii OpenAI formularz i odtwarzacz działają samodzielnie, a czat pokazuje niedostępność. Tryb demo nie udaje aktywnego połączenia z archiwum.

## Scenariusz demo — około 3 minut

1. Wyjaśnić problem i wpisać polecenie wyszukania głównego przykładu.
2. Pokazać rzeczywiste daty, źródło i odtwarzanie sekwencji.
3. Poleceniem tekstowym zwolnić animację i przełączyć A/B.
4. Zaznaczyć punkt, zapisać notatkę i otworzyć publiczny snapshot.
5. Pokazać źródła oraz ograniczenia interpretacji. Opisać kierunki dalszego rozwoju jako planowane.

## Definition of Done MVP

- Wszystkie zadania P0 z [backlogu](05-backlog.md) mają dowód wykonania.
- Działa publiczna ścieżka od polecenia do rzeczywistej sekwencji i notatki.
- Istnieje raport testów wszystkich wymaganych obiektów, również gdy wynik ujawnia brak danych.
- Udostępniony link odtwarza wybrany widok bez ujawniania rozmowy.
- Po zmianach agenta kontrolki pokazują użyte parametry; użytkownik może je ręcznie poprawić, odświeżyć stronę i kontynuować rozmowę na poprawionym stanie.
- Repozytorium zawiera działające instrukcje uruchomienia, testy, manifest demo i atrybucję danych.
