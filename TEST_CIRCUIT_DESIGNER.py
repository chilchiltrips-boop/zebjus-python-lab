from pathlib import Path
import subprocess, json, sys, types, xml.etree.ElementTree as ET, re
ROOT=Path(__file__).resolve().parent
NODE=r'''
const fs=require('fs'),vm=require('vm');
global.localStorage={m:new Map(),getItem(k){return this.m.has(k)?this.m.get(k):null},setItem(k,v){this.m.set(k,String(v))},removeItem(k){this.m.delete(k)}};
global.StorageEvent=function(t,o){this.type=t;Object.assign(this,o||{})};global.dispatchEvent=()=>{};
global.document={};global.BroadcastChannel=class{constructor(name){this.name=name;global.__designBus=this}addEventListener(type,fn){if(type==='message')this.listener=fn}postMessage(data){this.sent=data}};
vm.runInThisContext(fs.readFileSync(process.argv[1],'utf8'));
vm.runInThisContext(fs.readFileSync(process.argv[2],'utf8'));
function one(type){const d=ZebjusCircuit.newDesign(),c=ZebjusCircuit.addComponent(d,type);let error=null,issues=[],code='';try{ZebjusCircuit.autoWireComponent(d,c.id);issues=ZebjusCircuit.validateDesign(d);code=ZebjusCircuit.generatePython(d);}catch(e){error=String(e.message||e)}return {type,error,issues,code,connections:d.connections};}
const out=ZebjusCircuitLibrary.COMPONENTS.map(m=>one(m.type));
// shared I2C with unique addresses reuses one pair
const sd=ZebjusCircuit.newDesign();for(const t of ['OLED','LCD1602','MPU6050','I2CDevice']){const c=ZebjusCircuit.addComponent(sd,t);ZebjusCircuit.autoWireComponent(sd,c.id)}const si=ZebjusCircuit.validateDesign(sd),pairs={};for(const w of sd.connections){if(w.kind==='i2cSda'||w.kind==='i2cScl')(pairs[w.kind]??=new Set()).add(w.boardPin)}
// incompatible pin rejection
let adcRejected=false,outRejected=false,i2cConflictRejected=false;try{const d=ZebjusCircuit.newDesign(),c=ZebjusCircuit.addComponent(d,'ADC');ZebjusCircuit.connect(d,c.id,'AO','GPIO13')}catch(e){adcRejected=true}try{const d=ZebjusCircuit.newDesign(),c=ZebjusCircuit.addComponent(d,'PWM');ZebjusCircuit.connect(d,c.id,'PWM','GPIO34')}catch(e){outRejected=true}try{const d=ZebjusCircuit.newDesign(),a=ZebjusCircuit.addComponent(d,'OLED');ZebjusCircuit.autoWireComponent(d,a.id);const b=ZebjusCircuit.addComponent(d,'PWM');ZebjusCircuit.connect(d,b.id,'PWM','GPIO21')}catch(e){i2cConflictRejected=true}
// I2C duplicate address on same bus must error
const id=ZebjusCircuit.newDesign();for(let i=0;i<2;i++){const c=ZebjusCircuit.addComponent(id,'LCD1602');ZebjusCircuit.autoWireComponent(id,c.id)}const i2cDup=ZebjusCircuit.validateDesign(id).filter(x=>x.level==='error').map(x=>x.message);
// UART: two auto devices -> ports 1,2; third must error
const ud=ZebjusCircuit.newDesign();for(const t of ['UART','GPS']){const c=ZebjusCircuit.addComponent(ud,t);ZebjusCircuit.autoWireComponent(ud,c.id)}const uartCode=ZebjusCircuit.generatePython(ud);const u3=ZebjusCircuit.addComponent(ud,'UART');try{ZebjusCircuit.autoWireComponent(ud,u3.id)}catch(_){}const uart3Issues=ZebjusCircuit.validateDesign(ud).filter(x=>x.level==='error').map(x=>x.message);
// SPI: auto devices share SCK/MISO/MOSI and get different CS on bus 1
const sp=ZebjusCircuit.newDesign();for(let i=0;i<3;i++){const c=ZebjusCircuit.addComponent(sp,'SPI');ZebjusCircuit.autoWireComponent(sp,c.id)}const spiIssues=ZebjusCircuit.validateDesign(sp).filter(x=>x.level==='error');const spiCode=ZebjusCircuit.generatePython(sp);const spiLines={};for(const c of sp.components){spiLines[c.id]={};for(const n of ['SCK','MISO','MOSI','CS'])spiLines[c.id][n]=ZebjusCircuit.connectionFor(sp,c.id,n)?.boardPin}
// bus 2 explicitly must use a separately allocated triplet
const sp2=ZebjusCircuit.newDesign(),s1=ZebjusCircuit.addComponent(sp2,'SPI'),s2=ZebjusCircuit.addComponent(sp2,'SPI');ZebjusCircuit.setProperty(sp2,s2.id,'bus',2);ZebjusCircuit.autoWireComponent(sp2,s1.id);ZebjusCircuit.autoWireComponent(sp2,s2.id);const spi2Issues=ZebjusCircuit.validateDesign(sp2).filter(x=>x.level==='error'),spi2Code=ZebjusCircuit.generatePython(sp2);
// SingleLED numbering is based on LED ordinal, not overall component index
const ld=ZebjusCircuit.newDesign();for(const t of ['SingleLED','RGBLED','SingleLED']){const c=ZebjusCircuit.addComponent(ld,t);ZebjusCircuit.autoWireComponent(ld,c.id)}const ledCode=ZebjusCircuit.generatePython(ld);
// generated block must be before the first top-level LIVE loop
const live='from js import Date\n\nprint("start")\n\nwhile True:\n    print(Date.new())\n';const inserted=ZebjusCircuit.applyGeneratedBlock(live,'from zebjus import DHT11\n\ndht11 = DHT11(pin=13)\n');const whilePos=inserted.indexOf('while True:'),blockPos=inserted.indexOf('# === ZEBJUS CIRCUIT AUTO-GENERATED START ===');
// property editing and migration
const pd=ZebjusCircuit.newDesign(),pc=ZebjusCircuit.addComponent(pd,'I2CDevice');ZebjusCircuit.setProperty(pd,pc.id,'address',0x55);const propAddress=pc.properties.address;localStorage.setItem(ZebjusCircuit.LEGACY_STORAGE,JSON.stringify({version:1,name:'Old',width:1800,height:1000,components:[{id:'LCD16021',type:'LCD1602',x:2,y:3,properties:{}}],connections:[]}));localStorage.removeItem(ZebjusCircuit.STORAGE);const migrated=ZebjusCircuit.loadDesign();const od=ZebjusCircuit.newDesign(),oc=ZebjusCircuit.addComponent(od,'DHT11');oc.rotation=90;oc.flipX=true;oc.flipY=false;const orient=ZebjusCircuit.normalizeDesign(od).components[0];
const zeroBoard=ZebjusCircuit.normalizeDesign({version:2,name:'Edge',width:2400,height:1600,board:{x:0,y:0},components:[],connections:[]}).board;
// BroadcastChannel shared-page design propagation.
let broadcastSeen=null;const stopListen=ZebjusCircuit.onDesignChange(x=>broadcastSeen=x);const bd=ZebjusCircuit.newDesign();bd.name='From schematic';__designBus.listener({data:{type:'design',design:bd}});stopListen();const savedBroadcast=ZebjusCircuit.newDesign();savedBroadcast.name='From circuit';ZebjusCircuit.saveDesign(savedBroadcast);const broadcast={channel:__designBus.name,seen:broadcastSeen?.name,sent:__designBus.sent?.design?.name};
// resource limits
const td=ZebjusCircuit.newDesign();for(let i=0;i<5;i++){const c=ZebjusCircuit.addComponent(td,'TM1637');try{ZebjusCircuit.autoWireComponent(td,c.id)}catch(_){}}const tmLimit=ZebjusCircuit.validateDesign(td).some(x=>x.level==='error'&&/TM1637 limit exceeded/.test(x.message));
const cd=ZebjusCircuit.newDesign();for(let i=0;i<9;i++){const c=ZebjusCircuit.addComponent(cd,'CounterInput');try{ZebjusCircuit.autoWireComponent(cd,c.id)}catch(_){}}const counterLimit=ZebjusCircuit.validateDesign(cd).some(x=>x.level==='error'&&/Counter-input limit exceeded/.test(x.message));
// live capability profile update
ZebjusCircuit.setBridgeCapabilities({gpioOut:[13,14],gpioIn:[13,14,34],adc1:[34],counterPins:[34],uartPorts:[1],spiBuses:[1],counterSlots:2,tm1637Slots:2,lcd1602Slots:2});const caps=ZebjusCircuit.getCapabilities();
process.stdout.write(JSON.stringify({out,sharedIssues:si,pairs:{sda:[...(pairs.i2cSda||[])],scl:[...(pairs.i2cScl||[])]},adcRejected,outRejected,i2cConflictRejected,i2cDup,uartCode,uart3Issues,spiIssues,spiCode,spiLines,spi2Issues,spi2Code,ledCode,inserted,whilePos,blockPos,propAddress,migrated,zeroBoard,broadcast,tmLimit,counterLimit,caps,orient,count:ZebjusCircuitLibrary.COMPONENTS.length}));
'''
raw=subprocess.check_output(['node','-e',NODE,str(ROOT/'component-library.js'),str(ROOT/'circuit-sync.js')],text=True)
data=json.loads(raw)
assert data['count']==80
fail=[]
for item in data['out']:
    errs=[x for x in item['issues'] if x.get('level')=='error']
    if item['error'] or errs: fail.append((item['type'],item['error'],errs))
