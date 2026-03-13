"use client";

import { useState, useCallback, useEffect } from "react";
import { t, getLocale, setLocale as saveLocale, getAvailableLocales, type Locale, type Translations } from "@/lib/i18n";

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("en-NZ");

  // Hydrate from localStorage on mount
  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    saveLocale(newLocale);
    setLocaleState(newLocale);
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
