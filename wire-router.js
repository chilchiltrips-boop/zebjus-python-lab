(function(root,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
root.ZebjusWireRouter=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const VERSION="1.1.0";
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const same=(a,b)=>Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01;
const point=(p)=>({x:finite(p?.x),y:finite(p?.y)});

function cleanPoints(input){
  const points=[];
  (input||[]).map(point).forEach(p=>{if(!points.length||!same(points[points.length-1],p))points.push(p)});
  let changed=true;
  while(changed&&points.length>2){
    changed=false;
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],c=points[i+1];
      const vertical=Math.abs(a.x-b.x)<.01&&Math.abs(b.x-c.x)<.01&&(b.y-a.y)*(c.y-b.y)>0;
      const horizontal=Math.abs(a.y-b.y)<.01&&Math.abs(b.y-c.y)<.01&&(b.x-a.x)*(c.x-b.x)>0;
      if(vertical||horizontal){
        points.splice(i,1);changed=true;break;
      }
    }
  }
  return points;
}

function distancePointToSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
  if(length2<.0001)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/length2,0,1);
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function pathLength(points){
  let total=0;
  for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  return total;
}

function normalizedPins(pins,defaultRadius){
  return (pins||[]).map((pin,index)=>({
    x:finite(pin.x),y:finite(pin.y),key:String(pin.key??index),
    radius:Math.max(8,finite(pin.radius,defaultRadius))
  }));
}

function routePinConflicts(points,pins,exclude=[],keepout=17){
  const ignored=new Set((exclude||[]).map(String)),hit=new Set(),list=normalizedPins(pins,keepout);
  for(let i=1;i<points.length;i++)for(const pin of list){
    if(ignored.has(pin.key))continue;
    const a=points[i-1],b=points[i],margin=pin.radius;
    if(pin.x<Math.min(a.x,b.x)-margin||pin.x>Math.max(a.x,b.x)+margin||pin.y<Math.min(a.y,b.y)-margin||pin.y>Math.max(a.y,b.y)+margin)continue;
    if(distancePointToSegment(pin,points[i-1],points[i])<pin.radius)hit.add(pin.key);
  }
  return [...hit];
}

function scorePrepared(points,list,ignored,bounds=null){
  let score=pathLength(points)+(Math.max(0,points.length-2)*18);
  const hit=new Set();
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    for(const pin of list){
      if(ignored.has(pin.key))continue;
      const margin=pin.radius+10;
      if(pin.x<Math.min(a.x,b.x)-margin||pin.x>Math.max(a.x,b.x)+margin||pin.y<Math.min(a.y,b.y)-margin||pin.y>Math.max(a.y,b.y)+margin)continue;
      const distance=distancePointToSegment(pin,a,b);
      if(distance<pin.radius){hit.add(pin.key);score+=10000000+(pin.radius-distance)*100000;}
      else if(distance<pin.radius+10)score+=(pin.radius+10-distance)*600;
    }
  }
  if(bounds){
    const minX=finite(bounds.minX,0),minY=finite(bounds.minY,0),maxX=finite(bounds.maxX,Infinity),maxY=finite(bounds.maxY,Infinity);
    for(const p of points)if(p.x<minX||p.x>maxX||p.y<minY||p.y>maxY)score+=10000000;
  }
  return {score,conflicts:[...hit]};
}

function scoreRoute(points,pins,exclude=[],keepout=17,bounds=null){
  return scorePrepared(points,normalizedPins(pins,keepout),new Set((exclude||[]).map(String)),bounds);
}

function congestionScore(points,occupied=[],gap=8){
  let score=0,overlaps=0,crossings=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],horizontal=Math.abs(a.y-b.y)<.01,vertical=Math.abs(a.x-b.x)<.01;
    for(const route of occupied||[])for(let j=1;j<route.length;j++){
      const c=route[j-1],d=route[j],otherHorizontal=Math.abs(c.y-d.y)<.01,otherVertical=Math.abs(c.x-d.x)<.01;
      if(horizontal&&otherHorizontal&&Math.abs(a.y-c.y)<gap){const overlap=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x));if(overlap>2){score+=1600+overlap*32;overlaps++;}}
      else if(vertical&&otherVertical&&Math.abs(a.x-c.x)<gap){const overlap=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y));if(overlap>2){score+=1600+overlap*32;overlaps++;}}
      else if(horizontal&&otherVertical){if(c.x>Math.min(a.x,b.x)+2&&c.x<Math.max(a.x,b.x)-2&&a.y>Math.min(c.y,d.y)+2&&a.y<Math.max(c.y,d.y)-2){score+=240;crossings++;}}
      else if(vertical&&otherHorizontal){if(a.x>Math.min(c.x,d.x)+2&&a.x<Math.max(c.x,d.x)-2&&c.y>Math.min(a.y,b.y)+2&&c.y<Math.max(a.y,b.y)-2){score+=240;crossings++;}}
    }
  }
  return {score,overlaps,crossings};
}

