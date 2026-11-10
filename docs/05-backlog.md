# Lista rzeczy do zrobienia

**P0** jest niezbędne do MVP; **P1/P2** to rozszerzenia. FE = frontend, BE = backend, DATA = dane/obrazy, QA = weryfikacja. Zależności wskazują rezultaty, które muszą istnieć przed zakończeniem zadania.

Przygotowano szkielet repozytorium, sesje i stan widoku w MongoDB, fabrykę i narzędzia agenta, scenariusze offline, runner live oraz plan demo. MongoDB Atlas Free jest wybranym wariantem bazy. Pełny zakres obecnego kodu: [uruchomienie](11-uruchomienie-i-atlas.md). Częściowo wykonane zadania pozostają otwarte do spełnienia wszystkich kryteriów; np. S03 wymaga jeszcze OpenAPI, a A04 historii i SSE.

## Etap 1 — potwierdzenie danych i decyzji

- [ ] **D01 · P0 · DATA/BE:** wykonać zapytanie SIA2 dla rzeczywistego obszaru; zapisać próbkę schematu i mapowanie pól. **Gotowe:** znane formaty, czasy, wersje, URL i zachowanie pustego wyniku.
- [ ] **D02 · P0 · DATA:** znaleźć przynajmniej dwie porównywalne obserwacje dla głównego demo; sprawdzić wszystkie obiekty z [wymagań](01-zakres.md). **Gotowe:** manifest z datami, pokryciem, ograniczeniami i uzasadnieniem wyboru; brak danych również udokumentowany. **Zależy od:** D01.
- [ ] **D03 · P0 · DATA:** przygotować dwa wycinki FITS, odczytać właściwe HDU, maski i WCS, wyrównać i wyrenderować. **Gotowe:** dwie klatki na wspólnej siatce, kontrolne punkty i ustalona zgodność spektralna; zatwierdzony wybór procesu Python lub sprawdzonej alternatywy TS. **Zależy od:** D02.
- [ ] **D04 · P0 · zespół:** zatwierdzić nazwę, języki UI, limit budżetu API, środowisko hostingu i tolerancje porównania. **Gotowe:** decyzje zapisane w dokumentacji; dostępność modelu potwierdzona krótkim testem po uzyskaniu klucza.

**Brama etapu:** istnieją prawdziwe, porównywalne obrazy. Jeżeli jej nie przejdziemy, poprawiamy dostęp do danych przed rozbudową czatu.

## Etap 2 — fundament aplikacji

- [x] **S01 · P0 · FE/BE:** utworzyć monorepo pnpm z React/Vite i NestJS. **Gotowe:** ekran React jest budowany, API uruchamiane w testach HTTP; TypeScript strict, lint i build przechodzą. Start z bazą użytkownika wymaga jego URI Atlas.
- [ ] **S02 · P0 · BE:** MongoDB Atlas Free, integracja `@nestjs/mongoose`, schematy dokumentów, indeksy i konfiguracja środowiska; lokalny replica set opcjonalny. **Postęp:** `sessions`, `views`, skrypt indeksów v001 i `.env.example` istnieją; pozostałe kolekcje oraz połączenie z klastrem użytkownika do wykonania. **Gotowe:** baza odtwarzana od zera przez wersjonowane skrypty inicjalizacji i zmian danych. **Zależy od:** S01.
- [ ] **S03 · P0 · FE/BE:** wspólne kontrakty, błędy i OpenAPI. **Gotowe:** klient i API używają tych samych schematów. **Zależy od:** S01.
- [ ] **S04 · P0 · BE:** anonimowe sesje i kontrola właściciela. **Gotowe:** druga sesja nie odczyta rozmowy, zadania, pliku ani adnotacji pierwszej. **Zależy od:** S02.
- [ ] **S05 · P0 · BE:** healthchecki, requestId, logi i CI. **Gotowe:** pull request uruchamia lint, typecheck, testy i build. **Zależy od:** S01.

## Etap 3 — wyszukiwanie i obrazy

