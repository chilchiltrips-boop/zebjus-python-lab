(function(){
  const state={ready:false,running:false,detected:false,fingers:0,side:"",rawFingers:0,history:[],frames:0};
  let handLandmarker=null,stream=null,raf=0,lastTime=-1,currentDeviceId="";

  function cfg(){return window.ZEBJUS_CONFIG?.mediaPipe||{};}

  async function createLandmarker(delegate){
    const c=cfg();
    const mod=await import(c.moduleUrl);
    const vision=await mod.FilesetResolver.forVisionTasks(c.wasmRoot);
    return mod.HandLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:c.modelUrl,delegate},
      runningMode:"VIDEO",
      numHands:1,
      minHandDetectionConfidence:.50,
      minHandPresenceConfidence:.50,
      minTrackingConfidence:.50
    });
  }

  async function ensureModel(){
    if(handLandmarker)return handLandmarker;
    try{handLandmarker=await createLandmarker("GPU");}
    catch(e){console.warn("MediaPipe GPU failed; using CPU.",e);handLandmarker=await createLandmarker("CPU");}
    state.ready=true;
    return handLandmarker;
  }

  function rawFingerCount(lm){
    if(!lm||lm.length<21)return 0;
    let n=0;
    for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]]){
      if(lm[tip].y < lm[pip].y - 0.012)n++;
    }
    // Thumb: simple extension distance works for both left/right and mirrored preview.
    const thumbDx=Math.abs(lm[4].x-lm[3].x);
    const thumbDy=Math.abs(lm[4].y-lm[3].y);
    if(Math.hypot(thumbDx,thumbDy) > 0.045)n++;
    return Math.max(0,Math.min(5,n));
  }

  function stableFromHistory(){
    const recent=state.history.slice(-7);
    const detected=recent.filter(x=>x.detected);
    if(!detected.length)return {detected:false,fingers:0,side:""};

    const counts=new Map();
    for(const x of detected)counts.set(x.fingers,(counts.get(x.fingers)||0)+1);
    let fingers=detected[detected.length-1].fingers,best=-1;
    for(const [k,v] of counts)if(v>best){best=v;fingers=k;}

    const sides=detected.map(x=>x.side).filter(Boolean);
    const side=sides.length?sides[sides.length-1]:"";
    return {detected:detected.length>=Math.max(1,Math.ceil(recent.length*.35)),fingers,side};
  }

  function draw(canvas,lm){
    const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1,ctx=canvas.getContext("2d");
    const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.clearRect(0,0,w,h);
    if(!lm?.length)return;
    ctx.fillStyle="rgba(255,255,255,.95)";
    for(const p of lm){ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.5*d,0,Math.PI*2);ctx.fill();}
  }

  function emit(){
    window.dispatchEvent(new CustomEvent("zebjus-ai-state",{detail:{
      detected:state.detected,fingers:state.fingers,side:state.side,rawFingers:state.rawFingers
    }}));
  }

  function loop(video,canvas){
    if(!state.running)return;
    if(video.readyState>=2&&handLandmarker&&video.currentTime!==lastTime){
      lastTime=video.currentTime;
      const result=handLandmarker.detectForVideo(video,performance.now());
      const lm=result.landmarks?.[0]||[];
      const detected=lm.length>0;
      const raw=detected?rawFingerCount(lm):0;
      const side=detected?(result.handednesses?.[0]?.[0]?.categoryName||""):"";

      state.rawFingers=raw;
      state.frames++;
      state.history.push({detected,fingers:raw,side});
      if(state.history.length>12)state.history.shift();

      const stable=stableFromHistory();
      state.detected=stable.detected;
      state.fingers=stable.fingers;
      state.side=stable.side;

      draw(canvas,lm);
      emit();
    }
    raf=requestAnimationFrame(()=>loop(video,canvas));
  }

  async function start(video,canvas,deviceId=""){
    stop(video,canvas);
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera API unavailable in this browser.");
    const vc=deviceId
      ? {deviceId:{exact:deviceId},width:{ideal:960},height:{ideal:540}}
      : {facingMode:"user",width:{ideal:960},height:{ideal:540}};
    stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});
    currentDeviceId=stream.getVideoTracks()[0]?.getSettings()?.deviceId||deviceId||"";
    video.srcObject=stream;
    await video.play();
    await ensureModel();
    state.running=true;state.history=[];state.frames=0;state.detected=false;state.fingers=0;state.rawFingers=0;lastTime=-1;
    loop(video,canvas);
    return currentDeviceId;
  }

  function stop(video,canvas){
    state.running=false;
    if(raf)cancelAnimationFrame(raf);raf=0;
    if(stream){for(const t of stream.getTracks())t.stop();stream=null;}
    if(video)video.srcObject=null;
    if(canvas)canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    state.detected=false;state.fingers=0;state.rawFingers=0;state.side="";state.history=[];state.frames=0;currentDeviceId="";
    emit();
  }

  function getSnapshot(){
    const s=stableFromHistory();
    return {detected:s.detected,fingers:s.fingers,side:s.side,rawFingers:state.rawFingers,frames:state.frames};
  }

  async function waitForStable(timeoutMs=1400){
    const startTime=performance.now();
    while(performance.now()-startTime<timeoutMs){
      const s=getSnapshot();
      if(s.frames>=5 && (s.detected || performance.now()-startTime>650))return s;
      await new Promise(r=>setTimeout(r,70));
    }
    return getSnapshot();
  }

  window.ZebjusAI={start,stop,getSnapshot,waitForStable,getDeviceId:()=>currentDeviceId};
})();