if fail: raise SystemExit(f'Circuit auto-wire failures: {fail}')
assert data['pairs']['sda']==['GPIO21'] and data['pairs']['scl']==['GPIO22'],data['pairs']
assert not [x for x in data['sharedIssues'] if x.get('level')=='error']
assert data['adcRejected'] and data['outRejected'] and data['i2cConflictRejected']
assert any('address' in x.lower() for x in data['i2cDup']),data['i2cDup']
assert 'port=1' in data['uartCode'] and 'port=2' in data['uartCode'],data['uartCode']
assert any('only 2 UART ports' in x for x in data['uart3Issues']),data['uart3Issues']
assert not data['spiIssues'],data['spiIssues']
vals=list(data['spiLines'].values());assert len({v['SCK'] for v in vals})==1 and len({v['MISO'] for v in vals})==1 and len({v['MOSI'] for v in vals})==1;assert len({v['CS'] for v in vals})==3
assert data['spiCode'].count('bus=1')==3
assert not data['spi2Issues'];assert 'bus=1' in data['spi2Code'] and 'bus=2' in data['spi2Code']
assert 'from zebjus import LED1, RGBLED, LED2' in data['ledCode'],data['ledCode']
assert data['blockPos']>=0 and data['blockPos']<data['whilePos'],data['inserted']
assert data['propAddress']==0x55 and data['migrated']['version']==2 and data['migrated']['components'][0]['properties']['address']==0x27
assert data['zeroBoard']=={'x':0,'y':0},data['zeroBoard']
assert data['broadcast']=={'channel':'zebjus-circuit-design-v2','seen':'From schematic','sent':'From circuit'},data['broadcast']
assert data['tmLimit'] and data['counterLimit']
assert data['caps']['gpioOut']==[13,14] and data['caps']['uartPorts']==[1]
assert data['orient']['rotation']==90 and data['orient']['flipX'] is True and data['orient']['flipY'] is False

