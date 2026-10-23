import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createAvatar } from "./avatar";
import { TRACK_END, HOLD, SETTLE, FADE, SLEEP_IN, SLEEP_OUT, WAKE_IN, WAKE_OUT, STRETCH_OUT, createAutoSnap, restPoint } from "./track";

type Parent = THREE.Object3D;
type V3 = [number, number, number];
type Pose = { p: V3; yaw: number; lean: number; arms: [number, number]; elbows: [number, number]; spread: [number, number]; thighs: [number, number]; knees: [number, number]; head: number };
export type WorldFrame = { index: number; progress: number; enter: number; leave: number; anchor: [number,number]; detail: [number,number]; opacity: number; night: number; sleeping: boolean };
export type WorldOptions = { onFrame?: (state:WorldFrame)=>void; board?: string };
const TAU = Math.PI * 2;
const mix = THREE.MathUtils.lerp;
const smooth = (a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);

export function createWorld(mount:HTMLElement, initialMotion:boolean, onFailure:()=>void, options:WorldOptions={}) {
  const coarse=matchMedia("(pointer: coarse)").matches;
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.25:1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden","true");mount.appendChild(renderer.domElement);
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, roughness = .58, metalness = 0) => {
    const key = `${color}:${roughness}:${metalness}`;
    if (!materialCache.has(key)) { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materialCache.set(key, m); materials.push(m); }
    return materialCache.get(key)!;
  };
  const C = { white: mat("#f3f3ec"), cream: mat("#d5dce1"), lime: mat("#c7d947"), green: mat("#738a67"), dark: mat("#303a35"), black: mat("#1d2925"), gray: mat("#a6afa8"), steel: mat("#b3bdb7", .24, .65), wood: mat("#ae8973"), skin: mat("#e7b18a", .76), hair: mat("#45362d", .8), blue: mat("#9cbcc8"), warm: mat("#d5c5ae") };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: Parent, p: V3 = [0,0,0]) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(...p); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (parent: Parent, size: V3, p: V3, material: THREE.Material, r = .04) => {
    const radius = Math.min(r, ...size.map(n => n / 2));
    const key = `b:${size.join()}:${radius}`;
    if (!geometries.has(key)) geometries.set(key, new RoundedBoxGeometry(...size, 3, radius));
    return mesh(geometries.get(key)!, material, parent, p);
  };
  const sphere = (parent: Parent, scale: V3, p: V3, material: THREE.Material) => {
    if (!geometries.has("sphere")) geometries.set("sphere", new THREE.SphereGeometry(1, 32, 24));
    const m = mesh(geometries.get("sphere")!, material, parent, p); m.scale.set(...scale); return m;
  };
  const cylinder = (parent: Parent, top: number, bottom: number, height: number, p: V3, material: THREE.Material, n = 32) => {
    const key = `c:${top}:${bottom}:${height}:${n}`;
    if (!geometries.has(key)) geometries.set(key,new THREE.CylinderGeometry(top,bottom,height,n));
    return mesh(geometries.get(key)!,material,parent,p);
  };
  const ring = (parent: Parent, radius: number, tube: number, p: V3, material: THREE.Material, arc = TAU) => {
    const key = `t:${radius}:${tube}:${arc}`;
    if (!geometries.has(key)) geometries.set(key,new THREE.TorusGeometry(radius,tube,8,48,arc));
    return mesh(geometries.get(key)!,material,parent,p);
  };
  const group = (parent: Parent, p: V3 = [0,0,0]) => { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; };
  const texture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement("canvas"); canvas.width=width; canvas.height=height;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable"); draw(ctx);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); textures.push(t); return t;
  };
  const panel = (parent: Parent, width: number, height: number, p: V3, map: THREE.Texture) => {
    const m = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide }); materials.push(m);
    const geo = new THREE.PlaneGeometry(width,height); geometries.set(`plane:${geometries.size}`,geo);
    const plane=mesh(geo,m,parent,p); plane.castShadow=false; return plane;
  };
  const textPanel = (parent: Parent, word: string, w: number, h: number, p: V3, color = "#25332b", bg = "transparent", size = 64) => panel(parent,w,h,p,texture(640,Math.round(640*h/w),ctx=>{
    if(bg!=="transparent") {ctx.fillStyle=bg;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);}
    ctx.fillStyle=color;ctx.font=`700 ${size}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(word,320,ctx.canvas.height/2);
  }));
  const plant = (parent: Parent, p: V3, s = 1) => {
    const g=group(parent,p);g.scale.setScalar(s);
    cylinder(g,.23,.17,.38,[0,.19,0],C.cream);cylinder(g,.209,.209,.012,[0,.39,0],C.dark);
    const stem=cylinder(g,.025,.035,.75,[0,.72,0],C.green);stem.rotation.z=.08;
    for(let i=0;i<7;i++){const angle=i*2.39;const leaf=sphere(g,[.13,.3,.075],[Math.cos(angle)*.17,.69+i*.065,Math.sin(angle)*.17],i%2?C.lime:C.green);leaf.rotation.set(.6*Math.cos(angle),angle,-.6*Math.sin(angle));}
    return g;
  };
  const mug = (parent: Parent, p: V3, color = C.white) => {
    const g=group(parent,p);cylinder(g,.115,.10,.21,[0,.105,0],color);cylinder(g,.095,.095,.009,[0,.214,0],C.hair);ring(g,.075,.023,[.115,.12,0],color);return g;
  };
  const book = (parent: Parent, p: V3, color = C.lime, w=.43, d=.62) => {
    const g=group(parent,p);box(g,[w,.065,d],[0,.04,0],C.white,.014);box(g,[w+.025,.018,d+.025],[0,.08,0],color,.007);box(g,[w+.025,.018,d+.025],[0,0,0],color,.007);box(g,[.025,.09,d+.025],[-w/2,.04,0],color,.007);return g;
  };
  const lamp = (parent: Parent, p: V3, s=1) => {
    const g=group(parent,p);g.scale.setScalar(s);cylinder(g,.23,.25,.07,[0,.035,0],C.dark);cylinder(g,.023,.023,.75,[0,.43,0],C.steel);
    const shade=cylinder(g,.13,.28,.25,[0,.84,0],C.lime);shade.rotation.z=.16;cylinder(g,.22,.22,.025,[0,.72,0],C.white);return g;
  };


  const pmrem=new THREE.PMREMGenerator(renderer);const envRoom=new RoomEnvironment();
  const environment=pmrem.fromScene(envRoom,.06);scene.environment=environment.texture;scene.environmentIntensity=.48;envRoom.dispose();pmrem.dispose();
  const sky=new THREE.Color("#dce2eb");scene.background=sky;scene.fog=new THREE.Fog(sky,17,42);
  const ambient=new THREE.HemisphereLight(0xf0f5ff,0x7d7b87,2.05);scene.add(ambient);
  const keyLight=new THREE.DirectionalLight(0xffebd6,3.5);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-7;keyLight.shadow.camera.right=7;keyLight.shadow.camera.top=7;keyLight.shadow.camera.bottom=-7;keyLight.shadow.camera.near=.5;keyLight.shadow.camera.far=28;keyLight.shadow.normalBias=.028;keyLight.shadow.bias=-.0001;keyLight.shadow.radius=4;scene.add(keyLight,keyLight.target);
  const fill=new THREE.DirectionalLight(0xc7d8ff,1.1);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(36,1,.1,65);
  const floorMat=mat("#dce2eb",.91);
  const floor=mesh(new THREE.PlaneGeometry(150,150),floorMat,scene,[0,-.01,0]);geometries.set("floor",floor.geometry);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  const sets=Array.from({length:7},()=>group(scene));
  // Chapters sit on a circle by slot. Chapters 3 and 4 (work, security) share a slot: the same study at two times of
  // day, so that change happens by switching the lights off and on instead of orbiting the camera.
  const slot=[0,1,2,3,3,4,5];
  const slotAngle=(s:number)=>s/7*TAU;
  sets.forEach((set,i)=>{const a=slotAngle(slot[i]);set.position.set(Math.sin(a)*11,0,Math.cos(a)*11);set.rotation.y=a;});
  const avatar=createAvatar({group,box,sphere,cylinder,mesh,mat,geometries},scene);
  const {root:actor,body,head,eyes,shoulders:arms,elbows,hands,thighs,knees}=avatar;
  const heldBook=book(hands[0],[.21,-.02,.09],C.dark,.48,.34);heldBook.rotation.x=Math.PI/2;heldBook.visible=false;
  const dumbbells:THREE.Group[]=[];
  hands.forEach(hand=>{const g=group(hand,[0,-.04,.035]);dumbbells.push(g);const bar=cylinder(g,.030,.030,.64,[0,0,0],C.steel);bar.rotation.z=Math.PI/2;for(const s of [-1,1]){const plate=cylinder(g,.145,.145,.15,[s*.23,0,0],C.dark,32);plate.rotation.z=Math.PI/2;const end=cylinder(g,.047,.047,.022,[s*.32,0,0],C.steel);end.rotation.z=Math.PI/2;}g.visible=false;});
  // 01 — A quiet room. The window is actual geometry, with a strip of morning light.
  const morning=sets[0];
  box(morning,[4.25,2.65,.13],[-.35,1.32,-1.89],C.cream,.045);
  box(morning,[.12,2.65,1.75],[-2.41,1.32,-1.08],C.cream,.04);
  const windowFrame=group(morning,[-.98,1.62,-1.80]);
  box(windowFrame,[1.60,1.48,.08],[0,0,0],C.white,.025);box(windowFrame,[1.39,1.26,.028],[0,0,.05],mat("#c0d2d4"),.008);
  box(windowFrame,[.045,1.28,.04],[0,0,.08],C.white,.004);box(windowFrame,[1.4,.045,.04],[0,-.05,.08],C.white,.004);box(windowFrame,[1.77,.085,.28],[0,-.76,.08],C.white,.02);
  const curtain=box(morning,[.30,1.73,.18],[-1.95,1.53,-1.64],C.white,.05);curtain.rotation.z=.025;
  for(let i=0;i<4;i++)box(morning,[.026,1.58,.025],[-2.05+i*.065,1.54,-1.54],C.cream,.009);
  box(morning,[1.72,.22,2.55],[-.88,.25,-.08],C.wood,.085);box(morning,[1.69,.25,2.48],[-.88,.465,-.08],C.white,.12);
  box(morning,[1.78,.76,.13],[-.88,.57,-1.36],C.wood,.07);
  const blanket=box(morning,[1.70,.17,1.60],[-.88,.66,.30],mat("#858daf"),.065);box(morning,[1.68,.06,.21],[-.88,.755,-.42],mat("#69769b"),.025);
  box(morning,[.66,.18,.46],[-.89,.67,-.94],C.white,.085);
  box(morning,[.55,.51,.54],[.50,.28,-1.14],C.white,.035);box(morning,[.47,.025,.025],[.50,.36,-.855],C.cream,.008);
  const clock=group(morning,[.50,.70,-1.14]);box(clock,[.32,.21,.10],[0,0,0],C.dark,.045);textPanel(clock,"07:00",.255,.13,[0,0,.055],"#d7ff5f","transparent",70);
  plant(morning,[1.96,0,-1.1],1.05);
  box(morning,[1.35,.028,1.75],[1.02,.055,.80],mat("#a9afc7"),.045);
  cylinder(morning,.30,.30,.06,[1.88,.61,.89],C.wood);cylinder(morning,.055,.055,.57,[1.88,.30,.89],C.dark);mug(morning,[1.87,.65,.88]);
  const lightPatchMat=new THREE.MeshBasicMaterial({color:0xf9ffda,transparent:true,opacity:.30,depthWrite:false});materials.push(lightPatchMat);const patch=box(morning,[1.0,.005,1.42],[.40,.06,.10],lightPatchMat,.005);patch.rotation.y=-.5;patch.castShadow=false;

  // 02 — Petersburg, suggested by a few facades, a lamp and the pavement.
  const city=sets[1];
  box(city,[5.68,.06,1.16],[0,.045,1.48],C.gray,.015);
  for(let i=0;i<16;i++)box(city,[.012,.009,1.15],[-2.6+i*.35,.081,1.48],C.cream,.001);
  for(let i=0;i<3;i++)box(city,[5.65,.008,.013],[0,.081,1.10+i*.36],C.cream,.001);
  const building=(x:number,w:number,h:number,color:THREE.Material,rows:number)=>{const g=group(city,[x,0,-1.28]);box(g,[w,h,.92],[0,h/2,0],color,.025);box(g,[w+.14,.10,1.04],[0,h+.04,0],C.white,.015);box(g,[w+.10,.10,1],[0,.16,0],C.white,.009);
    for(let row=0;row<rows;row++){for(let col=0;col<2;col++){const xx=(col-.5)*w*.47;const yy=.55+row*.63;box(g,[w*.29,.42,.035],[xx,yy,.478],C.white,.016);box(g,[w*.22,.34,.025],[xx,yy,.50],C.blue,.004);box(g,[.018,.34,.016],[xx,yy,.52],C.white,.002);box(g,[w*.34,.045,.09],[xx,yy-.23,.5],C.white,.005);}}
    for(let i=0;i<2;i++)box(g,[.05,h-.2,.045],[(i-.5)*(w-.13),h/2,.48],C.white,.006);
    return g;};
  building(-1.76,1.13,2.6,C.warm,3);building(-.20,1.47,3.18,C.cream,4);building(1.30,1.14,2.28,mat("#d6ad9a"),3);
  // Hip roof: the 4-sided cylinder is turned square to the facade inside a group, and the group is stretched to the
  // cornice footprint, so the roof stays a rectangle aligned with the building instead of a skewed rhombus.
  const roof=group(city,[-.2,3.41,-1.28]);roof.scale.set(.74*Math.SQRT2,1,.47*Math.SQRT2);cylinder(roof,.6,1,.28,[0,0,0],C.dark,4).rotation.y=Math.PI/4;
  cylinder(city,.022,.029,.65,[-.2,3.78,-1.28],C.steel);sphere(city,[.05,.05,.05],[-.2,4.13,-1.28],C.lime);
  const streetlamp=group(city,[-2.24,0,.56]);cylinder(streetlamp,.065,.10,.16,[0,.08,0],C.dark);cylinder(streetlamp,.028,.045,1.85,[0,1,0],C.dark);box(streetlamp,[.25,.32,.25],[0,2.01,0],C.warm,.04);cylinder(streetlamp,.19,.17,.10,[0,2.22,0],C.dark,4);
  const tree=group(city,[2.24,0,.50]);cylinder(tree,.06,.085,1.20,[0,.6,0],C.wood);sphere(tree,[.48,.60,.48],[0,1.50,0],C.green);sphere(tree,[.36,.42,.37],[-.19,1.67,.08],C.lime);cylinder(tree,.40,.40,.045,[0,.04,0],C.dark);
  box(city,[.82,.12,.36],[1.08,.56,.40],C.wood,.025);for(const x of [.79,1.37])box(city,[.055,.52,.27],[x,.26,.40],C.dark,.015);

  // 03 — Mathematics on a board and a book in hand.
  const learn=sets[2];
  const board=group(learn,[.65,1.90,-1.29]);box(board,[2.80,1.57,.13],[0,0,0],C.wood,.04);box(board,[2.66,1.43,.04],[0,0,.086],C.dark,.017);
  const mathTexture=texture(1024,512,ctx=>{ctx.fillStyle="#263a31";ctx.fillRect(0,0,1024,512);ctx.fillStyle="#d7ff8a";ctx.font="bold 58px sans-serif";ctx.fillText(options.board??"ИТМО",50,85);ctx.fillStyle="#e7eee0";ctx.font="42px monospace";ctx.fillText("f(x) = Wx + b",55,178);ctx.fillText("∇L(θ) → 0",55,250);ctx.font="28px monospace";ctx.fillStyle="#a8b9a8";ctx.fillText("",55,435);ctx.strokeStyle="#a5c679";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(570,370);ctx.lineTo(570,150);ctx.moveTo(550,350);ctx.lineTo(940,350);ctx.stroke();ctx.strokeStyle="#d7ff8a";ctx.lineWidth=5;ctx.beginPath();for(let i=0;i<180;i++){const x=580+i*1.9,y=335-Math.pow(i/180,2)*175;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();});
  panel(board,2.56,1.29,[0,0,.113],mathTexture);box(board,[2.90,.06,.24],[0,-.77,.08],C.cream,.015);
  for(const x of [-.44,1.74])box(learn,[.075,1.3,.09],[x,.65,-1.33],C.steel,.02);
  const books=group(learn,[1.92,0,.49]);book(books,[0,.06,0],C.wood,.65,.85);const b2=book(books,[0,.17,0],C.dark,.68,.80);b2.rotation.y=.1;book(books,[0,.28,0],C.lime,.62,.82);
  plant(learn,[-2.0,0,-1.08],1.08);
  cylinder(learn,.47,.44,.10,[-1.45,.73,.26],C.wood);for(const x of [-1.71,-1.19])box(learn,[.08,.68,.08],[x,.34,.26],C.dark,.025);
  book(learn,[-1.45,.79,.26],C.white,.46,.58);


  const screenTexture=(security:boolean)=>texture(1024,640,ctx=>{
    ctx.fillStyle=security?"#10241b":"#26322d";ctx.fillRect(0,0,1024,640);ctx.fillStyle="#35453b";ctx.fillRect(0,0,1024,58);for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(30+i*26,29,7,0,TAU);ctx.fillStyle=["#b7d09b","#7f9675","#d7ff5f"][i];ctx.fill();}
    ctx.fillStyle="#c2d0bc";ctx.font="23px monospace";ctx.fillText(security?"security / terminal":"projects / workspace",150,38);
    ctx.font="30px monospace";
    const lines=security?["$ audit ./my-project", "", "  ✓ encryption", "  ✓ access control", "  ✓ input validation", "", "  CTF{keep_learning}", "", "$ _"]:["def make_something():","  idea = explore()", "  while not idea.works:", "    idea = iterate(idea)", "", "  return idea", "", "# work in progress", "> ready to build_"];
    lines.forEach((line,i)=>{ctx.fillStyle=line.includes("✓")||line.includes("CTF")||line.includes("class")?"#d7ff84":line.includes("#")?"#758d76":"#d8e5d1";ctx.fillText(line,security?60:75,115+i*54);});
  });
  const deskSet=(parent:Parent,security=false)=>{
    box(parent,[2.85,.13,1.20],[.12,1.04,-.47],security?C.dark:C.wood,.05);
    for(const x of [-1.06,1.30])for(const z of [-.91,-.05])box(parent,[.085,.99,.085],[x,.50,z],C.dark,.018);
    const monitor=group(parent,[.14,1.77,-.81]);box(monitor,[1.68,1.05,.11],[0,0,0],C.black,.045);const screen=panel(monitor,1.54,.92,[0,0,.061],screenTexture(security));box(parent,[.065,.28,.055],[.14,1.21,-.83],C.steel,.015);box(parent,[.51,.035,.25],[.14,1.12,-.78],C.dark,.025);
    // Keyboard and mouse sit near the front edge, within reach of the seated figure's hands.
    box(parent,[.78,.036,.27],[.02,1.133,0],C.cream,.015);for(let row=0;row<3;row++)for(let col=0;col<11;col++)box(parent,[.046,.014,.038],[-.315+col*.064,1.158,-.08+row*.068],row===2&&col>3&&col<7?C.gray:C.white,.005);
    sphere(parent,[.078,.035,.11],[.63,1.16,-.02],C.gray);
    mug(parent,[-.95,1.12,-.42],C.lime);lamp(parent,[1.25,1.12,-.67],.70);
    box(parent,[.63,.14,.60],[0,.72,.78],C.dark,.10);box(parent,[.62,.68,.11],[0,1.09,1.08],C.dark,.09);cylinder(parent,.05,.06,.66,[0,.38,.78],C.steel);
    for(let i=0;i<5;i++){const leg=box(parent,[.055,.07,.54],[0,.06,.78],C.dark,.025);leg.rotation.y=i*TAU/5;leg.position.x=Math.sin(i*TAU/5)*.23;leg.position.z+=Math.cos(i*TAU/5)*.23;}
    return screen.material as THREE.MeshBasicMaterial;
  };
  // 04 — A personal software project.
  const build=sets[3];const buildScreen=deskSet(build);
  plant(build,[-2.14,0,-.73],1.35);
  box(build,[.57,.97,.66],[1.91,.50,-.64],C.white,.07);box(build,[.43,.85,.015],[1.91,.53,-.299],C.cream,.015);cylinder(build,.037,.037,.008,[1.91,.84,-.283],C.lime).rotation.x=Math.PI/2;
  book(build,[1.91,1.01,-.64],C.lime,.45,.57);
  const shelf=group(build,[-1.03,2.50,-1.65]);box(shelf,[1.68,.075,.40],[0,0,0],C.wood,.02);
  for(let i=0;i<4;i++)box(shelf,[.13,.40+i*.035,.25],[-.56+i*.17,.235+i*.016,0],[C.lime,C.cream,C.dark,C.white][i],.014);


  // 05 — Evening terminal, a server and a small CTF trophy.
  const security=sets[4];const securityScreen=deskSet(security,true);
  const server=group(security,[1.94,0,-.71]);box(server,[.69,1.46,.80],[0,.74,0],C.black,.05);
  for(let i=0;i<5;i++){box(server,[.58,.17,.05],[0,.26+i*.235,.43],C.dark,.013);box(server,[.055,.021,.013],[.18,.27+i*.235,.46],C.lime,.003);for(let j=0;j<4;j++)box(server,[.13,.012,.012],[-.15,.23+i*.235+j*.023,.462],C.gray,.002);}
  const trophy=group(security,[-1.97,.0,-.66]);box(trophy,[.49,.12,.46],[0,.1,0],C.black,.03);cylinder(trophy,.052,.09,.27,[0,.28,0],C.wood);cylinder(trophy,.25,.13,.35,[0,.56,0],C.lime);for(const s of [-1,1]){const handle=ring(trophy,.15,.034,[s*.20,.58,0],C.lime,Math.PI);handle.rotation.z=s<0?Math.PI/2:-Math.PI/2;}
  textPanel(trophy,"01",.20,.11,[0,.12,.239],"#d7ff5f","transparent",100);
  const lock=group(security,[.1,2.92,-1.09]);box(lock,[.56,.43,.17],[0,0,0],C.lime,.07);const shackle=ring(lock,.20,.038,[0,.28,0],C.steel,Math.PI);box(lock,[.076,.12,.022],[0,0,.095],C.dark,.023);
  const securityLight=new THREE.PointLight(0xc5ff68,2.5,5);securityLight.position.set(0,1.9,.2);security.add(securityLight);

  // 06 — A real change of pace.
  const gym=sets[5];box(gym,[4.56,.035,3.57],[0,.05,0],mat("#86918a"),.04);
  for(let i=0;i<4;i++)box(gym,[.010,.004,3.5],[-1.6+i*1.05,.071,0],C.gray,.002);
  box(gym,[1.84,.18,.65],[-.60,.67,-1.14],C.dark,.085);for(const x of [-1.26,.06]){box(gym,[.10,.61,.10],[x,.32,-1.14],C.steel,.02);box(gym,[.12,.075,.81],[x,.10,-1.14],C.dark,.025);}
  const rack=group(gym,[1.82,0,-.57]);for(const x of [-.35,.35])box(rack,[.075,1.38,.11],[x,.70,0],C.steel,.015);
  for(let row=0;row<3;row++){box(rack,[.92,.07,.35],[0,.37+row*.42,.08],C.dark,.02);for(const x of [-.24,.24]){const small=group(rack,[x,.48+row*.42,.08]);const bar=cylinder(small,.023,.023,.31,[0,0,0],C.steel);bar.rotation.z=Math.PI/2;for(const side of [-1,1]){const p=cylinder(small,.105,.105,.07,[side*.13,0,0],C.dark,12);p.rotation.z=Math.PI/2;}}}
  cylinder(gym,.105,.12,.35,[-1.82,.245,.56],C.white);cylinder(gym,.065,.065,.055,[-1.82,.447,.56],C.lime);
  const towel=box(gym,[.52,.08,.71],[-.55,.79,-1.13],C.cream,.04);



  // A second visit to the same room completes the day. The bedside lamp and book stay in the room all day
  // so the night set is geometrically identical to the morning one; only light and the clock face differ.
  lamp(morning,[.64,.54,-1.25],.58);
  const bedsideBook=book(morning,[.46,.56,-.76],C.dark,.38,.46);bedsideBook.rotation.y=.16;
  const night=sets[6];
  for(const child of morning.children)night.add(child.clone(true));
  const nightClock=textPanel(night,"23:00",.255,.13,[.50,.70,-1.083],"#d7ff5f","#303a35",70);
  const nightClockMat=nightClock.material as THREE.MeshBasicMaterial;
  const nightGlow=new THREE.PointLight(0xffbd7e,6,5.0,2);nightGlow.position.set(.51,1.02,-1.08);night.add(nightGlow);
  const thoughtBook=book(city,[1.1,.635,.42],mat("#62688e"),.34,.44);thoughtBook.rotation.y=.13;
  const laptopBook=book(build,[-1.1,1.12,-.48],C.cream,.34,.43);

  // Use the same shadow-mapped render path on desktop and mobile.
  const basePose=(p:V3=[0,0,0],yaw=.20):Pose=>({p,yaw,lean:0,arms:[.02,-.02],elbows:[-.10,-.10],spread:[-.07,.07],thighs:[0,0],knees:[0,0],head:0});
  const poses:Pose[]=[
    {...basePose([.56,.04,.62],.02)},
    {...basePose([-.15,.04,1.10],.68)},
    {...basePose([-.25,.02,.68],.10),arms:[-.57,-.55],elbows:[-1.07,-1.12],head:.12},
    // Seat height and arm angles put the fingertips on the keys with the forearms just clearing the desk edge.
    {...basePose([0,-.36,.57],Math.PI-.15),arms:[-.78,-.78],elbows:[-.95,-.95],thighs:[-1.18,-1.18],knees:[1.18,1.18],head:.10},
    {...basePose([0,-.36,.57],Math.PI-.15),arms:[-.78,-.78],elbows:[-.95,-.95],thighs:[-1.18,-1.18],knees:[1.18,1.18],head:.12},
    {...basePose([-.47,.05,.60],.10),arms:[-.07,-.07]},
    {...basePose([.57,.04,.65],-.25),arms:[-.3,-.2]},
  ];
  const anchors:V3[]=[[-2.50,1.15,1.20],[-2.25,1.64,1.82],[-2.15,2.00,.64],[-2.27,1.72,.71],[-2.30,1.62,.75],[-2.20,1.72,1.07],[-2.45,1.55,1.23]];
  const details:V3[]=[[1.7,.85,.5],[1.20,.82,.70],[1.72,1.30,-.5],[1.27,1.20,-.13],[1.84,1.57,-.38],[1.75,1.2,-.35],[.67,1.05,-.83]];
  const colors=["#dce2eb","#cbd7df","#e0e4e9","#d9dfe8","#273245","#d7dee5","#181e35"].map(c=>new THREE.Color(c));
  const pitch=new THREE.Color("#07090f");
  let alive=true,raf=0,motion=initialMotion,blocked=false,t=0,arrival=initialMotion?0:7,lastIndex=0,lastTime=performance.now();
  let progress=0,target=0,desiredAngle=0,userAngle=0,pointerX=0,pointerY=0,drag=false,dragX=0,width=1,height=1,lastPaint=0;
  // The day closes without moving anything: once he is asleep the night room simply turns into morning —
  // sky and lights brighten, the lamp goes out, the clock face changes — then the frame is cut to the identical
  // chapter-0 set. `loopK` is that dawn, 0..1. One scroll gesture carries night into morning.
  const SLEEP_HOLD=.7,LOOP_DURATION=2.4,WAKE_DELAY=.3;
  let sleepTime=0,loopSent=false,looping=false,loopK=0,wakeFade=false;
  const snap=createAutoSnap(()=>motion&&!blocked&&!drag&&!looping,()=>motion,()=>!blocked&&!looping);
  const sampleScroll=()=>{target=snap.target();};
  const resize=()=>{const bounds=mount.getBoundingClientRect();width=bounds.width;height=bounds.height;if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();sampleScroll();};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();progress=target;
  const onDown=(e:PointerEvent)=>{if(e.pointerType!=="mouse"||e.button!==0)return;drag=true;dragX=e.clientX;mount.setPointerCapture(e.pointerId);};
  const onMove=(e:PointerEvent)=>{pointerX=e.clientX/Math.max(1,width)-.5;pointerY=e.clientY/Math.max(1,height)-.5;if(drag){desiredAngle=THREE.MathUtils.clamp(desiredAngle+(e.clientX-dragX)*.004,-.55,.55);dragX=e.clientX;}};
  const onUp=()=>{drag=false;};const onLeave=()=>{if(!drag){pointerX=0;pointerY=0;}};
  const contextLost=(e:Event)=>{e.preventDefault();console.error("3D WebGL context lost",e);alive=false;cancelAnimationFrame(raf);onFailure();};
  mount.addEventListener("pointerdown",onDown);mount.addEventListener("pointermove",onMove);mount.addEventListener("pointerup",onUp);mount.addEventListener("pointercancel",onUp);mount.addEventListener("pointerleave",onLeave);renderer.domElement.addEventListener("webglcontextlost",contextLost);window.addEventListener("scroll",sampleScroll,{passive:true});window.addEventListener("resize",resize);
  const poseAt=(i:number,time:number,local:number):Pose=>{
    const b=poses[i];const p:Pose={...b,p:[...b.p],arms:[...b.arms],elbows:[...b.elbows],spread:[...b.spread],thighs:[...b.thighs],knees:[...b.knees]};
    // Getting up is scroll-driven: the pose depends only on where the page is, so it never plays on its own and
    // is already complete (and stays put) for the whole walk into the next chapter.
    if(i===0){const wake=smooth(WAKE_IN,WAKE_OUT,local);p.p=[mix(-.88,.56,wake),mix(.76,.04,wake),mix(1.02,.62,wake)];p.lean=mix(-Math.PI/2,0,wake);const stretch=Math.sin(smooth(WAKE_OUT,STRETCH_OUT,local)*Math.PI);p.spread=[-.07-stretch*.8,.07+stretch*.8];p.head=-stretch*.08;}
    if(i===1){const walk=Math.sin(time*4.7);p.thighs=[walk*.42,-walk*.42];p.knees=[Math.max(0,-walk)*.58,Math.max(0,walk)*.58];p.arms=[-walk*.32,walk*.32];p.p[1]+=(1-Math.cos(time*9.4))*.018;p.p[0]+=Math.sin(time*.32)*.08;}
    if(i===2){p.head+=Math.sin(time*.6)*.045;p.elbows[0]+=Math.sin(time*1.1)*.025;}
    if(i===3||i===4){p.elbows[0]+=Math.sin(time*7.9)*.035;p.elbows[1]+=Math.sin(time*9.1+1)*.035;p.head+=Math.sin(time*.8)*.035;}
    if(i===5){p.elbows=[-.23-(.5+.5*Math.sin(time*1.7))*1.80,-.23-(.5+.5*Math.sin(time*1.7+Math.PI))*1.80];p.p[1]+=Math.cos(time*3.4)*.009;}
    // Fully asleep he matches the chapter-0 pose before waking exactly, so the night→morning cut is invisible.
    if(i===6){const sleep=smooth(SLEEP_IN,SLEEP_OUT,local);p.p=[mix(.57,-.88,sleep),mix(.04,.76,sleep),mix(.65,1.02,sleep)];p.yaw=mix(-.25,.02,sleep);p.lean=-Math.PI/2*sleep;p.arms=[mix(-.3,.02,sleep),mix(-.2,-.02,sleep)];p.elbows=[mix(-.7,-.10,sleep),mix(-.6,-.1,sleep)];}
    return p;
  };
  const vec=new THREE.Vector3(),camTarget=new THREE.Vector3(),camPosition=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
  const project=(p:V3,i:number):[number,number]=>{vec.set(...p).applyMatrix4(sets[i].matrixWorld).project(camera);return [(vec.x*.5+.5)*width,(-vec.y*.5+.5)*height];};
  const render=(now:number)=>{
    if(!alive)return;raf=requestAnimationFrame(render);const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;if(document.hidden)return;
    snap.update(now);sampleScroll();
    if(motion&&!blocked)t+=dt;
    const damping=1-Math.exp(-dt*7);
    if(looping){if(motion&&!blocked)loopK=Math.min(1,loopK+dt/LOOP_DURATION);progress=TRACK_END;}
    else progress=motion?mix(progress,target,damping):target;
    const dawn=looping?smooth(0,1,loopK):0;
    const i=Math.min(6,Math.floor(progress)),next=Math.min(6,i+1),local=progress-i;
    const f=i===6?0:(motion?smooth(HOLD,SETTLE,local):local>.80?1:0);
    // During the dawn the UI switches to the morning chapter halfway, while the 3D view stays on the night set.
    const index=looping?(dawn>.5?0:6):f>.50?next:i;
    if(lastIndex!==index){arrival=0;lastIndex=index;sleepTime=0;wakeFade=false;}if(motion&&!blocked&&!looping)arrival+=dt;
    // While at the night room the city stands in as its right-hand neighbour, exactly where it sits next to the
    // morning room, so the cut between the two identical rooms changes nothing at the edges of the frame.
    const cityAngle=i===6?slotAngle(slot[6]+1):slotAngle(slot[1]);sets[1].position.set(Math.sin(cityAngle)*11,0,Math.cos(cityAngle)*11);sets[1].rotation.y=cityAngle;
    // The set shown at the next slot along the circle (the right-hand edge of the frame).
    const peek=i===6?1:i===3||i===4?5:next;
    // Work → security happens in place: the lights go fully out around the middle of the transition and the
    // study is swapped for its evening version while nothing can be seen.
    const inPlace=next!==i&&slot[next]===slot[i];
    const blackout=inPlace?smooth(0,.45,f)*(1-smooth(.55,1,f)):0;
    if(!motion&&!drag&&Math.abs(progress-target)<.001&&Math.abs(userAngle-desiredAngle)<.001&&now-lastPaint<140)return;lastPaint=now;
    const a=poseAt(i,t,local),b=poseAt(next,t,0);
    const angle=slotAngle(mix(slot[i],slot[next],f));
    const center=new THREE.Vector3(Math.sin(angle)*11,0,Math.cos(angle)*11);
    // The previous set is dropped as soon as the camera has fully arrived, not only when progress crosses the chapter.
    sets.forEach((set,j)=>set.visible=j===peek||(inPlace?j===(f<.5?i:next):j===i&&f<1));
    const p=a.p.map((v,j)=>mix(v,b.p[j],f)) as V3;
    vec.set(...p).applyAxisAngle(axis,angle);actor.position.copy(center).add(vec);
    actor.rotation.set(mix(a.lean,b.lean,f),angle+mix(a.yaw,b.yaw,f),0,"YXZ");
    const travel=inPlace?0:Math.sin(f*Math.PI);actor.position.y+=travel*.022*(1-Math.cos(t*10));
    for(let k=0;k<2;k++){arms[k].rotation.set(mix(a.arms[k],b.arms[k],f)-Math.sin(t*5.4+k*Math.PI)*travel*.24,0,mix(a.spread[k],b.spread[k],f));elbows[k].rotation.x=mix(a.elbows[k],b.elbows[k],f);thighs[k].rotation.x=mix(a.thighs[k],b.thighs[k],f)+Math.sin(t*5.4+k*Math.PI)*travel*.42;knees[k].rotation.x=mix(a.knees[k],b.knees[k],f)+Math.max(0,-Math.sin(t*5.4+k*Math.PI))*travel*.4;}
    head.rotation.set(mix(a.head,b.head,f),motion?Math.sin(t*.47)*.035:0,motion?Math.sin(t*.7)*.009:0);
    body.scale.y=1+(motion?Math.sin(t*1.75)*.0024:0);
    const sleeping=index===6&&local>SLEEP_OUT;
    const shut=progress<WAKE_IN+.06||sleeping;
    const blink=shut?.10:(motion&&Math.sin(t*1.29)>.995?.12:1);eyes.forEach(e=>e.scale.y=blink);
    avatar.setOutfit(index===0||index===6?0:index===1?2:index===5?3:1);heldBook.visible=index===2;dumbbells.forEach(d=>d.visible=index===5);
    const sleepingDim=(i===6?smooth(SLEEP_IN,SLEEP_OUT,local):0)*(1-dawn);
    sky.copy(colors[i]).lerp(colors[next],f);if(looping)sky.copy(colors[6]).lerp(colors[0],dawn);sky.lerp(pitch,blackout);floorMat.color.copy(sky);(scene.fog as THREE.Fog).color.copy(sky);
    const darkness=((i===4?1-f:next===4?f:0)*.50+(i===6?1-f:next===6?f:0)*.75)*(1-dawn);
    const lit=1-blackout;
    ambient.intensity=mix(2.05,.85,darkness)*lit;keyLight.intensity=mix(3.5,1.4,darkness)*(1-sleepingDim*.25)*lit;scene.environmentIntensity=.48*lit;
    securityLight.intensity=2.5*lit;buildScreen.opacity=securityScreen.opacity=lit;
    const keyOffset=new THREE.Vector3(-3.5,8.5,5).applyAxisAngle(axis,angle);keyLight.position.copy(center).add(keyOffset);keyLight.target.position.copy(center);fill.position.copy(center).add(new THREE.Vector3(6,5,-5).applyAxisAngle(axis,angle));fill.intensity=mix(1.1,.6,darkness)*lit;
    lock.rotation.y=Math.sin(t*.6)*.13;lock.position.y=2.92+Math.sin(t)*.026;
    // The bedside lamp dims as he falls asleep and goes out with the dawn; the 23:00 face fades to reveal 07:00 beneath.
    nightGlow.intensity=6*(1-(i===6?smooth(SLEEP_IN,SLEEP_OUT,local):0)*.9)*(1-dawn);
    nightClockMat.opacity=1-dawn;nightClock.visible=dawn<.995;
    blanket.scale.y=1+Math.sin(t*1.75)*.005;
    userAngle=mix(userAngle,desiredAngle,damping);
    const mobile=width<760;
    const zoom=[1.02,1.09,.96,.96,.96,.90,1.02];const distance=mix(zoom[i],zoom[next],f);
    const mobileZoom=mobile?Math.max(1.24,.84/camera.aspect):1;
    (scene.fog as THREE.Fog).near=17*mobileZoom;(scene.fog as THREE.Fog).far=42*mobileZoom;
    const base=new THREE.Vector3(6.4,4.1,10.8).multiplyScalar(distance*mobileZoom);base.applyAxisAngle(axis,angle+userAngle+(motion?pointerX*.10:0));base.y+=(motion?pointerY*.25:0);
    camPosition.copy(center).add(base);camera.position.copy(camPosition);
    camTarget.copy(center).add(new THREE.Vector3(mobile?0:.06,mobile?1.00:1.24,0));camera.lookAt(camTarget);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    // Caption presence is symmetric around a chapter change: it leaves while the camera is still parked
    // (local HOLD-FADE → HOLD), and returns only after the camera has settled and the previous set is gone
    // (SETTLE → SETTLE+FADE, measured in the new chapter's own local progress, which is negative while arriving).
    const l=progress-index;
    let enter=smooth(SETTLE-1,SETTLE-1+FADE,l),leave=1-smooth(HOLD-FADE,HOLD,l);
    if(index===0)enter=wakeFade?smooth(WAKE_DELAY,WAKE_DELAY+.6,arrival):1;
    if(looping)leave=0;
    if(!motion){enter=1;leave=1;}
    const shown=looping?6:index;
    options.onFrame?.({index,progress:looping?TRACK_END*(1-dawn):progress,enter,leave,anchor:project(anchors[shown],shown),detail:project(details[shown],shown),opacity:Math.min(enter,leave),night:darkness,sleeping});
    try{renderer.render(scene,camera);}catch(error){console.error("3D render failed",error);alive=false;cancelAnimationFrame(raf);onFailure();return;}
    if(sleeping&&motion&&!blocked&&!loopSent){sleepTime+=dt;if(sleepTime>SLEEP_HOLD){loopSent=true;looping=true;loopK=0;snap.cancel();}}else if(!sleeping){sleepTime=0;loopSent=false;}
    // Morning light has filled the night room, which is now pixel-identical to chapter 0's room: cut and hand back to the scroll.
    if(looping&&loopK>=1){looping=false;target=0;progress=0;arrival=0;wakeFade=true;snap.jump(0);scrollTo({top:0,behavior:"instant"});}
  };
  raf=requestAnimationFrame(render);
  return {
    setMotion(value:boolean){motion=value;},
    setBlocked(value:boolean){blocked=value;},
    restart(){snap.jump(0);target=0;progress=0;arrival=0;sleepTime=0;loopSent=false;looping=false;loopK=0;wakeFade=false;lastIndex=0;t=0;},
    goTo(chapter:number){snap.goTo(restPoint(chapter));},
    reset(){desiredAngle=0;pointerX=0;pointerY=0;},
    destroy(){alive=false;cancelAnimationFrame(raf);snap.destroy();observer.disconnect();window.removeEventListener("scroll",sampleScroll);window.removeEventListener("resize",resize);mount.removeEventListener("pointerdown",onDown);mount.removeEventListener("pointermove",onMove);mount.removeEventListener("pointerup",onUp);mount.removeEventListener("pointercancel",onUp);mount.removeEventListener("pointerleave",onLeave);renderer.domElement.removeEventListener("webglcontextlost",contextLost);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}
