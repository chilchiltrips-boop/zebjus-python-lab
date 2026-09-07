from pathlib import Path
import re, sys, types, math
ROOT=Path(__file__).resolve().parent
s=(ROOT/'py-worker.js').read_text()
blocks=re.findall(r'runPythonAsync\(`([\s\S]*?)`\)',s)
assert blocks, 'Pyodide init block missing'
for i,b in enumerate(blocks,1):
    if '${' not in b: compile(b,f'<pyodide-block-{i}>','exec')

messages=[]
class Obj:
    @staticmethod
    def fromEntries(x): return dict(x)
jsmod=types.ModuleType('js');jsmod.Object=Obj;jsmod.postMessage=lambda x:messages.append(x)
sys.modules['js']=jsmod
sys.modules['pyodide']=types.ModuleType('pyodide')
ffi=types.ModuleType('pyodide.ffi');ffi.to_js=lambda x,**kwargs:x;sys.modules['pyodide.ffi']=ffi
g={};exec(blocks[0],g,g)

# Offline must be visibly simulated and non-static enough to animate.
g['_sensor_state']['simulation']=True
d=g['DHT11'](13).read();assert d['simulated'] and d['valid'] and 15<d['temperature']<45 and 0<d['humidity']<=100
u=g['Ultrasonic'](18,19).read();assert math.isfinite(u) and 2<=u<=400
a=g['AnalogInput'](34);assert 0<=a.raw()<=4095
assert isinstance(g['Switch'](32).read(),bool)
assert isinstance(g['RotaryEncoder'](32,33,14).position(),int)
gps=g['GPS'](34,16,9600,1).read();assert gps['fix'] and gps['satellites']>0
imu=g['MPU6050'](21,22,0x68,0).read();assert imu['valid'] and imu['simulated']

# Connected/no sensor response must never fall back to demo constants.
g['_sensor_state']['simulation']=False
g['_input_state']={'analog':{},'digital':{},'rotary':{},'ultrasonic':{},'dht11':{}}
g['_bridge_state']={'gpio':{},'adc':{},'pwm':{},'i2c':{},'uart':{},'spi':{},'pulse':{},'counter':{},'transaction':{}}
d=g['DHT11'](13).read();assert not d['valid'] and math.isnan(d['temperature']) and math.isnan(d['humidity']);assert g['DHT11'](13).get_values()==[]
u=g['Ultrasonic'](18,19).read();assert math.isnan(u)
imu=g['MPU6050'](21,22,0x68,0).read();assert not imu['valid'] and not imu['simulated']

# Connected/real state must pass through exactly.
g['_input_state']['dht11']['13']={'temperature':29.4,'humidity':61.2,'valid':True,'pin':13}
g['_input_state']['ultrasonic']['18,19']={'distanceCm':37.8,'valid':True,'trig':18,'echo':19}
g['_input_state']['analog']['34']={'raw':3010,'value255':187,'percent':73,'millivolts':2425,'valid':True}
g['_input_state']['digital']['32']={'state':0,'active':True,'valid':True}
g['_input_state']['rotary']['32,33,14']={'position':7,'delta':1,'direction':'CW','pressed':False,'switchState':1,'valid':True}
d=g['DHT11'](13).read();assert d['temperature']==29.4 and d['humidity']==61.2 and d['valid']
assert abs(g['Ultrasonic'](18,19).read()-37.8)<1e-6
assert g['AnalogInput'](34).raw()==3010 and g['AnalogInput'](34).read()==187
assert g['Switch'](32).read() is True
assert g['RotaryEncoder'](32,33,14).position()==7

# Outputs must still emit commands for browser animation / physical mirroring.
messages.clear();g['RGBLED'](25,26,27).color('red');g['PWMServo'](4).write(90);g['MotorDriver'](13,14,16).forward(40)
cmds=[m.get('payload',{}).get('command') for m in messages if isinstance(m,dict) and m.get('type')=='kit-command']
for expected in ('RGB_LED_SET','UI_SERVO_SET','UI_MOTOR_SET'): assert expected in cmds, (expected,cmds)

# Native display modules must emit deterministic commands for offline animation + physical mirroring.
messages.clear()
tm=g['TM1637'](13,14,6); tm.number(1234)
lcd=g['LCD1602'](21,22,0x27,0); lcd.line(0,'ZEBJUS'); lcd.line(1,'Python Lab')
display_payloads=[m.get('payload',{}) for m in messages if isinstance(m,dict) and m.get('type')=='kit-command']
tm_msgs=[x for x in display_payloads if x.get('command')=='TM1637_SET']
lcd_msgs=[x for x in display_payloads if x.get('command')=='LCD1602_SET']
assert tm_msgs, 'TM1637 emitted no browser/hardware command'
assert tm_msgs[-1].get('clk')==13 and tm_msgs[-1].get('dio')==14 and tm_msgs[-1].get('brightness')==6
assert tm_msgs[-1].get('segments')==[0x06,0x5B,0x4F,0x66], tm_msgs[-1]
assert any(x.get('action')=='init' and x.get('address')==0x27 for x in lcd_msgs), lcd_msgs
assert any(x.get('action')=='write' and x.get('row')==0 and str(x.get('text','')).startswith('ZEBJUS') for x in lcd_msgs), lcd_msgs
assert any(x.get('action')=='write' and x.get('row')==1 and str(x.get('text','')).startswith('Python Lab') for x in lcd_msgs), lcd_msgs

print('Sensor runtime regression PASS')
