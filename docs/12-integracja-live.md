# Integracja live — 14 listopada 2026

Działający lokalnie przepływ obejmuje NestJS/MongoDB, wyszukiwanie SIA2 IRSA, pobieranie wycinków FITS, wspólną siatkę WCS TAN, odtwarzanie Blink, A/B, notatki i agenta OpenAI Agents SDK. Agent i ręczne kontrolki zapisują ten sam stan z rewizją. SSE odtwarza zdarzenia po Last-Event-ID. Historia SDK i wiadomości pozostają w sesji MongoDB.

## Zweryfikowane dane

Zapytania o pole 0,1°, bez ograniczenia dat, wydanie DR1:

| Cel | Produkty |
| --- | ---: |
| Barnard’s Star | 259 |
| Epsilon Indi B | 417 |
| RW Aurigae | 237 |
| R Draconis | 459 |
| WISE 0855 | 297 |

To wyniki wyszukiwania, nie potwierdzenie wykrycia tych obiektów. Dla WISE 0855 QR3 zwróciło pustą listę.

Sprawdzona para WISE 0855 / D1: 6 maja 2025 12:20 UTC i 31 października 2025 18:55 UTC; długości fali w centrum odpowiednio 0,9937 i 0,9913 µm. Obrazy są wizualnym podglądem, bez dopasowania PSF i bez fotometrii. Nie deklarujemy widoczności samego WISE 0855 ani jego detekcji.

## Maska jakości

