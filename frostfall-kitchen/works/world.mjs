// A dimetric factory floor. The simulation supplies all worker and stock positions.
const LABELS = { forest: 'Timber intake', farm: 'Grow room', kitchen: 'Kitchen', mill: 'Sawmill', depot: 'Dispatch', hall: 'Dining hall' };
const COLORS = { forest: '#bc8553', farm: '#799360', kitchen: '#cf7658', mill: '#728b93', depot: '#a083aa', hall: '#b2a16d' };
const CARGO = { logs: '#a97450', crops: '#95aa57', meals: '#e0a849', planks: '#d3a071' };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const project = (x, z, y = 0) => [24 * (x - z), 12 * (x + z) - 27 * y];
const coats = ['#d66e47', '#537f75', '#d26956', '#628ca0', '#c7a045', '#668b76', '#946e9e', '#d19250'];
const tones = ['#efbe9c', '#ba8267', '#e5ae84', '#9f6e59'];
const metal = ['#839da4', '#557680', '#3e5b68'];
const dark = ['#5b7480', '#3e5e69', '#324c56'];
const orange = ['#efb17a', '#cd8954', '#a7684e'];
const timber = ['#d4a276', '#ad7856', '#895e4d'];

function polygon(c, points, color, stroke) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = .65; c.stroke(); }
}
function quadrilateral(c, x, z, w, d, y, color, stroke) {
  polygon(c, [project(x, z, y), project(x+w, z, y), project(x+w, z+d, y), project(x, z+d, y)], color, stroke);
}
function block(c, x, z, w, d, h, color, y = 0) {
  const [a,b,e,f] = [project(x,z,y+h), project(x+w,z,y+h), project(x+w,z+d,y+h), project(x,z+d,y+h)];
  const bb = project(x+w,z,y), ee = project(x+w,z+d,y), ff = project(x,z+d,y);
  polygon(c,[b,bb,ee,e],color[2]);
  polygon(c,[f,e,ee,ff],color[1]);
  polygon(c,[a,b,e,f],color[0],'#493a3227');
}
function oval(c,x,y,rx,ry,color) {
  c.beginPath();
  c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  c.fillStyle=color;
  c.fill();
}
function line(c, points, color, width) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (let i=1;i<points.length;i++) c.lineTo(...points[i]);
  c.strokeStyle=color;
  c.lineCap='round';
  c.lineWidth=width;
  c.stroke();
}
function path(c,x,z,length) {
  for(let i=0;i<length;i++) quadrilateral(c,x+i*.53,z,.28,.29,.025,'#dfc8a2');
}
function stripe(c,x,z,w,d) {
  quadrilateral(c,x,z,w,d,.015,'#6e7377');
  for(let i=.1;i<w-.12;i+=.42) quadrilateral(c,x+i,z+.07,.14,d-.14,.02,'#d6ba87');
}
function wall(c,x,z,length,alongX) {
  const w=alongX?length:.18;
  const d=alongX?.18:length;
  block(c,x,z,w,d,2.85,orange);
  block(c,x,z,w,d,.27,['#e8bd90','#a5735a','#8f6558']);
  block(c,x-.045,z-.045,w+.09,d+.09,.12,['#ffe0a5','#e5a87d','#c98a65'],2.85);
  for(let a=.68;a<length-.25;a+=1.13) {
    block(c,x+(alongX?a:0),z+(alongX?0:a),alongX?.045:.24,alongX?.24:.045,2.48,['#e3a671','#c17f54','#a16852'],.24);
  }
}
function windowBand(c,x,z,alongX) {
  const w=alongX?1.35:.25, d=alongX?.25:1.35;
  block(c,x,z,w,d,.84,timber,1.27);
  block(c,x+(alongX?.13:.02),z+(alongX?.015:.13),alongX?1.09:.27,alongX?.27:1.09,.59,['#b7d4cf','#75aaa7','#6c969b'],1.39);
  block(c,x+(alongX?.64:.015),z+(alongX?.015:.64),alongX?.07:.28,alongX?.28:.07,.61,timber,1.39);
}
function crate(c,x,z,resource,y=0,size=.62) {
  const color = CARGO[resource] ?? '#c59161';
  block(c,x,z,size,size,size*.72,[color,'#ad8053','#8e674f'],y);
  quadrilateral(c,x+.1,z+.12,size-.2,size-.24,y+size*.72+.006,'#ecce98','#765a4b5c');
  quadrilateral(c,x+.18,z+.19,size-.36,size-.38,y+size*.72+.02,color);
}
function pallet(c,x,z,resource,count) {
  block(c,x-.08,z-.08,1.55,1.34,.12,timber);
  for(let i=0;i<Math.min(6,Math.ceil(count/2));i++){
    crate(c,x+i%2*.71,z+Math.floor(i%4/2)*.61,resource,.13+Math.floor(i/4)*.45);
  }
}
function conveyor(c,x,z,length,phase,active) {
  block(c,x,z,length,.94,.55,metal);
  block(c,x+.06,z+.09,length-.12,.76,.045,['#526679','#657a83','#364c5d'],.55);
  for(let t=.18;t<length-.09;t+=.28) block(c,x+t,z+.13,.06,.68,.046,['#abc1bf','#729196','#56787e'],.597);
  block(c,x,z,length,.085,.14,dark,.59);
  block(c,x,z+.86,length,.085,.14,dark,.59);
  for(let i=0;i<2;i++){
    const position = active ? (phase*.3+i*length*.54)%(length-.58) : .18+i*(length-.84)*.75;
    crate(c,x+position,z+.2,i?'planks':'meals',.65,.46);
  }
}
function machine(c,x,z,type,active=false,phase=0) {
  const kitchen=type==='oven';
  block(c,x-.12,z-.12,1.78,1.48,.04,['#6c6664','#665856','#685553']);
  block(c,x,z,1.55,1.15,.68,metal);
  if(kitchen){
    block(c,x+.04,z+.05,1.34,.81,.61,['#cbd0c4','#a2a99d','#6c7d83'],.68);
    block(c,x+.14,z+.86,1.13,.13,.42,['#886b60','#564947','#5f5451'],.77);
    block(c,x+.31,z+.996,.72,.034,.23,active?['#ffd483','#c97d49','#b45a39']:['#aea69a','#61615f','#5d615f'],.87);
    block(c,x+.98,z+.12,.25,.24,.49,dark,1.27);
  }else{
    block(c,x+.14,z+.17,1.27,.87,.12,dark,.68);
    block(c,x+.13,z+.23,.23,.64,.65,metal,.79);
    block(c,x+1.2,z+.23,.23,.64,.65,metal,.79);
    block(c,x+.28,z+.23,.99,.33,.17,['#dfad72','#bb7c4e','#8e5b4b'],1.33);
    const [sx,sy]=project(x+.84,z+.48,1.06);
    oval(c,sx,sy,9,12,'#bdced0');
    for(let i=0;i<4;i++){const a=i*Math.PI/2+(active?phase*7:0);oval(c,sx+Math.cos(a)*6,sy+Math.sin(a)*8,1.5,1.5,'#526779');}
    oval(c,sx,sy,2.5,3,'#526779');
  }
  block(c,x+1.33,z+.83,.15,.19,.17,[active?'#bbd884':'#f3ad74','#825f4e','#664e4a'],.69);
}
function growBed(c,x,z,ready,index){
  block(c,x,z,1.5,.94,.36,['#695c56','#ac825f','#866c56']);
  for(let i=0;i<5;i++){
    const [sx,sy]=project(x+.22+i*.26,z+.44,.44);
    const height=ready>i+index?10:5;
    oval(c,sx-2,sy-4,3,height*.57,'#6f884e');
    oval(c,sx+3,sy-5,3,height*.62,'#9caa61');
    if(height>5) oval(c,sx,sy-9,2.9,3.1,'#cfbf6e');
  }
}
function worker(c,x,z,w,i,phase,cart,moving) {
  const [sx,sy] = project(x,z);
  const swing=moving?Math.sin(phase*11+i)*3:0;
  const coat=coats[i%coats.length], skin=tones[i%tones.length];
  oval(c,sx+4,sy+1,12,5,'#493e3a48');
  if(w.task?.stage==='deliver'&&w.task.resource){
    if(cart){
      block(c,x+.26,z+.08,.83,.77,.22,timber);
      oval(c,sx+14,sy+9,3,4,'#54515a');
      crate(c,x+.35,z+.17,w.task.resource,.23,.62);
    } else crate(c,x+.24,z+.22,w.task.resource,.54,.46);
  }
  line(c,[[sx-3,sy-10],[sx-4+swing,sy-1]],'#464652',5);
  line(c,[[sx+3,sy-10],[sx+4-swing,sy-1]],'#52535a',5);
  oval(c,sx,sy-15,7.7,9.4,coat);
  line(c,[[sx+5,sy-17],[sx+8,sy-12+swing]],coat,4);
  oval(c,sx,sy-24,6,6.2,skin);
  const hat=w.role==='kitchen'?'#efe5cd':w.role==='haul'?'#e8be53':coat;
  oval(c,sx-1,sy-28,6.8,5.3,hat);
  oval(c,sx+2,sy-26,7.4,2,hat);
  oval(c,sx+3,sy-24,1,1,'#554347');
}