function uniqueLanes(values,min,max){
  const seen=new Set(),out=[];
  for(const raw of values){
    const value=Math.round(clamp(finite(raw),min,max)*10)/10,key=String(value);
    if(!seen.has(key)){seen.add(key);out.push(value);}
  }
  return out;
}

function roundedPath(input,radius=11){
  const points=cleanPoints(input);
  if(!points.length)return "";
  if(points.length===1)return `M ${points[0].x} ${points[0].y}`;
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++){
    const previous=points[i-1],corner=points[i],next=points[i+1];
    const inLength=Math.hypot(corner.x-previous.x,corner.y-previous.y),outLength=Math.hypot(next.x-corner.x,next.y-corner.y);
    if(inLength<.01||outLength<.01)continue;
    const r=Math.min(radius,inLength/2,outLength/2);
    const before={x:corner.x+(previous.x-corner.x)*r/inLength,y:corner.y+(previous.y-corner.y)*r/inLength};
    const after={x:corner.x+(next.x-corner.x)*r/outLength,y:corner.y+(next.y-corner.y)*r/outLength};
    d+=` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  const last=points[points.length-1];
  return d+` L ${last.x} ${last.y}`;
}

function route(options={}){
  const start=point(options.start),end=point(options.end),startLead=point(options.startLead||start),endLead=point(options.endLead||end);
  const keepout=Math.max(10,finite(options.keepout,17)),pins=normalizedPins(options.pins,keepout),index=Math.max(0,finite(options.index));
  const bounds={minX:finite(options.bounds?.minX,8),minY:finite(options.bounds?.minY,8),maxX:finite(options.bounds?.maxX,5900)-8,maxY:finite(options.bounds?.maxY,3950)-8};
  if(bounds.maxX<bounds.minX)bounds.maxX=bounds.minX;
  if(bounds.maxY<bounds.minY)bounds.maxY=bounds.minY;
  const laneOffset=(index%13)*7,spread=34+laneOffset;
  const pinXs=pins.map(p=>p.x),pinYs=pins.map(p=>p.y);
  const minPinX=pinXs.length?Math.min(...pinXs,start.x,end.x):Math.min(start.x,end.x),maxPinX=pinXs.length?Math.max(...pinXs,start.x,end.x):Math.max(start.x,end.x);
  const minPinY=pinYs.length?Math.min(...pinYs,start.y,end.y):Math.min(start.y,end.y),maxPinY=pinYs.length?Math.max(...pinYs,start.y,end.y):Math.max(start.y,end.y);
  const midX=(startLead.x+endLead.x)/2,midY=(startLead.y+endLead.y)/2,jitter=((index%9)-4)*7;
  const xLanes=uniqueLanes([
    midX+jitter,midX-jitter,
    Math.min(startLead.x,endLead.x)-spread,Math.max(startLead.x,endLead.x)+spread,
    minPinX-30-laneOffset,maxPinX+30+laneOffset,
    bounds.minX+18+laneOffset,bounds.maxX-18-laneOffset
  ],bounds.minX,bounds.maxX);
  const yLanes=uniqueLanes([
    midY+jitter,midY-jitter,
    Math.min(startLead.y,endLead.y)-spread,Math.max(startLead.y,endLead.y)+spread,
    minPinY-30-laneOffset,maxPinY+30+laneOffset,
    bounds.minY+18+laneOffset,bounds.maxY-18-laneOffset
  ],bounds.minY,bounds.maxY);
  const outerX=uniqueLanes([minPinX-30-laneOffset,maxPinX+30+laneOffset,bounds.minX+18+laneOffset,bounds.maxX-18-laneOffset],bounds.minX,bounds.maxX);
  const outerY=uniqueLanes([minPinY-30-laneOffset,maxPinY+30+laneOffset,bounds.minY+18+laneOffset,bounds.maxY-18-laneOffset],bounds.minY,bounds.maxY);
  const candidates=[];
  const add=raw=>{const points=raw.map(point),next=points.slice(2).find(p=>!same(p,startLead)),previous=[...points.slice(0,-2)].reverse().find(p=>!same(p,endLead));if(next){const outward={x:startLead.x-start.x,y:startLead.y-start.y},continuation={x:next.x-startLead.x,y:next.y-startLead.y};if(outward.x*continuation.x+outward.y*continuation.y<-.01)return}if(previous){const incoming={x:endLead.x-previous.x,y:endLead.y-previous.y},approach={x:end.x-endLead.x,y:end.y-endLead.y};if(incoming.x*approach.x+incoming.y*approach.y<-.01)return}const cleaned=cleanPoints(points);if(cleaned.length>1)candidates.push(cleaned)};
  for(const x of xLanes)add([start,startLead,{x,y:startLead.y},{x,y:endLead.y},endLead,end]);
  for(const y of yLanes)add([start,startLead,{x:startLead.x,y},{x:endLead.x,y},endLead,end]);
  for(const x of outerX.slice(0,2))for(const y of outerY.slice(0,2)){
    add([start,startLead,{x,y:startLead.y},{x,y},{x:endLead.x,y},endLead,end]);
    add([start,startLead,{x:startLead.x,y},{x,y},{x,y:endLead.y},endLead,end]);
  }
  add([start,startLead,{x:startLead.x,y:endLead.y},endLead,end]);
  add([start,startLead,{x:endLead.x,y:startLead.y},endLead,end]);
  let best=null,ignored=new Set((options.exclude||[]).map(String));
  for(const points of candidates){
    const rated=scorePrepared(points,pins,ignored,bounds);
    const congestion=congestionScore(points,options.occupied||[]);
    rated.score+=congestion.score;
    if(!best||rated.score<best.score)best={points,score:rated.score,conflicts:rated.conflicts,overlaps:congestion.overlaps,crossings:congestion.crossings};
  }
  best=best||{points:cleanPoints([start,startLead,endLead,end]),score:0,conflicts:[]};
  return {...best,d:roundedPath(best.points,finite(options.radius,11))};
}

function boxesOverlap(a,b,padding=4){
  return a.x<b.x+b.width+padding&&a.x+a.width+padding>b.x&&a.y<b.y+b.height+padding&&a.y+a.height+padding>b.y;
}

function labelPlacement(options={}){
  const points=cleanPoints(options.points||[]),text=String(options.text||""),pins=normalizedPins(options.pins,15),labels=options.labels||[];
  const width=clamp(text.length*6.7+20,72,190),height=23,index=Math.max(0,finite(options.index));
  const bounds={minX:finite(options.bounds?.minX,8),minY:finite(options.bounds?.minY,8),maxX:finite(options.bounds?.maxX,5900)-8,maxY:finite(options.bounds?.maxY,3950)-8};
  const ignored=new Set((options.exclude||[]).map(String)),segments=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length>4)segments.push({a,b,length,horizontal:Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)});
  }
  segments.sort((a,b)=>b.length-a.length);
  const candidates=[],offsets=[17,-17,31,-31,45,-45],fractions=[.5,.38,.62];
  for(const segment of segments.slice(0,8))for(const fraction of fractions)for(const offset of offsets){
    const cx=segment.a.x+(segment.b.x-segment.a.x)*fraction+(segment.horizontal?0:offset);
    const cy=segment.a.y+(segment.b.y-segment.a.y)*fraction+(segment.horizontal?offset:0);
    const rect={x:cx-width/2,y:cy-height/2,width,height};
    let score=-segment.length*.35+Math.abs(fraction-.5)*30+Math.abs(offset)*.15+((index%5)*.01);
    if(rect.x<bounds.minX||rect.y<bounds.minY||rect.x+width>bounds.maxX||rect.y+height>bounds.maxY)score+=1000000;
    for(const pin of pins){
      if(ignored.has(pin.key))continue;
      const px=clamp(pin.x,rect.x,rect.x+width),py=clamp(pin.y,rect.y,rect.y+height);
      const distance=Math.hypot(pin.x-px,pin.y-py);
      if(distance<pin.radius+3)score+=100000+(pin.radius+3-distance)*1000;
    }
    for(const used of labels)if(boxesOverlap(rect,used,5))score+=250000;
    candidates.push({rect,score});
  }
  let best=candidates.sort((a,b)=>a.score-b.score)[0];
  if(!best){
    const base=points[Math.floor(points.length/2)]||{x:width/2+8,y:height/2+8};
    best={rect:{x:base.x-width/2,y:base.y-height/2,width,height},score:0};
  }
  const rect={...best.rect};
  return {...rect,textX:rect.x+rect.width/2,textY:rect.y+15.5,score:best.score};
}

return {VERSION,cleanPoints,distancePointToSegment,pathLength,routePinConflicts,scoreRoute,congestionScore,roundedPath,route,labelPlacement,boxesOverlap};
});
