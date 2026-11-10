# Zakres i wymagania

## Cel

Ułatwić osobie bez doświadczenia astronomicznego porównanie rzeczywistych obrazów tego samego obszaru nieba. Czat ma wykonywać operacje w aplikacji: wyszukanie danych, wybór sekwencji, zmianę widoku i zapis notatki.

## Powiązanie z wyzwaniem

Oficjalne zadanie wymaga publicznego narzędzia webowego: podania RA/Dec, wyświetlenia kolejnych obrazów SPHEREx i łatwego zauważania zmian. Wskazane obiekty testowe: Barnard’s Star, Epsilon Indi B, WISE 0855, RW Aurigae i R Draconis. Opcjonalne kierunki obejmują wybór pola widzenia, obsługę pasm, dodawanie/odejmowanie obrazów, widma, nakładki Gaia/WISE, metadane i współrzędne w URL. [Źródło: oficjalne wyzwanie](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/).

Agent, zapis sesji i poniższy podział na etapy są naszym projektem rozwiązania. Odbiór obejmuje także testy na wszystkich pięciu obiektach wskazanych powyżej.

## Użytkownicy

- Odwiedzający: wpisuje polecenie, ogląda animację i rozumie podstawowe metadane.
- Użytkownik zainteresowany astronomią: wybiera współrzędne, filtruje obserwacje i zapisuje adnotacje.
- Zespół projektu: dodaje sprawdzone przykłady, diagnozuje problemy danych i prezentuje demo.

## MVP — P0

| ID | Funkcja | Kryterium odbioru |
| --- | --- | --- |
| F01 | Wyszukiwanie obszaru | Formularz RA/Dec i rozmiaru pola; walidacja stopni oraz opcjonalnie zapisu h/m/s i d/m/s; jasne błędy |
| F02 | Przykładowe obiekty | Przyciski dla zestawu testowego; każda pozycja ma źródło i epokę współrzędnych |
| F03 | Integracja SPHEREx | Wyszukanie rzeczywistych obserwacji; data, wydanie, detektor, zakres długości fali, pochodzenie |
| F04 | Przygotowanie klatek | Wspólny obszar i siatka nieba; zgodne dane spektralne; udokumentowana normalizacja |
| F05 | Odtwarzacz czasowy | Play/pause, poprzednia/następna klatka, prędkość, daty; co najmniej dwie odrębne epoki w sprawdzonym przykładzie |
| F06 | Porównanie A/B | Przełączanie dwóch klatek oraz widok obok siebie; wspólny zoom i położenie |
| F07 | Czat tekstowy | Odpowiedź strumieniowa, historia rozmowy, anulowanie i czytelny status wykonywanej operacji |
| F08 | Agent wykonujący operacje i synchronizacja kontrolek | Każda zatwierdzona zmiana agenta aktualizuje odpowiednie pola, zaznaczenia i suwaki; użytkownik może ręcznie poprawić ustawienia i kontynuować bez odtwarzania ich od zera |
| F09 | Metadane i ograniczenia | Źródła, daty, pokrycie i jakość danych; jawny stan braku danych lub braku porównywalnej pary |
| F10 | Notatka i link | Zaznaczenie punktu w RA/Dec, zapis komentarza i jawne utworzenie publicznego widoku bez historii czatu |
| F11 | Działający serwis | HTTPS, odseparowane sesje, limity użycia i gotowy scenariusz demo |

## Rozszerzenia

**P1 — po ukończeniu P0:** obraz różnicowy po wyrównaniu i kontroli PSF, pomiar przesunięcia z niepewnością, nakładki katalogowe, eksport adnotacji, większe pola i mozaiki.

**P2 — dalszy rozwój:** widma, fotometria i krzywe blasku, automatyczne proponowanie kandydatów, konta i współpraca użytkowników, kolejka większych analiz.

Poza MVP: potwierdzanie odkryć, wyznaczanie orbit z dwóch klatek, pełny przegląd całego nieba oraz trening własnego modelu detekcji.

## Przebieg głównego scenariusza

1. Użytkownik wpisuje: „Pokaż WISE 0855 i porównaj dostępne obserwacje”.
2. Agent rozpoznaje nazwę, wyszukuje dane i zwraca liczbę dostępnych klatek.
3. Backend wybiera porównywalną grupę i przygotowuje obrazy; UI pokazuje postęp.
4. Agent otwiera sekwencję. Użytkownik włącza animację lub pisze „Odtwórz wolniej”.
5. Użytkownik zaznacza interesujący punkt i prosi o zapisanie notatki.
6. Aplikacja zapisuje użyte obserwacje i parametry. Publiczny link powstaje po wybraniu „Udostępnij”.

Po operacjach agenta formularz zawiera użyte współrzędne, pole i daty; checkboxy wskazują wybrane obserwacje, a przełączniki i suwak pokazują bieżący tryb i tempo. Użytkownik może zmienić pojedyncze ustawienie. Agent uwzględnia tę poprawkę w kolejnym poleceniu. Dotyczy to również stanu odtworzonego po odświeżeniu strony.

Gdy danych jest za mało, aplikacja proponuje większy obszar, inny przedział dat albo sprawdzony przykład. Nie uzupełnia obserwacji wygenerowanymi obrazami.

## Układ interfejsu

Wybrany kierunek: nowoczesny kokpit kosmicznego myśliwca inspirowany X-wingiem i szkicem użytkownika. Szczegóły: [interfejs kokpitu](08-interfejs-kokpit.md).

- Góra: nazwa, bieżący obiekt, status źródła danych i język.
- Lewa konsola: obiekt, RA/Dec, rozmiar pola, daty, wyszukiwanie i wybór obserwacji.
- Środek: duży ekran obrazów, podział A/B, skala kątowa, orientacja, zaznaczenia i zoom.
- Prawa konsola: tryb widoku, źródła, metadane, jakość danych, wybrany punkt i notatki.
- Dół: oś czasu, sterowanie odtwarzaniem oraz tekstowy copilot z historią i statusem operacji.
- Mobile: przełączane zakładki i uproszczona rama kokpitu; bez pomniejszania całego panelu desktopowego.

## Wymagania jakościowe — cele projektowe

- Sterowanie klawiaturą, etykiety kontrolek, wyraźny fokus; animacja uruchamiana świadomie.
- Każdy obraz ma widoczną datę; nierówne odstępy obserwacji są opisane na osi czasu.
- Na przygotowanym zestawie: interfejs gotowy do użycia do 3 s, pierwsza klatka z cache do 5 s, płynne odtwarzanie 2 kl./s po pobraniu klatek.
- Dla danych pobieranych na żywo pokazywać postęp i limit czasu, bez obietnicy stałej szybkości archiwum.
- Każde twierdzenie agenta o dostępności danych wynika z wyniku narzędzia. Obserwacja zmiany pozostaje kandydatem do weryfikacji.
