const terminal = document.getElementById("terminal");
const pythonStatus = document.getElementById("pythonStatus");
const kitStatus = document.getElementById("kitStatus");
const kitIdInput = document.getElementById("kitId");
const wsUrlInput = document.getElementById("wsUrl");
const demoModeInput = document.getElementById("demoMode");

let editor;
let worker;
let ws = null;
let running = false;

const starterCode = `from zebjus import *

led = LED(1)

print("Blinking LED 5 times...")

for i in range(5):
    led.on()
    print("LED ON")
    sleep(0.5)

    led.off()
    print("LED OFF")
    sleep(0.5)

print("Done")
`;

const blankCode = `from zebjus import *

# Write your code here
`;

function log(text){
  terminal.textContent += (terminal.textContent ? "\\n" : "") + text;
  terminal.scrollTop = terminal.scrollHeight;
}

function setPythonStatus(text, ok=false){
  pythonStatus.textContent = text;
  pythonStatus.className = "badge " + (ok ? "ok" : "warn");
}

function setKitStatus(text, ok=false){
  kitStatus.textContent = text;
  kitStatus.className = "badge " + (ok ? "ok" : "");
}

function createWorker(){
  if(worker) worker.terminate();
  setPythonStatus("Python loading…");
  worker = new Worker("py-worker.js");
  worker.onmessage = (event) => {
    const msg = event.data || {};
    if(msg.type === "ready"){
      setPythonStatus("Python ready", true);
      log("Python runtime ready.");
    }else if(msg.type === "stdout"){
      if(msg.text !== undefined && msg.text !== "") log(msg.text);
    }else if(msg.type === "stderr"){
      if(msg.text !== undefined && msg.text !== "") log("ERROR: " + msg.text);
    }else if(msg.type === "done"){
      running = false;
      log("Program finished.");
    }else if(msg.type === "error"){
      running = false;
      log("ERROR: " + msg.text);
    }else if(msg.type === "kit-command"){
      handleKitCommand(msg.payload);
    }
  };
  worker.onerror = (e) => {
    running = false;
    log("Worker error: " + e.message);
    setPythonStatus("Python error");
  };
}

function connectKit(){
  if(demoModeInput.checked){
    setKitStatus("Demo kit connected", true);
    log("Demo kit connected.");
    return;
  }

  const url = wsUrlInput.value.trim();
  const kitId = kitIdInput.value.trim();
  if(!url.startsWith("wss://")){
    log("Use a secure wss:// WebSocket URL.");
    return;
  }
  if(!kitId){
    log("Enter a Kit ID.");
    return;
  }

  disconnectKit(false);
  log("Connecting to " + url + " …");

  try{
    ws = new WebSocket(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({type:"hello", kitId}));
      setKitStatus("Kit connected", true);
      log("WebSocket connected for " + kitId);
    };
    ws.onmessage = (event) => log("KIT → " + event.data);
    ws.onerror = () => log("WebSocket error.");
    ws.onclose = () => {
      setKitStatus("Kit disconnected");
      log("WebSocket disconnected.");
    };
  }catch(err){
    log("Connection failed: " + err.message);
  }
}

function disconnectKit(writeLog=true){
  if(ws){
    try{ ws.close(); }catch(e){}
    ws = null;
  }
  setKitStatus("Kit disconnected");
  if(writeLog) log("Kit disconnected.");
}

function sendRealCommand(payload){
  if(!ws || ws.readyState !== WebSocket.OPEN){
    log("Kit not connected. Enable Demo mode or connect WebSocket.");
    return;
  }
  const packet = {
    type:"command",
    kitId:kitIdInput.value.trim(),
    ...payload
  };
  ws.send(JSON.stringify(packet));
}

function handleKitCommand(payload){
  if(!payload) return;

  if(demoModeInput.checked){
    applyDemoCommand(payload);
    log("DEMO → " + JSON.stringify(payload));
  }else{
    sendRealCommand(payload);
    log("SEND → " + JSON.stringify(payload));
  }
}

function applyDemoCommand(p){
  if(p.command === "LED_SET" && Number(p.id) === 1){
    document.getElementById("demoLed").classList.toggle("on", Number(p.value) === 1);
  }

  if(p.command === "MOTOR_SET" && Number(p.id) === 1){
    const speed = Math.max(-100, Math.min(100, Number(p.speed) || 0));
    document.getElementById("motorMeter").style.width = Math.abs(speed) + "%";
    document.getElementById("motorLabel").textContent =
      speed === 0 ? "Motor 1: stopped" : `Motor 1: ${speed > 0 ? "forward" : "backward"} ${Math.abs(speed)}%`;
  }

  if(p.command === "SERVO_SET" && Number(p.id) === 1){
    const angle = Math.max(0, Math.min(180, Number(p.angle) || 0));
    document.getElementById("servoNeedle").style.transform = `rotate(${angle - 90}deg)`;
    document.getElementById("servoLabel").textContent = `Servo 1: ${angle}°`;
  }
}

