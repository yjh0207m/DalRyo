const fs = require('fs');
const path = require('path');
const W=535,H=705,cols=18,rows=24;
const bones=[['Body',265,460],['Head',335,425],['EarLeft',250,245],['EarRight',363,232],['ForeLeft',268,498],['ForeRight',405,493],['Hind',165,505]];
const points=[];const index=new Map();
function add(c,r,contour){index.set(`${c},${r}`,points.length);points.push({c,r,contour});}
for(let c=0;c<=cols;c++)add(c,0,true);
for(let r=1;r<=rows;r++)add(cols,r,true);
for(let c=cols-1;c>=0;c--)add(c,rows,true);
for(let r=rows-1;r>0;r--)add(0,r,true);
for(let r=1;r<rows;r++)for(let c=1;c<cols;c++)add(c,r,false);
const triangles=[];
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=index.get(`${c},${r}`),b=index.get(`${c+1},${r}`),d=index.get(`${c},${r+1}`),e=index.get(`${c+1},${r+1}`);triangles.push(a,b,e,a,e,d);}
const bytes=[];for(let v of triangles){while(v>127){bytes.push((v&127)|128);v>>>=7;}bytes.push(v);}
function weight(x,y){let i=0,t=0;if(y<240){i=x<305?2:3;t=Math.min(1,(245-y)/70);}else if(y<430&&x>200){i=1;t=Math.min(1,(430-y)/55,(x-200)/50);}else if(y>485){i=x<205?6:x<345?4:5;t=Math.min(1,(y-485)/70);}let b=Math.round(t*255);return b===0?[1,255]:b===255?[i+1,255]:[1|((i+1)<<8),(255-b)|(b<<8)];}
let mesh=points.map(({c,r,contour})=>{const x=c/cols*W,y=r/rows*H,[indices,values]=weight(x,y);return `<${contour?'ContourMeshVertex':'MeshVertex'} x="${(250+(x-W/2)*.65).toFixed(3)}" y="${(252+(y-H/2)*.65).toFixed(3)}" u="${c/cols}" v="${r/rows}"><Weight values="${values}" indices="${indices}"/></${contour?'ContourMeshVertex':'MeshVertex'}>`;}).join('\n');
const names=['idle','walk','run','sprint','stone','jump'];
const bool=(id,v)=>`<TransitionBoolCondition inputId="0:${id}" opValue="${v?'equal':'notEqual'}"/>`;
const num=(op,v)=>`<TransitionNumberCondition inputId="0:10" opValue="${op}" value="${v}"/>`;
function conditions(i){if(i===4)return bool(12,true);let s=bool(12,false)+bool(11,i!==0);if(i===1)s+=num('lessThan',6);if(i===2)s+=num('greaterThanOrEqual',6)+num('lessThan',11);if(i===3)s+=num('greaterThanOrEqual',11);return s;}
let states=names.map((n,i)=>{let ts='';if(i===5)ts=`<StateTransition stateToId="0:100" duration="100" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;else{for(const j of [4,0,1,2,3])if(i!==j)ts+=`<StateTransition stateToId="0:${100+j}" duration="120">${conditions(j)}</StateTransition>`;if(i!==4)ts+=`<StateTransition stateToId="0:105" duration="60">${bool(12,false)}<TransitionTriggerCondition inputId="0:13"/></StateTransition>`;}return `<AnimationState x="${200+i*190}" y="${i%2*150}" animationId="0:${200+i}" reset="true" id="0:${100+i}">${ts}</AnimationState>`;}).join('\n');
function keys(id,prop,values,duration){return `<KeyedObject objectId="0:${id}"><KeyedProperty property="${prop}">${values.map((v,i)=>`<KeyFrameDouble frame="${Math.round(i*duration/(values.length-1))}" value="${v}" interpolationType="linear"/>`).join('')}</KeyedProperty></KeyedObject>`;}
// Sample sinusoidal movement instead of four sharp linear poses. The body
// rotates/scales about the feet, avoiding the former top-left pivot drift.
const round=value=>Number(value.toFixed(5));
let anims=names.map((n,i)=>{
  const duration=[144,34,24,18,60,42][i];
  const count=i===5?7:13;
  const phases=Array.from({length:count},(_,j)=>j/(count-1));
  const moving=i>0&&i<4;
  const amplitude=[.012,.075,.11,.145,0,0][i];
  const rotation=phases.map(t=>i===5?0:Math.sin(2*Math.PI*t)*amplitude*.15);
  const scaleY=phases.map(t=>i===5?[1,.90,1.04,1.02,1,.91,1][Math.round(t*6)]:1+Math.sin(4*Math.PI*t)*amplitude*.14);
  const scaleX=scaleY.map(v=>1-(v-1)*.55);
  const bounce=phases.map(t=>i===5?[0,0,-42,-92,-42,0,0][Math.round(t*6)]:moving?-Math.pow(Math.sin(2*Math.PI*t),2)*[0,4,8,12][i]:0);
  const x=phases.map((t,j)=>round(250-Math.cos(rotation[j])*scaleX[j]*250+Math.sin(rotation[j])*scaleY[j]*410));
  const y=phases.map((t,j)=>round(410-Math.sin(rotation[j])*scaleX[j]*250-Math.cos(rotation[j])*scaleY[j]*410+bounce[j]));
  let k=keys(20,'x',x,duration)+keys(20,'y',y,duration)+keys(20,'rotation',rotation.map(round),duration)+keys(20,'scaleX',scaleX.map(round),duration)+keys(20,'scaleY',scaleY.map(round),duration);
  for(let b=0;b<bones.length;b++){
    const values=phases.map(t=>{
      if(i===4||b===0)return 0;
      if(i===5)return Math.sin(Math.PI*t)*(b===2?-.14:b===3?.11:b>=4?-.10:.025);
      const lag=b===2?-.6:b===3?-.95:0;
      const wave=Math.sin(2*Math.PI*t+lag)-Math.sin(lag);
      const strength=b===1?-.22:b===2?.8:b===3?.65:(b===5?-1:1)*1.5;
      return wave*amplitude*strength;
    });
    k+=keys(30+b,'rotation',values.map(round),duration);
  }
  return `<LinearAnimation name="${n}" id="0:${200+i}" duration="${duration}" fps="60" loopValue="${i===5?'oneShot':'loop'}">${k}</LinearAnimation>`;
}).join('\n');
const xml=`<Rive version="1" kind="fragment">
<ImageAsset file="images/rabbit_S.png" name="Rabbit original baby" id="0:60"/>
<Artboard name="baby" width="500" height="500" defaultStateMachineId="0:7" styleId="0:5" id="0:2"><LayoutComponentStyle name="Artboard Style" id="0:5"/>
<Node name="Character rig" x="0" y="0" id="0:20">
${bones.map(([name,x,y],i)=>`<RootBone name="${name}" x="${250+(x-W/2)*.65}" y="${252+(y-H/2)*.65}" length="50" id="0:${30+i}"/>`).join('\n')}
<Image name="Rabbit baby" assetId="0:60" id="0:50"><Mesh name="Deformation mesh" triangleIndexBytes="${Buffer.from(bytes).toString('base64')}">${mesh}<Skin name="Skin" tx="0" ty="0">${bones.map(([name,x,y],i)=>`<Tendon name="${name} bind" boneId="0:${30+i}" tx="${250+(x-W/2)*.65}" ty="${252+(y-H/2)*.65}"/>`).join('')}</Skin></Mesh></Image>
</Node>
<StateMachine name="Character" id="0:7"><StateMachineNumber name="speed" id="0:10"/><StateMachineBool name="running" id="0:11"/><StateMachineBool name="stone" id="0:12"/><StateMachineTrigger name="jump" id="0:13"/><StateMachineLayer name="Locomotion"><AnyState x="200" y="-150"/><ExitState x="400" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="0:100"/></EntryState>${states}</StateMachineLayer></StateMachine>
${anims}
</Artboard></Rive>`;
fs.writeFileSync(path.join(__dirname,'scene.rml'),xml);
console.log('Generated rabbit baby: 475 mesh vertices, 7 bones, 6 motions.');


