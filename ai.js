const state={ready:false,running:false,detected:false,fingers:0,side:"",landmarks:[]};
let handLandmarker=null,stream=null,rafId=0,lastVideoTime=-1;

function cfg(){
  return window.ZEBJUS_CONFIG?.mediaPipe || {
    moduleUrl:"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm",
    wasmRoot:"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
    modelUrl:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  };
}

async function createLandmarker(delegate){
  const c=cfg();
  const mod=await import(c.moduleUrl);
  const {FilesetResolver,HandLandmarker}=mod;
  const vision=await FilesetResolver.forVisionTasks(c.wasmRoot);

  return await HandLandmarker.createFromOptions(vision,{
    baseOptions:{
      modelAssetPath:c.modelUrl,
      delegate
    },
    runningMode:"VIDEO",
    numHands:1,
    minHandDetectionConfidence:.55,
    minHandPresenceConfidence:.55,
    minTrackingConfidence:.55
  });
}

async function ensureModel(){
  if(handLandmarker)return handLandmarker;

  // Try GPU first. If WebGL/GPU delegate is unavailable, fall back to CPU.
  try{
    handLandmarker=await createLandmarker("GPU");
  }catch(gpuError){
    console.warn("MediaPipe GPU init failed; trying CPU.",gpuError);
    handLandmarker=await createLandmarker("CPU");
  }

  state.ready=true;
  return handLandmarker;
}

function countFingers(lm){
  if(!lm||lm.length<21)return 0;

  let n=0;
  for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]]){
    if(lm[tip].y<lm[pip].y)n++;
  }

  if(Math.abs(lm[4].x-lm[3].x)>.035)n++;
  return n;
}

function draw(canvas,lm){
  const ctx=canvas.getContext("2d");
  const r=canvas.getBoundingClientRect();
  const d=window.devicePixelRatio||1;

  canvas.width=Math.max(1,Math.round(r.width*d));
  canvas.height=Math.max(1,Math.round(r.height*d));
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(!lm?.length)return;

  ctx.fillStyle="rgba(255,255,255,.92)";
  for(const p of lm){
    ctx.beginPath();
    ctx.arc(p.x*canvas.width,p.y*canvas.height,3.2*d,0,Math.PI*2);
    ctx.fill();
  }
}

function emit(){
  window.dispatchEvent(new CustomEvent("zebjus-ai-state",{
    detail:{
      detected:state.detected,
      fingers:state.fingers,
      side:state.side
    }
  }));
}

async function loop(video,canvas){
  if(!state.running)return;

  if(video.readyState>=2 && handLandmarker && video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime;

    const result=handLandmarker.detectForVideo(video,performance.now());
    const lm=result.landmarks?.[0]||[];

    state.detected=lm.length>0;
    state.landmarks=lm;
    state.fingers=state.detected?countFingers(lm):0;
    state.side=state.detected?(result.handednesses?.[0]?.[0]?.categoryName||""):"";

    draw(canvas,lm);
    emit();
  }

  rafId=requestAnimationFrame(()=>loop(video,canvas));
}

async function start(video,canvas){
  if(!navigator.mediaDevices?.getUserMedia){
    throw new Error("Camera API unavailable in this browser.");
  }

  // Request camera FIRST so the browser permission prompt appears immediately.
  stream=await navigator.mediaDevices.getUserMedia({
    video:{
      facingMode:"user",
      width:{ideal:960},
      height:{ideal:540}
    },
    audio:false
  });

  video.srcObject=stream;
  await video.play();

  try{
    await ensureModel();
  }catch(err){
    for(const track of stream.getTracks())track.stop();
    stream=null;
    video.srcObject=null;
    throw new Error("MediaPipe failed to load: "+(err?.message||err));
  }

  state.running=true;
  lastVideoTime=-1;
  loop(video,canvas);
}

function stop(video,canvas){
  state.running=false;

  if(rafId)cancelAnimationFrame(rafId);
  rafId=0;

  if(stream){
    for(const track of stream.getTracks())track.stop();
    stream=null;
  }

  if(video)video.srcObject=null;

  if(canvas){
    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
  }

  state.detected=false;
  state.fingers=0;
  state.side="";
  state.landmarks=[];
  emit();
}

window.ZebjusAI={
  state,
  start,
  stop,
  getSnapshot:()=>({
    detected:state.detected,
    fingers:state.fingers,
    side:state.side
  })
};