- [ ] **B01 · P0 · BE:** adapter IRSA z walidacją, timeoutem i kontrolowanym retry. **Gotowe:** rzeczywiste wyszukiwanie oraz rozróżnienie pustego wyniku i awarii. **Zależy od:** D01, S03.
- [ ] **B02 · P0 · BE:** katalog przykładów i konwersja współrzędnych. **Gotowe:** źródło i epoka każdego wpisu; testy skrajnych RA/Dec. **Zależy od:** D02.
- [ ] **B03 · P0 · DATA/BE:** pipeline przygotowania klatek i cache. **Gotowe:** powtarzalny manifest, maski, wspólna siatka, kontrola pasm i wersji. **Zależy od:** D03, B01.
- [ ] **B04 · P0 · BE:** zadania w MongoDB, atomowe przejęcie przez `findOneAndUpdate`, lease, postęp, anulowanie i odzyskanie po restarcie. **Gotowe:** brak wiecznie aktywnego zadania; stary worker nie nadpisuje wyniku, a ponowienie go nie dubluje. **Zależy od:** B03, S02.
- [ ] **B05 · P0 · BE:** bezpieczne serwowanie podglądów. **Gotowe:** dostęp tylko do plików właściwej sekwencji; limit wielkości i walidacja URL archiwum. **Zależy od:** B03, S04.

## Etap 4 — interfejs przeglądania

- [ ] **F01 · P0 · FE:** układ nowoczesnego kokpitu zgodnie z [projektem UI](08-interfejs-kokpit.md): ekran centralny, konsole boczne, dolny copilot, tokeny wizualne, stany puste, ładowanie i błędy. **Gotowe:** używalny desktop i mobile, czytelne dane oraz pełna ręczna obsługa operacji agenta. **Zależy od:** S01.
- [ ] **F02 · P0 · FE:** formularz RA/Dec, pole, daty i przykłady. **Gotowe:** wyszukiwanie przez API z poprawną walidacją. **Zależy od:** B01, B02.
- [ ] **F03 · P0 · FE:** odtwarzacz Canvas, zoom/pan, oś czasu, play/pause i prędkość. **Gotowe:** daty widoczne przy każdej klatce, brak animowania niegotowej sekwencji. **Zależy od:** B04, B05.
- [ ] **F04 · P0 · FE:** porównanie blink i A/B. **Gotowe:** synchronizacja pozycji i skali oraz opis zgodności klatek. **Zależy od:** F03.
- [ ] **F05 · P0 · FE:** metadane, ostrzeżenia jakości i linki do źródeł. **Gotowe:** użytkownik zna daty, wydanie i ograniczenia. **Zależy od:** F03.
- [ ] **F06 · P0 · FE/BE:** kliknięcie obrazu → RA/Dec, notatka i jawne udostępnienie. **Gotowe:** link odtwarza snapshot i nie zawiera rozmowy. **Zależy od:** F03, S04.
- [ ] **F07 · P0 · FE/BE:** wspólny stan formularza, zaznaczeń i odtwarzacza; aktualizacja kontrolek po każdej operacji agenta i odtworzenie po odświeżeniu. **Gotowe:** użytkownik ręcznie poprawia parametry ustawione przez agenta, a kolejne polecenie uwzględnia poprawkę; zdarzenia nie kasują wpisywanego tekstu ani nie nadpisują nowszej edycji. **Zależy od:** F02–F04, S03, S04.

## Etap 5 — agent i czat