function runCode(){
  if(running){
    log("A program is already running. Press Stop first.");
    return;
  }
  running = true;
  terminal.textContent = "";
  worker.postMessage({type:"run", code:editor.getValue()});
}

function stopCode(){
  running = false;
  createWorker();
  log("Program stopped.");
  applyDemoCommand({command:"LED_SET", id:1, value:0});
  applyDemoCommand({command:"MOTOR_SET", id:1, speed:0});
}

document.getElementById("connectBtn").onclick = connectKit;
document.getElementById("disconnectBtn").onclick = () => disconnectKit();
document.getElementById("runBtn").onclick = runCode;
document.getElementById("stopBtn").onclick = stopCode;
document.getElementById("clearBtn").onclick = () => terminal.textContent = "";
document.getElementById("exampleBtn").onclick = () => editor.setValue(starterCode);
document.getElementById("resetBtn").onclick = () => editor.setValue(blankCode);

demoModeInput.onchange = () => {
  if(demoModeInput.checked){
    disconnectKit(false);
    setKitStatus("Demo mode");
    log("Demo mode enabled.");
  }else{
    setKitStatus("Kit disconnected");
    log("Demo mode disabled. Connect your real kit.");
  }
};

window.MonacoEnvironment = {
  getWorkerUrl: function() {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
      self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' };
      importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');
    `)}`;
  }
};

require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" }});

require(["vs/editor/editor.main"], function(){
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: starterCode,
    language: "python",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: 14,
    minimap: {enabled:false},
    lineNumbers: "on",
    tabSize: 4,
    insertSpaces: true,
    quickSuggestions: {other:true, comments:false, strings:true},
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: "currentDocument",
    padding: {top:12}
  });

  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],
    provideCompletionItems: function(model, position){
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: model.getWordUntilPosition(position).startColumn,
        endColumn: model.getWordUntilPosition(position).endColumn
      };

      const suggestions = [
        {label:"LED", kind:monaco.languages.CompletionItemKind.Class, insertText:"LED(${1:1})", insertTextRules:4, detail:"ZEBJUS LED class", range},
        {label:"Motor", kind:monaco.languages.CompletionItemKind.Class, insertText:"Motor(${1:1})", insertTextRules:4, detail:"ZEBJUS Motor class", range},
        {label:"Servo", kind:monaco.languages.CompletionItemKind.Class, insertText:"Servo(${1:1})", insertTextRules:4, detail:"ZEBJUS Servo class", range},
        {label:"sleep", kind:monaco.languages.CompletionItemKind.Function, insertText:"sleep(${1:1})", insertTextRules:4, detail:"Pause program in seconds", range},
        {label:"print", kind:monaco.languages.CompletionItemKind.Function, insertText:"print(${1})", insertTextRules:4, range},
        {label:"for loop", kind:monaco.languages.CompletionItemKind.Snippet, insertText:"for ${1:i} in range(${2:5}):\\n\\t${3:print(i)}", insertTextRules:4, detail:"Python for loop", range},
        {label:"while loop", kind:monaco.languages.CompletionItemKind.Snippet, insertText:"while ${1:True}:\\n\\t${2:pass}", insertTextRules:4, detail:"Python while loop", range},
        {label:"if", kind:monaco.languages.CompletionItemKind.Snippet, insertText:"if ${1:condition}:\\n\\t${2:pass}", insertTextRules:4, detail:"Python if statement", range},
        {label:"on", kind:monaco.languages.CompletionItemKind.Method, insertText:"on()", detail:"LED ON", range},
        {label:"off", kind:monaco.languages.CompletionItemKind.Method, insertText:"off()", detail:"LED OFF", range},
        {label:"blink", kind:monaco.languages.CompletionItemKind.Method, insertText:"blink(${1:5}, ${2:0.5})", insertTextRules:4, detail:"Blink LED", range},
        {label:"forward", kind:monaco.languages.CompletionItemKind.Method, insertText:"forward(${1:60})", insertTextRules:4, detail:"Motor forward 0-100%", range},
        {label:"backward", kind:monaco.languages.CompletionItemKind.Method, insertText:"backward(${1:60})", insertTextRules:4, detail:"Motor backward 0-100%", range},
        {label:"stop", kind:monaco.languages.CompletionItemKind.Method, insertText:"stop()", detail:"Stop motor", range},
        {label:"write", kind:monaco.languages.CompletionItemKind.Method, insertText:"write(${1:90})", insertTextRules:4, detail:"Servo angle 0-180°", range}
      ];
      return {suggestions};
    }
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCode);
});

createWorker();