# Generated code compilation plus keyword-signature validation.
allowed={
'RGBLED':set(),'TM1637':{'clk','dio','brightness'},'LCD1602':{'sda','scl','address','bus'},'OLED':{'sda','scl','address'},'DHT11':{'pin'},'Ultrasonic':{'trig','echo'},
'Potentiometer':{'pin'},'AnalogInput':{'pin'},'Switch':{'pin'},'DigitalInput':{'pin'},'RotaryEncoder':{'clk','dt','switch'},'DigitalOutput':{'pin'},'GPIOInput':{'pin'},'PulseInput':{'pin'},'PulseOutput':{'pin'},'CounterInput':{'pin','edge','pullup'},'Relay':{'pin'},'ADC':{'pin'},'LDR':{'pin'},'SoilMoisture':{'pin'},'GasSensor':{'pin'},'VoltageSensor':{'pin'},'SoundSensor':{'pin'},'RainSensor':{'pin'},'WaterLevelSensor':{'pin'},'Thermistor':{'pin'},'PWM':{'pin','frequency','resolution'},'PWMServo':{'pin','min_us','max_us','frequency'},'MotorDriver':{'in1','in2','pwm_pin','frequency'},'I2C':{'sda','scl','frequency','bus'},'I2CDevice':{'address','sda','scl','frequency','bus'},'UART':{'rx','tx','baud','port'},'GPS':{'rx','tx','baud','port'},'SPI':{'sck','miso','mosi','cs','frequency','mode','bus','lsb_first','active_low'},'HardwareTransaction':set(),'MPU6050':{'sda','scl','address','bus'},'PIRSensor':{'pin'},'ReedSwitch':{'pin'},'TouchSensor':{'pin'},'FlameSensor':{'pin'},'FlowSensor':{'pin','pulses_per_liter','edge','pullup'},'RPMSensor':{'pin','pulses_per_revolution','edge','pullup'},'Buzzer':{'pin','frequency'},'Joystick':{'x_pin','y_pin','switch_pin'},
'DCMotor':{'in1','in2','pwm_pin','frequency'},'TTGearMotor':{'in1','in2','pwm_pin','frequency'},'StepperMotor':{'in1','in2','in3','in4','steps_per_revolution'},'BLDCESC':{'pin','frequency'},'FanMotor':{'pin'},'WaterPump':{'pin'},'Solenoid':{'pin'},'VibrationMotor':{'pin'},'PCA9685':{'sda','scl','address','bus','frequency'},'LSM6DS3':{'sda','scl','address','bus'},'BME280':{'sda','scl','address','bus'},'BMP280':{'sda','scl','address','bus'},'ADXL345':{'sda','scl','address','bus'},'BH1750':{'sda','scl','address','bus'},'VL53L0X':{'sda','scl','address','bus'},'DS18B20':{'pin'},'IRObstacle':{'pin'},'IRReceiver':{'pin'},'LineSensor':{'pin'},'HallSensor':{'pin'},'FlexSensor':{'pin'},'CurrentSensor':{'pin'},'HX711':{'data_pin','clock_pin','scale'},'RC522':{'sck','miso','mosi','cs','bus'},'MicroSD':{'sck','miso','mosi','cs','bus'},'MAX7219':{'sck','miso','mosi','cs','bus','brightness'},'NeoPixel':{'pin','count'},'Keypad4x4':{'rows','cols'},'DS3231':{'sda','scl','address','bus'},'LoRaSX1278':{'sck','miso','mosi','cs','bus','frequency'},'MCP2515':{'sck','miso','mosi','cs','interrupt_pin','bus','bitrate'},'PhotoInterrupt':{'pin'},'TiltSensor':{'pin'},'LaserModule':{'pin'},'SevenSegment':{'pins'}
}
class Stub:
    def __init__(self,*args,**kwargs): self.args=args;self.kwargs=kwargs

