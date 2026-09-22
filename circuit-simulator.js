(function(g){
"use strict";
const motors=new Set(["MotorDriver","DCMotor","TTGearMotor","StepperMotor","BLDCESC","FanMotor","WaterPump","VibrationMotor"]);
const binaryOutputs=new Set(["SingleLED","DigitalOutput","Relay","PulseOutput","Solenoid","LaserModule"]);
const digitalInputs=new Set(["Switch","DigitalInput","GPIOInput","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","IRObstacle","IRReceiver","LineSensor","TiltSensor"]);
const analogInputs=new Set(["Potentiometer","AnalogInput","ADC","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor","FlexSensor","CurrentSensor"]);
const buses=new Set(["I2C","I2CDevice","UART","SPI","HardwareTransaction","RC522","MicroSD","LoRaSX1278","MCP2515"]);
function wave(t,offset=0,speed=1){return (Math.sin(t*speed+offset)+1)/2;}
function pct(x){return Math.round(Math.max(0,Math.min(1,x))*100);}
function valueFor(c,t,index){
  const type=c.type,w=wave(t,index*.71,.9),slow=wave(t,index*.33,.35),active=true;
  if(motors.has(type))return {active,value:type==="StepperMotor"?`${Math.round(t*120)%2048} steps`:`${Math.round(35+w*60)}% · ${Math.sin(t*.35)>-.2?"CW":"CCW"}`,level:pct(w)};
  if(binaryOutputs.has(type))return {active:Math.sin(t*1.7+index)>.05,value:Math.sin(t*1.7+index)>.05?"ON":"OFF",level:Math.sin(t*1.7+index)>.05?100:0};
  if(type==="RGBLED"||type==="NeoPixel")return {active,value:`RGB ${Math.round(255*w)}, ${Math.round(255*(1-w))}, ${Math.round(255*slow)}`,level:pct(w)};
  if(type==="PWM"||type==="PWMServo")return {active,value:type==="PWMServo"?`${Math.round(15+w*150)}°`:`PWM ${pct(w)}%`,level:pct(w)};
  if(type==="Buzzer")return {active,value:`${Math.round(350+w*1650)} Hz`,level:pct(w)};
  if(type==="TM1637"||type==="SevenSegment")return {active,value:String(Math.round(t*10)%10000).padStart(type==="TM1637"?4:1,"0"),level:85};
  if(type==="LCD1602")return {active,value:"ZEBJUS · RUNNING",level:100};
  if(type==="OLED"||type==="MAX7219")return {active,value:`Frame ${Math.round(t*8)%100}`,level:88};
  if(type==="DHT11"||type==="BME280")return {active,value:`${(25+w*5).toFixed(1)}°C · ${Math.round(52+slow*28)}% RH`,level:pct(w)};
  if(type==="BMP280")return {active,value:`${(996+w*18).toFixed(1)} hPa`,level:pct(w)};
  if(type==="DS18B20"||type==="Thermistor")return {active,value:`${(24+w*8).toFixed(1)}°C`,level:pct(w)};
  if(type==="Ultrasonic")return {active,value:`${(8+w*142).toFixed(1)} cm`,level:pct(1-w)};
  if(type==="VL53L0X")return {active,value:`${Math.round(45+w*1150)} mm`,level:pct(1-w)};
  if(type==="GPS")return {active,value:`10.050${Math.round(w*9)}, 76.620${Math.round(slow*9)}`,level:82};
  if(type==="MPU6050"||type==="LSM6DS3"||type==="ADXL345")return {active,value:`R ${(w*30-15).toFixed(1)}° · P ${(slow*20-10).toFixed(1)}°`,level:pct(w)};
  if(type==="BH1750"||type==="LDR")return {active,value:`${Math.round(40+w*860)} lux`,level:pct(w)};
  if(type==="FlowSensor")return {active,value:`${(1+w*8).toFixed(2)} L/min`,level:pct(w)};
  if(type==="RPMSensor"||type==="HallSensor"||type==="PhotoInterrupt"||type==="CounterInput")return {active,value:`${Math.round(180+w*2200)} RPM`,level:pct(w)};
  if(type==="HX711")return {active,value:`${(slow*5).toFixed(2)} kg`,level:pct(slow)};
  if(type==="DS3231")return {active,value:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}),level:100};
  if(type==="Keypad4x4")return {active,value:`Key ${"123A456B789C*0#D"[Math.round(t)%16]}`,level:80};
  if(type==="PCA9685")return {active,value:`CH0 ${Math.round(10+w*160)}°`,level:pct(w)};
  if(digitalInputs.has(type))return {active,value:Math.sin(t+index)>.1?"HIGH":"LOW",level:Math.sin(t+index)>.1?100:0};
  if(analogInputs.has(type))return {active,value:`${Math.round(w*4095)} · ${pct(w)}%`,level:pct(w)};
  if(buses.has(type))return {active,value:`${Math.round(8+w*46)} packets/s`,level:pct(w)};
  if(type==="Joystick")return {active,value:`X ${Math.round(w*4095)} · Y ${Math.round(slow*4095)}`,level:pct(w)};
  if(type==="RotaryEncoder")return {active,value:`Position ${Math.round(t*3)%100}`,level:pct(w)};
  return {active,value:"ACTIVE",level:pct(w)};
}
function create(options={}){
  const getDesign=typeof options.getDesign==="function"?options.getDesign:()=>({components:[]}),onFrame=typeof options.onFrame==="function"?options.onFrame:()=>{};
  let running=false,timer=null,startedAt=0;
  function frame(){if(!running)return;const elapsed=(Date.now()-startedAt)/1000,design=getDesign()||{components:[]};onFrame({running:true,elapsed,components:(design.components||[]).map((c,i)=>({id:c.id,type:c.type,...valueFor(c,elapsed,i)}))});}
  function start(){if(running)return false;running=true;startedAt=Date.now();frame();timer=setInterval(frame,240);return true;}
  function stop(){if(!running)return false;running=false;if(timer)clearInterval(timer);timer=null;onFrame({running:false,elapsed:0,components:[]});return true;}
  return {start,stop,toggle(){return running?(stop(),false):(start(),true);},isRunning(){return running;},frame};
}
g.ZebjusCircuitSimulator={VERSION:"1.0.0",create,valueFor};
})(globalThis);
