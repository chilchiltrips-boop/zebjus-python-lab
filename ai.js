const state={ready:false,running:false,detected:false,fingers:0,side:"",landmarks:[]};
let handLandmarker=null,stream=null,raf=0,lastTime=-1,currentDeviceId="";

function cfg(){return window.ZEBJUS_CONFIG?.mediaPipe||{};}

async function createLandmarker(delegate){
  const c=cfg(),mod=await import(c.moduleUrl);
  const vision=await mod.FilesetResolver.forVisionTasks(c.wasmRoot);
  return mod.HandLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:c.modelUrl,delegate},
    runningMode:"VIDEO",numHands:1,
    minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55
  });
}
async function ensureModel(){
  if(handLandmarker)return handLandmarker;
  try{handLandmarker=await createLandmarker("GPU");}
  catch(e){console.warn("GPU MediaPipe failed, using CPU",e);handLandmarker=await createLandmarker("CPU");}
  state.ready=true;return handLandmarker;
}
function countFingers(lm){
  if(!lm||lm.length<21)return 0;let n=0;
  for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]])if(lm[tip].y<lm[pip].y)n++;
  if(Math.abs(lm[4].x-lm[3].x)>.035)n++;
  return n;
}
function draw(canvas,lm){
  const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1,ctx=canvas.getContext("2d");
  const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);if(!lm?.length)return;
  ctx.fillStyle="rgba(255,255,255,.95)";
  for(const p of lm){ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.5*d,0,Math.PI*2);ctx.fill();}
}
function emit(){window.dispatchEvent(new CustomEvent("zebjus-ai-state",{detail:{detected:state.detected,fingers:state.fingers,side:state.side}}));}
function loop(video,canvas){
  if(!state.running)return;
  if(video.readyState>=2&&handLandmarker&&video.currentTime!==lastTime){
    lastTime=video.currentTime;
    const result=handLandmarker.detectForVideo(video,performance.now()),lm=result.landmarks?.[0]||[];
    state.detected=lm.length>0;state.landmarks=lm;state.fingers=state.detected?countFingers(lm):0;
    state.side=state.detected?(result.handednesses?.[0]?.[0]?.categoryName||""):"";
    draw(canvas,lm);emit();
  }
  raf=requestAnimationFrame(()=>loop(video,canvas));
}
async function start(video,canvas,deviceId=""){
  stop(video,canvas);
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera API unavailable.");
  const vc=deviceId?{deviceId:{exact:deviceId},width:{ideal:960},height:{ideal:540}}:{facingMode:"user",width:{ideal:960},height:{ideal:540}};
  stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});
  currentDeviceId=stream.getVideoTracks()[0]?.getSettings()?.deviceId||deviceId||"";
  video.srcObject=stream;await video.play();await ensureModel();
  state.running=true;lastTime=-1;loop(video,canvas);return currentDeviceId;
}
function stop(video,canvas){
  state.running=false;if(raf)cancelAnimationFrame(raf);raf=0;
  if(stream){for(const t of stream.getTracks())t.stop();stream=null;}
  if(video)video.srcObject=null;if(canvas)canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
  state.detected=false;state.fingers=0;state.side="";state.landmarks=[];currentDeviceId="";emit();
}
window.ZebjusAI={start,stop,getSnapshot:()=>({detected:state.detected,fingers:state.fingers,side:state.side}),getDeviceId:()=>currentDeviceId};
