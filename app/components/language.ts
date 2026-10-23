import type { Locale } from "./copy";

const paths: Record<Locale, string> = { ru: "/", en: "/en" };
export const LANGUAGE_KEY = "lang";

// Runs in <head> before the first paint: a visitor who never picked a language is sent to the version
// their browser prefers (the first of ru/en in its language list, English when neither is there).
// An explicit pick on the language switch is remembered and always wins. Crawlers are left alone.
export const languageScript = (locale: Locale) => `(function(){try{
if(/bot|crawl|spider|slurp|preview/i.test(navigator.userAgent))return;
var paths=${JSON.stringify(paths)},saved=null;
try{saved=localStorage.getItem(${JSON.stringify(LANGUAGE_KEY)});}catch(e){}
var want=saved;
if(!paths[want]){want="en";var list=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
for(var i=0;i<list.length;i++){var l=String(list[i]).toLowerCase().split("-")[0];if(paths[l]){want=l;break;}}}
if(want!==${JSON.stringify(locale)})location.replace(paths[want]+location.search+location.hash);
}catch(e){}})();`;
