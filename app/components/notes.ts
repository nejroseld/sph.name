/// <reference types="vite/client" />
import type { Locale } from "./copy";

// Notes are Markdown files in notes/<locale>/*.md, bundled at build time:
//
//   ---
//   title: Note title
//   date: 2026-10-03
//   kind: Working note        (optional, shown in the list)
//   status: Working thesis    (optional, shown above the title)
//   ---
//
//   First paragraph is the lead.
//
//   Every further paragraph (separated by a blank line) is body text.
export type Note = { slug: string; title: string; date: string; meta: string; status: string; lead: string; body: string[] };

const files = import.meta.glob("/notes/*/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const defaults = {
  ru: { kind: "Рабочая заметка", status: "Рабочий тезис" },
  en: { kind: "Working note", status: "Working thesis" },
};
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const formatDate = (iso: string, locale: Locale) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return locale === "en" ? `${d} ${months[m - 1]} ${y}` : `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
};

const parse = (path: string, raw: string, locale: Locale): Note => {
  const match = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Note ${path} has no front matter`);
  const fields = Object.fromEntries(match[1].split("\n").map(line => line.match(/^(\w+):\s*(.*)$/)).filter(m => m !== null).map(m => [m[1], m[2].trim()]));
  if (!fields.title || !fields.date) throw new Error(`Note ${path} needs a title and a date`);
  const [lead = "", ...body] = match[2].split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const date = formatDate(fields.date, locale);
  return {
    slug: path.split("/").pop()!.replace(/\.md$/, ""),
    title: fields.title, date: fields.date,
    meta: `${fields.kind || defaults[locale].kind} · ${date}`,
    status: `${fields.status || defaults[locale].status} / ${date}`,
    lead, body,
  };
};

export const notesFor = (locale: Locale): Note[] => Object.entries(files)
  .filter(([path]) => path.split("/").at(-2) === locale)
  .map(([path, raw]) => parse(path, raw, locale))
  .sort((a, b) => b.date.localeCompare(a.date));