def make(name):
    class S:
        def __init__(self,*args,**kwargs):
            if name.startswith('LED') and name[3:].isdigit(): return
            bad=set(kwargs)-allowed.get(name,set())
            if bad: raise TypeError(f'{name} unexpected kwargs {sorted(bad)}')
    S.__name__=name;return S
z=types.ModuleType('zebjus')
all_codes=[x['code'] for x in data['out']]+[data['uartCode'],data['spiCode'],data['spi2Code'],data['ledCode']]
for code in all_codes:
    compile(code,'<circuit-generated>','exec')
    m=re.search(r'^from zebjus import (.+)$',code,re.M)
    if m:
        for name in [x.strip() for x in m.group(1).split(',')]: setattr(z,name,make(name))
sys.modules['zebjus']=z
for code in all_codes: exec(compile(code,'<circuit-exec>','exec'),{}, {})
# 2D-only SVG validation + pin-label evidence.
svg=list(ROOT.glob('*.svg'));assert len(svg)==81
assert not list(ROOT.glob('*-3d.svg'))
assert all(f.name.endswith('-2d.svg') for f in svg)
for f in svg:
    r=ET.parse(f).getroot();assert r.tag.endswith('svg') and r.attrib.get('data-realistic')=='top-view'
for name in ('tm1637-2d.svg','lcd1602-2d.svg','ultrasonic-2d.svg','zebjus-custom-board-38pin-2d.svg'):
    txt=(ROOT/name).read_text();assert '<text' in txt and ('GPIO' in txt or 'VCC' in txt or name=='zebjus-custom-board-38pin-2d.svg')