function shelf(c,x,z,resource,count) {
  block(c,x-.16,z-.12,1.72,.69,.12,dark);
  for(const dx of [0,1.38]) for(const dz of [0,.54]) block(c,x+dx,z+dz,.11,.11,1.54,orange);
  for(const h of [.22,.83,1.45]) block(c,x-.05,z-.035,1.57,.63,.1,metal,h);
  for(let i=0;i<Math.min(6,Math.ceil(count/2));i++) crate(c,x+.12+(i%3)*.45,z+.045,resource,.33+Math.floor(i/3)*.61,.4);
}
function plant(c,x,z) {
  block(c,x,z,.55,.64,.51,['#d5beb0','#b58f80','#896f69']);
  const [sx,sy]=project(x+.26,z+.29,.55);
  line(c,[[sx,sy],[sx-1,sy-18]],'#577a5c',2);
  for(const [dx,dy,rx,ry] of [[-5,-8,8,4],[5,-12,7,3],[-6,-18,5,4],[5,-21,7,4],[0,-25,3,5]]){
    oval(c,sx+dx,sy+dy,rx,ry,dx<0?'#789567':'#a1ae68');
  }
}
function bench(c,x,z,type) {
  block(c,x,z,1.65,.64,.72,metal);
  block(c,x-.07,z-.04,1.78,.74,.085,['#dcd0b8','#b2998b','#8a7a77'],.72);
  if(type==='cook'){
    block(c,x+.17,z+.18,.58,.31,.045,orange,.82);
    const [bx,by]=project(x+1.13,z+.25,.83);
    oval(c,bx,by,9,5,'#60727b');
    oval(c,bx,by-2,7,3,'#c39672');
  }else{
    block(c,x+.19,z+.08,.88,.4,.19,timber,.82);
    block(c,x+1.13,z+.19,.24,.16,.09,dark,.82);
  }
}
function stationShadow(c,x,z){
  polygon(c,[project(x-1.6,z-1.34),project(x+2.04,z-1.34),project(x+2.44,z+.56),project(x-1.87,z+.78)],'#3f394c29');
}

