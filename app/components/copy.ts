export type Locale = "ru" | "en";
type Chapter = { id: string; name: string; time: string; title: string; action: "philosophy" | "projects" | null; actionLabel: string };
type Project = { title: string; type: string; status: string; text: string; href: string | null };

const obsidian = "https://community.obsidian.md/plugins/sync-and-mcp";

export const copy = {
  ru: {
    lang: "ru",
    home: "/",
    other: { href: "/en", label: "EN", aria: "English version" },
    email: "s@sph.by",
    chapters: [
      { id:"morning", name:"Подъём", time:"07:00", title:"Степан.", action:null, actionLabel:"" },
      { id:"city", name:"По пути", time:"08:10", title:"Мысли по пути.", action:"philosophy", actionLabel:"Философия" },
      { id:"learn", name:"Учёба", time:"09:40", title:"Линал,forever.", action:null, actionLabel:"" },
      { id:"build", name:"Проекты", time:"14:00", title:"В работе.", action:"projects", actionLabel:"Проекты" },
      { id:"security", name:"Безопасность", time:"17:30", title:"Безопасность.", action:null, actionLabel:"" },
      { id:"gym", name:"Зал", time:"20:00", title:"Ещё подход.", action:null, actionLabel:"" },
      { id:"night", name:"Перед сном", time:"23:00", title:"Ещё одна мысль.", action:"philosophy", actionLabel:"Открыть заметки" },
    ] as Chapter[],
    projects: [
      { title:"Этот сайт", type:"Интерактивный 3D-день", status:"В процессе", text:"Пробую рассказать о себе через движение, пространство и маленькие сцены из жизни.", href:null },
      { title:"Sync & MCP", type:"Инструменты для Obsidian", status:"Ранняя версия", text:"Синхронизация заметок и доступ к ним через MCP. Проект ещё меняется.", href:obsidian },
    ] as Project[],
    ui: {
      skip: "Контакты", scene: "3D-сцена", home: "В начало дня", materials: "Материалы",
      projects: "Проекты", writing: "Тексты", contact: "Контакт", loading: "Свет включается…", still: "Статичный режим",
      newDay: "Новый день", chapters: "Главы дня", scrollDown: "Листай вниз", dayCloses: "День замыкается",
      pause: "Остановить анимацию", play: "Включить анимацию", resetView: "Вернуть ракурс", close: "Закрыть",
      titles: { projects: "Проекты.", philosophy: "Философия.", contact: "На связи." },
      descriptions: { projects: "Список проектов и подробности", philosophy: "Философские заметки", contact: "Контактный адрес" },
      projectPage: "Страница проекта", copied: "Адрес скопирован", copyAddress: "Скопировать адрес",
      copiedStatus: "Скопировано", copyManually: "Выдели адрес, чтобы скопировать вручную", footer: "Степан / Санкт-Петербург",
      intro: "Степан.", tagline: "ИТМО. Разработка. Безопасность. Философия.", noJs: "Для 3D-истории включи JavaScript.",
    },
    note: {
      title: "Истина как примитив", meta: "Рабочая заметка · 03.10.2026", status: "Рабочий тезис / 03.10.2026", all: "Все заметки",
      lead: "Истина не определима через другие понятия в том языке, на котором её определяют, если этот язык может называть свои предложения и подставлять имя предложения в формулу, а его базовая логика классическая или интуиционистская.",
      body: ["Определение истины, претендующее схватить уже употребляемое понятие, есть утверждение, а притязание на истину заключено в самой силе утверждения: истина есть мерило правильности утверждаемого. Мерило утверждений языка распространяется на все его утверждения. Поэтому определение нашей истины - это определение истины того самого языка, на котором оно произнесено, и оно обязано охватить все его предложения, в том числе предложения о самом определении.", "Но в таком языке для любого кандидата D строится предложение, говорящее о себе, что D к нему неприменимо, и на нём D ошибается (Тарский). Значит, всякое определение либо ошибается на собственном языке, либо верно лишь на фрагменте, из которого изъяты некоторые предложения о нём самом, - и оценивает их уже не оно.", "Для собственной доказуемости результат ещё жёстче: формальная система, доказывающая, что всё доказуемое в ней истинно (Pr(⌜φ⌝) → φ для каждого φ), доказывает всё (Лёб).", "Итак, истина не определима никакими средствами языка, в котором она служит мерилом. Она семантический примитив как позиция: в своём языке - неопределимое мерило утверждения, в метаязыке - определимый предмет, тогда как мерило самого метаязыка там снова неопределимо."],
    },
    board: "ИТМО",
  },
  en: {
    lang: "en",
    home: "/en",
    other: { href: "/", label: "RU", aria: "Русская версия" },
    email: "s@sph.name",
    chapters: [
      { id:"morning", name:"Wake up", time:"07:00", title:"Stepan.", action:null, actionLabel:"" },
      { id:"city", name:"On the way", time:"08:10", title:"Thoughts on the way.", action:"philosophy", actionLabel:"Philosophy" },
      { id:"learn", name:"Study", time:"09:40", title:"Linear algebra, forever.", action:null, actionLabel:"" },
      { id:"build", name:"Projects", time:"14:00", title:"Work in progress.", action:"projects", actionLabel:"Projects" },
      { id:"security", name:"Security", time:"17:30", title:"Security.", action:null, actionLabel:"" },
      { id:"gym", name:"Gym", time:"20:00", title:"One more set.", action:null, actionLabel:"" },
      { id:"night", name:"Before sleep", time:"23:00", title:"One more thought.", action:"philosophy", actionLabel:"Open notes" },
    ] as Chapter[],
    projects: [
      { title:"This site", type:"An interactive 3D day", status:"In progress", text:"An attempt to tell about myself through motion, space and small scenes from everyday life.", href:null },
      { title:"Sync & MCP", type:"Tools for Obsidian", status:"Early version", text:"Note syncing and access to notes over MCP. The project is still changing.", href:obsidian },
    ] as Project[],
    ui: {
      skip: "Contact", scene: "3D scene", home: "Back to the start of the day", materials: "Materials",
      projects: "Projects", writing: "Writing", contact: "Contact", loading: "Turning the lights on…", still: "Static mode",
      newDay: "New day", chapters: "Chapters of the day", scrollDown: "Scroll down", dayCloses: "The day comes full circle",
      pause: "Pause animation", play: "Play animation", resetView: "Reset view", close: "Close",
      titles: { projects: "Projects.", philosophy: "Philosophy.", contact: "Get in touch." },
      descriptions: { projects: "Projects and details", philosophy: "Philosophy notes", contact: "Contact address" },
      projectPage: "Project page", copied: "Address copied", copyAddress: "Copy address",
      copiedStatus: "Copied", copyManually: "Select the address to copy it manually", footer: "Stepan / Saint Petersburg",
      intro: "Stepan.", tagline: "ITMO. Development. Security. Philosophy.", noJs: "Turn on JavaScript for the 3D story.",
    },
    note: {
      title: "Truth as a primitive", meta: "Working note · 3 Oct 2026", status: "Working thesis / 3 Oct 2026", all: "All notes",
      lead: "Truth cannot be defined through other concepts in the very language in which it is being defined, provided that the language can name its own sentences and substitute a sentence's name into a formula, and its underlying logic is classical or intuitionistic.",
      body: ["A definition of truth that claims to capture the concept already in use is itself an assertion, and the claim to truth lies in the very force of assertion: truth is the measure of correctness of what is asserted. The measure of a language's assertions extends to all of its assertions. So a definition of our truth is a definition of truth for the very language in which it is stated, and it must cover all of that language's sentences, including sentences about the definition itself.", "But in such a language, for any candidate D one can construct a sentence that says of itself that D does not apply to it, and D gets that sentence wrong (Tarski). So every definition either errs on its own language or holds only on a fragment from which some sentences about the definition itself have been removed - and those sentences are no longer judged by it.", "For a system's own provability the result is even harsher: a formal system that proves that everything provable in it is true (Pr(⌜φ⌝) → φ for every φ) proves everything (Löb).", "Hence truth cannot be defined by any means of the language in which it serves as the measure. It is a semantic primitive as a position: in its own language, the undefinable measure of assertion; in the metalanguage, a definable object, while the measure of the metalanguage itself is, there, once again undefinable."],
    },
    board: "ITMO",
  },
} as const;

export const metadataFor = (locale: Locale) => locale === "en"
  ? { title: "Stepan — one day", description: "One day in motion. Development, security, ITMO and philosophy — Stepan's personal site." }
  : { title: "Степан — один день", description: "Один день в движении. Разработка, безопасность, ИТМО и философия — личный сайт Степана." };
