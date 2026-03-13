import { enNZ } from "./en-NZ";
import { miNZ } from "./mi-NZ";
import type { Locale, Translations } from "./types";

export type { Locale, Translations };

const translations: Record<Locale, Translations> = {
  "en-NZ": enNZ,
  "mi-NZ": miNZ,
};

const LOCALE_KEY = "ksq_locale";
const DEFAULT_LOCALE: Locale = "en-NZ";

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return (localStorage.getItem(LOCALE_KEY) as Locale) || DEFAULT_LOCALE;
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function t(key: keyof Translations, locale?: Locale): string {
  const l = locale || getLocale();
  return translations[l]?.[key] || translations[DEFAULT_LOCALE][key] || key;
}

export function getAvailableLocales(): { code: Locale; label: string }[] {
  return [
    { code: "en-NZ", label: "English (NZ)" },
    { code: "mi-NZ", label: "Te Reo Maori" },
  ];
}
