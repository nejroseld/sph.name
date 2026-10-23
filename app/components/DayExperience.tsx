"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pause, Play, RotateCcw, X, Plus, Minus, LoaderCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import type { WorldFrame } from "../world/scene";
import { TRACK_END, restPoint, progressToScroll, scrollToProgress } from "../world/track";
import posterFrames from "../world/poster-frames.json";

type Panel = "projects" | "philosophy" | "contact" | null;
type World = { destroy():void; setMotion(value:boolean):void; setBlocked(value:boolean):void; reset():void; restart():void; goTo(chapter:number):void };
const chapters = [
  { id:"morning", name:"Подъём", time:"07:00", title:"Степан.", action:null, actionLabel:"" },
  { id:"city", name:"По пути", time:"08:10", title:"Мысли по пути.", action:"philosophy", actionLabel:"Философия" },
  { id:"learn", name:"Учёба", time:"09:40", title:"Линал,forever.", action:null, actionLabel:"" },
  { id:"build", name:"Проекты", time:"14:00", title:"В работе.", action:"projects", actionLabel:"Проекты" },
  { id:"security", name:"Безопасность", time:"17:30", title:"Безопасность.", action:null, actionLabel:"" },
  { id:"gym", name:"Зал", time:"20:00", title:"Ещё подход.", action:null, actionLabel:"" },
  { id:"night", name:"Перед сном", time:"23:00", title:"Ещё одна мысль.", action:"philosophy", actionLabel:"Открыть заметки" },
] as const;

const projects = [
  { title:"Этот сайт", type:"Интерактивный 3D-день", status:"В процессе", text:"Пробую рассказать о себе через движение, пространство и маленькие сцены из жизни.", href:null },
  { title:"Sync & MCP", type:"Инструменты для Obsidian", status:"Ранняя версия", text:"Синхронизация заметок и доступ к ним через MCP. Проект ещё меняется.", href:"https://community.obsidian.md/plugins/sync-and-mcp" },
];

