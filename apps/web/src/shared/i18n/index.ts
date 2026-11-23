import { useSyncExternalStore } from 'react';
import { english } from './translations.en';
export type Language = 'en' | 'pl';
const key = 'spherex-language';
let language: Language = 'en';
const entryUrl = typeof window === 'undefined' ? undefined : new URL(window.location.href);
const englishEntry = entryUrl?.searchParams.get('lang') === 'en';
try {
  if (englishEntry) localStorage.setItem(key, 'en');
  else language = localStorage.getItem(key) === 'pl' ? 'pl' : 'en';
} catch {
  /* Storage is optional. */
}
if (englishEntry && entryUrl) {
  entryUrl.searchParams.delete('lang');
  window.history.replaceState(window.history.state, '', entryUrl);
}
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = language;
export function setLanguage(value: Language) {
  language = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Keep the in-memory choice. */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => language,
    () => 'en' as Language,
  );
}
const reverse = Object.fromEntries(Object.entries(english).map(([pl, en]) => [en, pl]));
const nestedNotices = new Set(
  ['Pominięto produkt {0}: {1}', 'Pobrano tylko {0} wycinków. {1}'].flatMap((source) => [
    source,
    english[source],
  ]),
);
function templatePatterns(catalog: Record<string, string>) {
  return Object.entries(catalog)
    .filter(([source]) => /\{\d+\}/.test(source))
    .map(([source, target]) => {
      const slots: number[] = [];
      let pattern = '',
        cursor = 0;
      for (const match of source.matchAll(/\{(\d+)\}/g)) {
        pattern +=
          source.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(.*?)';
        slots.push(Number(match[1]));
        cursor = match.index! + match[0].length;
      }
      pattern += source.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return {
        regex: new RegExp('^' + pattern + '$'),
        target,
        slots,
        nested: nestedNotices.has(source),
      };
    });
}
const toEnglish = templatePatterns(english),
  toPolish = templatePatterns(reverse);
/** Numbered slots preserve dynamic values and let persisted notices change language too. */
export function t(source: string, ...values: unknown[]): string {
  const trimmed = source.trim(),
    catalog = language === 'en' ? english : reverse;
  let translated =
    catalog[source] ?? (catalog[trimmed] ? source.replace(trimmed, catalog[trimmed]!) : source);
  if (translated === source && !values.length) {
    for (const { regex, target, slots, nested } of language === 'en' ? toEnglish : toPolish) {
      const match = regex.exec(source);
      if (!match) continue;
      translated = target.replace(/\{(\d+)\}/g, (slot, index: string) => {
        const capture = slots.indexOf(Number(index));
        if (capture < 0) return slot;
        const value = match[capture + 1]!;
        return nested && index === '1' ? t(value) : value;
      });
      break;
    }
  }
  return translated.replace(/\{(\d+)\}/g, (slot, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : slot,
  );
}
