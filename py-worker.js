import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/pyodide.mjs";

let pyodide=null,readyPromise=null,opencvReady=false,importLoadCache=new Set();
let activeLiveSession="",preparedRunSession="",livePrefixDone=false,livePrefixCode="",liveCycleCode="";

async function initialize(){
  if(pyodide)return pyodide;
  if(readyPromise)return readyPromise;

  readyPromise=(async()=>{
    const base="https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
    pyodide=await loadPyodide({indexURL:base});
    pyodide.setStdout({batched:text=>postMessage({type:"runtime-stdout",text})});
    pyodide.setStderr({batched:text=>postMessage({type:"stderr",text})});

    await pyodide.runPythonAsync(`
import sys,types,time,io,base64,js,math,json,traceback
from js import postMessage
from pyodide.ffi import to_js

_ai_state={"detected":False,"fingers":0,"side":"","landmarks":[]}
_face_state=[]
_hand_landmarks=[]
_sensor_state={"simulation":True,"ultrasonic_cm":None,"dht_temperature":None,"dht_humidity":None,"dht_pin":13,"pot_value":None,"pot_raw":None,"pot_pin":34,"pot_percent":None,"pot_mv":None}
_input_state={"analog":{},"digital":{},"rotary":{},"ultrasonic":{},"dht11":{}}
_bridge_state={"gpio":{},"adc":{},"pwm":{},"i2c":{},"uart":{},"spi":{},"pulse":{},"counter":{},"transaction":{}}
_i2c_bus_defaults={0:(21,22),1:(25,26)}
_i2c_bus_claimed={}
_gps_state={}
_current_frame=None
_loaded_image=None

class _ZebjusTerminalStream:
    def __init__(self,kind="stdout"): self.kind=kind
    def write(self,text):
        text=str(text)
        if text:
            postMessage(to_js({"type":self.kind,"text":text},dict_converter=js.Object.fromEntries))
        return len(text)
    def flush(self): pass
    def isatty(self): return False
    @property
    def encoding(self): return "utf-8"

_zebjus_stdout=_ZebjusTerminalStream("stdout")
_zebjus_stderr=_ZebjusTerminalStream("stderr")

def _clamp255(v): return max(0,min(255,int(v)))

def _send(command,**kwargs):
    postMessage(to_js(
        {"type":"kit-command","payload":{"command":command,**kwargs}},
        dict_converter=js.Object.fromEntries
    ))


def _sensor_live(sensor,**values):
    clean={"sensor":str(sensor)}
    for k,v in values.items():
        if isinstance(v,float) and (math.isnan(v) or math.isinf(v)): clean[str(k)]=None
        elif isinstance(v,(int,float,bool,str)) or v is None: clean[str(k)]=v
        else: clean[str(k)]=str(v)
    postMessage(to_js({"type":"sensor-live","sensor":str(sensor),"json":json.dumps(clean)},dict_converter=js.Object.fromEntries))
    return clean

def _simulating(): return bool(_sensor_state.get("simulation",False))
def _sim_phase(seed=0.0,speed=1.0): return time.monotonic()*float(speed)+float(seed)
def _finite_number(v):
    try: return math.isfinite(float(v))
    except Exception: return False

SUPPORTED_RGB_PINS=(4,13,14,16,17,18,19,21,22,23,25,26,27,32,33)
_RGB_COLORS={
    "red":(255,0,0),"green":(0,255,0),"blue":(0,0,255),"white":(255,255,255),
    "yellow":(255,255,0),"cyan":(0,255,255),"purple":(128,0,255),"magenta":(255,0,255),
    "orange":(255,120,0),"pink":(255,40,120),"off":(0,0,0),"black":(0,0,0)
}

class RGBLED:
    def __init__(self,*args,red=None,green=None,blue=None,common_anode=False):
        self.id=1;self.pins=None;self.common_anode=bool(common_anode)
        named=(red is not None or green is not None or blue is not None)
        if named:
            if red is None or green is None or blue is None: raise ValueError("RGBLED named pins require red=, green= and blue= together")
            if args: raise ValueError("Use either RGBLED(25,26,27) or named red=/green=/blue= pins, not both")
            self.pins=(int(red),int(green),int(blue))
        elif len(args)==0:
            self.id=1
        elif len(args)==1:
            self.id=int(args[0])
        elif len(args)==3:
            self.pins=tuple(int(x) for x in args)
        else:
            raise ValueError("RGBLED expects RGBLED(1) or RGBLED(redPin, greenPin, bluePin)")
        if self.pins is not None:
            if len(set(self.pins))!=3: raise ValueError("RGB LED red, green and blue pins must be different")
            bad=[p for p in self.pins if p not in SUPPORTED_RGB_PINS]
            if bad: raise ValueError(f"Unsupported RGB pin(s): {bad}. Use one of {SUPPORTED_RGB_PINS}")
    def write(self,r=0,g=0,b=0):
        r,g,b=_clamp255(r),_clamp255(g),_clamp255(b)
        data={"id":self.id,"r":r,"g":g,"b":b,"commonAnode":self.common_anode}
        if self.pins is not None: data.update({"rPin":self.pins[0],"gPin":self.pins[1],"bPin":self.pins[2]})
        _send("RGB_LED_SET",**data)
    def set(self,r=0,g=0,b=0): self.write(r,g,b)
    def color(self,name,brightness=255):
        key=str(name).strip().lower()
        if key not in _RGB_COLORS: raise ValueError("Unknown RGB color: "+str(name))
        level=_clamp255(brightness)/255.0;r,g,b=_RGB_COLORS[key]
        self.write(round(r*level),round(g*level),round(b*level))
    def red(self,value=255): self.write(value,0,0)
    def green(self,value=255): self.write(0,value,0)
    def blue(self,value=255): self.write(0,0,value)
    def white(self,value=255): self.write(value,value,value)
    def off(self): self.write(0,0,0)

# Backward-compatible LED API maps to the RGB LED.
class LED:
    def __init__(self,id=1): self.rgb=RGBLED(id)
    def on(self): self.rgb.white(255)
    def off(self): self.rgb.off()
    def blink(self,count=3,interval=.5):
        for _ in range(int(count)):
            self.on();time.sleep(float(interval));self.off();time.sleep(float(interval))

class _SingleLED:
    def __init__(self,pin,slot=1,active_high=True):
        self.pin=int(pin);self.slot=int(slot);self.active_high=bool(active_high)
        if self.pin not in SUPPORTED_RGB_PINS: raise ValueError(f"LED pin {self.pin} must be output-capable. Use one of {SUPPORTED_RGB_PINS}")
    def write(self,value=255): _send("LED_SET",id=self.slot,pin=self.pin,value=_clamp255(value),activeHigh=self.active_high)
    def brightness(self,value=255): self.write(value)
    def on(self): self.write(255)
    def off(self): self.write(0)
    def blink(self,count=3,interval=.5):
        for _ in range(int(count)):
            self.on();time.sleep(float(interval));self.off();time.sleep(float(interval))

def _make_led_class(slot):
    class NumberedLED(_SingleLED):
        def __init__(self,pin,active_high=True): super().__init__(pin,slot=slot,active_high=active_high)
    NumberedLED.__name__=f"LED{slot}";NumberedLED.__qualname__=NumberedLED.__name__;return NumberedLED

def _make_rgb_class(slot):
    class NumberedRGBLED(RGBLED):
        def __init__(self,*args,**kwargs):
            if slot>1 and len(args)==0 and not any(k in kwargs for k in ("red","green","blue")): raise ValueError(f"RGBLED{slot} needs three GPIO pins, e.g. RGBLED{slot}(32,33,4)")
            super().__init__(*args,**kwargs);self.id=slot
    NumberedRGBLED.__name__=f"RGBLED{slot}";NumberedRGBLED.__qualname__=NumberedRGBLED.__name__;return NumberedRGBLED

LED_CLASSES={i:_make_led_class(i) for i in range(1,16)}
RGBLED_CLASSES={i:_make_rgb_class(i) for i in range(1,6)}

class Motor:
    def __init__(self,id=1): self.id=int(id)
    def forward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=max(0,min(100,int(speed))))
    def backward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=-max(0,min(100,int(speed))))
    def stop(self): _send("MOTOR_SET",id=self.id,speed=0)

class Servo:
    def __init__(self,id=1): self.id=int(id)
    def write(self,angle=90): _send("SERVO_SET",id=self.id,angle=max(0,min(180,int(angle))))

SUPPORTED_OUTPUT_PINS=(4,13,14,16,17,18,19,21,22,23,25,26,27,32,33)
SUPPORTED_ADC_PINS=(32,33,34,35,36,39)
SUPPORTED_DIGITAL_PINS=(4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39)
SUPPORTED_ULTRASONIC_ECHO_PINS=(12,)+SUPPORTED_DIGITAL_PINS
SUPPORTED_COUNTER_PINS=(4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35)

def _analog_data(pin): return _input_state.get("analog",{}).get(str(int(pin)),{})
def _digital_data(pin): return _input_state.get("digital",{}).get(str(int(pin)),{})
def _rotary_key(clk,dt,sw): return f"{int(clk)},{int(dt)},{int(sw)}"
def _rotary_data(clk,dt,sw): return _input_state.get("rotary",{}).get(_rotary_key(clk,dt,sw),{})
def _ultrasonic_key(trig,echo): return f"{int(trig)},{int(echo)}"
def _ultrasonic_data(trig,echo): return _input_state.get("ultrasonic",{}).get(_ultrasonic_key(trig,echo),{})
def _dht_data(pin): return _input_state.get("dht11",{}).get(str(int(pin)),{})

class Ultrasonic:
    def __init__(self,*args,trig=18,echo=19,max_cm=400):
        # Backward compatible Ultrasonic() / Ultrasonic(1), plus physical Ultrasonic(18,19).
        if len(args)==1:
            self.id=int(args[0])
        elif len(args)==2:
            trig,echo=int(args[0]),int(args[1]);self.id=1
        elif len(args)==0:
            self.id=1
        else:
            raise ValueError("Ultrasonic expects Ultrasonic(), Ultrasonic(18,19), or named trig=/echo= pins")
        self.trig=int(trig);self.echo=int(echo);self.max_cm=max(2,int(max_cm))
        if self.trig not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"Unsupported ultrasonic TRIG pin {self.trig}. Use one of {SUPPORTED_OUTPUT_PINS}")
        if self.echo not in SUPPORTED_ULTRASONIC_ECHO_PINS: raise ValueError(f"Unsupported ultrasonic ECHO pin {self.echo}. Use one of {SUPPORTED_ULTRASONIC_ECHO_PINS}")
        if self.trig==self.echo: raise ValueError("Ultrasonic TRIG and ECHO pins must be different")
    def read(self):
        d=_ultrasonic_data(self.trig,self.echo)
        if _simulating():
            cm=max(2.0,min(float(self.max_cm),35.0+25.0*(1.0+math.sin(_sim_phase(self.trig*.17,.8)))))
            _sensor_live("ULTRASONIC",trig=self.trig,echo=self.echo,distanceCm=round(cm,1),valid=True,simulated=True,maxCm=self.max_cm)
            return cm
        valid=bool(d.get("valid",False)) and _finite_number(d.get("distanceCm",d.get("distance_cm")))
        stale=bool(d.get("stale",False)) and _finite_number(d.get("distanceCm",d.get("distance_cm")))
        cm=float(d.get("distanceCm",d.get("distance_cm"))) if (valid or stale) else float("nan")
        _sensor_live("ULTRASONIC",trig=self.trig,echo=self.echo,distanceCm=cm if math.isfinite(cm) else None,valid=valid,stale=stale,simulated=False,maxCm=self.max_cm,message=str(d.get("message","")))
        return cm
    def centimeters(self): return self.read()
    @property
    def distance_cm(self): return self.read()

class DHT11:
    """DHT11 temperature/humidity sensor. Offline runs are simulated; connected runs never substitute fake values for failed hardware reads."""
    def __init__(self,pin=13):
        self.pin=int(pin)
        if self.pin not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"DHT11 DATA pin {self.pin} must be output-capable. Use one of {SUPPORTED_OUTPUT_PINS}")
    def read(self):
        if _simulating():
            ph=_sim_phase(self.pin*.11,.16);temperature=27.0+2.2*math.sin(ph);humidity=60.0+8.0*math.cos(ph*.83)
            out={"temperature":temperature,"humidity":humidity,"valid":True,"stale":False,"simulated":True,"pin":self.pin}
            _sensor_live("DHT11",**out);return out
        d=_dht_data(self.pin);has_t=_finite_number(d.get("temperature"));has_h=_finite_number(d.get("humidity"));has_values=has_t and has_h
        valid=bool(d.get("valid",False)) and has_values;stale=bool(d.get("stale",False)) and has_values
        temperature=float(d.get("temperature")) if has_values else float("nan");humidity=float(d.get("humidity")) if has_values else float("nan")
        out={"temperature":temperature,"humidity":humidity,"valid":valid,"stale":stale,"simulated":False,"pin":self.pin,"message":str(d.get("message",""))}
        _sensor_live("DHT11",temperature=temperature if math.isfinite(temperature) else None,humidity=humidity if math.isfinite(humidity) else None,valid=valid,stale=stale,simulated=False,pin=self.pin,message=out["message"]);return out
    def temperature(self): return float(self.read()["temperature"])
    def humidity(self): return float(self.read()["humidity"])
    def get_values(self):
        d=self.read()
        if not (_finite_number(d.get("humidity")) and _finite_number(d.get("temperature"))): return []
        return [int(round(d["humidity"]*10)),int(round(d["temperature"]*10))]
    @property
    def temperature_c(self): return self.temperature()
    @property
    def humidity_percent(self): return self.humidity()


def plot(*values,**series):
    data={}
    if len(values)==1 and isinstance(values[0],dict): data.update(values[0])
    elif values:
        for i,v in enumerate(values,1): data[f"Value{i}"]=v
    data.update(series)
    numeric={}
    for k,v in data.items():
        try: numeric[str(k)]=float(v)
        except Exception: pass
    if numeric:
        postMessage(to_js({"type":"plot","json":json.dumps(numeric)},dict_converter=js.Object.fromEntries))
    return numeric

def clear_plot():
    postMessage(to_js({"type":"plot-clear"},dict_converter=js.Object.fromEntries))

class SerialPlotter:
    def __init__(self,*args,**kwargs): pass
    def plot(self,*values,**series): return plot(*values,**series)
    def clear(self): clear_plot()

class OLED:
    """SSD1306 128x64 I2C display. Commands mirror to the Lab OLED preview and the physical kit."""
    def __init__(self,sda=21,scl=22,address=0x3C,width=128,height=64):
        self.sda=int(sda);self.scl=int(scl);self.address=int(address);self.width=int(width);self.height=int(height)
        if self.sda not in SUPPORTED_OUTPUT_PINS or self.scl not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"OLED SDA/SCL must use output-capable pins: {SUPPORTED_OUTPUT_PINS}")
        if self.sda==self.scl: raise ValueError("OLED SDA and SCL pins must be different")
        if self.width!=128 or self.height!=64: raise ValueError("This firmware currently supports SSD1306 128x64 OLED displays")
        known=_i2c_bus_claimed.get(0)
        if known is not None and tuple(known)!=(self.sda,self.scl): raise ValueError(f"I2C bus 0 already uses SDA{known[0]}/SCL{known[1]}; OLED requested SDA{self.sda}/SCL{self.scl}")
        if 0 not in _i2c_bus_claimed: _i2c_bus_claimed[0]=(self.sda,self.scl)
        _send("OLED_INIT",sda=self.sda,scl=self.scl,address=self.address,width=self.width,height=self.height)
    def _cmd(self,command,**kwargs): _send(command,sda=self.sda,scl=self.scl,address=self.address,width=self.width,height=self.height,**kwargs)
    def clear(self,show=False): self._cmd("OLED_CLEAR",show=bool(show))
    def show(self): self._cmd("OLED_SHOW")
    def text(self,text,x=0,y=0,size=1,show=False): self._cmd("OLED_TEXT",text=str(text),x=int(x),y=int(y),size=max(1,min(4,int(size))),show=bool(show))
    def pixel(self,x,y,on=True,show=False): self._cmd("OLED_PIXEL",x=int(x),y=int(y),on=bool(on),show=bool(show))
    def line(self,x1,y1,x2,y2,on=True,show=False): self._cmd("OLED_LINE",x1=int(x1),y1=int(y1),x2=int(x2),y2=int(y2),on=bool(on),show=bool(show))
    def rect(self,x,y,w,h,fill=False,on=True,show=False): self._cmd("OLED_RECT",x=int(x),y=int(y),w=int(w),h=int(h),fill=bool(fill),on=bool(on),show=bool(show))
    def circle(self,x,y,r,fill=False,on=True,show=False): self._cmd("OLED_CIRCLE",x=int(x),y=int(y),r=int(r),fill=bool(fill),on=bool(on),show=bool(show))
    def invert(self,enabled=True): self._cmd("OLED_INVERT",enabled=bool(enabled))
    def contrast(self,value=127): self._cmd("OLED_CONTRAST",value=max(0,min(255,int(value))))
    def display_text(self,text,x=0,y=0,size=1,clear=True): self._cmd("OLED_DISPLAY_TEXT",text=str(text),x=int(x),y=int(y),size=max(1,min(4,int(size))),clear=bool(clear))
    def distance_bar(self,distance_cm,max_cm=400,title="Distance"):
        self._cmd("OLED_DISTANCE_BAR",distance=float(distance_cm),maxCm=max(1,float(max_cm)),title=str(title))
    def radar(self,angle,distance_cm,max_cm=200,title="RADAR"):
        self._cmd("OLED_RADAR",angle=max(0,min(180,float(angle))),distance=max(0.0,float(distance_cm)),maxCm=max(1.0,float(max_cm)),title=str(title))
    def scroll_text(self,text,y=24,size=1,speed=0.08,step=6,direction="left"):
        text=str(text);size=max(1,min(4,int(size)));step=max(1,int(step));speed=max(0.01,float(speed));direction=str(direction).lower()
        approx_w=max(1,len(text)*6*size)
        positions=range(self.width,-approx_w-1,-step) if direction!="right" else range(-approx_w,self.width+1,step)
        for x in positions:
            self.display_text(text,x,y,size,True);time.sleep(speed)

class AnalogInput:
    def __init__(self,pin=34):
        pin=int(pin)
        if pin not in SUPPORTED_ADC_PINS: raise ValueError(f"Unsupported analog input pin {pin}. Use one of {SUPPORTED_ADC_PINS}")
        self.pin=pin
    def _sample(self):
        d=_analog_data(self.pin)
        if _simulating():
            raw=int(round(2047.5+1900.0*math.sin(_sim_phase(self.pin*.13,.45))));raw=max(0,min(4095,raw));value=round(raw*255/4095);pct=round(raw*100/4095);mv=round(raw*3300/4095)
            out={"sensor":"ANALOG","pin":self.pin,"raw":raw,"value255":value,"value":value,"percent":pct,"millivolts":mv,"valid":True,"simulated":True};_sensor_live("ANALOG",**{k:v for k,v in out.items() if k!="sensor"});return out
        out=dict(d) if d else {"pin":self.pin,"valid":False,"simulated":False}
        if d: out.setdefault("valid",True);out["simulated"]=False
        _sensor_live("ANALOG",**out);return out
    def read(self):
        d=self._sample();return int(d.get("value255",d.get("value",0)))
    def raw(self):
        d=self._sample();return int(d.get("raw",round(self.read()*4095/255)))
    def percent(self):
        d=self._sample();return int(d.get("percent",round(self.read()*100/255)))
    def millivolts(self):
        d=self._sample();return int(d.get("millivolts",d.get("mv",0)))
    @property
    def value(self): return self.read()


class Potentiometer(AnalogInput):
    def __init__(self,pin=34):
        pin=int(pin)
        if pin==1: pin=34
        super().__init__(pin)

class DigitalInput:
    def __init__(self,pin=32,pullup=False,active_low=False):
        pin=int(pin)
        if pin not in SUPPORTED_DIGITAL_PINS: raise ValueError(f"Unsupported digital input pin {pin}. Use one of {SUPPORTED_DIGITAL_PINS}")
        self.pin=pin; self.pullup=bool(pullup); self.active_low=bool(active_low)
    def _sample(self):
        d=_digital_data(self.pin)
        if _simulating():
            active=(int(_sim_phase(self.pin*.07,.5))%2)==0;state=(0 if active else 1) if self.active_low else (1 if active else 0);out={"pin":self.pin,"state":state,"active":active,"pressed":active,"valid":True,"simulated":True};_sensor_live("DIGITAL",**out);return out
        out=dict(d) if d else {"pin":self.pin,"valid":False,"simulated":False};out["simulated"]=False;_sensor_live("DIGITAL",**out);return out
    def state(self):
        d=self._sample();return int(d.get("state",1 if self.pullup else 0))
    def read(self):
        d=self._sample()
        if "active" in d:return bool(d.get("active"))
        state=int(d.get("state",1 if self.pullup else 0));return state==(0 if self.active_low else 1)
    def active(self): return self.read()
    @property
    def value(self): return self.read()


class Switch(DigitalInput):
    def __init__(self,pin=32,pullup=True,active_low=True): super().__init__(pin,pullup,active_low)
    def pressed(self): return self.read()

class RotaryEncoder:
    def __init__(self,clk=32,dt=33,switch=None,pullup=True):
        clk,dt=int(clk),int(dt); sw=-1 if switch is None else int(switch)
        if clk not in SUPPORTED_DIGITAL_PINS or dt not in SUPPORTED_DIGITAL_PINS or clk==dt: raise ValueError("Invalid rotary CLK/DT pins")
        if sw>=0 and (sw not in SUPPORTED_DIGITAL_PINS or sw in (clk,dt)): raise ValueError("Invalid rotary switch pin")
        self.clk=clk; self.dt=dt; self.switch=None if sw<0 else sw; self.pullup=bool(pullup); self._sw=sw;self._sim_last=0
    def _sample(self):
        d=_rotary_data(self.clk,self.dt,self._sw)
        if _simulating():
            pos=int(_sim_phase((self.clk+self.dt)*.05,.6))%24;delta=pos-self._sim_last;self._sim_last=pos;direction="CW" if delta>0 else ("CCW" if delta<0 else "NONE");pressed=(int(_sim_phase(self.clk,.2))%7)==0;out={"clk":self.clk,"dt":self.dt,"sw":self._sw,"position":pos,"delta":delta,"direction":direction,"pressed":pressed,"switchState":0 if pressed else 1,"valid":True,"simulated":True};_sensor_live("ROTARY",**out);return out
        out=dict(d) if d else {"clk":self.clk,"dt":self.dt,"sw":self._sw,"valid":False,"simulated":False};out["simulated"]=False;_sensor_live("ROTARY",**out);return out
    def position(self): return int(self._sample().get("position",0))
    def delta(self): return int(self._sample().get("delta",0))
    def direction(self): return str(self._sample().get("direction","NONE"))
    def pressed(self): return bool(self._sample().get("pressed",False))
    def switch_state(self): return int(self._sample().get("switchState",1))
    @property
    def value(self): return self.position()



# ---------------- UNIVERSAL HARDWARE BRIDGE v2 ----------------
def _bridge_get(group,key,default=None):
    try: return _bridge_state.get(group,{}).get(str(key),default)
    except Exception: return default

def _bridge_cmd(command,key,**kwargs):
    _send(command,key=str(key),**kwargs)

def _bytes(v):
    if v is None: return []
    if isinstance(v,(bytes,bytearray)): return [int(x)&255 for x in v]
    if isinstance(v,str): return [ord(x)&255 for x in v]
    return [int(x)&255 for x in list(v)]

def dashboard(name,**values):
    clean={}
    for k,v in values.items():
        if isinstance(v,(int,float,bool,str)): clean[str(k)]=v
        else: clean[str(k)]=str(v)
    postMessage(to_js({"type":"sensor-card","name":str(name),"json":json.dumps(clean)},dict_converter=js.Object.fromEntries))
    return clean

class DigitalOutput:
    __zebjus_ui__={"type":"digital_output"}
    def __init__(self,pin,active_high=True,initial=False):
        self.pin=int(pin);self.active_high=bool(active_high)
        if self.pin not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"DigitalOutput pin {self.pin} must be one of {SUPPORTED_OUTPUT_PINS}")
        self.write(initial)
    def write(self,value):
        logical=bool(value);physical=logical if self.active_high else not logical
        safe_physical=0 if self.active_high else 1
        _bridge_cmd("BRIDGE_GPIO_WRITE",f"gpio:{self.pin}",pin=self.pin,value=1 if physical else 0,safeValue=safe_physical)
        return logical
    def on(self): return self.write(True)
    def off(self): return self.write(False)
    def toggle(self):
        d=_bridge_get("gpio",f"gpio:{self.pin}",{}) or {};physical=bool(d.get("value",0));logical=physical if self.active_high else not physical;return self.write(not logical)

class Relay(DigitalOutput): pass

class GPIOInput:
    __zebjus_ui__={"type":"digital_input"}
    def __init__(self,pin,pull=None,active_low=False):
        self.pin=int(pin);self.pull=str(pull or "input").lower();self.active_low=bool(active_low)
        if self.pin not in SUPPORTED_ULTRASONIC_ECHO_PINS: raise ValueError("Unsupported GPIO input pin")
    def state(self):
        key=f"gpio:{self.pin}";_bridge_cmd("BRIDGE_GPIO_READ",key,pin=self.pin,mode=self.pull)
        if _simulating(): return 1 if (int(_sim_phase(self.pin*.09,.45))%2)==0 else 0
        d=_bridge_get("gpio",key,{}) or {};return int(d.get("value",0))
    def read(self):
        v=bool(self.state());return not v if self.active_low else v
    @property
    def value(self): return self.read()

class ADC:
    __zebjus_ui__={"type":"analog"}
    def __init__(self,pin):
        self.pin=int(pin)
        if self.pin not in SUPPORTED_ADC_PINS: raise ValueError(f"ADC pin must be one of {SUPPORTED_ADC_PINS}")
    def _read(self):
        key=f"adc:{self.pin}";_bridge_cmd("BRIDGE_ADC_READ",key,pin=self.pin)
        if _simulating():
            raw=max(0,min(4095,int(round(2048+1850*math.sin(_sim_phase(self.pin*.13,.45))))));return {"raw":raw,"millivolts":round(raw*3300/4095),"valid":True,"simulated":True}
        return _bridge_get("adc",key,{}) or {}
    def raw(self): return int(self._read().get("raw",0))
    def millivolts(self): return int(self._read().get("millivolts",0))
    def read(self): return self.raw()
    def percent(self): return max(0.0,min(100.0,self.raw()*100.0/4095.0))
    @property
    def value(self): return self.raw()

class PWM:
    __zebjus_ui__={"type":"pwm_output"}
    def __init__(self,pin,frequency=1000,resolution=8,duty=0):
        self.pin=int(pin);self.frequency=int(frequency);self.resolution=max(1,min(14,int(resolution)))
        if self.pin not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"PWM pin must be one of {SUPPORTED_OUTPUT_PINS}")
        self.write(duty)
    @property
    def max_duty(self): return (1<<self.resolution)-1
    def write(self,duty):
        duty=max(0,min(self.max_duty,int(duty)));_bridge_cmd("BRIDGE_PWM_SET",f"pwm:{self.pin}",pin=self.pin,duty=duty,frequency=self.frequency,resolution=self.resolution,safeDuty=0);return duty
    def duty(self,value): return self.write(value)
    def percent(self,value): return self.write(round(self.max_duty*max(0,min(100,float(value)))/100.0))
    def off(self): return self.write(0)

class PWMServo:
    __zebjus_ui__={"type":"servo"}
    def __init__(self,pin,min_us=500,max_us=2500,frequency=50):
        self.pin=int(pin);self.min_us=int(min_us);self.max_us=int(max_us);self.frequency=int(frequency);self.pwm=PWM(pin,frequency,14,0)
    def write(self,angle=90):
        angle=max(0.0,min(180.0,float(angle)));us=self.min_us+(self.max_us-self.min_us)*(angle/180.0);period=1000000.0/self.frequency;duty=round(self.pwm.max_duty*us/period);self.pwm.write(duty);_send("UI_SERVO_SET",id=self.pin,pin=self.pin,angle=angle);return angle
    def angle(self,value): return self.write(value)
    def write_us(self,microseconds):
        period=1000000.0/self.frequency;us=max(0,float(microseconds));duty=round(self.pwm.max_duty*us/period);out=self.pwm.write(duty);angle=max(0.0,min(180.0,(us-self.min_us)*180.0/max(1,self.max_us-self.min_us)));_send("UI_SERVO_SET",id=self.pin,pin=self.pin,angle=angle);return out
    def detach(self): self.pwm.off();_send("UI_SERVO_SET",id=self.pin,pin=self.pin,angle=0,detached=True)

class MotorDriver:
    __zebjus_ui__={"type":"motor"}
    def __init__(self,in1,in2,pwm_pin,frequency=18000):
        self.in1=DigitalOutput(in1);self.in2=DigitalOutput(in2);self.pwm=PWM(pwm_pin,frequency,8,0)
    def forward(self,speed=100): speed=max(0,min(100,float(speed)));self.in1.on();self.in2.off();self.pwm.percent(speed);_send("UI_MOTOR_SET",id=self.pwm.pin,pwmPin=self.pwm.pin,in1=self.in1.pin,in2=self.in2.pin,speed=speed,mode="forward")
    def backward(self,speed=100): speed=max(0,min(100,float(speed)));self.in1.off();self.in2.on();self.pwm.percent(speed);_send("UI_MOTOR_SET",id=self.pwm.pin,pwmPin=self.pwm.pin,in1=self.in1.pin,in2=self.in2.pin,speed=-speed,mode="backward")
    def stop(self): self.pwm.off();self.in1.off();self.in2.off();_send("UI_MOTOR_SET",id=self.pwm.pin,pwmPin=self.pwm.pin,in1=self.in1.pin,in2=self.in2.pin,speed=0,mode="stop")
    def brake(self): self.pwm.off();self.in1.on();self.in2.on();_send("UI_MOTOR_SET",id=self.pwm.pin,pwmPin=self.pwm.pin,in1=self.in1.pin,in2=self.in2.pin,speed=0,mode="brake")

class I2C:
    __zebjus_ui__={"type":"i2c"}
    def __init__(self,sda=None,scl=None,frequency=400000,bus=0):
        self.bus=1 if int(bus)==1 else 0;known=_i2c_bus_claimed.get(self.bus,_i2c_bus_defaults[self.bus])
        self.sda=int(known[0] if sda is None else sda);self.scl=int(known[1] if scl is None else scl);self.frequency=int(frequency)
        if self.sda not in SUPPORTED_OUTPUT_PINS or self.scl not in SUPPORTED_OUTPUT_PINS or self.sda==self.scl: raise ValueError("I2C SDA/SCL must be different safe GPIO pins")
        claimed=_i2c_bus_claimed.get(self.bus)
        if claimed is not None and tuple(claimed)!=(self.sda,self.scl): raise ValueError(f"I2C bus {self.bus} already uses SDA{claimed[0]}/SCL{claimed[1]}; requested SDA{self.sda}/SCL{self.scl}")
        if self.bus not in _i2c_bus_claimed: _i2c_bus_claimed[self.bus]=(self.sda,self.scl)
    def _key(self,op,address=0,reg=-1,length=0): return f"i2c:{self.bus}:{self.sda}:{self.scl}:{op}:{int(address)}:{int(reg)}:{int(length)}"
    def scan(self):
        key=self._key("scan");_bridge_cmd("BRIDGE_I2C",key,op="scan",bus=self.bus,sda=self.sda,scl=self.scl,frequency=self.frequency);d=_bridge_get("i2c",key,{}) or {};return list(d.get("addresses",[]))
    def writeto(self,address,data,stop=True):
        key=self._key("write",address);_bridge_cmd("BRIDGE_I2C",key,op="write",bus=self.bus,sda=self.sda,scl=self.scl,frequency=self.frequency,address=int(address),data=_bytes(data),stop=bool(stop));return True
    def readfrom(self,address,length):
        key=self._key("read",address,-1,length);_bridge_cmd("BRIDGE_I2C",key,op="read",bus=self.bus,sda=self.sda,scl=self.scl,frequency=self.frequency,address=int(address),length=int(length));d=_bridge_get("i2c",key,{}) or {};return bytes(int(x)&255 for x in d.get("data",[]))
    def write_register(self,address,register,value,reg_width=1):
        data=_bytes(value if isinstance(value,(list,tuple,bytes,bytearray)) else [value]);key=self._key("writereg",address,register,len(data));_bridge_cmd("BRIDGE_I2C",key,op="writereg",bus=self.bus,sda=self.sda,scl=self.scl,frequency=self.frequency,address=int(address),reg=int(register),regWidth=int(reg_width),data=data,stop=True);return True
    def read_registers(self,address,register,length,reg_width=1):
        key=self._key("readreg",address,register,length);_bridge_cmd("BRIDGE_I2C",key,op="readreg",bus=self.bus,sda=self.sda,scl=self.scl,frequency=self.frequency,address=int(address),reg=int(register),regWidth=int(reg_width),length=int(length));d=_bridge_get("i2c",key,{}) or {};return [int(x)&255 for x in d.get("data",[])]

class I2CDevice:
    def __init__(self,address,sda=None,scl=None,frequency=400000,bus=0): self.address=int(address);self.bus=I2C(sda,scl,frequency,bus)
    def read(self,length): return self.bus.readfrom(self.address,length)
    def write(self,data): return self.bus.writeto(self.address,data)
    def read_registers(self,register,length,reg_width=1): return self.bus.read_registers(self.address,register,length,reg_width)
    def write_register(self,register,value,reg_width=1): return self.bus.write_register(self.address,register,value,reg_width)

class UART:
    __zebjus_ui__={"type":"uart"}
    def __init__(self,rx=16,tx=17,baud=9600,port=1):
        self.rx=int(rx);self.tx=int(tx);self.baud=int(baud);self.port=2 if int(port)==2 else 1
        if self.rx not in SUPPORTED_ULTRASONIC_ECHO_PINS or self.tx not in SUPPORTED_OUTPUT_PINS or self.rx==self.tx: raise ValueError("UART needs different valid RX/TX GPIO pins")
    @property
    def key(self): return f"uart:{self.port}:{self.rx}:{self.tx}"
    def write(self,data): _bridge_cmd("BRIDGE_UART",self.key,op="write",port=self.port,rx=self.rx,tx=self.tx,baud=self.baud,data=_bytes(data));return True
    def print(self,text): _bridge_cmd("BRIDGE_UART",self.key,op="write",port=self.port,rx=self.rx,tx=self.tx,baud=self.baud,text=str(text));return True
    def read(self,max_bytes=128):
        _bridge_cmd("BRIDGE_UART",self.key,op="read",port=self.port,rx=self.rx,tx=self.tx,baud=self.baud,max=int(max_bytes));d=_bridge_get("uart",self.key,{}) or {};return bytes(int(x)&255 for x in d.get("data",[]))
    def readline(self,max_bytes=160):
        _bridge_cmd("BRIDGE_UART",self.key,op="readline",port=self.port,rx=self.rx,tx=self.tx,baud=self.baud,max=int(max_bytes),waitMs=5);d=_bridge_get("uart",self.key,{}) or {};return str(d.get("text",""))
    def available(self): return int((_bridge_get("uart",self.key,{}) or {}).get("available",0))

class SPI:
    __zebjus_ui__={"type":"spi"}
    def __init__(self,sck=18,miso=19,mosi=23,cs=4,frequency=1000000,mode=0,bus=1,lsb_first=False,active_low=True):
        self.sck=int(sck);self.miso=int(miso);self.mosi=int(mosi);self.cs=int(cs);self.frequency=int(frequency);self.mode=int(mode);self.bus=2 if int(bus)==2 else 1;self.lsb_first=bool(lsb_first);self.active_low=bool(active_low)
    @property
    def key(self): return f"spi:{self.bus}:{self.sck}:{self.miso}:{self.mosi}:{self.cs}"
    def transfer(self,data):
        payload=_bytes(data);_bridge_cmd("BRIDGE_SPI",self.key,bus=self.bus,sck=self.sck,miso=self.miso,mosi=self.mosi,cs=self.cs,frequency=self.frequency,mode=self.mode,lsbFirst=self.lsb_first,activeLow=self.active_low,data=payload);d=_bridge_get("spi",self.key,{}) or {};return bytes(int(x)&255 for x in d.get("data",[]))
    def write(self,data): self.transfer(data);return True

class PulseInput:
    __zebjus_ui__={"type":"pulse_input"}
    def __init__(self,pin,state=1,timeout_us=100000): self.pin=int(pin);self.state=1 if state else 0;self.timeout_us=int(timeout_us)
    @property
    def key(self): return f"pulse:{self.pin}:{self.state}"
    def read_us(self):
        _bridge_cmd("BRIDGE_PULSE",self.key,op="in",pin=self.pin,state=self.state,timeoutUs=self.timeout_us)
        if _simulating(): return int(900+250*math.sin(_sim_phase(self.pin*.07,.8)))
        return int((_bridge_get("pulse",self.key,{}) or {}).get("microseconds",0))
    def frequency(self):
        _bridge_cmd("BRIDGE_PULSE",self.key,op="frequency",pin=self.pin,state=self.state,timeoutUs=self.timeout_us)
        if _simulating(): return 12.0+4.0*math.sin(_sim_phase(self.pin*.05,.6))
        return float((_bridge_get("pulse",self.key,{}) or {}).get("hz",0.0))

class PulseOutput:
    def __init__(self,pin,idle=0):
        self.pin=int(pin);self.idle=1 if idle else 0
        if self.pin not in SUPPORTED_OUTPUT_PINS: raise ValueError(f"PulseOutput pin {self.pin} must be one of {SUPPORTED_OUTPUT_PINS}")
    def pulse_us(self,width_us,state=1): _bridge_cmd("BRIDGE_PULSE",f"pulseout:{self.pin}",op="out",pin=self.pin,state=1 if state else 0,widthUs=int(width_us),safeValue=self.idle);return True

class CounterInput:
    """Interrupt-backed pulse counter for flow, Hall/RPM, reed and frequency-output sensors."""
    __zebjus_ui__={"type":"counter_input"}
    def __init__(self,pin,edge="rising",pullup=False):
        self.pin=int(pin);self.edge=str(edge).lower();self.pullup=bool(pullup)
        if self.pin not in SUPPORTED_COUNTER_PINS: raise ValueError(f"CounterInput pin {self.pin} must be one of {SUPPORTED_COUNTER_PINS}")
        if self.edge not in ("rising","falling","change"): raise ValueError("CounterInput edge must be 'rising', 'falling', or 'change'")
        self.key=f"counter:{self.pin}:{self.edge}";self._last_request=0.0
    def _sample(self):
        now=time.time()
        if now-self._last_request>0.03:
            _bridge_cmd("BRIDGE_COUNTER",self.key,op="read",pin=self.pin,edge=self.edge,pullup=self.pullup);self._last_request=now
        if _simulating():
            hz=max(0.1,8.0+3.0*math.sin(_sim_phase(self.pin*.06,.5)));count=int(time.monotonic()*hz);return {"count":count,"delta":1,"hz":hz,"valid":True,"simulated":True}
        return _bridge_get("counter",self.key,{}) or {}
    def snapshot(self): return dict(self._sample())
    def read(self): return int(self._sample().get("count",0))
    def count(self): return self.read()
    def frequency(self): return float(self._sample().get("hz",0.0))
    def delta(self): return int(self._sample().get("delta",0))
    def reset(self): _bridge_cmd("BRIDGE_COUNTER",self.key,op="reset",pin=self.pin,edge=self.edge,pullup=self.pullup);self._last_request=0.0;return True

class HardwareTransaction:
    """Run compact GPIO/pulse timing operations locally on ESP32. WRITE accepts optional safeValue as the fourth field."""
    def __init__(self,key="custom"): self.key=str(key)
    def run(self,ops):
        if isinstance(ops,(list,tuple)): ops=";".join(",".join(str(x) for x in row) if isinstance(row,(list,tuple)) else str(row) for row in ops)
        _bridge_cmd("BRIDGE_TRANSACTION",self.key,ops=str(ops));return list((_bridge_get("transaction",self.key,{}) or {}).get("results",[]))

class GPS:
    """Generic NMEA GPS driver over UART. Works with NEO-6M/7M/M8N and similar NMEA modules."""
    __zebjus_ui__={"type":"gps"}
    def __init__(self,rx=16,tx=17,baud=9600,port=1): self.uart=UART(rx,tx,baud,port);self.key=self.uart.key
    @staticmethod
    def _coord(raw,hemi):
        try:
            v=float(raw);deg=int(v//100);mins=v-deg*100;out=deg+mins/60.0;return -out if hemi in ("S","W") else out
        except Exception:return None
    def read(self):
        st=_gps_state.setdefault(self.key,{"latitude":None,"longitude":None,"altitude":None,"speed":0.0,"course":0.0,"satellites":0,"hdop":None,"fix":False,"utc":""})
        if _simulating():
            ph=_sim_phase(self.uart.rx*.09,.05);st.update(latitude=10.0500+0.0015*math.sin(ph),longitude=76.6200+0.0015*math.cos(ph),altitude=42.0+2.0*math.sin(ph*.7),speed=5.0+2.0*math.sin(ph*1.3),course=(ph*20.0)%360,satellites=8+(int(ph)%4),hdop=1.1,fix=True,utc="SIM")
            dashboard("GPS",Latitude=st["latitude"],Longitude=st["longitude"],Satellites=st["satellites"],Speed_kmh=round(st["speed"],2),Fix=True,Mode="SIMULATION");return dict(st)
        text=self.uart.readline(220)
        for line in str(text).splitlines():
            parts=line.strip().split(",");
            if not parts: continue
            typ=parts[0][-3:]
            try:
                if typ=="GGA" and len(parts)>9:
                    st.update(latitude=self._coord(parts[2],parts[3]),longitude=self._coord(parts[4],parts[5]),fix=parts[6] not in ("","0"),satellites=int(parts[7] or 0),hdop=float(parts[8]) if parts[8] else None,altitude=float(parts[9]) if parts[9] else None,utc=parts[1])
                elif typ=="RMC" and len(parts)>8:
                    st.update(latitude=self._coord(parts[3],parts[4]),longitude=self._coord(parts[5],parts[6]),fix=parts[2]=="A",speed=float(parts[7] or 0)*1.852,course=float(parts[8] or 0),utc=parts[1])
            except Exception: pass
        dashboard("GPS",Latitude=st.get("latitude"),Longitude=st.get("longitude"),Satellites=st.get("satellites",0),Speed_kmh=round(float(st.get("speed",0)),2),Fix=st.get("fix",False),Mode="HARDWARE")
        return dict(st)
    @property
    def latitude(self): return self.read().get("latitude")
    @property
    def longitude(self): return self.read().get("longitude")

class MPU6050:
    """Common MPU6050 I2C IMU driver using the universal I2C bridge."""
    __zebjus_ui__={"type":"imu"}
    def __init__(self,sda=None,scl=None,address=0x68,bus=0): self.dev=I2CDevice(address,sda,scl,400000,bus);self.dev.write_register(0x6B,0)
    @staticmethod
    def _s16(a,b):
        v=(int(a)<<8)|int(b);return v-65536 if v&0x8000 else v
    def read(self):
        if _simulating():
            ph=_sim_phase(self.dev.address*.03,.7);roll=18.0*math.sin(ph);pitch=12.0*math.cos(ph*.8);rr=math.radians(roll);pr=math.radians(pitch);ax=-math.sin(pr);ay=math.sin(rr)*math.cos(pr);az=math.cos(rr)*math.cos(pr);gx=8.0*math.cos(ph);gy=-6.0*math.sin(ph*.8);gz=3.0*math.sin(ph*.5);temp=28.0+0.8*math.sin(ph*.2);out={"accel_x":ax,"accel_y":ay,"accel_z":az,"gyro_x":gx,"gyro_y":gy,"gyro_z":gz,"temperature":temp,"valid":True,"simulated":True};dashboard("MPU6050",AccX=round(ax,3),AccY=round(ay,3),AccZ=round(az,3),GyroX=round(gx,2),GyroY=round(gy,2),GyroZ=round(gz,2),Mode="SIMULATION");return out
        d=self.dev.read_registers(0x3B,14)
        if len(d)<14:
            out={"accel_x":float("nan"),"accel_y":float("nan"),"accel_z":float("nan"),"gyro_x":float("nan"),"gyro_y":float("nan"),"gyro_z":float("nan"),"temperature":float("nan"),"valid":False,"simulated":False};dashboard("MPU6050",Status="WAITING / READ ERROR",Mode="HARDWARE");return out
        ax=self._s16(d[0],d[1])/16384.0;ay=self._s16(d[2],d[3])/16384.0;az=self._s16(d[4],d[5])/16384.0;temp=self._s16(d[6],d[7])/340.0+36.53;gx=self._s16(d[8],d[9])/131.0;gy=self._s16(d[10],d[11])/131.0;gz=self._s16(d[12],d[13])/131.0
        out={"accel_x":ax,"accel_y":ay,"accel_z":az,"gyro_x":gx,"gyro_y":gy,"gyro_z":gz,"temperature":temp,"valid":True,"simulated":False};dashboard("MPU6050",AccX=round(ax,3),AccY=round(ay,3),AccZ=round(az,3),GyroX=round(gx,2),GyroY=round(gy,2),GyroZ=round(gz,2),Mode="HARDWARE");return out

# Common modules share the universal bridge; sensor-specific UI is handled in the browser.
class LDR(ADC): __zebjus_ui__={"type":"light"}
class SoilMoisture(ADC): __zebjus_ui__={"type":"soil"}
class GasSensor(ADC): __zebjus_ui__={"type":"gas"}
class VoltageSensor(ADC): __zebjus_ui__={"type":"voltage"}
class SoundSensor(ADC): __zebjus_ui__={"type":"sound"}
class RainSensor(ADC): __zebjus_ui__={"type":"rain"}
class WaterLevelSensor(ADC): __zebjus_ui__={"type":"water"}
class Thermistor(ADC): __zebjus_ui__={"type":"temperature"}

class PIRSensor(GPIOInput):
    __zebjus_ui__={"type":"motion"}
    def __init__(self,pin=27,active_low=False): super().__init__(pin,"input",active_low)
class ReedSwitch(GPIOInput):
    __zebjus_ui__={"type":"reed"}
    def __init__(self,pin=32,active_low=True): super().__init__(pin,"pullup",active_low)
class TouchSensor(GPIOInput):
    __zebjus_ui__={"type":"touch"}
    def __init__(self,pin=32,active_low=False): super().__init__(pin,"input",active_low)
class FlameSensor(GPIOInput):
    __zebjus_ui__={"type":"flame"}
    def __init__(self,pin=32,active_low=False): super().__init__(pin,"input",active_low)

class FlowSensor(CounterInput):
    __zebjus_ui__={"type":"flow"}
    def __init__(self,pin,pulses_per_liter=450.0,edge="rising",pullup=False): super().__init__(pin,edge,pullup);self.pulses_per_liter=max(0.001,float(pulses_per_liter))
    def liters(self): return self.count()/self.pulses_per_liter
    def flow_lpm(self):
        hz=self.frequency();v=hz*60.0/self.pulses_per_liter;dashboard("Flow Sensor",Flow_L_min=round(v,3),Frequency_Hz=round(hz,2),Pulses=self.count());return v

class RPMSensor(CounterInput):
    __zebjus_ui__={"type":"rpm"}
    def __init__(self,pin,pulses_per_revolution=1.0,edge="rising",pullup=False): super().__init__(pin,edge,pullup);self.ppr=max(0.001,float(pulses_per_revolution))
    def rpm(self):
        hz=self.frequency();v=hz*60.0/self.ppr;dashboard("RPM Sensor",RPM=round(v,1),Frequency_Hz=round(hz,2));return v

class Buzzer(PWM):
    __zebjus_ui__={"type":"buzzer"}
    def __init__(self,pin,frequency=1000): super().__init__(pin,frequency,8,0)
    def tone(self,frequency=1000,volume=50): self.frequency=max(20,int(frequency));duty=round(self.max_duty*max(0,min(100,float(volume)))/200.0);self.write(duty);_send("UI_BUZZER_SET",pin=self.pin,frequency=self.frequency,volume=max(0,min(100,float(volume))));return self.frequency
    def no_tone(self): self.off();_send("UI_BUZZER_SET",pin=self.pin,frequency=0,volume=0)

class Joystick:
    __zebjus_ui__={"type":"joystick"}
    def __init__(self,x_pin=34,y_pin=35,switch_pin=None,active_low=True): self.x=ADC(x_pin);self.y=ADC(y_pin);self.switch=None if switch_pin is None else GPIOInput(switch_pin,"pullup" if active_low else "input",active_low);self.x_pin=int(x_pin);self.y_pin=int(y_pin);self.switch_pin=None if switch_pin is None else int(switch_pin)
    def read(self):
        out={"x":self.x.raw(),"y":self.y.raw(),"pressed":False if self.switch is None else self.switch.read()};dashboard("Joystick",X=out["x"],Y=out["y"],Pressed=out["pressed"]);return out

def sleep(seconds): time.sleep(float(seconds))

def _close_cv_windows():
    postMessage(to_js({"type":"close-images"},dict_converter=js.Object.fromEntries))

class HandResult:
    def __init__(self,detected=False,fingers=0,side="",landmarks=None):
        self.detected=bool(detected);self.fingers=int(fingers);self.side=str(side);self.landmarks=list(landmarks or [])
    def __repr__(self): return f"HandResult(detected={self.detected}, fingers={self.fingers}, side='{self.side}')"

class HandDetector:
    def read(self): return HandResult(_ai_state["detected"],_ai_state["fingers"],_ai_state["side"],_hand_landmarks)

class FaceResult:
    def __init__(self,faces=None): self.faces=list(faces or []);self.count=len(self.faces);self.detected=self.count>0
    def __repr__(self): return f"FaceResult(detected={self.detected}, count={self.count})"

class FaceDetector:
    def __init__(self,minDetectionCon=0.5,modelSelection=0): self.minDetectionCon=float(minDetectionCon);self.modelSelection=int(modelSelection)
    def read(self): return FaceResult([f.copy() for f in _face_state if float(f.get("score",0))>=self.minDetectionCon])
    def findFaces(self,img,draw=True): return _cvzone_find_faces(img,draw,self.minDetectionCon,score_as_percent=False)

class Camera:
    def __init__(self,index=0): self.index=int(index)
    def read(self):
        if _current_frame is None: raise RuntimeError("No camera frame available.")
        return _current_frame.copy()

def load_image():
    if _loaded_image is None: raise RuntimeError("No image loaded. Use Image Lab → Load Image first.")
    return _loaded_image.copy()

def show(image,title="OpenCV Output"):
    import cv2
    ok,buf=cv2.imencode(".png",image)
    if not ok: raise RuntimeError("Could not encode image")
    data="data:image/png;base64,"+base64.b64encode(bytes(buf)).decode()
    postMessage(to_js({"type":"image","dataUrl":data,"title":str(title)},dict_converter=js.Object.fromEntries))

def draw_rgb_led(image,x,y,r=255,g=0,b=0,radius=28):
    import cv2
    x,y,radius=int(x),int(y),max(6,int(radius))
    r,g,b=_clamp255(r),_clamp255(g),_clamp255(b)
    cv2.circle(image,(x,y),radius+4,(225,225,225),2,cv2.LINE_AA)
    cv2.circle(image,(x,y),radius,(b,g,r),-1,cv2.LINE_AA)
    cv2.circle(image,(x-radius//3,y-radius//3),max(2,radius//6),(255,255,255),-1,cv2.LINE_AA)
    return image

def draw_potentiometer(image,x,y,value=128,radius=34):
    import cv2,math
    x,y,radius=int(x),int(y),max(10,int(radius));value=_clamp255(value)
    cv2.circle(image,(x,y),radius,(75,75,75),-1,cv2.LINE_AA)
    cv2.circle(image,(x,y),radius,(200,200,200),2,cv2.LINE_AA)
    angle=math.radians(-135.0+(value/255.0)*270.0)
    px=int(x+math.cos(angle)*radius*.72);py=int(y+math.sin(angle)*radius*.72)
    cv2.line(image,(x,y),(px,py),(0,190,255),3,cv2.LINE_AA)
    cv2.putText(image,str(value),(x-radius,y+radius+18),cv2.FONT_HERSHEY_SIMPLEX,.45,(230,230,230),1,cv2.LINE_AA)
    return image

def draw_ultrasonic(image,x,y,distance_cm=50,max_cm=400,width=180,height=20):
    import cv2
    x,y,width,height=int(x),int(y),max(60,int(width)),max(8,int(height))
    d=max(0.0,float(distance_cm));m=max(1.0,float(max_cm));ratio=min(1.0,d/m)
    cv2.rectangle(image,(x,y),(x+width,y+height),(180,180,180),2)
    cv2.rectangle(image,(x+2,y+2),(x+2+int((width-4)*ratio),y+height-2),(220,170,60),-1)
    cv2.putText(image,f"{d:.1f} cm",(x,y-8),cv2.FONT_HERSHEY_SIMPLEX,.45,(230,230,230),1,cv2.LINE_AA)
    return image


# ---------------- Browser compatibility: MediaPipe + CVZone ----------------
class _RelativeBoundingBox:
    def __init__(self,f): self.xmin=float(f.get("xmin",0));self.ymin=float(f.get("ymin",0));self.width=float(f.get("width",0));self.height=float(f.get("height",0))
class _LocationData:
    def __init__(self,f): self.relative_bounding_box=_RelativeBoundingBox(f)
class _MPDetection:
    def __init__(self,f): self.score=[float(f.get("score",0))];self.location_data=_LocationData(f)
class _MPFaceResults:
    def __init__(self,faces): self.detections=[_MPDetection(f) for f in faces] or None
class _MPFaceDetection:
    def __init__(self,min_detection_confidence=0.5,model_selection=0,**kwargs): self.min_detection_confidence=float(min_detection_confidence);self.model_selection=int(model_selection)
    def process(self,img): return _MPFaceResults([f for f in _face_state if float(f.get("score",0))>=self.min_detection_confidence])
    def close(self): pass

def _draw_detection(img,detection):
    import cv2
    if img is None:return img
    h,w=img.shape[:2];b=detection.location_data.relative_bounding_box
    x,y,bw,bh=int(b.xmin*w),int(b.ymin*h),int(b.width*w),int(b.height*h)
    cv2.rectangle(img,(x,y),(x+bw,y+bh),(255,0,255),2);return img

def _cvzone_putTextRect(img,text,pos,scale=2,thickness=2,colorR=(255,255,255),colorT=(255,255,255),colorB=(0,255,0),offset=10,border=None,colorBorder=(255,0,255),font=None):
    import cv2
    font=cv2.FONT_HERSHEY_PLAIN if font is None else font;x,y=int(pos[0]),int(pos[1]);scale=float(scale);thickness=int(thickness);offset=int(offset)
    (tw,th),base=cv2.getTextSize(str(text),font,scale,thickness);x1,y1=x-offset,y+offset;x2,y2=x+tw+offset,y-th-offset
    cv2.rectangle(img,(x1,y1),(x2,y2),tuple(map(int,colorR)),-1)
    if border is not None: cv2.rectangle(img,(x1,y1),(x2,y2),tuple(map(int,colorBorder)),int(border))
    cv2.putText(img,str(text),(x,y),font,scale,tuple(map(int,colorT)),thickness)
    return img,(x1,y2,x2-x1,y1-y2)

def _cvzone_cornerRect(img,bbox,l=30,t=5,rt=1,colorR=(255,0,255),colorC=(0,255,0)):
    import cv2
    x,y,w,h=map(int,bbox);l,t,rt=int(l),int(t),int(rt)
    if rt: cv2.rectangle(img,(x,y),(x+w,y+h),tuple(map(int,colorR)),rt)
    c=tuple(map(int,colorC))
    for a,b in [((x,y),(x+l,y)),((x,y),(x,y+l)),((x+w,y),(x+w-l,y)),((x+w,y),(x+w,y+l)),((x,y+h),(x+l,y+h)),((x,y+h),(x,y+h-l)),((x+w,y+h),(x+w-l,y+h)),((x+w,y+h),(x+w,y+h-l))]: cv2.line(img,a,b,c,t)
    return img

def _cvzone_find_faces(img,draw=True,min_con=0.5,score_as_percent=True):
    import cv2
    if img is None:return img,[]
    ih,iw=img.shape[:2];bboxs=[]
    for idx,f in enumerate(_face_state):
        score=float(f.get("score",0))
        if score<float(min_con):continue
        x=int(float(f.get("xmin",0))*iw);y=int(float(f.get("ymin",0))*ih);w=int(float(f.get("width",0))*iw);h=int(float(f.get("height",0))*ih);cx,cy=x+w//2,y+h//2
        bboxs.append({"id":idx,"bbox":(x,y,w,h),"score":int(score*100) if score_as_percent else [score],"center":(cx,cy)})
        if draw:
            cv2.rectangle(img,(x,y),(x+w,y+h),(255,0,255),2);_cvzone_putTextRect(img,f"{int(score*100)}%",(x,max(20,y-10)),scale=1.2,thickness=1)
    return img,bboxs

class _CVZoneFaceDetector:
    def __init__(self,minDetectionCon=0.5,modelSelection=0): self.minDetectionCon=float(minDetectionCon);self.modelSelection=int(modelSelection)
    def findFaces(self,img,draw=True): return _cvzone_find_faces(img,draw,self.minDetectionCon,score_as_percent=True)

# ---------------- VISION AI Z legacy-course compatibility ----------------
def _hand_points(img):
    if img is None or not _hand_landmarks: return []
    h,w=img.shape[:2]
    return [[i,int(float(p.get("x",0))*w),int(float(p.get("y",0))*h)] for i,p in enumerate(_hand_landmarks)]

class _LegacyHandDetector:
    def __init__(self,mode=False,maxHands=1,detectionCon=0.5,trackCon=0.5,**kwargs):
        self.mode=mode;self.maxHands=maxHands;self.detectionCon=detectionCon;self.trackCon=trackCon
    def findHands(self,img,draw=True):
        if draw and img is not None:
            import cv2
            pts=_hand_points(img)
            for _,x,y in pts: cv2.circle(img,(x,y),3,(255,0,255),cv2.FILLED)
            for a,b in [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),(9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17)]:
                if len(pts)>max(a,b): cv2.line(img,(pts[a][1],pts[a][2]),(pts[b][1],pts[b][2]),(0,255,0),2)
        return img
    def findPosition(self,img,handNo=0,draw=True):
        pts=_hand_points(img)
        if not pts:return [],()
        xs=[p[1] for p in pts];ys=[p[2] for p in pts]
        bbox=(min(xs),min(ys),max(xs),max(ys))
        if draw:
            import cv2
            for _,x,y in pts: cv2.circle(img,(x,y),4,(255,0,255),cv2.FILLED)
            cv2.rectangle(img,(bbox[0]-10,bbox[1]-10),(bbox[2]+10,bbox[3]+10),(0,255,0),2)
        return pts,bbox

class SerialObject:
    def __init__(self,port=None,*args,**kwargs): self.port=str(port or "ZEBJUS")
    def getData(self):
        raw=int(round(max(0,min(4095,int(_sensor_state.get("pot_raw",0))))*1023/4095))
        return [str(raw)]
    def sendData(self,data):
        vals=list(data) if hasattr(data,"__iter__") and not isinstance(data,(str,bytes)) else [data]
        if len(vals)>=3:
            rgb=[max(0,min(255,int(float(v)))) for v in vals[:3]]
            if max(rgb)<=1: rgb=[v*255 for v in rgb]
            _send("RGB_LED_SET",id=1,r=rgb[0],g=rgb[1],b=rgb[2])
        if len(vals)>=4: _send("SERVO_SET",id=1,angle=max(0,min(180,int(float(vals[3])))))
        return True

class WifiBridge:
    def __init__(self,*args,**kwargs): self.digits=3;self.count=1;self.started=False
    def start(self): self.started=True;return True
    def set_format(self,digits=3,count=1): self.digits=int(digits);self.count=int(count);return self
    def send_values(self,values):
        vals=list(values)
        if vals: _send("SERVO_SET",id=1,angle=max(0,min(180,int(float(vals[0])))))
        return True

mp_face=types.ModuleType("mediapipe.solutions.face_detection");mp_face.FaceDetection=_MPFaceDetection
mp_draw=types.ModuleType("mediapipe.solutions.drawing_utils");mp_draw.draw_detection=_draw_detection
mp_solutions=types.ModuleType("mediapipe.solutions");mp_solutions.face_detection=mp_face;mp_solutions.drawing_utils=mp_draw
mp=types.ModuleType("mediapipe");mp.solutions=mp_solutions
sys.modules["mediapipe"]=mp;sys.modules["mediapipe.solutions"]=mp_solutions;sys.modules["mediapipe.solutions.face_detection"]=mp_face;sys.modules["mediapipe.solutions.drawing_utils"]=mp_draw

cvz=types.ModuleType("cvzone");cvz.putTextRect=_cvzone_putTextRect;cvz.cornerRect=_cvzone_cornerRect
cvz_fd=types.ModuleType("cvzone.FaceDetectionModule");cvz_fd.FaceDetector=_CVZoneFaceDetector
cvz.FaceDetectionModule=cvz_fd
sys.modules["cvzone"]=cvz;sys.modules["cvzone.FaceDetectionModule"]=cvz_fd

serial_mod=types.ModuleType("SerialModule");serial_mod.SerialObject=SerialObject
cvz_serial=types.ModuleType("cvzone.SerialModule");cvz_serial.SerialObject=SerialObject
cvz.SerialModule=cvz_serial
htm_mod=types.ModuleType("HandTrackingModule");htm_mod.handDetector=_LegacyHandDetector
wifi_mod=types.ModuleType("zebjus_wifi");wifi_mod.WifiBridge=WifiBridge
sys.modules["SerialModule"]=serial_mod;sys.modules["cvzone.SerialModule"]=cvz_serial
sys.modules["HandTrackingModule"]=htm_mod;sys.modules["zebjus_wifi"]=wifi_mod

z=types.ModuleType("zebjus")
for k,v in {
    "RGBLED":RGBLED,"LED":LED,"Motor":Motor,"Servo":Servo,"OLED":OLED,"DHT11":DHT11,"SerialPlotter":SerialPlotter,
    "plot":plot,"clear_plot":clear_plot,"dashboard":dashboard,"Ultrasonic":Ultrasonic,"AnalogInput":AnalogInput,"Potentiometer":Potentiometer,"DigitalInput":DigitalInput,"Switch":Switch,"RotaryEncoder":RotaryEncoder,
    "DigitalOutput":DigitalOutput,"Relay":Relay,"GPIOInput":GPIOInput,"ADC":ADC,"PWM":PWM,"PWMServo":PWMServo,"MotorDriver":MotorDriver,"I2C":I2C,"I2CDevice":I2CDevice,"UART":UART,"SPI":SPI,"PulseInput":PulseInput,"PulseOutput":PulseOutput,"CounterInput":CounterInput,"HardwareTransaction":HardwareTransaction,"GPS":GPS,"MPU6050":MPU6050,"LDR":LDR,"SoilMoisture":SoilMoisture,"GasSensor":GasSensor,"VoltageSensor":VoltageSensor,"SoundSensor":SoundSensor,"RainSensor":RainSensor,"WaterLevelSensor":WaterLevelSensor,"Thermistor":Thermistor,"PIRSensor":PIRSensor,"ReedSwitch":ReedSwitch,"TouchSensor":TouchSensor,"FlameSensor":FlameSensor,"FlowSensor":FlowSensor,"RPMSensor":RPMSensor,"Buzzer":Buzzer,"Joystick":Joystick,"sleep":sleep
}.items(): setattr(z,k,v)
for i,c in LED_CLASSES.items(): setattr(z,f"LED{i}",c)
for i,c in RGBLED_CLASSES.items(): setattr(z,f"RGBLED{i}",c)
z.__all__=["RGBLED","LED","Motor","Servo","OLED","DHT11","SerialPlotter","plot","clear_plot","dashboard","Ultrasonic","AnalogInput","Potentiometer","DigitalInput","Switch","RotaryEncoder","DigitalOutput","Relay","GPIOInput","ADC","PWM","PWMServo","MotorDriver","I2C","I2CDevice","UART","SPI","PulseInput","PulseOutput","CounterInput","HardwareTransaction","GPS","MPU6050","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","FlowSensor","RPMSensor","Buzzer","Joystick","sleep"]+[f"LED{i}" for i in range(1,16)]+[f"RGBLED{i}" for i in range(1,6)]
sys.modules["zebjus"]=z

za=types.ModuleType("zebjus_ai")
za.HandDetector=HandDetector;za.HandResult=HandResult;za.FaceDetector=FaceDetector;za.FaceResult=FaceResult
za.__all__=["HandDetector","HandResult","FaceDetector","FaceResult"]
sys.modules["zebjus_ai"]=za

zc=types.ModuleType("zebjus_cv")
for k,v in {
    "Camera":Camera,"load_image":load_image,"show":show,
    "draw_rgb_led":draw_rgb_led,"draw_potentiometer":draw_potentiometer,
    "draw_ultrasonic":draw_ultrasonic
}.items(): setattr(zc,k,v)
zc.__all__=["Camera","load_image","show","draw_rgb_led","draw_potentiometer","draw_ultrasonic"]
sys.modules["zebjus_cv"]=zc
    `);

    postMessage({type:"ready"});
    return pyodide;
  })();

  return readyPromise;
}