export default function DayExperience() {
  const mount=useRef<HTMLDivElement>(null);
  const root=useRef<HTMLElement>(null);
  const label=useRef<HTMLDivElement>(null);
  const hotspot=useRef<HTMLButtonElement>(null);
  const progressBar=useRef<HTMLDivElement>(null);
  const world=useRef<World|null>(null);
  const selected=useRef(0);
  const flags=useRef({panel:null as Panel,closing:false,motion:true});
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const [active,setActive]=useState(0);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  const [motion,setMotion]=useState(true);
  const [panel,setPanel]=useState<Panel>(null);
  const [closing,setClosing]=useState(false);
  const [readNote,setReadNote]=useState(false);
  const [project,setProject]=useState<number|null>(null);
  const [copied,setCopied]=useState(false);
  const [copyFailed,setCopyFailed]=useState(false);
  const [sleeping,setSleeping]=useState(false);
  const sleepRef=useRef(false);
  const frameHandler=useRef<(frame:WorldFrame)=>void>(()=>{});
  const loopHandler=useRef<()=>void>(()=>{});
  const panelTrigger=useRef<HTMLElement|null>(null);

  useEffect(()=>{
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    let alive=true;
    setMotion(!media.matches);flags.current.motion=!media.matches;
    const onFrame=(frame:WorldFrame)=>{
      if(!alive)return;
      if(selected.current!==frame.index){selected.current=frame.index;setActive(frame.index);}
      if(sleepRef.current!==frame.sleeping){sleepRef.current=frame.sleeping;setSleeping(frame.sleeping);}
      const mobile=innerWidth<760;
      const textWidth=label.current?.offsetWidth??(mobile?240:325);
      const x=mobile?24:Math.max(42,Math.min(innerWidth-textWidth-28,frame.anchor[0]-textWidth+20));
      const y=mobile?Math.max(118,frame.anchor[1]-190):Math.max(145,Math.min(innerHeight-230,frame.anchor[1]));
      // Outgoing caption drifts up as it fades, the incoming one settles down into place.
      const drift=(1-frame.enter)*18-(1-frame.leave)*18;
      if(label.current){label.current.style.transform=`translate3d(${x}px,${y+drift}px,0)`;label.current.style.opacity=String(frame.opacity);}
      if(hotspot.current){
        const hx=Math.max(24,Math.min(innerWidth-210,frame.detail[0]));
        const hy=mobile?Math.min(innerHeight-156,Math.max(y+130,frame.detail[1]+85)):Math.max(130,Math.min(innerHeight-160,frame.detail[1]));
        hotspot.current.style.transform=`translate3d(${hx}px,${hy+drift}px,0)`;hotspot.current.style.opacity=String(frame.opacity);hotspot.current.style.pointerEvents=frame.opacity<.5?"none":"";
      }
      root.current?.style.setProperty("--night",String(frame.night));
      if(progressBar.current)progressBar.current.style.transform=`scaleX(${frame.progress/TRACK_END})`;
    };
    // Static-poster mode only: the 3D world loops by orbiting the camera on into the morning room itself.
    const onLoop=()=>{
      if(!alive||flags.current.panel||flags.current.closing)return;
      flags.current.closing=true;setClosing(true);world.current?.setBlocked(true);
      const closeTimer=setTimeout(()=>{
        if(!alive)return;
        window.scrollTo({top:0,behavior:"instant"});world.current?.restart();
        const openTimer=setTimeout(()=>{if(!alive)return;flags.current.closing=false;setClosing(false);world.current?.setBlocked(false);},180);
        timers.current.push(openTimer);
      },media.matches?30:850);
      timers.current.push(closeTimer);
    };
    frameHandler.current=onFrame;loopHandler.current=onLoop;
    import("../world/scene").then(({createWorld})=>{
      if(!alive||!mount.current)return;
      world.current=createWorld(mount.current,!media.matches,()=>{if(alive)setFailed(true);},{onFrame});setReady(true);
    }).catch(error=>{console.error("3D initialization failed",error);if(alive)setFailed(true);});
    const preference=()=>{setMotion(!media.matches);flags.current.motion=!media.matches;world.current?.setMotion(!media.matches);};
    media.addEventListener("change",preference);
    return()=>{alive=false;world.current?.destroy();world.current=null;timers.current.forEach(clearTimeout);media.removeEventListener("change",preference);};
  },[]);

  useEffect(()=>{
    if(!failed)return;
    world.current?.destroy();world.current=null;
    let sleepStarted=0,loopSent=false;
    const update=()=>{
      const progress=scrollToProgress(scrollY);
      const index=Math.min(6,Math.floor(progress+.18));
      const mobile=innerWidth<760;
      const still=posterFrames[`${chapters[index].id}${mobile?"-mobile":""}` as keyof typeof posterFrames];
      const sleeping=progress>6.90;
      const scale=Math.max(innerWidth/still.width,innerHeight/still.height);
      const dx=(innerWidth-still.width*scale)/2,dy=(innerHeight-still.height*scale)/2;
      frameHandler.current({index,progress,enter:1,leave:1,anchor:[still.anchor[0]*scale+dx,still.anchor[1]*scale+dy],detail:[still.detail[0]*scale+dx,still.detail[1]*scale+dy],opacity:1,night:index===4?.5:index===6?.75:0,sleeping});
      if(sleeping&&flags.current.motion&&!flags.current.panel&&!flags.current.closing){if(!sleepStarted)sleepStarted=performance.now();if(!loopSent&&performance.now()-sleepStarted>3200){loopSent=true;loopHandler.current();}}
      else{sleepStarted=0;if(!sleeping)loopSent=false;}
    };
    update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);const interval=setInterval(update,120);
    return()=>{clearInterval(interval);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[failed]);

  useEffect(()=>{flags.current.panel=panel;world.current?.setBlocked(!!panel||flags.current.closing);},[panel]);
  const go=(index:number)=>{
    // The world glides there itself (and lifts its one-chapter-per-gesture limit for the trip); otherwise plain scroll.
    if(world.current&&motion)world.current.goTo(index);
    else window.scrollTo({top:progressToScroll(restPoint(index)),behavior:motion?"smooth":"instant"});
  };
  const toggleMotion=()=>{const next=!motion;setMotion(next);flags.current.motion=next;world.current?.setMotion(next);};
  const copy=async()=>{try{await navigator.clipboard.writeText("dev@stfn.uk");setCopyFailed(false);setCopied(true);timers.current.push(setTimeout(()=>setCopied(false),2000));}catch{setCopyFailed(true);}};
  const openPanel=(next:Panel)=>{panelTrigger.current=document.activeElement as HTMLElement;setReadNote(false);setProject(null);setPanel(next);};
  const current=chapters[active];
  const dark=active===4||active===6;

  return (
    <main ref={root} className={`experience ${dark?"is-dark":""} ${!motion?"is-still":""} ${failed?"is-static":""}`} data-scene={current.id}>
      <a className="skip-link" href="#contact" onClick={e=>{e.preventDefault();openPanel("contact");}}>Контакты</a>
      <div className="world" ref={mount} aria-label={`3D-сцена: ${current.name}`} />
      <div className="vignette" aria-hidden="true" />
      <div className={`day-veil ${closing?"is-closed":""}`} aria-hidden="true" />
      <header className="site-header">
        <button className="wordmark" onClick={()=>go(0)} aria-label="В начало дня">sph<span>.</span></button>
        <nav className="header-links" aria-label="Материалы"><button onClick={()=>openPanel("projects")}>Проекты</button><button onClick={()=>openPanel("philosophy")}>Тексты</button><button onClick={()=>openPanel("contact")}>Контакт</button></nav>
      </header>
      {!ready&&!failed&&<div className="loading" role="status"><LoaderCircle size={21}/><span>Свет включается…</span></div>}
      {failed&&<><picture className="scene-poster"><source media="(max-width:759px)" srcSet={`/scene-posters/${sleeping?"sleep":current.id}-mobile.webp`}/><img src={`/scene-posters/${sleeping?"sleep":current.id}.webp`} alt=""/></picture><span className="static-hint" role="status">Статичный режим</span></>}
      <div className={`world-label ${active===0?"intro-label":""}`} ref={label}>
        {active===0?<h1>Степан.</h1>:<h2>{current.title}</h2>}
        {active===4&&<span className="quiet-meta">CTF / AppSec</span>}
        {active===2&&<span className="quiet-meta">ITMO AI ENGINEERING</span>}
      </div>
      {current.action&&<button className="world-hotspot" ref={hotspot} onClick={()=>openPanel(current.action as Panel)}><span className="hotspot-node"><Plus size={13}/></span><span>{current.actionLabel}</span></button>}
      {sleeping&&!motion&&<button className="new-day-button" onClick={()=>{window.scrollTo({top:0,behavior:"instant"});world.current?.restart();}}>Новый день</button>}
      <div className="scroll-track" aria-hidden="true" />
      <footer className="day-footer">
        <div className="scene-clock" key={current.id}><span>{current.time}</span><span className="clock-divider"/><span>{current.name}</span></div>
        <nav className="day-nav" aria-label="Главы дня">{chapters.map((chapter,i)=><button key={chapter.id} onClick={()=>go(i)} aria-label={`${chapter.name}, ${chapter.time}`} aria-current={i===active?"step":undefined} className={i===active?"active":""}><i/><span>{chapter.name}</span></button>)}</nav>
        <div className="scene-controls"><span className="scroll-cue">{active===0?"Листай вниз":active===6?"День замыкается":""}</span><button onClick={toggleMotion} aria-label={motion?"Остановить анимацию":"Включить анимацию"} aria-pressed={!motion}>{motion?<Pause size={15}/>:<Play size={15}/>}</button>{!failed&&<button onClick={()=>world.current?.reset()} aria-label="Вернуть ракурс"><RotateCcw size={15}/></button>}</div>
        <div className="reading-progress" aria-hidden="true"><div ref={progressBar}/></div>
      </footer>
      <div className="sr-only" aria-live="polite">{current.name}</div>
      <Sheet open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
        <SheetContent className="folio-sheet" showCloseButton={false} onCloseAutoFocus={e=>{e.preventDefault();if(!flags.current.panel)panelTrigger.current?.focus();}}>
          <div className="folio-top"><span className="folio-number">{panel==="projects"?"01":panel==="philosophy"?"02":"03"}</span><SheetClose className="folio-close" aria-label="Закрыть"><X size={21}/></SheetClose></div>
          <SheetTitle className="folio-title">{panel==="projects"?"Проекты.":panel==="philosophy"?"Философия.":"На связи."}</SheetTitle>
          <SheetDescription className="sr-only">{panel==="projects"?"Список проектов и подробности":panel==="philosophy"?"Философские заметки":"Контактный адрес"}</SheetDescription>
          {panel==="projects"&&<div className="project-list">{projects.map((item,i)=><article key={item.title} className={`project-row ${project===i?"expanded":""}`}><button className="project-toggle" onClick={()=>setProject(project===i?null:i)} aria-expanded={project===i}><span className="item-index">0{i+1}</span><span><strong>{item.title}</strong><small>{item.type}</small></span>{project===i?<Minus size={19}/>:<Plus size={19}/>}</button>{project===i&&<div className="project-detail"><span className="item-status">{item.status}</span><p>{item.text}</p>{item.href&&<a href={item.href} target="_blank" rel="noreferrer">Страница проекта</a>}</div>}</article>)}</div>}
          {panel==="philosophy"&&<div className="notes">{!readNote?<button className="note-row" onClick={()=>setReadNote(true)}><span className="item-index">01</span><span><strong>Истина как примитив</strong><small>Рабочая заметка · 03.10.2026</small></span><Plus size={19}/></button>:<article className="note-reading"><button className="back-to-notes" onClick={()=>setReadNote(false)}>Все заметки</button><p className="item-status">Рабочий тезис / 03.10.2026</p><h3>Истина как примитив</h3><p className="note-lead">Можно ли определить истину, не используя её в самом определении?</p><p>В этой теории истина принимается как семантический примитив.</p><p>Любое определение имеет форму утверждения P. Но утверждать P — уже значит претендовать на истинность P. Получается, понятие истины присутствует в основании самого определения.</p><p className="note-end">Отправная точка для дальнейшего разбора.</p></article>}</div>}
          {panel==="contact"&&<div className="contact-panel"><a href="mailto:dev@stfn.uk">dev@stfn.uk</a><button onClick={copy} aria-label={copied?"Адрес скопирован":"Скопировать адрес"}>{copied?<Check size={20}/>:<Copy size={20}/>}</button><span role="status">{copied?"Скопировано":copyFailed?"Выдели адрес, чтобы скопировать вручную":""}</span></div>}
          <div className="folio-bottom">Степан / Санкт-Петербург</div>
        </SheetContent>
      </Sheet>
      <noscript><div className="no-js"><h1>Степан.</h1><p>ИТМО. Разработка. Безопасность. Философия.</p><p>Для 3D-истории включи JavaScript.</p><a href="mailto:dev@stfn.uk">dev@stfn.uk</a></div></noscript>
    </main>
  );
}
