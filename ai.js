(function(){
  const state={ready:false,running:false,detected:false,fingers:0,side:"",rawFingers:0,history:[],frames:0,faces:[],faceFrames:0,landmarks:[]};
  let handLandmarker=null,faceDetector=null,stream=null,raf=0,lastTime=-1,currentDeviceId="",visionPromise=null;

  function cfg(){return window.ZEBJUS_CONFIG?.mediaPipe||{};}
  async function visionModule(){if(!visionPromise)visionPromise=import(cfg().moduleUrl);return visionPromise;}

  async function createHand(delegate){
    const c=cfg(),mod=await visionModule(),vision=await mod.FilesetResolver.forVisionTasks(c.wasmRoot);
    return mod.HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:c.modelUrl,delegate},runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:.50,minHandPresenceConfidence:.50,minTrackingConfidence:.50});
  }

  async function createFace(delegate){
    const c=cfg(),mod=await visionModule(),vision=await mod.FilesetResolver.forVisionTasks(c.wasmRoot);
    if(!mod.FaceDetector)throw new Error("MediaPipe FaceDetector is unavailable in the configured Tasks Vision build.");
    return mod.FaceDetector.createFromOptions(vision,{baseOptions:{modelAssetPath:c.faceModelUrl,delegate},runningMode:"VIDEO",minDetectionConfidence:.50,minSuppressionThreshold:.30});
  }

  async function ensureHand(){
    if(handLandmarker)return handLandmarker;
    try{handLandmarker=await createHand("GPU");}
    catch(e){console.warn("MediaPipe Hand GPU failed; using CPU.",e);handLandmarker=await createHand("CPU");}
    state.ready=true;return handLandmarker;
  }

  async function enableFaceDetection(){
    if(faceDetector)return faceDetector;
    try{faceDetector=await createFace("GPU");}
    catch(e){console.warn("MediaPipe Face GPU failed; using CPU.",e);faceDetector=await createFace("CPU");}
    state.faceFrames=0;return faceDetector;
  }

  function rawFingerCount(lm){
    if(!lm||lm.length<21)return 0;let n=0;
    for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]])if(lm[tip].y<lm[pip].y-.012)n++;
    if(Math.hypot(Math.abs(lm[4].x-lm[3].x),Math.abs(lm[4].y-lm[3].y))>.045)n++;
    return Math.max(0,Math.min(5,n));
  }

  function stableFromHistory(){
    const recent=state.history.slice(-7),detected=recent.filter(x=>x.detected);
    if(!detected.length)return{detected:false,fingers:0,side:""};
    const counts=new Map();for(const x of detected)counts.set(x.fingers,(counts.get(x.fingers)||0)+1);
    let fingers=detected[detected.length-1].fingers,best=-1;for(const [k,v] of counts)if(v>best){best=v;fingers=k;}
    const sides=detected.map(x=>x.side).filter(Boolean),side=sides.length?sides[sides.length-1]:"";
    return{detected:detected.length>=Math.max(1,Math.ceil(recent.length*.35)),fingers,side};
  }

  function normalizeFaces(result,video){
    const vw=Math.max(1,video.videoWidth||1),vh=Math.max(1,video.videoHeight||1),faces=[];
    for(const d of result?.detections||[]){
      const b=d.boundingBox||{},score=Number(d.categories?.[0]?.score??d.score?.[0]??0);
      const x=Math.max(0,Number(b.originX)||0),y=Math.max(0,Number(b.originY)||0),w=Math.max(0,Number(b.width)||0),h=Math.max(0,Number(b.height)||0);
      faces.push({xmin:x/vw,ymin:y/vh,width:w/vw,height:h/vh,score,center:[(x+w/2)/vw,(y+h/2)/vh]});
    }
    return faces;
  }

  function draw(canvas,lm,faces,video){
    const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1,ctx=canvas.getContext("2d"),w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.clearRect(0,0,w,h);
    if(lm?.length){ctx.fillStyle="rgba(255,255,255,.95)";for(const p of lm){ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.5*d,0,Math.PI*2);ctx.fill();}}
    if(faces?.length){ctx.strokeStyle="rgba(0,255,170,.95)";ctx.fillStyle="rgba(0,255,170,.95)";ctx.lineWidth=2*d;ctx.font=`${11*d}px sans-serif`;for(const f of faces){const x=f.xmin*w,y=f.ymin*h,bw=f.width*w,bh=f.height*h;ctx.strokeRect(x,y,bw,bh);ctx.fillText(`${Math.round((f.score||0)*100)}%`,x+3*d,Math.max(12*d,y-4*d));}}
  }

  function emit(){window.dispatchEvent(new CustomEvent("zebjus-ai-state",{detail:{detected:state.detected,fingers:state.fingers,side:state.side,rawFingers:state.rawFingers,faces:state.faces,faceCount:state.faces.length,landmarks:state.landmarks.map(p=>({...p}))}}));}

  function loop(video,canvas){
    if(!state.running)return;
    if(video.readyState>=2&&video.currentTime!==lastTime){
      lastTime=video.currentTime;let lm=[];
      if(handLandmarker){
        const hr=handLandmarker.detectForVideo(video,performance.now());lm=hr.landmarks?.[0]||[];
        const detected=lm.length>0,raw=detected?rawFingerCount(lm):0,side=detected?(hr.handednesses?.[0]?.[0]?.categoryName||""):"";
        state.rawFingers=raw;state.landmarks=lm.map(p=>({x:Number(p.x)||0,y:Number(p.y)||0,z:Number(p.z)||0}));state.frames++;state.history.push({detected,fingers:raw,side});if(state.history.length>12)state.history.shift();
        const stable=stableFromHistory();state.detected=stable.detected;state.fingers=stable.fingers;state.side=stable.side;
      }
      if(faceDetector){
        try{state.faces=normalizeFaces(faceDetector.detectForVideo(video,performance.now()),video);state.faceFrames++;}
        catch(e){console.warn("Face detection frame failed",e);}
      }
      draw(canvas,lm,state.faces,video);emit();
    }
    raf=requestAnimationFrame(()=>loop(video,canvas));
  }

  async function start(video,canvas,deviceId=""){
    stop(video,canvas);
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera API unavailable in this browser.");
    const vc=deviceId?{deviceId:{exact:deviceId},width:{ideal:960},height:{ideal:540}}:{facingMode:"user",width:{ideal:960},height:{ideal:540}};
    stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});currentDeviceId=stream.getVideoTracks()[0]?.getSettings()?.deviceId||deviceId||"";
    video.srcObject=stream;await video.play();await ensureHand();
    state.running=true;state.history=[];state.frames=0;state.detected=false;state.fingers=0;state.rawFingers=0;state.faces=[];state.faceFrames=0;lastTime=-1;loop(video,canvas);return currentDeviceId;
  }

  function stop(video,canvas){
    state.running=false;if(raf)cancelAnimationFrame(raf);raf=0;if(stream){for(const t of stream.getTracks())t.stop();stream=null;}if(video)video.srcObject=null;
    if(canvas)canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    state.detected=false;state.fingers=0;state.rawFingers=0;state.side="";state.history=[];state.frames=0;state.faces=[];state.faceFrames=0;state.landmarks=[];currentDeviceId="";emit();
  }

  function getSnapshot(){const s=stableFromHistory();return{detected:s.detected,fingers:s.fingers,side:s.side,rawFingers:state.rawFingers,frames:state.frames,faces:state.faces.map(x=>({...x})),faceCount:state.faces.length,faceFrames:state.faceFrames,landmarks:state.landmarks.map(p=>({...p}))};}
  async function waitForStable(timeoutMs=1400){const t=performance.now();while(performance.now()-t<timeoutMs){const s=getSnapshot();if(s.frames>=5&&(s.detected||performance.now()-t>650))return s;await new Promise(r=>setTimeout(r,70));}return getSnapshot();}
  async function waitForFaces(timeoutMs=1400){await enableFaceDetection();const t=performance.now();while(performance.now()-t<timeoutMs){const s=getSnapshot();if(s.faceFrames>=3||performance.now()-t>850)return s;await new Promise(r=>setTimeout(r,70));}return getSnapshot();}

  window.ZebjusAI={start,stop,getSnapshot,waitForStable,waitForFaces,enableFaceDetection,getDeviceId:()=>currentDeviceId};
})();