Poprzedni filtr `FLAGS == 0` błędnie usuwał także flagę SOURCE (bit 21), oznaczającą piksele zawierające sygnał źródeł astronomicznych. Polityka v3 zachowuje flagi 0 i sam SOURCE. SOURCE połączony z inną flagą nadal jest maskowany. [Definicje IRSA](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html), [przykład IRSA](https://caltech-ipac.github.io/irsa-tutorials/spherex-source-discovery-tool-demo/).

Przełącznik „Maska jakości” znajduje się nad obrazem. Włączony ukrywa piksele z pozostałymi flagami lub nieprawidłową wariancją. Wyłączony pokazuje wariant diagnostyczny, również z problematycznymi pikselami. Oba warianty stosują tę samą siatkę, wspólny kontrast asinh i kontrolę zgodności długości fali. Brakujące lub niezgodne spektralnie piksele nie są uzupełniane.

Dla sprawdzonej pary wspólne pokrycie zmieniło się z błędnych 27,5% na 67,6% po zachowaniu SOURCE; wariant bez maski jakości pokazuje 84,7%. Warianty powstają równocześnie w workerze i są przełączane bez ponownego pobierania FITS. Wybór zapisuje się w stanie sesji. Stare manifesty bez obu wariantów wymagają nowego przygotowania sekwencji.

## Uruchomienie i kontrole

```bash
uv sync --project workers/imaging --locked
pnpm db:up
pnpm dev:doppler  # sekrety sphere_x / dev; MONGODB_URI może pochodzić z lokalnego .env
pnpm check
pnpm test:integration
pnpm test:imaging
pnpm verify:live -- --images  # jawny test rzeczywistego archiwum; wymaga działającego API
```

Model: `gpt-6.1-sol`, domyślny wysiłek rozumowania `low`; klucz pozostaje na backendzie. Do wyboru detektora służy deterministyczne `select_observations`, aby model nie musiał przepisywać długich list identyfikatorów.

Testy offline obejmują kontrolę współrzędnych, konflikty rewizji, zachowanie SOURCE i odrzucenie SOURCE z defektem, wspólny kontrast, orientację PNG oraz zgodność wariantów. Testy HTTP sprawdzają własność zasobów i obu wariantów obrazu, błędne parametry, anulowanie, replay SSE i idempotencję.

Aktualna kolejka obrazów jest lokalna i wymaga jednego procesu API. Publiczne snapshoty, PL/EN, wdrożenie HTTPS, automatyczne sprzątanie cache i kolejka rozproszona pozostają do wykonania. Link z UI udostępnia tylko współrzędne.

## Wybór pasma i kompaktowy odtwarzacz

Suwak nad obrazem wybiera detektor D1–D6; etykieta zakresu µm pochodzi z metadanych bieżącego wyszukiwania. Przesuwanie suwaka zmienia filtr listy, bez pobierania plików. „Przygotuj pasmo” zaznacza do 24 obserwacji wskazanego detektora z odrębnych czasów i uruchamia istniejący pipeline. To wybór zakresu detektora, a nie dowolnej, dokładnej długości fali; zgodny podzbiór weryfikuje WCS-WAVE. Dopóki nowa sekwencja nie jest gotowa, widoczny pozostaje poprzedni obraz ze swoją rzeczywistą długością fali.

Odtwarzacz ma jeden pasek: poprzednia/play-pauza/następna, suwak klatki, licznik i wybór tempa. Data nadal widnieje przy obrazie. Informacja o nierównych odstępach czasowych jest w podpowiedzi suwaka.

## Aktualizacja interfejsu — podgląd bez maski jakości

Na życzenie użytkownika usunięto przełącznik maski jakości. Interfejs wyświetla wariant bez maskowania jakości (`quality=off`); istniejące sesje są synchronizowane do `qualityMask=false`. Nadal obowiązuje wspólne pokrycie i zgodność długości fali. Wcześniejszy opis przełącznika dokumentuje historyczną wersję v3; oba warianty plików pozostają dostępne w API dla zgodności zapisanych sekwencji.

### Wszystkie zdjęcia i MP4

Zniesiono limit 24 zdjęć na pasmo w zaznaczaniu, API, agencie, stanie widoku i workerze. Można przygotować wszystkie wyniki bieżącego wyszukiwania (wyszukiwarka zwraca maksymalnie 500 produktów). Filtr zgodności długości fali pozostaje aktywny: detektor nie oznacza jednej długości fali. Panel pokazuje liczbę gotowych klatek względem zleconych zdjęć oraz ostrzeżenia dotyczące pobierania, pokrycia i zgodności spektralnej.

Przycisk „↓ MP4” eksportuje klatki bieżącego pasma, w kolejności czasowej i przy ustawionym FPS, z podpisami UTC i długością fali. Endpoint POST `/sequences/:id/export` sprawdza właściciela oraz przynależność klatek do jednego pasma. Worker używa `imageio-ffmpeg` z dołączonym FFmpeg, kodowania H.264/yuv420p i faststart. Pliki robocze eksportu są usuwane także po błędzie; po aktualizacji zależności uruchom `uv sync --project workers/imaging`.

### Animacja bez filtrowania długości fali

Na życzenie użytkownika pipeline `tan-all-wavelengths-multiband-v5` zachowuje wszystkie poprawnie odczytane obserwacje obejmujące środek pola, niezależnie od długości fali. Usunięto wybór największej zgodnej grupy oraz spektralną maskę pikseli. Każda klatka zachowuje własne pokrycie przestrzenne; kontrast pozostaje wspólny. Daty i długości fali nadal opisują każdą klatkę i trafiają do MP4. Ostrzeżenie wyjaśnia, że różnice mogą wynikać z długości fali, a nie zmian obiektu w czasie. Dotychczasową sekwencję Andromedy przeliczono z cache: 18 klatek zamiast 4, bez ponownego pobierania niedostępnych produktów IRSA.

### Kolor RGB i jasność

Panel nad obrazem zawiera tryb „Kolor RGB”, okno czasu 1/6/24/72/168 godzin oraz suwak ekspozycji −6…+2 EV. Kompozycja korzysta wyłącznie z przygotowanych klatek bieżącej sekwencji i jej wspólnej siatki WCS. Wybiera najbliższą bieżącej klatce grupę z jak największą liczbą różnych detektorów, po jednej obserwacji na detektor. Całkowity odstęp między najwcześniejszą a najpóźniejszą obserwacją nie przekracza wybranego okna; kandydaci muszą też znajdować się w tym odstępie od bieżącej daty. Lista źródeł pokazuje faktyczne daty UTC, długości fali oraz przypisanie do kanałów. Krótsze fale są niebieskie, środkowe zielone, dłuższe czerwone; przy dwóch pasmach zielony jest geometryczną mieszanką obu. Są to kolory umowne, nie fotometria. Brakujące kanały pozostają przezroczyste; nie ma dopasowania PSF.

Worker zachowuje dla każdej klatki liniowe wartości po normalizacji kontrastu, przed obcięciem bieli, jako little-endian Float32 (`radianceName`). Chroniony endpoint GET `/sequences/:id/frames/:frameId/radiance` udostępnia dane wyłącznie właścicielowi. Przeglądarka stosuje mnożnik `2**EV` przed funkcją asinh, więc suwak może przywrócić szczegóły powyżej punktu bieli PNG. Starsze sekwencje bez tych danych mają podgląd zastępczy i informację o potrzebie ponownego przygotowania. Regulacja dotyczy podglądu; istniejący eksport MP4 pozostaje eksportem pojedynczego pasma i jest nieaktywny podczas kompozycji RGB.

### MP4 z kolorowej animacji

Eksport przyjmuje opcjonalne ustawienia `color`, `exposure`, `epochHours` i trzy kanały `{enabled, detector}`. Przy włączonym RGB przycisk ma nazwę „↓ RGB MP4”. Serwer wyznacza źródła każdej epoki tym samym selektorem co podgląd; żadna ścieżka pliku nie pochodzi od klienta. Epoki bez co najmniej dwóch pasm lub bez wybranego aktywnego kanału są pomijane, a brak jakiejkolwiek poprawnej epoki zwraca opisowy błąd. Kodowanie zachowuje FPS, przypisanie automatyczne/ręczne, wyłączenie kanałów i EV. Funkcja asinh i mnożnik ekspozycji odpowiadają podglądowi. Podpisy zawierają datę epoki, EV, konfigurację RGB oraz daty i długości fali zdjęć źródłowych. Eksport monochromatyczny także uwzględnia ustawioną jasność.

### Katalog wydań i laboratorium widmowe

`config/spherex-releases.json` jest jedynym katalogiem wydań Level 2: `id`, etykieta, kolekcja SIA, prefiks produktów IBE i aktywność. `defaultRelease` ustawia domyślne wydanie nowych sesji. Opcjonalny `SPHEREX_RELEASES_FILE` wskazuje inny plik. API waliduje plik i przeładowuje go po zmianie mtime; GET `/data-releases` zasila selektor interfejsu. „Odśwież wydania” aktualizuje go bez przebudowy frontendu. Dodawanie wydania zachowującego format Level 2 wymaga tylko nowego wpisu; nigdy nie miesza ono kalibracji różnych wydań w jednej sekwencji. Zmiana formatu FITS wymaga osobnego sprawdzenia adaptera i testów — nie jest automatycznie uznawana za zgodną. Dozwolony host pozostaje wyłącznie HTTPS IRSA, a prefiks produktu musi figurować w katalogu.

Przyciski „Widmo punktu” i „Stacki D1–D6” otwierają laboratorium nad kokpitem. Analiza POST `/sequences/:id/analyze` korzysta wyłącznie z lokalnych FITS należących do gotowej sekwencji bieżącej sesji, bez nowego wyszukiwania ani pobierania. Zakres λ ogranicza wykorzystane piksele. Ścieżki i manifesty ustala serwer; klient przekazuje jedynie tryb, współrzędne i przedział długości fali.

Widmo to poglądowy pomiar najbliższego natywnego piksela dla wskazanych współrzędnych: `IMAGE - ZODI`, poprawne flagi jakości, λ/bandwidth z WCS-WAVE oraz σ z pierwiastka VARIANCE. Jednostka to jasność powierzchniowa MJy/sr, nie całkowity Fν źródła. Wykres nie łączy punktów z różnych dat linią; kolory rozróżniają detektory, podpowiedzi zawierają datę i ID. Tabela i CSV zachowują czas, detektor, długość fali, wartość, błąd i źródło. To nie jest fotometria aperturowa/PSF, odjęcie lokalnego tła ani pełne widmo 102 kanałów z gwarancją kompletności. Pełne pokrycie wymaga wystarczającej liczby obserwacji.

Stacki powstają osobno dla detektorów po projekcji WCS, z ważeniem odwrotnością VARIANCE i flagami jakości. Przy szerokim zakresie mieszają różne długości fali i daty, więc są poglądowym obrazem wielopasmowym. Interpolowana wariancja jest wagą względną, bez propagacji kowariancji resamplingu; narzędzie nie deklaruje liczbowej poprawy S/N ani skalibrowanej fotometrii stacku. Dla każdego stacku dostępne są liczba zdjęć, pokrycie, źródła/czasy i PNG. Test syntetyczny potwierdza średnią 3,6 dla wartości 2 i 10 z wariancjami 1 i 4.

### Kompozycja RGB ze stacków

W zakładce „Stacki D1–D6” kompozytor pozwala niezależnie włączać kanały R/G/B i wybierać dla każdego dowolny dostępny stack, także ten sam dla kilku kanałów. Niedostępne detektory są oznaczone w selektorach. Domyślne przypisanie to najdłuższy/środkowy/najkrótszy dostępny zakres. Podgląd i pobierany PNG korzystają z tego samego canvasu, z aktualnym EV i stanem checkboxów. Rozmiar PNG odpowiada siatce stacków (256×256); brak danych aktywnego kanału pozostaje przezroczysty. Sekcja źródeł pokazuje liczbę zdjęć i zakresy dat dla kanałów. Jest to wizualna kompozycja gotowych podglądów stacków o niezależnym kontraście, bez gwarancji jednoczesności i bez odzyskiwania wartości już obciętych do bieli w wejściowych PNG.

### Porównywanie epok, większe pola i odnośniki

„A ± B” pozwala wybrać dwie obserwacje gotowej sekwencji i wyliczyć A+B albo B−A z `IMAGE - ZODI`, po projekcji na wspólną siatkę i zastosowaniu flag jakości. Domyślnie druga epoka pochodzi z tego samego detektora i ma możliwie zbliżoną długość fali. Porównania nie odrzucają innych fal, ale pokazują ostrzeżenie. Czerwony oznacza dodatnią różnicę B−A, niebieski ujemną. Wynik ma PNG, wspólne pokrycie, zakres wartości MJy/sr i metadane obu źródeł. Bez dopasowania PSF i lokalnego tła nie jest to automatyczny detektor ruchu ani statystycznie skalibrowana mapa istotności.

FOV rozszerzono do 2°. Większe pola mogą mieć częściowe pokrycie pojedynczej ekspozycji; nie są automatycznie mozaikowane. Dla FOV >0,5° limit pobieranego pliku wynosi 128 MiB zamiast 32 MiB. Worker dekoduje i reprojektuje po jednym natywnym FITS, zachowując tylko wspólne tablice 256×256 i metadane, zamiast trzymać wszystkie duże obrazy w RAM. Podgląd nadal ma 256×256 pikseli, więc większy FOV oznacza mniejszą rozdzielczość kątową podglądu. Syntetyczne testy obejmują pola 0,1°, 1° i 2°. Dla sprawdzonych produktów żądania 1–2° zwracały HTTP 503, natomiast kontrolny wycinek 0,1° zwrócił HTTP 200. Obsługa 2° jest potwierdzona syntetycznie; dostępność dużych wycinków w aktualnej usłudze IRSA pozostaje niepotwierdzona.

Szczegóły flag jakości są dostępne w „Instrumenty” i przy porównaniach. Nazwy `MSKNnnnn` i opisy `MSKDnnnn` pochodzą bezpośrednio z nagłówka FLAGS, z liczbą i odsetkiem pikseli dla każdego ustawionego bitu. SOURCE (bit 21) jest opisywany jako znane źródło, nie automatyczna wada detektora. Metadane nowych klatek zachowują te zestawienia; starsze mogą odczytać je na żądanie ze źródłowego FITS.

Linki obsługują `ra`, `dec`, `fov`, `release`, `from`, `to`, `search=1` oraz `embed=1`. Obie współrzędne są wymagane. `search=1` uruchamia wyszukiwanie, lecz nie pobiera automatycznie wszystkich wycinków. Link i kod iframe nie zawierają identyfikatorów prywatnej sesji. `embed=1` daje zwarty układ bez bocznych paneli; przeglądarkowe ograniczenia ciasteczek między witrynami nadal obowiązują, więc produkcyjne osadzanie cross-site wymaga odpowiedniego projektu sesji/hostingu (domyślna sesja używa SameSite=Lax). W tej zmianie nie osłabiano uwierzytelniania ani OriginGuard. Lokalne/same-site osadzanie korzysta z bieżącej polityki sesji.

„Ten obszar w Aladin Lite” otwiera atlas CDS ze współrzędnymi i FOV. Pipeline FITS nadal korzysta z Astropy i afiliowanego pakietu reproject; nie dodano zewnętrznych skryptów atlasu do głównego kokpitu.

### Ziemia, SPHEREx i kierunek obserwacji w nawigacji

Zakładka „Nawigacja” zastępuje obraz nieba globem i pozycją SPHEREx, pozostawiając formularz współrzędnych po lewej. Zmiany RA/Dec/FOV działają od razu, bez zlecania wyszukiwania IRSA. Glob można obracać, przybliżać i ustawić czas ±120 min; „Teraz” przywraca zegar bieżący. Symbole satelity i stożka FOV są wizualnie powiększone.

GET `/spacecraft-orbit` pobiera wyłącznie elementy dla NORAD 63182 z ustalonego adresu CelesTrak. Sprawdzane są numery katalogowe, długości linii, sumy kontrolne i epoka. Pamięć podręczna trwa 2 godziny i współdzieli żądania równoległe. Przy awarii może zwrócić ostatni zestaw z `stale=true`; brak danych uruchamia jawnie oznaczony schemat nominalny. Przeglądarka odświeża elementy co 2 godziny. Pozycja i trajektoria obliczane są biblioteką satellite.js 6 (SGP4); prognozowanie jest ograniczone do ±7 dni od epoki TLE. Widok pokazuje UTC, epokę, wysokość, prędkość i współrzędne geograficzne.

Strzałka jest kierunkiem wybranych RA/Dec, nie telemetrią orientacji teleskopu. Konwersja kierunku ICRS do układu orbity jest orientacyjna (bez precesji/nutacji), a zasłonięcie liczone dla sferycznej Ziemi. Brak zasłonięcia nie potwierdza dostępności obserwacji: model nie uwzględnia Słońca, osłon, planu misji ani sterowania instrumentem. Mapa wybrzeży pochodzi z publicznego zbioru Natural Earth 110m.

Testy obejmują osie RA/Dec, normalizację kierunku, przecięcie promienia z Ziemią, identyfikację satelity i sumy kontrolne TLE oraz cache i jawny fallback. W UI sprawdzono aktualny TLE, zmianę strzałki po zmianie współrzędnych oraz zatrzymanie i wznowienie czasu.

### Zarejestrowana orientacja pola a orientacja satelity

W sprawdzonych publicznych źródłach nie znaleziono strumienia bieżącej orientacji ADCS/kwaternionów SPHEREx. Nie wyprowadza się jej z TLE ani z wybranego celu. Nawigacja ma zatem osobną sekcję „Orientacja z danych pomiarowych · pole detektora (archiwum)” i jawny komunikat o braku podłączonej orientacji korpusu na żywo.

Odczyt korzysta z istniejącej, autoryzowanej analizy metadanych wybranego FITS. `recordedPointing` zawiera ICRS w punkcie odniesienia CRPIX oraz kąty pozycyjne dodatnich osi X/Y detektora, mierzone na wschód od północy. Pozycja odniesienia nie jest środkiem wycinka i nie jest automatycznie wspólną osią optyczną teleskopu. Obliczenia wykonuje Astropy WCS z oryginalnego nagłówka, z konwersją współrzędnych do ICRS. Czas jest pobierany kolejno z DATE-AVG, DATE-OBS lub z jawnie oznaczonych metadanych archiwum, z uwzględnieniem TIMESYS. Kompas osi, dokładny czas, detektor i źródłowy FITS są widoczne w panelu.

Nie łączy się archiwalnego obrotu pola z aktualną pozycją orbitalną jako jednego pomiaru orientacji. Strzałka globu pozostaje zaplanowanym kierunkiem użytkownika. Podczas nawigacji ukryta animacja klatek jest zatrzymana lokalnie, aby nie zmieniać automatycznie ekspozycji używanej do odczytu orientacji. Test syntetyczny sprawdza przesunięty CRPIX, obrót 30° oraz priorytet czasu DATE-AVG.

### Przygotowanie FITS i cache projekcji

Pobieranie wycinków działa z limitem czterech równoległych żądań IRSA. Kolejność manifestu pozostaje zgodna z wyborem; anulowanie zatrzymuje dalsze pobrania, a postęp nie cofa się przy odpowiedziach przychodzących w różnej kolejności. Zachowane są limit rozmiaru odpowiedzi, timeout i trzy próby. Zmiana kodu API wymaga ponownego uruchomienia procesu; nie należy restartować go w trakcie aktywnego przygotowania.

Worker zapisuje wyrównane płaszczyzny w `data/cache/projections/` (lub `CACHE_ROOT/projections/`). Cache uwzględnia plik źródłowy, jego rozmiar i czas modyfikacji, RA/Dec, pole widzenia, rozmiar siatki oraz skrót kodu workera. Uszkodzony wpis jest przeliczany. Kontrast nadal jest wyznaczany dla bieżącego wyboru zdjęć; analizy naukowe korzystają z oryginalnych FITS. Zapis cache jest atomowy i nie wykorzystuje pickle.

Pomiar lokalny na 20 zapisanych rzeczywistych wycinkach: 19 poprawnych klatek, 1,545 s pierwszego przetwarzania i 0,162 s powtórzenia; wynikowe PNG identyczne bajtowo. Pomiar nie obejmuje transferu IRSA ani startu interpretera i nie stanowi gwarancji przyspieszenia całego zadania.

### Czas sceny a ekspozycje FITS

Kliknięcie pola w archiwalnej siatce zatrzymuje zegar sceny na wybranej ekspozycji. Worker odczytuje `DATE-AVG` z uwzględnieniem `TIMESYS`, `SGT_LAT_MIDPT`, `SGT_LON_MIDPT`, promień geocentryczny z normy `X_SC/Y_SC/Z_SC` oraz opcjonalną wartość prędkości z `VX_SC/VY_SC/VZ_SC`. Pozycję wyświetlamy z wykorzystaniem kulistego modelu Ziemi i zapisanego śladu naziemnego; nie traktujemy surowych współrzędnych inercjalnych jako ECF. Jeśli FITS zawiera także VX_SC/VY_SC/VZ_SC, wyznaczamy elipsę oskulacyjną w modelu dwuciałowym. Pozycja i cały tor korzystają z tej samej ramy i czasu Ziemi; punkt środka toru jest identyczny z pozycją satelity. Minimalna korekta obrotowa kotwiczy przybliżoną transformację osi niebieskich do śladu naziemnego FITS w kulistym modelu Ziemi. Model pomija J2, opór atmosferyczny i inne perturbacje, nie stanowi dokładnej efemerydy. Propagacja jest ograniczona do ±3 godzin od ekspozycji. Bez poprawnego wektora prędkości lub przy niepoprawnych elementach ślad pozostaje ukryty. „Now” / „Teraz” wraca do bieżącej prognozy TLE/SGP4.

Puste pole wybiera czas kolumny oraz dostępną ekspozycję innego pasma z dokładnie tego samego czasu archiwalnego. Interfejs wskazuje brak zdjęcia w klikniętym paśmie i pasmo użyte do odczytu pozycji. Brak danych pozycyjnych nie jest zastępowany etykietą prawdziwej pozycji: pozostaje jawny schemat poglądowy.

### Język interfejsu

Domyślny język to EN. Przycisk EN/PL w nagłówku zmienia język bez resetowania wybranej klatki, kanałów ani czasu sceny; wybór jest zapisywany pod kluczem `spherex-language` w localStorage. Katalog `apps/web/src/shared/i18n/translations.en.ts` zawiera tłumaczenia polskich kluczy i parametryzowanych komunikatów. Treści wpisane przez użytkownika i historia rozmowy nie są automatycznie tłumaczone.