function drawShell(c) {
  const x=-11.7,z=-9.2,right=11.4,front=9.3;
  quadrilateral(c,-14,-12,28,25,-.3,'#888184');
  quadrilateral(c,-14,-12,28,2.35,-.29,'#696b70');
  quadrilateral(c,-14,-9.57,28,.73,-.28,'#b7a29b');
  for(let i=-13.7;i<14;i+=.57) quadrilateral(c,i,-11.66,.19,1.55,-.27,'#c3bbb0');
  block(c,x-.27,z-.25,right-x+.5,front-z+.51,.4,['#b7a59c','#806b64','#6d5d60'],-.41);
  quadrilateral(c,x,z,right-x,front-z,0,'#a79b99');
  for(let ix=0;ix<23;ix++) for(let iz=0;iz<18;iz++){
    const tint = ['#a69b98','#958c8c','#a59a96','#9f9393','#ad9f9a'][(ix*17+iz*3+Math.floor(iz/3))%5];
    quadrilateral(c,x+ix,z+iz,1,1,.004,tint,'#6b5f5e27');
  }
  wall(c,x,z,right-x,true);
  wall(c,x,z,front-z,false);
  for(const a of [-8.3,-3.7,3.3,7.9]) windowBand(c,a,z,true);
  for(const a of [-6.3,-1.9,3.2]) windowBand(c,x,a,false);
  for(const a of [-10.65,2.22,9.79]) {
    block(c,a,z+.34,.38,.36,2.38,metal);
    block(c,a-.26,z+.24,.87,.41,.12,['#f2dcaf','#cda887','#a6826d'],2.37);
    quadrilateral(c,a-.35,z+.62,1.02,1.8,.014,'#f5d79f36');
  }
  // Set the floor edge in a small loading yard, with painted bay lines.
  for(let i=-10;i<10;i+=2.55) quadrilateral(c,i,front+.56,.065,2.03,-.26,'#d7c4a4');
  plant(c,-10.82,6.86);
  plant(c,9.65,7.36);
  // Only the near walls are cut down to curb height.
  block(c,x,front-.12,right-x,.22,.23,orange);
  block(c,right-.1,z,.22,front-z,.23,orange);
  block(c,-1.95,z+.02,3.72,.19,2.38,['#d7bf9c','#a99b86','#9b7863']);
  for(let i=0;i<8;i++) block(c,-1.8,z+.23,3.42,.055,.026,['#ada094','#827c78','#685c59'],.27+i*.24);
  for(let i=0;i<4;i++) block(c,-1.55+i*.79,z+.28,.55,.07,.31,['#adc7c7','#769a9f','#6c838e'],1.57);
  stripe(c,-1.95,z+.44,3.72,.57);
}

