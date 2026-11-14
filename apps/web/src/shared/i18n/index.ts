import { useSyncExternalStore } from 'react';
import { english } from './translations.en';
export type Language = 'en' | 'pl';
const key = 'spherex-language';
let language: Language = 'en';
try {
  language = localStorage.getItem(key) === 'pl' ? 'pl' : 'en';
} catch {
  /* Storage is optional. */
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
      return { regex: new RegExp('^' + pattern + '$'), target, slots };
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
    for (const { regex, target, slots } of language === 'en' ? toEnglish : toPolish) {
      const match = regex.exec(source);
      if (!match) continue;
      translated = target.replace(/\{(\d+)\}/g, (slot, index: string) => {
        const capture = slots.indexOf(Number(index));
        return capture < 0 ? slot : match[capture + 1]!;
      });
      break;
    }
  }
  return translated.replace(/\{(\d+)\}/g, (slot, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : slot,
  );
}
