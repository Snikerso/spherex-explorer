# Uruchomienie szkieletu i MongoDB Atlas Free

## Co działa w tym etapie

- Monorepo pnpm: React/Vite, NestJS, wspólne kontrakty Zod/TypeScript i lockfile.
- Ekran startowy z motywem kokpitu oraz rzeczywistym sprawdzeniem gotowości API i bazy.
- Anonimowa sesja w cookie, odczyt/zapis jej stanu w MongoDB i kontrola rewizji.
- Fabryka agenta SDK, siedem narzędzi oraz testowe adaptery obserwacji.
- Testy offline, integracja z tymczasowym MongoDB, runner ewaluacji live i konfiguracja CI.

To szkielet developerski. Nie ma jeszcze połączenia z IRSA, obrazów FITS, pełnego interfejsu kokpitu, czatu HTTP/SSE, trwałej historii SDK, limitów publicznego czatu ani kompletnego API z dokumentu 04. Nie publikować go jako ukończonego serwisu; domyślnie oba serwery nasłuchują lokalnie.

## Wymagania

Node 22.12+ z gałęzi 22 lub Node 24; pnpm 11.25.0. `.nvmrc` wskazuje wersję startową, a lockfile przypina zależności. Konfiguracja pnpm jawnie zezwala na build esbuild; pobieranie binarki testowego MongoDB odbywa się dopiero przy testach integracyjnych.

## MongoDB Atlas — główny wariant

Użytkownik tworzy własny klaster **Free** w Atlas. Nie potrzebujemy Dockera dla bazy aplikacji.

1. Utworzyć klaster Free i użytkownika bazy z rolą `readWrite` ograniczoną do bazy `spherex`.
2. W Network Access dopuścić adres IP komputera uruchamiającego backend. Przy późniejszym hostingu dopuścić adres wyjściowy backendu.
3. W Connect → Drivers skopiować URI aplikacji. Uzupełnić użytkownika, hasło i nazwę bazy `/spherex`. Znaki specjalne w loginie/haśle zakodować procentowo zgodnie z formatem URI.
4. Wkleić URI wyłącznie do lokalnego `.env` jako `MONGODB_URI`. Klienta React nie łączymy bezpośrednio z Atlas.

Przykładowy format z celowo fikcyjnymi wartościami:

```dotenv
MONGODB_URI=mongodb+srv://APP_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/spherex?retryWrites=true&w=majority
```

Do URI Atlas nie dopisywać lokalnego `directConnection=true` ani nazwy lokalnego replica set. Zachować parametry dostarczone przez Atlas. Nie wklejać URI z hasłem do czatu, kodu ani repozytorium.

Atlas Free ma obecnie limit 0,5 GB obejmujący dokumenty i indeksy oraz automatycznie zarządzaną replikację. Dlatego zapisujemy tam metadane i stan; FITS i podglądy pozostają poza bazą. API ogranicza pulę do 10 połączeń. Limity planu mogą się zmieniać. [Oficjalne limity Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

## Pierwsze uruchomienie

W katalogu głównym:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Uzupełnić `MONGODB_URI` w `.env`, następnie:

```bash
pnpm db:init
pnpm dev
```

- Frontend: `http://localhost:5173`.
- Gotowość API i bazy: `http://127.0.0.1:3000/api/v1/health/ready`.
- Żywotność API: `http://127.0.0.1:3000/api/v1/health/live`.

Skrypt `db:init` tworzy wymagane indeksy `sessions` i `views`; można wykonać go ponownie. Nie usuwa kolekcji ani indeksów. Następne etapy dodadzą własne wersjonowane skrypty dla kolejnych kolekcji.

Frontend używa proxy Vite `/api`, więc żądania przeglądarki trafiają do jednego origin. Domyślne `APP_ORIGIN=http://localhost:5173` musi odpowiadać adresowi otwartemu w przeglądarce. `API_PORT` jest konfigurowalny, ale przy jego zmianie trzeba też zmienić cel proxy w `apps/web/vite.config.ts`.

Klucz OpenAI nie jest potrzebny do uruchomienia tego ekranu, zapisu ustawień i testów offline. `OPENAI_API_KEY` i `OPENAI_MODEL` ustawiamy dopiero do jawnego `eval:live`.

## Sprawdzenie zapisu stanu przez REST

Poniższy przykład nie wymaga gotowego czatu ani kontrolek. Cookie zostaje w lokalnym pliku tymczasowym; usuwamy je po próbie.

```bash
curl -c /tmp/spherex-cookies.txt -X POST \
  -H 'Origin: http://localhost:5173' \
  http://127.0.0.1:3000/api/v1/sessions

curl -b /tmp/spherex-cookies.txt \
  http://127.0.0.1:3000/api/v1/view

curl -b /tmp/spherex-cookies.txt -X PATCH \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"expectedRevision":0,"patch":{"fps":1}}' \
  http://127.0.0.1:3000/api/v1/view

rm /tmp/spherex-cookies.txt
```

Nowa sesja zaczyna od rewizji 0. Kolejny zapis używa rewizji zwróconej przez API; stara rewizja daje `409 VIEW_CONFLICT`. Parametry są walidowane, a sesja wynika z cookie, nie z identyfikatora przysłanego w body.

## Opcjonalny MongoDB lokalny

Jeżeli Atlas nie jest dostępny, można świadomie wybrać lokalny replica set. Wymaga uruchomionego silnika Docker.

```bash
pnpm db:up
```

W `.env` wtedy:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/spherex?replicaSet=rs0&directConnection=true
```

Następnie `pnpm db:init` i `pnpm dev`. Compose jest wyłącznie lokalny; port bazy jest wystawiony na `127.0.0.1`. `pnpm db:down` zatrzymuje bazę i zachowuje wolumen. Do Atlas nie uruchamiamy lokalnego skryptu inicjalizacji replica set.

## Kontrola jakości

```bash
pnpm check
pnpm test:integration
pnpm demo:scenario
```

Pierwsza komenda uruchamia lint, sprawdzenie typów, testy offline i build. Druga testuje rzeczywisty tymczasowy replica set, a nie Atlas użytkownika. Wyniki testu lokalnego nie potwierdzają dostępu do Twojego klastra — ten sprawdza `health/ready` po uzupełnieniu URI.

Przy zmianie kontraktów podczas `pnpm dev` uruchomić `pnpm --filter @spherex/contracts build`; szkielet nie ma jeszcze automatycznego watch dla tego pakietu.
