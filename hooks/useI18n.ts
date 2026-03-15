"use client";

import { useCallback, useSyncExternalStore } from "react";
import { t, getLocale, setLocale as saveLocale, getAvailableLocales, type Locale, type Translations } from "@/lib/i18n";

// Simple external store for locale
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Locale {
  return getLocale();
}

function getServerSnapshot(): Locale {
  return "en-NZ";
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const changeLocale = useCallback((newLocale: Locale) => {
    saveLocale(newLocale);
    // Notify all subscribers
    listeners.forEach((l) => l());
  }, []);

  const translate = useCallback(
    (key: keyof Translations) => t(key, locale),
    [locale]
  );

  return {
    locale,
    changeLocale,
    t: translate,
    locales: getAvailableLocales(),
  };
}