# Pin-safe shared router + interactive simulation profiles cover every component.
SIM_NODE=r'''
const fs=require('fs'),vm=require('vm');
for(const file of process.argv.slice(1))vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const L=ZebjusCircuitLibrary,S=ZebjusCircuitSimulator,R=ZebjusWireRouter;
const missing=L.COMPONENTS.filter(c=>!S.TYPE_KIND[c.type]).map(c=>c.type),states=L.COMPONENTS.map((c,i)=>({type:c.type,...S.valueFor(c,1.25,i)}));
const gas={type:'GasSensor',simulation:{source:true,gasType:'Smoke',concentration:1000,freshAir:0,humidity:50,alarm:true}},gasDirty=S.valueFor(gas,0,0);gas.simulation.freshAir=90;const gasVentilated=S.valueFor(gas,0,0);
const led={type:'SingleLED',simulation:{enabled:true,mode:'Blink',level:100,rate:1}},ledOn=S.valueFor(led,.1,0),ledOff=S.valueFor(led,.6,0);
const motor={type:'DCMotor',simulation:{enabled:true,throttle:80,direction:'CCW',load:20,sound:true}},motorState=S.valueFor(motor,1,0);
const pins=[{x:100,y:100,key:'start',radius:18},{x:300,y:100,key:'end',radius:18},{x:200,y:100,key:'blocked',radius:18},{x:200,y:140,key:'blocked2',radius:18}];
const route=R.route({start:pins[0],end:pins[1],startLead:{x:100,y:130},endLead:{x:300,y:130},pins,exclude:['start','end'],bounds:{minX:0,minY:0,maxX:400,maxY:300}}),label=R.labelPlacement({points:route.points,text:'SIG→GPIO32',pins,exclude:['start','end'],bounds:{minX:0,minY:0,maxX:400,maxY:300}});
const occupied=[],multi=[];for(let i=0;i<24;i++){const y=35+(i%8)*28,a={x:25,y},b={x:375,y:45+(i%12)*18},r=R.route({start:a,startLead:{x:47,y},end:b,endLead:{x:353,y:b.y},pins,exclude:[],occupied,index:i,bounds:{minX:0,minY:0,maxX:400,maxY:300}});occupied.push(r.points);multi.push(r)}
const congestion=multi.reduce((total,r,i)=>{const c=R.congestionScore(r.points,multi.slice(0,i));total.overlaps+=c.overlaps;total.crossings+=c.crossings;return total},{overlaps:0,crossings:0});
process.stdout.write(JSON.stringify({count:L.COMPONENTS.length,profiles:Object.keys(S.TYPE_KIND).length,missing,validStates:states.every(x=>typeof x.value==='string'&&Number.isFinite(x.level)&&x.level>=0&&x.level<=100),gasDirty,gasVentilated,ledOn,ledOff,motorState,route,label,multiConflicts:multi.reduce((n,r)=>n+r.conflicts.length,0),congestion}));
'''
sim_data=json.loads(subprocess.check_output(['node','-e',SIM_NODE,str(ROOT/'component-library.js'),str(ROOT/'circuit-simulator.js'),str(ROOT/'wire-router.js')],text=True))
assert sim_data['count']==80 and sim_data['profiles']==80 and not sim_data['missing'] and sim_data['validStates']
assert sim_data['gasDirty']['ppm']>sim_data['gasVentilated']['ppm'] and sim_data['gasDirty']['raw']>sim_data['gasVentilated']['raw']
assert sim_data['ledOn']['active'] is True and sim_data['ledOff']['active'] is False
assert sim_data['motorState']['direction']=='CCW' and sim_data['motorState']['rpm']>0 and sim_data['motorState']['sound']['type']=='motor'
assert not sim_data['route']['conflicts'] and len(sim_data['route']['points'])>=4 and sim_data['label']['width']>=72
assert sim_data['multiConflicts']==0 and sim_data['congestion']['overlaps']>=0
print(f'Circuit Designer v6.8.1 regression PASS: 80/80 devices + simulation profiles; pin-safe shared router; gas/air mixing; motor/LED effects; 38-pin board; UART/SPI/I2C combinations; BroadcastChannel sync; generated Python; {len(svg)} realistic 2D assets')
