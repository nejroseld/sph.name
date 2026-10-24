import type { Locale } from "./copy";

const paths: Record<Locale, string> = { ru: "/", en: "/en" };

// Runs in <head> before the first paint and sends the visitor to the version their browser prefers:
// the first of ru/en in its language list, English when neither is there. Crawlers are left alone.
// The language used to be picked by hand and remembered under "lang"; that pick is dropped so it can't override the browser.
// /ru and /en ask for a language explicitly, so only / is redirected.
export const languageScript = (locale: Locale) => `(function(){try{
if(/bot|crawl|spider|slurp|preview/i.test(navigator.userAgent))return;
if(/^\\/(ru|en)(\\/|$)/.test(location.pathname))return;
try{localStorage.removeItem("lang");}catch(e){}
var paths=${JSON.stringify(paths)},want="en";
var list=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
for(var i=0;i<list.length;i++){var l=String(list[i]).toLowerCase().split("-")[0];if(paths[l]){want=l;break;}}
if(want!==${JSON.stringify(locale)})location.replace(paths[want]+location.search+location.hash);
}catch(e){}})();`;