async function syncUploadedFiles(files){
  try{
    pyodide.FS.mkdirTree("/home/pyodide/uploads");
    for(const f of (files||[])){
      const name=String(f?.name||"image").replace(/[\\/:*?"<>|]/g,"_");
      if(!name||!Array.isArray(f?.data))continue;
      pyodide.FS.writeFile(`/home/pyodide/uploads/${name}`,new Uint8Array(f.data));
    }
  }catch(e){
    postMessage({type:"stdout",text:"Image upload sync error: "+String(e?.message||e)});
  }
}



async function frameToPython(frame,targetName){
  if(!(frame?.data&&frame?.width&&frame?.height))return;
  pyodide.globals.set("__iw",Number(frame.width));
  pyodide.globals.set("__ih",Number(frame.height));
  pyodide.globals.set("__idata",frame.data);
  pyodide.globals.set("__target_name",targetName);
  await pyodide.runPythonAsync(`
import numpy as np,cv2
_raw=__idata.to_py() if hasattr(__idata,"to_py") else list(__idata)
_arr=np.asarray(_raw,dtype=np.uint8).reshape(int(__ih),int(__iw),4)
_img=cv2.cvtColor(_arr,cv2.COLOR_RGBA2BGR)
if __target_name=="camera": _current_frame=_img
elif __target_name=="loaded": _loaded_image=_img
del _raw,_arr,_img
  `);
}

async function prepareRun(m){
  const code=m.code||"";
  const needsCv=/\bimport\s+cv2\b|\bzebjus_cv\b|\bCamera\s*\(|\bload_image\s*\(|\bdraw_(?:rgb_led|potentiometer|ultrasonic)\s*\(|\bcvzone\b|\bmediapipe\b|\bFaceDetector\b|\bHandTrackingModule\b/.test(code);

  if(needsCv&&!opencvReady){
    postMessage({type:"status",text:"Loading OpenCV…",mode:"warn"});
    await pyodide.loadPackage(["numpy","opencv-python"]);
    await pyodide.runPythonAsync(`
import cv2
class _BrowserVideoCapture:
    def __init__(self,index=0): self.index=int(index);self.opened=_current_frame is not None
    def isOpened(self): return bool(self.opened and _current_frame is not None)
    def read(self):
        if _current_frame is None:return False,None
        return True,_current_frame.copy()
    def set(self,prop,value): return True
    def get(self,prop): return 0.0
    def release(self): self.opened=False

def _browser_imshow(title,img): show(img,str(title))
def _browser_close_windows():
    postMessage(to_js({"type":"close-images"},dict_converter=js.Object.fromEntries))
def _browser_waitKey(delay=1):
    # Browser/Pyodide compatibility: OpenCV waitKey uses milliseconds.
    # The Python runtime lives in a Web Worker, so this delay does not freeze the page UI.
    try: ms=max(0,int(delay))
    except Exception: ms=1
    if ms>0: time.sleep(ms/1000.0)
    return -1
cv2.VideoCapture=_BrowserVideoCapture
cv2.imshow=_browser_imshow
cv2.waitKey=_browser_waitKey
cv2.destroyAllWindows=_browser_close_windows
    `);
    opencvReady=true;
  }
  // Browser compatibility modules are local shims, not PyPI wheels.
  const scanCode=code.replace(/^\s*(?:from|import)\s+(?:zebjus(?:_ai|_cv)?|mediapipe|cvzone|SerialModule|HandTrackingModule|zebjus_wifi)(?:[.\w]*)?.*$/gm,"");
  if(scanCode.trim()&&!importLoadCache.has(scanCode)){
    await pyodide.loadPackagesFromImports(scanCode);
    importLoadCache.add(scanCode);
  }

  pyodide.globals.set("__stdin_text",String(m.stdin||""));
  pyodide.globals.set("__ai_detected",!!m.aiState?.detected);
  pyodide.globals.set("__ai_fingers",Number(m.aiState?.fingers)||0);
  pyodide.globals.set("__ai_side",String(m.aiState?.side||""));
  pyodide.globals.set("__faces_json",JSON.stringify(m.aiState?.faces||[]));
  pyodide.globals.set("__hand_landmarks_json",JSON.stringify(m.aiState?.landmarks||[]));
  pyodide.globals.set("__simulation_mode",!!m.sensorState?.simulationMode);
  pyodide.globals.set("__ultra",Number(m.sensorState?.ultrasonicCm)||0);
  pyodide.globals.set("__dht_t",Number(m.sensorState?.dhtTemperature)||0);
  pyodide.globals.set("__dht_h",Number(m.sensorState?.dhtHumidity)||0);
  pyodide.globals.set("__dht_pin",Number(m.sensorState?.dhtPin)||13);
  pyodide.globals.set("__pot",Math.max(0,Math.min(255,Number(m.sensorState?.potValue)||0)));
  pyodide.globals.set("__pot_raw",Math.max(0,Number(m.sensorState?.potRaw)||0));
  pyodide.globals.set("__pot_pin",Number(m.sensorState?.potPin)||34);
  pyodide.globals.set("__pot_percent",Math.max(0,Math.min(100,Number(m.sensorState?.potPercent)||0)));
  pyodide.globals.set("__pot_mv",Math.max(0,Number(m.sensorState?.potMillivolts)||0));
  pyodide.globals.set("__inputs_json",JSON.stringify(m.sensorState?.inputs||{analog:{},digital:{},rotary:{},ultrasonic:{},dht11:{}}));
  pyodide.globals.set("__bridge_json",JSON.stringify(m.sensorState?.bridge||{gpio:{},adc:{},pwm:{},i2c:{},uart:{},spi:{},pulse:{},counter:{},transaction:{}}));

  await pyodide.runPythonAsync(`
sys.stdin=io.StringIO(__stdin_text + ("\\n" if __stdin_text and not __stdin_text.endswith("\\n") else ""))
sys.stdout=_zebjus_stdout
sys.stderr=_zebjus_stderr
_hand_landmarks=json.loads(str(__hand_landmarks_json)) if str(__hand_landmarks_json) else []
_ai_state={"detected":bool(__ai_detected),"fingers":int(__ai_fingers),"side":str(__ai_side),"landmarks":_hand_landmarks}
_face_state=json.loads(str(__faces_json)) if str(__faces_json) else []
_sensor_state={"simulation":bool(__simulation_mode),"ultrasonic_cm":float(__ultra),"dht_temperature":float(__dht_t),"dht_humidity":float(__dht_h),"dht_pin":int(__dht_pin),"pot_value":int(__pot),"pot_raw":int(__pot_raw),"pot_pin":int(__pot_pin),"pot_percent":int(__pot_percent),"pot_mv":int(__pot_mv)}
_input_state=json.loads(str(__inputs_json)) if str(__inputs_json) else {"analog":{},"digital":{},"rotary":{},"ultrasonic":{},"dht11":{}}
_bridge_state=json.loads(str(__bridge_json)) if str(__bridge_json) else {"gpio":{},"adc":{},"pwm":{},"i2c":{},"uart":{},"spi":{},"pulse":{},"counter":{},"transaction":{}}
_current_frame=None
_loaded_image=None
  `);
if(Array.isArray(m.uploadedFiles)&&m.uploadedFiles.length)await syncUploadedFiles(m.uploadedFiles);

  if(needsCv){
    await frameToPython(m.frame,"camera");
    await frameToPython(m.imageFrame,"loaded");
  }

  return code;
}

function buildPersistentLiveParts(code){
  const lines=String(code||"").split(/\r?\n/);
  let start=-1;
  for(let i=0;i<lines.length;i++){
    if(/^while\s+True\s*:\s*(?:#.*)?$/.test(lines[i])){start=i;break;}
  }
  if(start<0)return null;
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){
    const line=lines[i];
    if(!line.trim()||/^\s*#/.test(line))continue;
    const indent=(line.match(/^[ \t]*/)||[""])[0].length;
    if(indent===0){end=i;break;}
  }
  const prefix=lines.map((line,i)=>i<start?line:"").join("\n");
  const cycle=lines.map((line,i)=>{
    if(i<start||i>=end)return "";
    if(i===start)return "for __zebjus_browser_cycle in range(1):";
    return line;
  }).join("\n");
  return {prefix,cycle};
}

function resetPersistentLive(){activeLiveSession="";livePrefixDone=false;livePrefixCode="";liveCycleCode="";}


function parsePythonError(err,code=""){
  const text=String(err?.message||err||"Python error");
  const lines=text.split(/\r?\n/).filter(Boolean);
  let errorType="PythonError",message=lines[lines.length-1]||text,line=1,offset=1;

  const last=message.match(/^([A-Za-z_]\w*(?:Error|Exception)):\s*(.*)$/);
  if(last){errorType=last[1];message=last[2]||last[1];}

  const fileMatches=[...text.matchAll(/File "(?:<exec>|<string>|main\.py)", line (\d+)/g)];
  if(fileMatches.length)line=Number(fileMatches[fileMatches.length-1][1])||1;

  const syntaxLine=text.match(/line (\d+)\s*\n[\s\S]*?\n\s*\^/);
  if(syntaxLine)line=Number(syntaxLine[1])||line;

  return {errorType,message,line,offset,text};
}

async function lintCode(code,requestId){
  await initialize();
  pyodide.globals.set("__lint_code",String(code||""));
  try{
    const raw=await pyodide.runPythonAsync(`
import json
try:
    compile(str(__lint_code),"main.py","exec")
    json.dumps({"ok":True})
except (SyntaxError,IndentationError,TabError) as e:
    json.dumps({
        "ok":False,
        "errorType":e.__class__.__name__,
        "message":str(getattr(e,"msg",e)),
        "line":int(getattr(e,"lineno",1) or 1),
        "offset":int(getattr(e,"offset",1) or 1)
    })
    `);
    const result=JSON.parse(String(raw||'{"ok":true}'));
    postMessage({type:"lint-result",requestId,...result});
  }catch(err){
    postMessage({type:"lint-result",requestId,ok:true});
  }
}

async function executeStudentCode(execCode){
  pyodide.globals.set("__student_exec_code",String(execCode||""));

  const raw=await pyodide.runPythonAsync(`
import json, traceback

try:
    exec(compile(str(__student_exec_code), "main.py", "exec"), globals(), globals())
    json.dumps({"ok": True})
except BaseException as e:
    frames = traceback.extract_tb(e.__traceback__)
    student_frames = [f for f in frames if f.filename == "main.py"]

    if student_frames:
        line = int(student_frames[-1].lineno)
    else:
        line = int(getattr(e, "lineno", 1) or 1)

    offset = int(getattr(e, "offset", 1) or 1)
    message = str(getattr(e, "msg", e))

    json.dumps({
        "ok": False,
        "errorType": e.__class__.__name__,
        "message": message,
        "line": line,
        "offset": offset
    })
  `);

  return JSON.parse(String(raw||'{"ok":true}'));
}

self.onmessage=async e=>{
  const m=e.data||{};

  if(m.type==="lint"){
    await lintCode(m.code||"",m.requestId||"");
    return;
  }
  if(m.type!=="run")return;

  try{
    await initialize();
    const session=String(m.liveSessionId||"default");
    if(preparedRunSession!==session){preparedRunSession=session;await pyodide.runPythonAsync(`_i2c_bus_claimed={};_gps_state={}`);}
    const execCode=await prepareRun(m);
    const liveParts=buildPersistentLiveParts(execCode);
    let result={ok:true};
    if(liveParts){
      if(activeLiveSession!==session){activeLiveSession=session;livePrefixDone=false;livePrefixCode=liveParts.prefix;liveCycleCode=liveParts.cycle;}
      if(!livePrefixDone){
        result=await executeStudentCode(livePrefixCode);
        if(result.ok)livePrefixDone=true;
      }
      if(result.ok)result=await executeStudentCode(liveCycleCode);
    }else{
      resetPersistentLive();
      result=await executeStudentCode(execCode);
    }

    if(result.ok)postMessage({type:"done"});
    else{resetPersistentLive();postMessage({type:"error",...result});}
  }catch(err){
    const info=parsePythonError(err,m.code||"");
    postMessage({type:"error",...info});
  }
};

initialize().catch(err=>postMessage({type:"error",text:"Python init failed: "+(err?.message||err)}));