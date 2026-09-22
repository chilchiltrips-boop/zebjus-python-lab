(function(g){
"use strict";
const VERSION="2.0.0";
const TYPE_KIND=Object.freeze({
  SingleLED:"led",RGBLED:"rgb",TM1637:"display",LCD1602:"display",OLED:"display",DHT11:"climate",Ultrasonic:"distance",
  Potentiometer:"analog",AnalogInput:"analog",Switch:"digital",DigitalInput:"digital",RotaryEncoder:"encoder",DigitalOutput:"output",Relay:"output",GPIOInput:"digital",ADC:"analog",PWM:"pwm",PWMServo:"servo",MotorDriver:"motor",
  I2C:"bus",I2CDevice:"bus",UART:"bus",SPI:"bus",PulseInput:"pulse",CounterInput:"pulse",PulseOutput:"output",HardwareTransaction:"bus",
  GPS:"gps",MPU6050:"motion",LDR:"light",SoilMoisture:"soil",GasSensor:"gas",VoltageSensor:"voltage",SoundSensor:"soundSensor",RainSensor:"rain",WaterLevelSensor:"water",Thermistor:"temperature",
  PIRSensor:"motionDigital",ReedSwitch:"reed",TouchSensor:"touch",FlameSensor:"flame",FlowSensor:"pulse",RPMSensor:"pulse",Buzzer:"buzzer",Joystick:"joystick",
  DCMotor:"motor",TTGearMotor:"motor",StepperMotor:"motor",BLDCESC:"motor",FanMotor:"motor",WaterPump:"motor",Solenoid:"output",VibrationMotor:"motor",PCA9685:"pca",
  LSM6DS3:"motion",BME280:"climate",BMP280:"pressure",ADXL345:"motion",BH1750:"light",VL53L0X:"distance",DS18B20:"temperature",
  IRObstacle:"obstacle",IRReceiver:"remote",LineSensor:"line",HallSensor:"pulse",FlexSensor:"analog",CurrentSensor:"current",HX711:"weight",
  RC522:"rfid",MicroSD:"storage",MAX7219:"display",NeoPixel:"rgb",Keypad4x4:"keypad",DS3231:"clock",LoRaSX1278:"radio",MCP2515:"can",
  PhotoInterrupt:"pulse",TiltSensor:"tilt",LaserModule:"output",SevenSegment:"display"
});
const TITLES={SingleLED:"Single LED",RGBLED:"RGB LED",TM1637:"TM1637 Display",LCD1602:"LCD 16×2",OLED:"OLED Display",DHT11:"DHT11 Climate",Ultrasonic:"Ultrasonic Distance",Potentiometer:"Potentiometer",AnalogInput:"Analog Input",Switch:"Switch",DigitalInput:"Digital Input",RotaryEncoder:"Rotary Encoder",DigitalOutput:"Digital Output",Relay:"Relay",GPIOInput:"GPIO Input",ADC:"ADC Input",PWM:"PWM Output",PWMServo:"Servo",MotorDriver:"Motor Driver",HardwareTransaction:"Hardware Transaction",GasSensor:"Air / Gas Sensor",SoundSensor:"Sound Sensor",WaterLevelSensor:"Water Level",SoilMoisture:"Soil Moisture",PIRSensor:"PIR Motion",ReedSwitch:"Magnetic Reed",TouchSensor:"Touch",FlameSensor:"Flame",FlowSensor:"Flow",RPMSensor:"RPM",Buzzer:"Buzzer",DCMotor:"DC Motor",TTGearMotor:"TT Gear Motor",StepperMotor:"Stepper Motor",BLDCESC:"BLDC + ESC",FanMotor:"Fan",WaterPump:"Water Pump",Solenoid:"Solenoid",VibrationMotor:"Vibration Motor",PCA9685:"PCA9685 Driver",BME280:"BME280 Environment",BMP280:"BMP280 Pressure",BH1750:"BH1750 Light",VL53L0X:"ToF Distance",DS18B20:"DS18B20 Temperature",IRObstacle:"IR Obstacle",IRReceiver:"IR Remote",LineSensor:"Line Sensor",CurrentSensor:"Current Sensor",HX711:"Load Cell",RC522:"RFID Reader",MicroSD:"MicroSD Card",MAX7219:"MAX7219 Matrix",NeoPixel:"NeoPixel Strip",Keypad4x4:"4×4 Keypad",DS3231:"RTC Clock",LoRaSX1278:"LoRa Radio",MCP2515:"CAN Controller",PhotoInterrupt:"Photo Interrupter",TiltSensor:"Tilt Sensor",LaserModule:"Laser Module",SevenSegment:"7-Segment Display"};
const range=(key,label,min,max,step,def,unit="")=>({key,label,type:"range",min,max,step,default:def,unit});
const checkbox=(key,label,def=false)=>({key,label,type:"checkbox",default:def});
const select=(key,label,options,def=options[0])=>({key,label,type:"select",options,default:def});
const text=(key,label,def="")=>({key,label,type:"text",default:def});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const pct=value=>Math.round(clamp(number(value),0,100));
const wave=(t,speed=1,offset=0)=>(Math.sin(t*speed*Math.PI*2+offset)+1)/2;
const profile=(kind,title,description,controls)=>({kind,title,description,controls});

function profileFor(component){
  const type=typeof component==="string"?component:component?.type,kind=TYPE_KIND[type]||"generic",title=TITLES[type]||String(type||"Component");
  switch(kind){
    case"led":return profile(kind,title,"Set the LED level or test a real blink/pulse pattern.",[checkbox("enabled","LED enabled",true),select("mode","Pattern",["Steady","Blink","Pulse"],"Blink"),range("level","Brightness",0,100,1,90,"%"),range("rate","Blink rate",.2,8,.1,1.5,"Hz")]);
    case"rgb":return profile(kind,title,"Preview colour, brightness and strip animation.",[checkbox("enabled","Output enabled",true),select("pattern","Pattern",["Solid","Rainbow","Chase","Blink"],"Rainbow"),range("hue","Hue",0,360,1,185,"°"),range("level","Brightness",0,100,1,80,"%"),range("rate","Effect speed",.1,8,.1,1.2,"×")]);
    case"display":return profile(kind,title,"Change the displayed content and brightness.",[checkbox("enabled","Display enabled",true),text("content","Display value",type==="LCD1602"?"ZEBJUS LAB":type==="SevenSegment"?"8":"1234"),range("level","Brightness",0,100,1,85,"%"),checkbox("animate","Auto count / scroll",true)]);
    case"climate":return profile(kind,title,"Inject controlled environmental values.",[range("temperature","Temperature",-20,80,.1,26,"°C"),range("humidity","Humidity",0,100,1,58,"% RH"),...(type==="BME280"?[range("pressure","Pressure",850,1100,.1,1008,"hPa")]:[]),range("variation","Variation",0,10,.1,.6,"")]);
    case"distance":return profile(kind,title,"Move a virtual target toward or away from the sensor.",[range("distance","Target distance",type==="VL53L0X"?20:2,type==="VL53L0X"?2000:400,1,type==="VL53L0X"?420:45,type==="VL53L0X"?"mm":"cm"),range("variation","Movement",0,100,1,8,"%"),checkbox("target","Target present",true)]);
    case"analog":return profile(kind,title,"Set the physical input and optional electrical noise.",[range("input","Input level",0,100,.1,52,"%"),range("noise","Noise",0,20,.1,.5,"%")]);
    case"digital":return profile(kind,title,"Toggle the digital input or generate automatic pulses.",[checkbox("triggered","Input HIGH",false),checkbox("autoPulse","Auto pulse",false),range("rate","Pulse rate",.2,10,.1,1,"Hz")]);
    case"encoder":return profile(kind,title,"Rotate or press the virtual encoder.",[range("position","Position",-100,100,1,0,"steps"),checkbox("pressed","Push switch",false),checkbox("autoRotate","Auto rotate",true),range("rate","Rotation speed",.2,10,.1,1,"×")]);
    case"output":return profile(kind,title,"Drive the output and select a switching pattern.",[checkbox("enabled","Output ON",true),select("mode","Pattern",["Steady","Blink","Pulse"],type==="PulseOutput"?"Pulse":"Steady"),range("level","Drive level",0,100,1,100,"%"),range("rate","Switch rate",.2,10,.1,1,"Hz")]);
    case"pwm":return profile(kind,title,"Adjust PWM duty and test a sweep.",[checkbox("enabled","PWM enabled",true),range("level","Duty cycle",0,100,1,55,"%"),checkbox("sweep","Auto sweep",true),range("rate","Sweep rate",.1,5,.1,.6,"×")]);
    case"servo":return profile(kind,title,"Set servo angle, sweep range and speed.",[checkbox("enabled","Servo powered",true),range("angle","Angle",0,180,1,90,"°"),checkbox("sweep","Auto sweep",true),range("rate","Sweep speed",.1,4,.1,.7,"×")]);
    case"motor":return profile(kind,title,"Test motor direction, speed and mechanical load.",[checkbox("enabled","Motor running",true),range("throttle","Throttle",0,100,1,65,"%"),select("direction","Direction",["CW","CCW","Brake"],"CW"),range("load","Mechanical load",0,100,1,25,"%"),checkbox("sound","Motor sound",true)]);
    case"bus":return profile(kind,title,"Generate bus traffic and inject communication errors.",[checkbox("connected","Device online",true),range("traffic","Traffic",0,100,1,45,"%"),range("errors","Error injection",0,30,.1,0,"%"),checkbox("activity","Continuous transfer",true)]);
    case"pulse":return profile(kind,title,"Set a pulse/rotation/flow source for counter testing.",[checkbox("enabled","Pulse source active",true),range("frequency","Pulse frequency",0,500,1,type==="FlowSensor"?24:type==="RPMSensor"?80:20,"Hz"),range("jitter","Jitter",0,20,.1,.5,"%")]);
    case"gps":return profile(kind,title,"Set location, speed and satellite fix.",[checkbox("fix","GPS fix",true),range("latitude","Latitude",-90,90,.0001,10.0507,"°"),range("longitude","Longitude",-180,180,.0001,76.6204,"°"),range("speed","Speed",0,180,.1,0,"km/h"),range("satellites","Satellites",0,20,1,9,"")]);
    case"motion":return profile(kind,title,"Tilt or shake the virtual motion sensor.",[range("roll","Roll",-180,180,1,0,"°"),range("pitch","Pitch",-90,90,1,0,"°"),range("shake","Shake",0,100,1,10,"%"),checkbox("autoMove","Auto movement",true)]);
    case"light":return profile(kind,title,"Control incident light and flicker.",[range("lux","Light",0,100000,10,650,"lux"),range("flicker","Flicker",0,100,1,2,"%")]);
    case"soil":return profile(kind,title,"Insert a virtual probe into dry or wet soil.",[range("moisture","Soil moisture",0,100,1,45,"%"),range("salinity","Salinity factor",0,100,1,12,"%"),range("temperature","Soil temperature",-10,60,.1,27,"°C")]);
    case"gas":return profile(kind,title,"Mix a gas source with fresh air; output follows concentration, ventilation and humidity.",[checkbox("source","Gas source ON",true),select("gasType","Air / gas mix",["Clean air","LPG","Smoke","CO","Alcohol","Methane"],"Smoke"),range("concentration","Gas concentration",0,2000,1,420,"ppm"),range("freshAir","Fresh-air flow",0,100,1,20,"%"),range("humidity","Humidity factor",0,100,1,55,"%"),checkbox("alarm","Alarm sound",true)]);
    case"voltage":return profile(kind,title,"Apply a safe virtual voltage to the divider input.",[range("voltage","Input voltage",0,25,.01,5,"V"),range("ripple","Ripple",0,20,.1,.2,"%")]);
    case"current":return profile(kind,title,"Set load current and polarity.",[range("current","Current",-30,30,.01,1.25,"A"),range("noise","Noise",0,10,.1,.2,"%")]);
    case"soundSensor":return profile(kind,title,"Inject sound level and tone into the microphone.",[range("level","Sound level",0,120,1,52,"dB"),range("frequency","Tone",40,8000,1,440,"Hz"),checkbox("burst","Sound burst",false),checkbox("audible","Monitor sound",false)]);
    case"rain":return profile(kind,title,"Apply rain to the sensing plate.",[range("rain","Rain intensity",0,100,1,0,"%"),range("droplets","Droplet variation",0,100,1,15,"%")]);
    case"water":return profile(kind,title,"Raise or lower the virtual water surface.",[range("level","Water level",0,100,1,35,"%"),range("waves","Wave movement",0,100,1,5,"%")]);
    case"temperature":return profile(kind,title,"Set probe temperature and variation.",[range("temperature","Temperature",-55,125,.1,28,"°C"),range("variation","Variation",0,10,.1,.3,"°C")]);
    case"motionDigital":return profile(kind,title,"Move a person through the PIR detection area.",[checkbox("motion","Motion present",false),range("distance","Person distance",.2,12,.1,2.5,"m"),checkbox("autoWalk","Auto walk",true)]);
    case"reed":return profile(kind,title,"Move a magnet toward the reed switch.",[checkbox("magnet","Magnet present",false),range("distance","Magnet distance",0,100,1,60,"mm")]);
    case"touch":return profile(kind,title,"Press or release the capacitive pad.",[checkbox("touched","Pad touched",false),range("strength","Touch strength",0,100,1,80,"%")]);
    case"flame":return profile(kind,title,"Place a flame at a controlled distance.",[checkbox("flame","Flame present",false),range("distance","Flame distance",5,300,1,80,"cm"),range("intensity","Flame intensity",0,100,1,60,"%")]);
    case"obstacle":return profile(kind,title,"Move an obstacle across the IR beam.",[checkbox("obstacle","Obstacle present",true),range("distance","Obstacle distance",1,80,1,18,"cm"),range("reflectivity","Reflectivity",0,100,1,70,"%")]);
    case"remote":return profile(kind,title,"Send a chosen IR remote command.",[checkbox("received","Signal received",false),select("command","Remote command",["POWER","UP","DOWN","LEFT","RIGHT","OK","1","2","3"],"POWER"),range("repeat","Repeat rate",0,10,1,0,"Hz")]);
    case"line":return profile(kind,title,"Move a black line under the optical sensor.",[checkbox("line","Line detected",true),range("position","Line position",-100,100,1,0,"%"),range("contrast","Surface contrast",0,100,1,85,"%")]);
    case"buzzer":return profile(kind,title,"Play a tone or frequency sweep.",[checkbox("enabled","Buzzer ON",true),range("frequency","Frequency",40,5000,1,880,"Hz"),range("volume","Volume",0,100,1,35,"%"),checkbox("sweep","Frequency sweep",false)]);
    case"joystick":return profile(kind,title,"Move the stick and press its switch.",[range("x","X axis",-100,100,1,0,"%"),range("y","Y axis",-100,100,1,0,"%"),checkbox("pressed","Stick pressed",false),checkbox("autoMove","Auto movement",true)]);
    case"pca":return profile(kind,title,"Test one PWM channel or sweep a servo bank.",[range("channel","Channel",0,15,1,0,""),range("angle","Servo angle",0,180,1,90,"°"),checkbox("sweep","Auto sweep",true),range("rate","Sweep speed",.1,4,.1,.8,"×")]);
    case"pressure":return profile(kind,title,"Set barometric pressure and temperature.",[range("pressure","Pressure",300,1100,.1,1008,"hPa"),range("temperature","Temperature",-40,85,.1,26,"°C"),range("variation","Weather variation",0,10,.1,.5,"hPa")]);
    case"weight":return profile(kind,title,"Place a load on the virtual load cell.",[range("weight","Applied load",0,50,.01,2.5,"kg"),range("tare","Tare offset",-5,5,.01,0,"kg"),range("vibration","Vibration",0,10,.1,.1,"%")]);
    case"rfid":return profile(kind,title,"Present or remove an RFID card.",[checkbox("card","Card present",true),text("uid","Card UID","A1 B2 C3 D4"),range("distance","Card distance",0,80,1,15,"mm")]);
    case"storage":return profile(kind,title,"Simulate SD activity, capacity and write faults.",[checkbox("mounted","Card mounted",true),range("used","Storage used",0,100,1,32,"%"),select("operation","Operation",["Idle","Read","Write","List files"],"Read"),range("errors","Error injection",0,30,1,0,"%")]);
    case"keypad":return profile(kind,title,"Press a key on the 4×4 matrix.",[checkbox("pressed","Key pressed",true),select("key","Key",["1","2","3","A","4","5","6","B","7","8","9","C","*","0","#","D"],"5"),checkbox("autoType","Auto type",false)]);
    case"clock":return profile(kind,title,"Run the RTC or apply a test time offset.",[checkbox("running","Clock running",true),range("offset","Time offset",-720,720,1,0,"min"),checkbox("battery","Backup battery",true)]);
    case"radio":return profile(kind,title,"Send LoRa packets with adjustable signal and loss.",[checkbox("connected","Radio active",true),range("traffic","Packet rate",0,20,.1,2,"pkt/s"),range("signal","Signal strength",-140,-20,1,-72,"dBm"),range("loss","Packet loss",0,100,1,2,"%")]);
    case"can":return profile(kind,title,"Generate CAN frames and bus errors.",[checkbox("connected","CAN bus active",true),range("traffic","Frame rate",0,500,1,60,"fps"),range("load","Bus load",0,100,1,25,"%"),range("errors","Error frames",0,30,.1,0,"%")]);
    case"tilt":return profile(kind,title,"Tilt the switch through its trigger angle.",[range("angle","Tilt angle",-90,90,1,0,"°"),range("threshold","Trigger angle",0,90,1,25,"°"),checkbox("autoTilt","Auto tilt",true)]);
    default:return profile(kind,title,"Adjust a generic activity level.",[checkbox("enabled","Active",true),range("level","Activity",0,100,1,50,"%")]);
  }
}

function normalizeValue(schema,value){
  if(schema.type==="checkbox")return value===true||value==="true"||value===1;
  if(schema.type==="range")return clamp(number(value,schema.default),schema.min,schema.max);
  if(schema.type==="select")return schema.options.includes(value)?value:schema.default;
  return String(value??schema.default??"");
}
function controlsFor(component){const p=profileFor(component),saved=component?.simulation||{},out={};p.controls.forEach(schema=>out[schema.key]=normalizeValue(schema,saved[schema.key]??schema.default));return out;}
function setControl(component,key,value){const p=profileFor(component),schema=p.controls.find(x=>x.key===key);if(!schema)throw new Error(`Unknown simulation control ${key}`);component.simulation={...(component.simulation||{}),[key]:normalizeValue(schema,value)};return component.simulation[key];}
function hslToRgb(h,s=1,l=.5){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return [f(0),f(8),f(4)].map(x=>Math.round(x*255));}
function outputWave(enabled,mode,level,rate,t){if(!enabled)return 0;if(mode==="Blink")return Math.sin(t*Math.max(.1,rate)*Math.PI*2)>=0?level:0;if(mode==="Pulse")return level*(.18+.82*wave(t,Math.max(.1,rate)));return level;}
function state(active,value,level,extra={}){return {active:!!active,value:String(value),level:pct(level),...extra};}

function valueFor(component,t=0,index=0){
  const type=component?.type||"",kind=TYPE_KIND[type]||"generic",v=controlsFor(component),phase=wave(t,.7,index*.41);
  switch(kind){
    case"led":{const level=outputWave(v.enabled,v.mode,v.level,v.rate,t);return state(level>1,level>1?`ON · ${Math.round(level)}%`:"OFF",level,{effect:v.mode});}
    case"rgb":{const hue=(v.hue+(v.pattern==="Rainbow"?t*v.rate*90:0))%360,level=outputWave(v.enabled,v.pattern==="Blink"?"Blink":"Steady",v.level,v.rate,t),rgb=hslToRgb(hue,1,.5);return state(level>1,`RGB ${rgb.join(", ")} · ${Math.round(level)}%`,level,{rgb,effect:v.pattern});}
    case"display":{const shown=v.animate?(type==="LCD1602"?`${v.content} ${Math.floor(t)%100}`:String(Math.floor(t*4)%10000).padStart(type==="SevenSegment"?1:4,"0")):v.content;return state(v.enabled,shown,v.enabled?v.level:0,{effect:v.animate?"animate":"steady"});}
    case"climate":{const delta=(phase-.5)*2*v.variation,temp=v.temperature+delta,humidity=clamp(v.humidity+delta*1.8,0,100),pressure=v.pressure==null?null:v.pressure+delta;return state(true,pressure==null?`${temp.toFixed(1)}°C · ${humidity.toFixed(0)}% RH`:`${temp.toFixed(1)}°C · ${humidity.toFixed(0)}% RH · ${pressure.toFixed(1)} hPa`,humidity,{temperature:temp,humidity,pressure});}
    case"distance":{const unit=type==="VL53L0X"?"mm":"cm",movement=(phase-.5)*2*v.variation/100*v.distance,distance=v.target?Math.max(0,v.distance+movement):null;return state(v.target,distance==null?"NO TARGET":`${distance.toFixed(unit==="mm"?0:1)} ${unit}`,distance==null?0:100-clamp(distance/(type==="VL53L0X"?20:4),0,100),{distance});}
    case"analog":{const input=clamp(v.input+(phase-.5)*2*v.noise,0,100),raw=Math.round(input/100*4095);return state(true,`${raw} · ${input.toFixed(1)}%`,input,{raw});}
    case"digital":{const high=v.autoPulse?Math.sin(t*v.rate*Math.PI*2)>=0:v.triggered;return state(high,high?"HIGH":"LOW",high?100:0);}
    case"encoder":{const position=v.autoRotate?Math.round(v.position+t*v.rate*6):Math.round(v.position);return state(true,`Position ${position}${v.pressed?" · PRESSED":""}`,Math.abs(position)%101,{position,pressed:v.pressed});}
    case"output":{const level=outputWave(v.enabled,v.mode,v.level,v.rate,t);return state(level>1,level>1?`${type==="Relay"?"CONTACT CLOSED":"ON"} · ${Math.round(level)}%`:type==="Relay"?"CONTACT OPEN":"OFF",level,{effect:v.mode,sound:type==="Relay"||type==="Solenoid"?{type:"click",gain:.05}:null});}
    case"pwm":{const level=v.enabled?(v.sweep?Math.round(wave(t,v.rate)*100):v.level):0;return state(level>0,`PWM ${level}%`,level,{duty:level});}
    case"servo":{const angle=v.enabled?(v.sweep?Math.round(5+wave(t,v.rate)*170):v.angle):v.angle;return state(v.enabled,`${angle}°`,angle/1.8,{angle,sound:v.enabled?{type:"servo",frequency:75+angle/4,gain:.012}:null});}
    case"motor":{const level=v.enabled&&v.direction!=="Brake"?v.throttle:0,maxRpm=type==="StepperMotor"?900:type==="TTGearMotor"?320:type==="FanMotor"?4200:2600,rpm=Math.round(level/100*maxRpm*(1-v.load*.005));const value=type==="StepperMotor"?`${Math.floor(t*rpm/60*200)%2000} steps · ${v.direction}`:type==="WaterPump"?`${(level*.065).toFixed(2)} L/min · load ${v.load}%`:`${rpm} RPM · ${v.direction} · load ${v.load}%`;return state(level>0,value,level,{direction:v.direction,rpm,sound:v.sound&&level?{type:"motor",frequency:45+level*1.8,gain:.008+level/7000}:null});}
    case"bus":{const online=v.connected,packets=online&&v.activity?Math.round((2+v.traffic*2.4)*(1-v.errors/100)):0;return state(online,online?`${packets} packets/s · ${v.errors?`${v.errors}% errors`:"OK"}`:"OFFLINE",online?v.traffic:0,{packets,errors:v.errors});}
    case"pulse":{const hz=v.enabled?Math.max(0,v.frequency*(1+(phase-.5)*2*v.jitter/100)):0;if(type==="FlowSensor")return state(hz>0,`${(hz*60/450).toFixed(2)} L/min · ${hz.toFixed(1)} Hz`,clamp(hz/5,0,100),{frequency:hz});if(type==="RPMSensor"||type==="HallSensor"||type==="PhotoInterrupt")return state(hz>0,`${Math.round(hz*60)} RPM · ${hz.toFixed(1)} Hz`,clamp(hz/5,0,100),{frequency:hz});return state(hz>0,`${hz.toFixed(1)} Hz · ${Math.round(t*hz)} pulses`,clamp(hz/5,0,100),{frequency:hz});}
    case"gps":return state(v.fix,v.fix?`${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)} · ${v.speed.toFixed(1)} km/h · ${v.satellites} sat`:"NO FIX",v.fix?clamp(v.satellites*6,0,100):0,{latitude:v.latitude,longitude:v.longitude,speed:v.speed});
    case"motion":{const auto=v.autoMove?(phase-.5)*2*v.shake:0,roll=v.roll+auto,pitch=v.pitch+auto*.65;return state(true,`R ${roll.toFixed(1)}° · P ${pitch.toFixed(1)}° · shake ${v.shake}%`,v.shake,{roll,pitch,shake:v.shake});}
    case"light":{const lux=Math.max(0,v.lux*(1+(phase-.5)*2*v.flicker/100));return state(true,`${Math.round(lux)} lux`,clamp(Math.log10(lux+1)*22,0,100),{lux});}
    case"soil":{const adjusted=clamp(v.moisture-v.salinity*.08,0,100),raw=Math.round(adjusted/100*4095);return state(true,`${adjusted.toFixed(0)}% moisture · ${v.temperature.toFixed(1)}°C · ADC ${raw}`,adjusted,{raw,moisture:adjusted});}
    case"gas":{const factors={"Clean air":.02,LPG:1,Smoke:.82,CO:.68,Alcohol:.55,Methane:.92},effective=v.source?v.concentration*(factors[v.gasType]||1)*(1-v.freshAir*.0075)*(1+Math.abs(v.humidity-50)*.004):0,raw=Math.round(clamp(90+effective/2000*4005,0,4095)),risk=effective>700?"DANGER":effective>250?"MODERATE":"CLEAN",level=clamp(effective/10,0,100);return state(effective>5,`${v.gasType} · ${Math.round(effective)} ppm · ADC ${raw} · ${risk}`,level,{raw,ppm:effective,risk,sound:v.alarm&&risk==="DANGER"?{type:"alarm",frequency:980,gain:.035}:null});}
    case"voltage":{const voltage=Math.max(0,v.voltage*(1+(phase-.5)*2*v.ripple/100)),raw=Math.round(clamp(voltage/25*4095,0,4095));return state(voltage>.01,`${voltage.toFixed(2)} V · ADC ${raw}`,voltage/25*100,{voltage,raw});}
    case"current":{const current=v.current+(phase-.5)*2*v.noise/100*Math.max(1,Math.abs(v.current)),raw=Math.round(clamp((current+30)/60*4095,0,4095));return state(Math.abs(current)>.01,`${current.toFixed(2)} A · ${current>=0?"FORWARD":"REVERSE"} · ADC ${raw}`,Math.abs(current)/30*100,{current,raw,direction:current>=0?"forward":"reverse"});}
    case"soundSensor":{const level=v.burst?clamp(v.level+wave(t,2.4)*30,0,120):v.level,raw=Math.round(level/120*4095);return state(level>5,`${Math.round(level)} dB · ${v.frequency} Hz · ADC ${raw}`,level/1.2,{raw,decibels:level,sound:v.audible?{type:"tone",frequency:v.frequency,gain:clamp(level/120*.035,0,.035)}:null});}
    case"rain":{const wet=clamp(v.rain+(phase-.5)*2*v.droplets/10,0,100),raw=Math.round(wet/100*4095);return state(wet>2,`${wet.toFixed(0)}% wet · ADC ${raw}`,wet,{raw});}
    case"water":{const level=clamp(v.level+(phase-.5)*2*v.waves/10,0,100),raw=Math.round(level/100*4095);return state(level>1,`${level.toFixed(0)}% · ADC ${raw}`,level,{raw});}
    case"temperature":{const temperature=v.temperature+(phase-.5)*2*v.variation;return state(true,`${temperature.toFixed(1)}°C`,clamp((temperature+55)/1.8,0,100),{temperature});}
    case"motionDigital":{const detected=v.autoWalk?Math.sin(t*.8*Math.PI*2)>0:v.motion,valid=detected&&v.distance<=8;return state(valid,valid?`MOTION · ${v.distance.toFixed(1)} m`:"CLEAR",valid?100:0);}
    case"reed":{const closed=v.magnet&&v.distance<35;return state(closed,closed?"MAGNET · CLOSED":"OPEN",closed?100:0);}
    case"touch":return state(v.touched,v.touched?`TOUCHED · ${v.strength}%`:"RELEASED",v.touched?v.strength:0);
    case"flame":{const detected=v.flame&&v.distance<220&&v.intensity>10;return state(detected,detected?`FLAME · ${v.distance} cm · ${v.intensity}%`:"NO FLAME",detected?v.intensity:0);}
    case"obstacle":{const detected=v.obstacle&&v.distance<45&&v.reflectivity>15;return state(detected,detected?`OBSTACLE · ${v.distance} cm`:"CLEAR",detected?100-v.distance*2:0);}
    case"remote":{const received=v.received||v.repeat>0&&Math.sin(t*v.repeat*Math.PI*2)>0;return state(received,received?`RX ${v.command}`:"WAITING",received?100:0);}
    case"line":{const detected=v.line&&Math.abs(v.position)<55&&v.contrast>20;return state(detected,detected?`LINE · offset ${v.position}% · contrast ${v.contrast}%`:"NO LINE",detected?v.contrast:0);}
    case"buzzer":{const frequency=v.sweep?v.frequency*(.55+wave(t,.8)*.9):v.frequency;return state(v.enabled,v.enabled?`${Math.round(frequency)} Hz · volume ${v.volume}%`:"SILENT",v.enabled?v.volume:0,{frequency,sound:v.enabled?{type:"buzzer",frequency,gain:v.volume/3000}:null});}
    case"joystick":{const x=v.autoMove?Math.round((wave(t,.35)-.5)*200):v.x,y=v.autoMove?Math.round((wave(t,.48,1.4)-.5)*200):v.y;return state(true,`X ${x}% · Y ${y}%${v.pressed?" · PRESSED":""}`,Math.max(Math.abs(x),Math.abs(y)),{x,y,pressed:v.pressed});}
    case"pca":{const angle=v.sweep?Math.round(5+wave(t,v.rate)*170):v.angle;return state(true,`CH${v.channel} · ${angle}°`,angle/1.8,{angle,channel:v.channel});}
    case"pressure":{const pressure=v.pressure+(phase-.5)*2*v.variation;return state(true,`${pressure.toFixed(1)} hPa · ${v.temperature.toFixed(1)}°C`,clamp((pressure-300)/8,0,100),{pressure,temperature:v.temperature});}
    case"weight":{const weight=Math.max(0,v.weight+v.tare+(phase-.5)*2*v.vibration/100),raw=Math.round(weight*100000);return state(weight>.001,`${weight.toFixed(2)} kg · ${raw} counts`,clamp(weight/50*100,0,100),{weight,raw});}
    case"rfid":{const read=v.card&&v.distance<45;return state(read,read?`UID ${v.uid} · READ OK`:v.card?"CARD TOO FAR":"NO CARD",read?100:0,{uid:v.uid});}
    case"storage":{const active=v.mounted&&v.operation!=="Idle",ok=v.mounted&&v.errors<15;return state(active,v.mounted?`${v.operation} · ${v.used}% used · ${ok?"OK":`${v.errors}% errors`}`:"NO CARD",active?65:0,{operation:v.operation});}
    case"keypad":{const key=v.autoType?"123A456B789C*0#D"[Math.floor(t*2)%16]:v.key,pressed=v.autoType||v.pressed;return state(pressed,pressed?`KEY ${key}`:"NO KEY",pressed?100:0,{key});}
    case"clock":{const now=new Date(Date.now()+v.offset*60000+(v.running?0:-t*1000));return state(v.running,`${now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})} · ${v.battery?"BAT OK":"BAT LOW"}`,v.battery?100:45,{timestamp:now.toISOString()});}
    case"radio":{const received=v.connected?v.traffic*(1-v.loss/100):0;return state(v.connected,`${received.toFixed(1)} pkt/s · ${v.signal} dBm · ${v.loss}% loss`,clamp((v.signal+140)/1.2,0,100),{packets:received});}
    case"can":{const frames=v.connected?Math.round(v.traffic*(1-v.errors/100)):0;return state(v.connected,`${frames} fps · load ${v.load}% · ${v.errors}% errors`,v.connected?v.load:0,{frames});}
    case"tilt":{const angle=v.autoTilt?(wave(t,.4)-.5)*180:v.angle,triggered=Math.abs(angle)>=v.threshold;return state(triggered,`${angle.toFixed(0)}° · ${triggered?"TILTED":"LEVEL"}`,triggered?100:0,{angle});}
    default:return state(v.enabled!==false,`${Math.round(v.level||0)}% ACTIVE`,v.level||0);
  }
}

function create(options={}){
  const getDesign=typeof options.getDesign==="function"?options.getDesign:()=>({components:[]}),onFrame=typeof options.onFrame==="function"?options.onFrame:()=>{};
  let running=false,timer=null,startedAt=0;
  function frame(){if(!running)return;const elapsed=(Date.now()-startedAt)/1000,design=getDesign()||{components:[]};onFrame({running:true,elapsed,components:(design.components||[]).map((component,index)=>({id:component.id,type:component.type,profile:profileFor(component).kind,...valueFor(component,elapsed,index)}))});}
  function start(){if(running)return false;running=true;startedAt=Date.now();frame();timer=setInterval(frame,120);return true;}
  function stop(){if(!running)return false;running=false;if(timer)clearInterval(timer);timer=null;onFrame({running:false,elapsed:0,components:[]});return true;}
  return {start,stop,toggle(){return running?(stop(),false):(start(),true);},isRunning(){return running;},frame};
}
g.ZebjusCircuitSimulator={VERSION,TYPE_KIND,profileFor,controlsFor,setControl,valueFor,create};
})(globalThis);