function drawZone(c,id,x,z) {
  const accent=COLORS[id];
  quadrilateral(c,x-2.19,z-1.97,4.38,3.57,.011,accent+'5c',accent);
  stripe(c,x-1.72,z+1.12,3.44,.44);
  const cp=project(x-1.75,z-1.74,.02);
  oval(c,cp[0],cp[1],4,2,'#f1d5a2');
}
function drawEquipment(c,id,x,z,state) {
  const stock=state.stock;
  stationShadow(c,x,z);
  if(id==='forest'){
    pallet(c,x-1.65,z-.95,'logs',stock.logs);
    conveyor(c,x-.46,z-1.36,2.52,0,false);
    shelf(c,x-2.15,z-2.48,'logs',Math.floor(stock.logs/2));
    for(let i=0;i<4;i++) block(c,x-1.48+i*.54,z+.15,.46,.29,.28,timber,.06);
  } else if(id==='farm'){
    growBed(c,x-1.75,z-1.23,state.ready,0);
    growBed(c,x-.03,z-1.23,state.ready,5);
    pallet(c,x+.38,z-.01,'crops',stock.crops);
    growBed(c,x-1.75,z-2.35,state.ready,10);
    growBed(c,x-.03,z-2.35,state.ready,13);
  } else if(id==='kitchen'){
    machine(c,x-1.58,z-1.24,'oven',state.active,state.phase);
    if(state.level>1) machine(c,x+.18,z-1.24,'oven',state.active,state.phase);
    else conveyor(c,x+.03,z-1.19,1.76,state.phase,state.active);
    pallet(c,x+.63,z+.02,'meals',stock.meals);
    bench(c,x-1.55,z-2.33,'cook');
    shelf(c,x+.51,z-2.25,'crops',stock.crops);
  } else if(id==='mill'){
    machine(c,x-1.52,z-1.19,'saw',state.active,state.phase);
    if(state.level>1) machine(c,x+.16,z-1.19,'saw',state.active,state.phase);
    else conveyor(c,x+.03,z-1.19,1.77,state.phase,state.active);
    pallet(c,x+.52,z+.01,'planks',stock.planks);
    bench(c,x-1.52,z-2.27,'mill');
    shelf(c,x+.48,z-2.23,'logs',stock.logs);
  } else if(id==='depot'){
    pallet(c,x-1.9,z-.73,'logs',stock.logs);
    pallet(c,x-.24,z-.73,'planks',stock.planks);
    pallet(c,x+.87,z-1.64,'meals',stock.meals);
    shelf(c,x-2.19,z-2.04,'logs',Math.floor(stock.logs/2));
    shelf(c,x-.36,z-2.04,'planks',Math.floor(stock.planks/2));
    if(state.level>1) shelf(c,x+1.47,z-2.65,'meals',stock.meals);
  } else if(id==='hall'){
    block(c,x-1.65,z-1.25,3.38,.84,.75,orange);
    block(c,x-1.7,z-1.32,3.48,1,.11,metal,.75);
    for(let i=0;i<Math.min(stock.meals,6);i++) crate(c,x-1.54+i*.48,z-1.12,'meals',.87,.38);
    for(let i=0;i<3;i++) block(c,x-1.35+i*1.24,z+.26,.61,.42,.29,timber);
    plant(c,x+1.72,z-1.45);
  }
}

