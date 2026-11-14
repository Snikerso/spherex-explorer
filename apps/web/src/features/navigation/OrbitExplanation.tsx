import { t } from '../../shared/i18n';
import type { NavigationController } from './useNavigationOrbit';
export function OrbitExplanation({ controller }: { controller: NavigationController }) {
  const { model, orbit, error } = controller;
  return (
    <>
      <details className="orbit-explanation">
        <summary>
          {model.date.toISOString().replace('T', ' ').slice(0, 19)} UTC ·{' '}
          {model.recorded
            ? t('pozycja zapisana w FITS · kulisty model Ziemi')
            : model.real
              ? t('epoka TLE {0}', orbit?.epochUtc.slice(0, 19).replace('T', ' '))
              : orbit
                ? t('Elementy poza zakresem propagacji — schemat poglądowy')
                : error || t('Oczekiwanie na elementy orbity')}
        </summary>
        <p>
          {t(
            'Domyślna kamera jest związana z kierunkiem Słońca, z północą u góry i Słońcem po lewej; nie podąża za satelitą. Obrót dobowy kontynentów jest zachowany. Złota oś łączy bieguny N/S; strzałka nad biegunem północnym pokazuje obrót z zachodu na wschód (przeciwnie do wskazówek zegara, patrząc znad północy). Model satelity i stożek są powiększone dla czytelności, a jego bryła jest symbolem, nie telemetrią orientacji korpusu. Przeciągnięcie globu przełącza na kamerę ręczną. Słońce i Księżyc: efemerydy Astronomy Engine dla czasu widoku, kierunki geocentryczne. Oświetlenie Ziemi wychodzi z iloczynu kierunku Słońca i normalnej do powierzchni; granica dnia i nocy zmienia się z czasem oraz obrotem widoku. Symbole na obrzeżu pokazują rzut kierunku; odległości i rozmiary na scenie nie są w skali. Odległości w podpisach liczymy od środka Ziemi. Obrót EQD → ECF wykorzystuje GMST (przybliżenie orientacji Ziemi).',
          )}
        </p>
        <p>
          {t(
            'Kliknięcie kwadracika zatrzymuje czas na wybranej ekspozycji. Pozycja archiwalna wykorzystuje SGT_LAT_MIDPT/SGT_LON_MIDPT oraz odległość od środka Ziemi z X_SC/Y_SC/Z_SC. Tor wyznaczamy z wektorów pozycji i prędkości tej samej ekspozycji jako elipsę dwuciałową. To przybliżenie bez perturbacji, nie dokładna efemeryda. Punkt satelity leży na tej samej elipsie. Cały tor pokazujemy względem orientacji Ziemi w jednym czasie, a nie jako ślad naziemny z różnych chwil. „Teraz” przywraca czas bieżący. Bez pozycji w FITS i odpowiedniego TLE widok pozostaje schematem poglądowym.',
          )}
        </p>
        <p>
          {t(
            'Pozycja w trybie bieżącym jest prognozą SGP4 z elementów orbitalnych CelesTrak. Strzałka pokazuje wybrane RA/Dec, a nie telemetrię orientacji teleskopu. Używamy przybliżenia kierunku ICRS do układu orbity; brak korekcji precesji i ograniczeń obserwacyjnych Słońca, osłon i planu misji. Model Ziemi jest sferyczny. Nie jest to planowanie ani sterowanie prawdziwą misją.',
          )}
        </p>
        {orbit?.stale && (
          <p className="amber">
            {t('CelesTrak jest niedostępny — użyto ostatnio pobranych elementów.')}
          </p>
        )}
        <p>
          <a
            href={
              orbit?.sourceUrl ??
              'https://celestrak.org/NORAD/elements/gp.php?CATNR=63182&FORMAT=TLE'
            }
            target="_blank"
            rel="noreferrer"
          >
            CelesTrak · NORAD 63182 ↗
          </a>{' '}
          ·{' '}
          <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
            {t('Mapa Natural Earth ↗')}
          </a>{' '}
          ·{' '}
          <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">
            {t('Efemerydy Astronomy Engine ↗')}
          </a>
        </p>
      </details>
    </>
  );
}
