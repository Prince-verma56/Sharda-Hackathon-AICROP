/** Remembers the farmer's UI language before/after login (read server-side on /farmer/login). */
export function saveLangCookie(lang: 'hi' | 'en') {
  document.cookie = `cropai_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}