export function createWorld(canvas,{onSelect,onCamera,lowPower=true,locations}) {
  const c=canvas.getContext('2d',{alpha:false});
  const base=canvas.ownerDocument.createElement('canvas');
  const back=base.getContext('2d',{alpha:false});
  if(!c||!back) throw new Error('Canvas graphics unavailable');
  let width=0,height=0,dpr=1,scale=1,zoom=1,left=0,top=0, panX=0,panY=0;
  let needBase=true, packed=false, selected=null, phase=0, pointer=null;
  const hits=[];
  const sites=Object.entries(locations);
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h||(w===width&&h===height)) return;
    if(!width&&w<540) zoom=1.38;
    width=w;height=h;
    dpr=Math.min(globalThis.devicePixelRatio||1,lowPower?1:1.5);
    canvas.width=base.width=Math.round(w*dpr);
    canvas.height=base.height=Math.round(h*dpr);
    needBase=true;
  }
  function camera(){
    scale=Math.min(width/1130,height/650)*zoom;
    left=width*.5+panX;
    top=height*.51+panY;
  }
  function reset(c2){c2.setTransform(dpr*scale,0,0,dpr*scale,dpr*left,dpr*top);}
  function background(){
    back.setTransform(1,0,0,1,0,0);
    back.fillStyle='#767174';
    back.fillRect(0,0,base.width,base.height);
    reset(back);drawShell(back);
    for(const [id,{x,z}] of sites) drawZone(back,id,x,z);
    path(back,-10,2.3,35);
    path(back,-10,-2.8,33);
    if(packed){path(back,-10,5.2,31);path(back,-9.7,-.05,29);}
    needBase=false;
  }
  function label(x,z,id){
    const [mx,my]=project(x-1.5,z-1.65,1.2);
    const px=mx*scale+left, py=my*scale+top;
    const color=COLORS[id];
    c.setTransform(dpr,0,0,dpr,0,0);
    c.font='700 11px system-ui,sans-serif';
    const labelWidth=c.measureText(LABELS[id]).width+18;
    c.fillStyle=selected?.type==='site'&&selected.id===id?'#9e563f':'#3f3943';
    c.fillRect(px-labelWidth/2,py-11,labelWidth,20);
    c.fillStyle=color;
    c.fillRect(px-labelWidth/2,py-11,3,20);
    c.fillStyle='#fff6e4';
    c.textAlign='center';
    c.textBaseline='middle';
    c.fillText(LABELS[id],px+1,py-1);
    hits.push({type:'site',id,x:px,y:py,rx:labelWidth/2+4,ry:15});
  }
  function render(state, alpha=1, dt=0) {
    resize();
    if(!width||!height) return;
    phase+=dt;
    const hasPaths=Boolean(state.projects.road.complete);
    if(hasPaths!==packed){packed=hasPaths;needBase=true;}
    camera();
    if(needBase) background();
    c.setTransform(1,0,0,1,0,0);
    c.drawImage(base,0,0);
    reset(c);
    hits.length=0;
    const actors=sites.map(([id,point])=>({id,...point,site:true}));
    for(const [i,w] of state.workers.entries()) actors.push({
      id:w.id,x:mix(w.prevX,w.x,alpha),z:mix(w.prevZ,w.z,alpha),w,i,
    });
    actors.sort((a,b)=>a.x+a.z-b.x-b.z);
    for(const a of actors){
      if(a.site){
        const active=state.workers.some(w=>w.task?.to===a.id&&w.task.stage==='work'&&Math.hypot(w.x-a.x,w.z-a.z)<2.1);
        if(selected?.type==='site'&&selected.id===a.id) quadrilateral(c,a.x-2.21,a.z-1.99,4.41,3.61,.023,'#fff8de35','#fff0a9');
        drawEquipment(c,a.id,a.x,a.z,{...state.sites[a.id],phase,active});
        const [sx,sy]=project(a.x,a.z-.38,.63);
        hits.push({type:'site',id:a.id,x:sx*scale+left,y:sy*scale+top,rx:Math.max(17,scale*42),ry:Math.max(13,scale*27)});
      }else{
        const [sx,sy]=project(a.x,a.z);
        if(selected?.type==='worker'&&selected.id===a.id) oval(c,sx,sy,14,6,'#fff0ac');
        worker(c,a.x,a.z,a.w,a.i,phase,state.projects.cart.complete,Math.hypot(a.w.x-a.w.prevX,a.w.z-a.w.prevZ)>.03);
        hits.push({type:'worker',id:a.id,x:sx*scale+left,y:(sy-14)*scale+top,rx:12,ry:15});
      }
    }
    for(const [id,{x,z}] of sites) label(x,z,id);
  }
  const local=e=>[e.clientX-canvas.getBoundingClientRect().left,e.clientY-canvas.getBoundingClientRect().top];
  function down(e){
    if(!e.isPrimary) return;
    const [x,y]=local(e);
    pointer={id:e.pointerId,x,y,panX,panY,moved:false};
    canvas.setPointerCapture?.(e.pointerId);
  }
  function move(e){
    if(pointer?.id!==e.pointerId||zoom<=1) return;
    const [x,y]=local(e);
    if(Math.hypot(x-pointer.x,y-pointer.y)<6&&!pointer.moved)return;
    pointer.moved=true;
    panX=clamp(pointer.panX+x-pointer.x,-width*zoom*.5,width*zoom*.5);
    panY=clamp(pointer.panY+y-pointer.y,-height*zoom*.5,height*zoom*.5);
    needBase=true;
    onCamera?.();
  }
  function up(e){
    if(pointer?.id!==e.pointerId) return;
    const [x,y]=local(e), moved=pointer.moved||Math.hypot(x-pointer.x,y-pointer.y)>8;
    pointer=null;
    if(moved) return;
    const hit=hits.slice().reverse().find(a=>Math.abs(x-a.x)<=a.rx&&Math.abs(y-a.y)<=a.ry);
    if(hit) onSelect({type:hit.type,id:hit.id});
  }
  function cancel(){pointer=null;}
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',cancel);
  return {
    render,resize,select(value){selected=value;},
    zoom(step){zoom=clamp(zoom+step*.38,1,2.52);if(zoom===1)panX=panY=0;needBase=true;return zoom;},
    stats(){return {width,height,dpr,targets:hits.map(h=>({...h})),zoom};},
    dispose(){
      canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',up);
      canvas.removeEventListener('pointercancel',cancel);
    },
  };
}