- [ ] **A01 · P0 · BE:** agent w NestJS, konfiguracja modelu i instrukcje. **Gotowe:** działający run SDK z limitem czasu i liczby kroków. **Zależy od:** S01, D04.
- [ ] **A02 · P0 · BE:** narzędzia `resolve_target`, `search_observations`, `prepare_sequence`. **Gotowe:** rzeczywiste wyniki serwisów, walidacja i obsługa błędów. **Zależy od:** A01, B01–B04.
- [ ] **A03 · P0 · FE/BE:** `set_view`, `set_playback`, `get_selection`, `save_annotation`; narzędzia publikują aktualizacje wspólnego stanu kontrolek. **Gotowe:** polecenie zmienia UI lub zapisuje wskazaną notatkę; parametry można później poprawić ręcznie, konflikt rewizji jest obsłużony. **Zależy od:** F03, F06, F07, A01.
- [ ] **A04 · P0 · BE:** historia SDK, zdarzenia SSE, reconnect i anulowanie. **Gotowe:** kontynuacja po odświeżeniu, idempotencja i izolacja sesji. **Zależy od:** S04, A01.
- [ ] **A05 · P0 · FE:** dolna konsola copilota z rozwijaną historią czatu, streamingiem, statusami narzędzi i „Stop”. **Gotowe:** polecenie wyszukuje sekwencję; następne zmienia odtwarzanie, a odpowiednie kontrolki ręczne pokazują ten sam stan. **Zależy od:** A02–A04.
- [ ] **A06 · P0 · QA/BE:** ewaluacje agenta i limity kosztów. **Gotowe:** zestaw przypadków z [testów](06-testy-i-wdrozenie.md), pomiar użycia, brak fałszywych komunikatów o sukcesie. **Zależy od:** A05.

## Etap 6 — odbiór i prezentacja

- [ ] **Q01 · P0 · QA:** testy danych, WCS, sesji, kontraktów i MongoDB: indeksów, transakcji, współbieżności oraz sprzątania dokumentów. **Gotowe:** wszystkie krytyczne scenariusze przechodzą na testowym replica set. **Zależy od:** B05, A04.
- [ ] **Q02 · P0 · QA:** E2E: formularz, animacja, czat, notatka, share, reconnect, błędy oraz agent → kontrolki → ręczna poprawka → kolejne polecenie. **Gotowe:** pełna ścieżka w przeglądarce, zachowanie ustawień po odświeżeniu, ochrona równoczesnej edycji i kontrola klawiaturą. **Zależy od:** F06, F07, A05.
- [ ] **Q03 · P0 · QA/DATA:** raport z pięciu obiektów testowych. **Gotowe:** dostępność, użyte daty, zgodność i obserwowane ograniczenia dla każdego; żadnych wymyślonych detekcji. **Zależy od:** D02, F04.
- [ ] **R01 · P0 · BE:** obrazy kontenerów aplikacji, połączenie z MongoDB Atlas Free, skrypty indeksów i zmian danych oraz HTTPS. **Gotowe:** publiczny frontend, gotowy backend i trwałe dane po restarcie. **Zależy od:** Q01, Q02.
- [ ] **R02 · P0 · zespół:** gotowe demo, backup danych i materiały zgłoszeniowe. **Gotowe:** film lub scenariusz, opis wykorzystania danych NASA, źródła i ograniczenia. **Zależy od:** Q03, R01.
- [ ] **R03 · P0 · zespół:** uzupełnić README o rzeczywiste komendy, licencję kodu, konfigurację i autorów. **Gotowe:** inna osoba uruchamia projekt według instrukcji. **Zależy od:** R01.

## P1/P2 — po odbiorze MVP

- [ ] **X01 · P1:** obraz różnicowy z kontrolą tła, jednostek i PSF; test artefaktów.
- [ ] **X02 · P1:** pomiar przesunięcia i niepewności, bez automatycznego potwierdzania obiektu.
- [ ] **X03 · P1:** nakładki Gaia/WISE z uwzględnieniem epoki i ruchu własnego.
- [ ] **X04 · P1:** zewnętrzne rozpoznawanie nazw, eksport CSV/JSON, mozaiki i większe pola.
- [ ] **X05 · P2:** fotometria, krzywe blasku i widma z propagacją niepewności.
- [ ] **X06 · P2:** propozycje kandydatów, konta, współpraca i kolejka obsługująca większe obciążenie.

Plan na krótki hackathon: pierwsza część prac — D/S/B; środkowa — F; ostatnia — A/Q/R. Zakres P1/P2 uruchamiać dopiero po przejściu P0. Przy małym zespole ograniczyć funkcje dodatkowe i liczbę klatek; zachować poprawność danych i faktyczne sterowanie aplikacją przez agenta.
