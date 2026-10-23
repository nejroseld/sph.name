import * as THREE from "three";

export type Vec3 = [number, number, number];
export interface ModelKit {
  group: (parent: THREE.Object3D, p?: Vec3) => THREE.Group;
  box: (parent: THREE.Object3D, size: Vec3, p: Vec3, material: THREE.Material, radius?: number) => THREE.Mesh;
  sphere: (parent: THREE.Object3D, size: Vec3, p: Vec3, material: THREE.Material) => THREE.Mesh;
  cylinder: (parent: THREE.Object3D, top: number, bottom: number, height: number, p: Vec3, material: THREE.Material, segments?: number) => THREE.Mesh;
  mesh: (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, p?: Vec3) => THREE.Mesh;
  mat: (color: string, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial;
  geometries: Map<string, THREE.BufferGeometry>;
}

/** A stylized portrait, modeled from the supplied reference; all garments are geometry. */
export function createAvatar(k: ModelKit, parent: THREE.Object3D) {
  const { group, box, sphere, cylinder, mesh, mat, geometries } = k;
  const root = group(parent);
  const body = group(root);
  root.scale.setScalar(.86);
  const skin = mat("#e8b9a9", .70);
  const lips = mat("#b97f80", .64);
  const hair = mat("#342b28", .63);
  const hairLight = mat("#493830", .68);
  const ivory = mat("#e1e0d3", .83);
  const black = mat("#242731", .80);
  const polo = mat("#252e40", .81);
  const shell = mat("#323b4d", .65);
  const violet = mat("#555898", .86);
  const violetDark = mat("#41477e", .85);
  const acid = mat("#e9ff3f", .56);
  const white = mat("#f2f2ed", .50);
  const sole = mat("#e4e7e7", .83);

  // Elliptical cross sections give the body, face and clothing an organic silhouette.
  const loft = (parent: THREE.Object3D, levels: [number, number, number, number?][], material: THREE.Material, p: Vec3 = [0,0,0], sculpt?: (x: number, y: number, z: number) => number) => {
    const positions: number[] = [], indices: number[] = [];
    const segments = 40;
    levels.forEach(([y,rx,rz,shift=0], row) => {
      for(let j=0;j<=segments;j++) {
        const a=j/segments*Math.PI*2;
        const x=Math.sin(a)*rx,z=Math.cos(a)*rz+shift,d=sculpt?sculpt(x,y,z):0,r=Math.hypot(x,z)||1;
        positions.push(x+x/r*d,y,z+z/r*d);
        if(row && j<segments) {const b=row*(segments+1)+j;indices.push(b,b-segments-1,b+1,b+1,b-segments-1,b-segments);}
      }
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    // The first and last column share a position; average their normals so the front has no shading seam.
    const n=geo.getAttribute("normal");
    for(let row=0;row<levels.length;row++){const a=row*(segments+1),b=a+segments;const v=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
    geometries.set(`avatar-loft-${geometries.size}`,geo);
    return mesh(geo,material,parent,p);
  };
  const curve = (parent: THREE.Object3D, points: Vec3[], radius: number, material: THREE.Material) => {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const geo=new THREE.TubeGeometry(path,16,radius,6,false);geometries.set(`avatar-curve-${geometries.size}`,geo);return mesh(geo,material,parent);
  };

  const wardrobes = Array.from({length:4},()=>group(body));
  const bodyLevels:[number,number,number][] = [[1.28,0,0],[1.29,.278,.158],[1.39,.295,.168],[1.67,.335,.181],[1.91,.39,.189],[2.04,.396,.18],[2.13,.285,.13],[2.17,.11,.10],[2.18,0,0]];
  wardrobes.forEach((g,i)=>{
    const material=[violet,polo,shell,black][i];
    loft(g,bodyLevels.map(([y,x,z])=>[y,i===0?x*1.06:x,i===0?z*1.07:z]),material);
    if(i===0) {
      sphere(g,[.255,.13,.125],[0,2.11,-.15],violetDark);
      box(g,[.38,.19,.025],[0,1.51,.183],violetDark,.047);
      box(g,[.59,.08,.34],[0,1.33,0],violetDark,.03);
      [-.065,.065].forEach(x=>curve(g,[[x,2.13,.14],[x*1.2,2.02,.189],[x*1.4,1.91,.194]],.008,ivory));
    }
    if(i===1) {
      const collar=cylinder(g,.10,.145,.105,[0,2.18,0],polo);collar.scale.z=.82;
      for(const s of [-1,1]) {const fold=box(g,[.10,.11,.016],[s*.075,2.12,.128],black,.009);fold.rotation.z=s*.42;}
      box(g,[.038,.18,.013],[0,2.035,.192],black,.005);
      [2.08,2.025,1.97].forEach(y=>sphere(g,[.006,.006,.005],[0,y,.203],ivory));
    }
    if(i===2) {
      cylinder(g,.11,.16,.15,[0,2.205,0],shell).scale.z=.80;
      curve(g,[[0,1.34,.172],[0,1.67,.19],[0,1.94,.194],[0,2.22,.106]],.008,black);
      box(g,[.019,.037,.020],[0,2.04,.209],mat("#8f98a6",.3,.4),.006);
      for(const s of [-1,1])curve(g,[[s*.13,1.61,.179],[s*.25,1.50,.136]],.007,black);
      sphere(g,[.20,.095,.085],[0,2.09,-.17],black);
    }
    if(i===3) cylinder(g,.103,.114,.21,[0,2.22,0],black).scale.z=.87;
  });
  cylinder(body,.079,.092,.19,[0,2.265,0],skin);

  const head=group(body,[0,2.51,0]);
  // Cheekbones, the hollow under them and the jaw angles are pushed into the head surface itself, so they read
  // as structure of one smooth form rather than separate pieces.
  const bump=(x:number,y:number,z:number,cx:number,cy:number,cz:number,sx:number,sy:number,sz:number)=>Math.exp(-((x-cx)**2/sx**2+(y-cy)**2/sy**2+(z-cz)**2/sz**2));
  const face=(x:number,y:number,z:number)=>{const ax=Math.abs(x);return .02*bump(ax,y,z,.14,-.02,.125,.05,.03,.06)-.011*bump(ax,y,z,.125,-.09,.13,.04,.03,.06)+.016*bump(ax,y,z,.165,-.185,.06,.05,.04,.08)+.006*bump(ax,y,z,0,-.225,.15,.06,.025,.05);};
  loft(head,[[-.258,0,0,.02],[-.25,.09,.09,.02],[-.218,.142,.13,.01],[-.19,.162,.145,.005],[-.16,.172,.155],[-.13,.178,.163],[-.1,.182,.169],[-.07,.188,.174],[-.04,.196,.179],[-.01,.198,.182],[.02,.197,.185],[.06,.193,.183],[.11,.185,.18],[.16,.172,.168],[.22,.151,.144],[.26,.07,.07],[.27,0,0]],skin,[0,0,0],face);
  for(const s of [-1,1]) {
    sphere(head,[.032,.06,.029],[s*.196,-.002,-.008],skin);
    sphere(head,[.014,.034,.016],[s*.216,-.002,.01],lips);
  }
  const eyes: THREE.Group[]=[];
  for(const s of [-1,1]) {
    const eye=group(head,[s*.076,.050,.173]);eyes.push(eye);
    sphere(eye,[.049,.023,.021],[0,0,0],white);
    sphere(eye,[.018,.020,.008],[s*-.001,0,.018],mat("#63523d",.35));
    sphere(eye,[.008,.011,.004],[0,0,.025],mat("#20252b",.22));
    sphere(eye,[.004,.004,.002],[-.005,.007,.029],white);
    curve(head,[[s*.030,.066,.180],[s*.078,.079,.192],[s*.121,.056,.168]],.006,skin);
    curve(head,[[s*.033,.123,.175],[s*.074,.135,.173],[s*.121,.122,.148]],.011,hairLight);
  }
  sphere(head,[.023,.069,.030],[0,.015,.180],skin);
  sphere(head,[.029,.021,.032],[0,-.027,.214],skin);
  for(const s of [-1,1])sphere(head,[.007,.004,.006],[s*.021,-.040,.222],lips);
  curve(head,[[-.052,-.107,.154],[-.019,-.100,.175],[0,-.104,.178],[.018,-.101,.175],[.052,-.107,.154]],.006,lips);
  sphere(head,[.042,.010,.013],[0,-.120,.166],lips);

  // Short sides, swept fringe, soft strand detail — no helmet silhouette.
  sphere(head,[.19,.122,.178],[0,.212,-.026],hair);
  // Back of the head: occiput mass, lower nape layer and tapered strands so the crown reads as hair, not scalp.
  sphere(head,[.178,.19,.117],[0,.07,-.09],hair);
  sphere(head,[.148,.125,.098],[0,-.05,-.1],hair);
  for(let i=0;i<7;i++) {
    const x=-.135+i*.045;
    curve(head,[[x,.25,-.13],[x*.95,.12,-.212],[x*.85,0,-.2],[x*.6,-.1,-.172],[x*.35,-.15,-.15]],.015+(i%2)*.003,i%3===1?hairLight:hair);
  }
  for(const s of [-1,1]) {
    sphere(head,[.035,.106,.11],[s*.169,.13,-.074],hair);
    curve(head,[[s*.178,.02,-.03],[s*.183,.12,-.066],[s*.141,.25,-.07]],.022,hair);
    // Behind the ear: hair tapers down toward the nape instead of stopping in a hard line.
    curve(head,[[s*.176,.09,-.088],[s*.162,-.02,-.13],[s*.128,-.1,-.152],[s*.08,-.15,-.15]],.02,hair);
  }
  for(let i=0;i<13;i++) {
    const t=i/12;
    curve(head,[[.143-t*.19,.191,.113+t*.013],[.079-t*.18,.300+t*.012,.093],[-.11-t*.031,.277-t*.020,-.005],[-.151,.203,-.101]],.019+(i%3)*.002,i%4===0?hairLight:hair);
  }

  const earbuds=group(head);
  for(const s of [-1,1]) {
    sphere(earbuds,[.021,.024,.025],[s*.215,.001,.023],white);
    const stem=box(earbuds,[.019,.090,.022],[s*.219,-.041,.028],white,.009);stem.rotation.z=s*.06;
    sphere(earbuds,[.006,.008,.008],[s*.233,.006,.028],black);
  }

  const shoulders:THREE.Group[]=[], elbows:THREE.Group[]=[], hands:THREE.Group[]=[], thighs:THREE.Group[]=[], knees:THREE.Group[]=[];
  const limbClothes:{upper:THREE.Group[];lower:THREE.Group[];thigh:THREE.Group[];shin:THREE.Group[];shoe:THREE.Group[]}[]=[];
  for(const s of [-1,1]) {
    const shoulder=group(body,[s*.391,2.02,0]);shoulders.push(shoulder);
    sphere(shoulder,[.113,.154,.115],[0,-.09,0],skin);
    // The skin cap stays well inside the sleeve dome so the cut end of the arm never shows through clothing.
    loft(shoulder,[[-.42,0,0],[-.41,.072,.074],[-.32,.083,.083],[-.13,.104,.105],[-.01,.092,.088],[.035,0,0]],skin);
    const elbow=group(shoulder,[0,-.414,0]);elbows.push(elbow);
    sphere(elbow,[.076,.071,.075],[0,0,0],skin);
    loft(elbow,[[-.38,0,0],[-.37,.044,.055],[-.21,.073,.076],[-.06,.076,.081],[.025,0,0]],skin);
    const hand=group(elbow,[0,-.39,.018]);hands.push(hand);
    sphere(hand,[.054,.087,.028],[0,-.025,0],skin);
    for(let f=0;f<4;f++) {const finger=box(hand,[.018,.081-(Math.abs(f-1.5)*.012),.026],[(f-1.5)*.021,-.091,.008],skin,.009);finger.rotation.x=-.20;}
    const thumb=sphere(hand,[.026,.052,.022],[-s*.043,-.010,.021],skin);thumb.rotation.z=s*.40;
    const thigh=group(body,[s*.172,1.30,0]);thighs.push(thigh);
    loft(thigh,[[-.625,0,0],[-.60,.092,.092],[-.47,.106,.104],[-.20,.133,.130],[.035,.142,.139],[.09,0,0]],skin);
    const knee=group(thigh,[0,-.61,0]);knees.push(knee);
    sphere(knee,[.09,.082,.091],[0,-.015,0],skin);
    loft(knee,[[-.555,0,0],[-.54,.054,.065],[-.30,.093,.094],[-.13,.09,.095],[.02,.082,.085],[.08,0,0]],skin);
    const parts={upper:[] as THREE.Group[],lower:[] as THREE.Group[],thigh:[] as THREE.Group[],shin:[] as THREE.Group[],shoe:[] as THREE.Group[]};
    for(let outfit=0;outfit<4;outfit++) {
      const up=group(shoulder),low=group(elbow),leg=group(thigh),shin=group(knee),shoe=group(knee);
      parts.upper.push(up);parts.lower.push(low);parts.thigh.push(leg);parts.shin.push(shin);parts.shoe.push(shoe);
      const cloth=[violet,polo,shell,black][outfit];
      // Sleeves end in a rounded dome over the shoulder joint instead of a flat cone.
      if(outfit!==3) loft(up,[[outfit===1?-.235:-.425,0,0],[outfit===1?-.230:-.420,.106,.114],[-.15,.125,.127],[.016,.124,.124],[.05,.108,.108],[.075,.072,.072],[.088,0,0]],cloth);
      if(outfit===0||outfit===2) {
        loft(low,[[-.365,0,0],[-.36,.067,.073],[-.31,.09,.091],[-.1,.098,.10],[.03,.102,.11],[.04,0,0]],cloth);
        cylinder(low,.072,.071,.05,[0,-.354,0],outfit===0?violetDark:black).scale.z=1.06;
      }
      const pants=outfit===0?black:outfit===3?black:ivory;
      const wide=outfit===1||outfit===2;
      loft(leg,[[outfit===0?-.40:-.65,0,0],[outfit===0?-.395:-.64,wide?.156:.125,wide?.150:.132],[-.20,wide?.167:.148,.154],[.05,.158,.153],[.07,0,0]],pants);
      if(outfit!==0) {
        loft(shin,[[-.56,0,0],[-.55,wide?.146:.072,wide?.141:.082],[-.40,wide?.153:.102,wide?.148:.112],[-.17,wide?.158:.122,wide?.152:.124],[.045,wide?.155:.12,wide?.151:.126],[.07,0,0]],pants);
        if(wide)curve(shin,[[0,-.51,.145],[0,-.20,.154],[0,.025,.153]],.0025,mat("#c0c0b5",.85));
      }
      if(outfit===0) {
        box(shoe,[.24,.05,.405],[0,-.592,.075],acid,.025);
        box(shoe,[.231,.105,.24],[0,-.542,.15],acid,.049);
      } else {
        box(shoe,[.22,.14,.405],[0,-.538,.077],outfit===3?white:black,.068);
        box(shoe,[.232,.05,.418],[0,-.592,.078],sole,.022);
        for(let lace=0;lace<3;lace++)box(shoe,[.118,.009,.017],[0,-.46,.06+lace*.042],outfit===3?ivory:mat("#535864",.8),.004);
        box(shoe,[.102,.07,.026],[0,-.513,-.122],outfit===3?ivory:black,.012);
      }
    }
    limbClothes.push(parts);
  }
  let outfit=-1;
  const setOutfit=(next:number)=>{
    if(next===outfit)return;outfit=next;
    wardrobes.forEach((g,i)=>g.visible=i===next);
    limbClothes.forEach(parts=>Object.values(parts).forEach(variants=>variants.forEach((g,i)=>g.visible=i===next)));
    earbuds.visible=next===2;
  };
  setOutfit(0);
  return {root,body,head,eyes,shoulders,elbows,hands,thighs,knees,setOutfit};
}
