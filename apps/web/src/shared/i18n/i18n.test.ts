import { afterEach, expect, it } from 'vitest';
import { setLanguage, t } from './index';
afterEach(() => setLanguage('en'));
it('defaults to English and preserves interpolation and spacing', () => {
  expect(t('Pasma')).toBe('Bands');
  expect(t(' Zdjęcia: ')).toBe(' Images: ');
  expect(t('Klatka {0}: {1}', 4, '2026-03-15')).toBe('Frame 4: 2026-03-15');
  expect(t('pl-PL')).toBe('en-GB');
});
it('changes both interface labels and previously stored notices between languages', () => {
  const notice = 'Przygotowywanie 6 pasm. Każde pasmo ma własną sekwencję czasową.';
  const english = t(notice);
  expect(english).toBe('Preparing 6 bands. Each band has its own time sequence.');
  setLanguage('pl');
  expect(t('Bands')).toBe('Pasma');
  expect(t(english)).toBe(notice);
  expect(t('Klatka {0}: {1}', 4, 'UTC')).toBe('Klatka 4: UTC');
});
it('preserves technical identifiers and arbitrary user content', () => {
  expect(t('D4 / 2025W18_1B / X_SC')).toBe('D4 / 2025W18_1B / X_SC');
  expect(t('custom text {42}')).toBe('custom text {42}');
});

it('translates unavailable band labels and frame counts without Polish suffixes', () => {
  setLanguage('en');
  expect(t('Brak w okresie')).toBe('unavailable in this time window');
  expect(t('{0} klatek', 24)).toBe('24 frames');
  setLanguage('pl');
  expect(t('Brak w okresie')).toBe('Brak w okresie');
  expect(t('{0} klatek', 24)).toBe('24 klatek');
});

it('translates stored preparation warnings with detector and observation identifiers', () => {
  expect(t('SPHEREx-D2: Pominięto abc123: Środek obszaru jest poza tą obserwacją.')).toBe(
    'SPHEREx-D2: Skipped abc123: The field center is outside this observation.',
  );
  expect(
    t(
      'SPHEREx-D1: Podgląd wizualny: odjęty model ZODI, wspólny kontrast asinh, bez dopasowania PSF i bez fotometrii.',
    ),
  ).toContain('Visual preview: ZODI');
  expect(
    t(
      'SPHEREx-D3: Filtrowanie długości fali wyłączone. Animacja pokazuje wszystkie dostępne obserwacje; różnice jasności i wyglądu mogą wynikać z różnych długości fali.',
    ),
  ).toContain('Wavelength filtering is off.');
});

it('translates job failure details without changing the product identifier', () => {
  const notice =
    'Pobrano tylko 1 wycinków. Pominięto produkt Cel: Nie udało się pobrać wycinka IRSA (HTTP 503).';
  const translated = t(notice);
  expect(translated).toBe(
    'Too few cutouts were downloaded (1). Skipped product Cel: Could not download the IRSA cutout (HTTP 503).',
  );
  setLanguage('pl');
  expect(t(translated)).toBe(notice);
});
