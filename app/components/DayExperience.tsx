"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pause, Play, RotateCcw, X, Plus, Minus, LoaderCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import type { WorldFrame } from "../world/scene";
import { TRACK_END, restPoint, progressToScroll, scrollToProgress } from "../world/track";
import posterFrames from "../world/poster-frames.json";
import { copy as dictionary, type Locale } from "./copy";
import type { Note } from "./notes";

type Panel = "projects" | "philosophy" | "contact" | null;
type World = { destroy():void; setMotion(value:boolean):void; setBlocked(value:boolean):void; reset():void; restart():void; goTo(chapter:number):void };
export default function DayExperience({ locale = "ru", notes = [] }: { locale?: Locale; notes?: Note[] }) {
  const t=dictionary[locale];const {chapters,projects,ui}=t;
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
  const [readNote,setReadNote]=useState<number|null>(null);
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
      world.current=createWorld(mount.current,!media.matches,()=>{if(alive)setFailed(true);},{onFrame,board:t.board});setReady(true);
    }).catch(error=>{console.error("3D initialization failed",error);if(alive)setFailed(true);});
    const preference=()=>{setMotion(!media.matches);flags.current.motion=!media.matches;world.current?.setMotion(!media.matches);};
    media.addEventListener("change",preference);
    return()=>{alive=false;world.current?.destroy();world.current=null;timers.current.forEach(clearTimeout);media.removeEventListener("change",preference);};
  },[t.board]);

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
  },[failed,chapters]);

  useEffect(()=>{flags.current.panel=panel;world.current?.setBlocked(!!panel||flags.current.closing);},[panel]);
  const go=(index:number)=>{
    // The world glides there itself (and lifts its one-chapter-per-gesture limit for the trip); otherwise plain scroll.
    if(world.current&&motion)world.current.goTo(index);
    else window.scrollTo({top:progressToScroll(restPoint(index)),behavior:motion?"smooth":"instant"});
  };
  const toggleMotion=()=>{const next=!motion;setMotion(next);flags.current.motion=next;world.current?.setMotion(next);};
  const copy=async()=>{try{await navigator.clipboard.writeText(t.email);setCopyFailed(false);setCopied(true);timers.current.push(setTimeout(()=>setCopied(false),2000));}catch{setCopyFailed(true);}};
  const openPanel=(next:Panel)=>{panelTrigger.current=document.activeElement as HTMLElement;setReadNote(null);setProject(null);setPanel(next);};
  const current=chapters[active];
  const dark=active===4||active===6;

  return (
    <main ref={root} className={`experience ${dark?"is-dark":""} ${!motion?"is-still":""} ${failed?"is-static":""}`} data-scene={current.id}>
      <a className="skip-link" href="#contact" onClick={e=>{e.preventDefault();openPanel("contact");}}>{ui.skip}</a>
      <div className="world" ref={mount} aria-label={`${ui.scene}: ${current.name}`} />
      <div className="vignette" aria-hidden="true" />
      <div className={`day-veil ${closing?"is-closed":""}`} aria-hidden="true" />
      <header className="site-header">
        <button className="wordmark" onClick={()=>go(0)} aria-label={ui.home}>sph<span>.</span></button>
        <nav className="header-links" aria-label={ui.materials}><button onClick={()=>openPanel("projects")}>{ui.projects}</button><button onClick={()=>openPanel("philosophy")}>{ui.writing}</button><button onClick={()=>openPanel("contact")}>{ui.contact}</button><a className="lang-switch" href={t.other.href} hrefLang={t.other.href==="/"?"ru":"en"} aria-label={t.other.aria}>{t.other.label}</a></nav>
      </header>
      {!ready&&!failed&&<div className="loading" role="status"><LoaderCircle size={21}/><span>{ui.loading}</span></div>}
      {failed&&<><picture className="scene-poster"><source media="(max-width:759px)" srcSet={`/scene-posters/${sleeping?"sleep":current.id}-mobile.webp`}/><img src={`/scene-posters/${sleeping?"sleep":current.id}.webp`} alt=""/></picture><span className="static-hint" role="status">{ui.still}</span></>}
      <div className={`world-label ${active===0?"intro-label":""}`} ref={label}>
        {active===0?<h1>{ui.intro}</h1>:<h2>{current.title}</h2>}
        {active===4&&<span className="quiet-meta">Purple Team</span>}
        {active===2&&<span className="quiet-meta">ITMO AI ENGINEERING</span>}
      </div>
      {current.action&&<button className="world-hotspot" ref={hotspot} onClick={()=>openPanel(current.action as Panel)}><span className="hotspot-node"><Plus size={13}/></span><span>{current.actionLabel}</span></button>}
      {sleeping&&!motion&&<button className="new-day-button" onClick={()=>{window.scrollTo({top:0,behavior:"instant"});world.current?.restart();}}>{ui.newDay}</button>}
      <div className="scroll-track" aria-hidden="true" />
      <footer className="day-footer">
        <div className="scene-clock" key={current.id}><span>{current.time}</span><span className="clock-divider"/><span>{current.name}</span></div>
        <nav className="day-nav" aria-label={ui.chapters}>{chapters.map((chapter,i)=><button key={chapter.id} onClick={()=>go(i)} aria-label={`${chapter.name}, ${chapter.time}`} aria-current={i===active?"step":undefined} className={i===active?"active":""}><i/><span>{chapter.name}</span></button>)}</nav>
        <div className="scene-controls"><span className="scroll-cue">{active===0?ui.scrollDown:active===6?ui.dayCloses:""}</span><button onClick={toggleMotion} aria-label={motion?ui.pause:ui.play} aria-pressed={!motion}>{motion?<Pause size={15}/>:<Play size={15}/>}</button>{!failed&&<button onClick={()=>world.current?.reset()} aria-label={ui.resetView}><RotateCcw size={15}/></button>}</div>
        <div className="reading-progress" aria-hidden="true"><div ref={progressBar}/></div>
      </footer>
      <div className="sr-only" aria-live="polite">{current.name}</div>
      <Sheet open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
        <SheetContent className="folio-sheet" showCloseButton={false} onCloseAutoFocus={e=>{e.preventDefault();if(!flags.current.panel)panelTrigger.current?.focus();}}>
          <div className="folio-top"><span className="folio-number">{panel==="projects"?"01":panel==="philosophy"?"02":"03"}</span><SheetClose className="folio-close" aria-label={ui.close}><X size={21}/></SheetClose></div>
          <SheetTitle className="folio-title">{panel?ui.titles[panel]:""}</SheetTitle>
          <SheetDescription className="sr-only">{panel?ui.descriptions[panel]:""}</SheetDescription>
          {panel==="projects"&&<div className="project-list">{projects.map((item,i)=><article key={item.title} className={`project-row ${project===i?"expanded":""}`}><button className="project-toggle" onClick={()=>setProject(project===i?null:i)} aria-expanded={project===i}><span className="item-index">0{i+1}</span><span><strong>{item.title}</strong><small>{item.type}</small></span>{project===i?<Minus size={19}/>:<Plus size={19}/>}</button>{project===i&&<div className="project-detail"><span className="item-status">{item.status}</span><p>{item.text}</p>{item.href&&<a href={item.href} target="_blank" rel="noreferrer">{ui.projectPage}</a>}</div>}</article>)}</div>}
          {panel==="philosophy"&&<div className="notes">{readNote===null?(notes.length?notes.map((note,i)=><button key={note.slug} className="note-row" onClick={()=>setReadNote(i)}><span className="item-index">{String(i+1).padStart(2,"0")}</span><span><strong>{note.title}</strong><small>{note.meta}</small></span><Plus size={19}/></button>):<p className="item-status">{ui.noNotes}</p>):<article className="note-reading"><button className="back-to-notes" onClick={()=>setReadNote(null)}>{ui.allNotes}</button><p className="item-status">{notes[readNote].status}</p><h3>{notes[readNote].title}</h3><p className="note-lead">{notes[readNote].lead}</p>{notes[readNote].body.map(text=><p key={text}>{text}</p>)}</article>}</div>}
          {panel==="contact"&&<div className="contact-panel"><a href={`mailto:${t.email}`}>{t.email}</a><button onClick={copy} aria-label={copied?ui.copied:ui.copyAddress}>{copied?<Check size={20}/>:<Copy size={20}/>}</button><span role="status">{copied?ui.copiedStatus:copyFailed?ui.copyManually:""}</span></div>}
          <div className="folio-bottom">{ui.footer}</div>
        </SheetContent>
      </Sheet>
      <noscript><div className="no-js"><h1>{ui.intro}</h1><p>{ui.tagline}</p><p>{ui.noJs}</p><a href={`mailto:${t.email}`}>{t.email}</a></div></noscript>
    </main>
  );
}
