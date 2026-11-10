# Plan demonstracji konkursowej

## Historia projektu

„Dane astronomiczne są obszerne i wymagają porównywania wielu obserwacji. SPHEREx Explorer daje użytkownikowi kokpit, w którym może oglądać zmiany nieba i sterować analizą zwykłym tekstem. Każde działanie copilota jest widoczne w kontrolkach i może być dalej poprawiane ręcznie”.

Główny wyróżnik prezentacji: agent wykonuje operacje, a użytkownik zachowuje pełną możliwość sterowania tym samym stanem aplikacji.

## Stan obecny i brama przed nagraniem

Obecnie można pokazać ekran startowy React, połączenie NestJS z MongoDB, zapis ustawień i testowy przepływ narzędzi. Makieta kokpitu jest obrazem koncepcyjnym. Scenariusz konkursowy poniżej dotyczy docelowej aplikacji; nagranie pełnej ścieżki wymaga jeszcze kontrolek, danych IRSA, renderowania i czatu. Nie przedstawiać skryptu testowego ani makiety jako działającego agenta z danymi NASA.

Do próby końcowej wybrać jeden obiekt z rzeczywistą, porównywalną sekwencją. WISE 0855 jest kandydatem do scenariusza, ale jego użycie zależy od wyników D01–D03. Jeśli inne pole lepiej pokazuje zmianę, pokazać sprawdzony przykład i podać powód wyboru.

## Przebieg — 3 minuty

| Czas | Co pokazujemy | Przykładowa wypowiedź |
| --- | --- | --- |
| 0:00–0:20 | Kokpit i problem porównywania obserwacji | „Szukamy zmian na niebie, porównując ten sam obszar w różnych terminach”. |
| 0:20–0:50 | Polecenie „Pokaż [sprawdzony obiekt] i znajdź obserwacje do porównania” | „Copilot ustawia współrzędne i filtry. Te same wartości od razu pojawiają się w formularzu”. |
| 0:50–1:20 | Przygotowane klatki, daty, źródło, animacja i A/B | „To osobne obserwacje z podanych dat. Porównujemy zgodne dane na wspólnej siatce nieba”. |
| 1:20–1:50 | Polecenie „Odtwarzaj 2 klatki/s”, potem ręczna zmiana na 1 | „Agent i użytkownik sterują tym samym odtwarzaczem. Po jego działaniu mogę poprawić dowolne ustawienie”. |
| 1:50–2:15 | Polecenie „Zatrzymaj, zachowaj moje tempo” oraz zapis punktu | „Copilot uwzględnia moją poprawkę. Interesujące miejsce zapisuję jako kandydata do dalszej analizy”. |
| 2:15–2:40 | Metadane, jakość, notatka i publiczny snapshot | „Zachowujemy źródła i parametry, żeby można było wrócić do tego porównania”. |
| 2:40–3:00 | Krótki opis stosu i ograniczeń | „React, NestJS, MongoDB Atlas i OpenAI Agents SDK. Narzędzie ułatwia przegląd danych; potwierdzenie odkrycia wymaga dalszych obserwacji”. |

Nie obiecywać widocznego ruchu konkretnego obiektu, zanim nie sprawdzimy rzeczywistych klatek. Jeśli przykład pokazuje wyłącznie sposób porównania, powiedzieć to wprost.

## Przygotowanie stanowiska

- [ ] Wybrać rzeczywiste obserwacje i zapisać manifest: identyfikatory, daty, wydanie, pokrycie spektralne, źródła, parametry przetwarzania.
- [ ] Sprawdzić, że scena jest czytelna przy rozdzielczości nagrania; ukryć sekrety i panele administracyjne.
- [ ] Przygotować cache klatek i odtwarzalny punkt startowy sesji.
- [ ] Sprawdzić dostęp do Atlas z sieci prezentacyjnej, stan klastra oraz połączenie backendu.
- [ ] Uruchomić testy, smoke test IRSA i test modelu z limitem kosztu.
- [ ] Przećwiczyć dokładne polecenia, ręczną poprawkę i powrót do stanu początkowego.
- [ ] Sprawdzić źródła, DOI oraz wymagane podziękowanie za dane.
- [ ] Przygotować krótkie nagranie zapasowe prawdziwego przebiegu i jasno oznaczony tryb danych demonstracyjnych.

## Plan awaryjny

| Problem | Uczciwy sposób prezentacji |
| --- | --- |
| IRSA odpowiada wolno | Użyć wcześniej pobranych prawdziwych klatek; pokazać ich źródła i oznaczenie danych z cache |
| OpenAI niedostępne | Pokazać ręczne sterowanie; ewentualne nagranie działania agenta wyraźnie nazwać nagraniem |
| Atlas niedostępny | Użyć wcześniej przygotowanego lokalnego środowiska lub nagrania; nie sugerować aktywnego zapisu |
| Nie widać oczekiwanej zmiany | Pokazać porównanie i ograniczenia; nie dopowiadać odkrycia |
| Funkcja nadal niegotowa | Pokazać makietę lub plan z etykietą „planowane”, bez udawania implementacji |

## Materiały do przygotowania na zgłoszenie

1. Film około 3 minut według scenariusza.
2. Krótki opis problemu, rozwiązania i wyróżnika: edytowalna współpraca z agentem.
3. Link do uruchomionej aplikacji i repozytorium, instrukcja użycia oraz autorzy.
4. Lista wykorzystanych danych i źródeł z atrybucją.
5. Opis wkładu zespołu, zastosowania AI, ograniczeń i dalszych kroków.

Dokładne pola, długość filmu i terminy trzeba sprawdzić w aktualnych zasadach zgłoszenia. Ten dokument jest scenariuszem projektu, nie potwierdzeniem wymagań formularza konkursowego.

## Demo techniczne dostępne już teraz

```bash
pnpm demo:scenario
```

Pokazuje w konsoli jawny przebieg: wyszukiwanie danych testowych → wybór klatek → tempo 2 → ręczna poprawka na 1 → odczyt nowego stanu przez następny run. Nie wykonuje wywołań modelu ani IRSA. Osobno `pnpm dev` pozwala pokazać ekran startowy i stan połączenia z bazą skonfigurowaną w `.env`.
