"""Regenerate the 2D-only component shelf as recognizable top-view parts."""
from pathlib import Path
from html import escape
import json, re

ROOT = Path(__file__).resolve().parent


def text(x, y, value, size=9, fill="#203247", anchor="middle", weight=700):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{fill}" font-size="{size}" font-family="Inter,Arial,sans-serif" font-weight="{weight}">{escape(str(value))}</text>'


def pcb(x, y, w, h, color="#176a55", label=""):
    holes = "".join(f'<circle cx="{cx}" cy="{cy}" r="4.5" fill="#edf2f5" stroke="#8c9aa5" stroke-width="2"/>' for cx, cy in ((x+9,y+9),(x+w-9,y+9),(x+9,y+h-9),(x+w-9,y+h-9)))
    silk = f'<path d="M{x+18} {y+13} H{x+w-18} M{x+18} {y+h-13} H{x+w-18}" stroke="#fff" stroke-opacity=".34" fill="none"/>'
    name = text(x+w/2, y+15, label, 7, "#f4fbff") if label else ""
    return f'<g><rect x="{x+3}" y="{y+5}" width="{w}" height="{h}" rx="8" fill="#405766" opacity=".18"/><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{color}" stroke="#183b43" stroke-width="2"/>{holes}{silk}{name}</g>'


def chip(x, y, w=48, h=30, label="IC"):
    pins = "".join(f'<rect x="{x-5 if side==0 else x+w}" y="{y+4+i*7}" width="5" height="3" fill="#aab4bc"/>' for side in (0,1) for i in range(max(2,int((h-7)/7))))
    return f'{pins}<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="url(#chip)" stroke="#05090d"/>{text(x+w/2,y+h/2+3,label,6,"#d2d9df",weight=600)}<circle cx="{x+7}" cy="{y+7}" r="2" fill="#68737b"/>'


def resistor(x, y, rotate=0, band="#cf5a42"):
    return f'<g transform="rotate({rotate} {x} {y})"><path d="M{x-18} {y}H{x-9}M{x+9} {y}H{x+18}" stroke="#8b949c" stroke-width="2"/><rect x="{x-9}" y="{y-4}" width="18" height="8" rx="3" fill="#d7bf82" stroke="#806b3f"/><path d="M{x-4} {y-4}V{y+4}M{x+3} {y-4}V{y+4}" stroke="{band}" stroke-width="2"/></g>'


def terminal(x, y, count=2, color="#31a35a"):
    parts=[f'<rect x="{x}" y="{y}" width="{count*24}" height="25" rx="4" fill="{color}" stroke="#166338" stroke-width="2"/>']
    for i in range(count):
        cx=x+12+i*24
        parts.append(f'<circle cx="{cx}" cy="{y+12}" r="7" fill="#bec7cd" stroke="#59656d" stroke-width="2"/><path d="M{cx-4} {y+12}H{cx+4}" stroke="#4c555b" stroke-width="2"/>')
    return "".join(parts)


def traces(x, y, w, h):
    return f'<path d="M{x} {y}h{w*.35}v{h*.45}h{w*.3}M{x+w} {y+h}h{-w*.28}v{-h*.32}h{-w*.32}" fill="none" stroke="#d7b44a" stroke-opacity=".55" stroke-width="2"/>'


def art(component_type):
    t=component_type
    if t in ("SingleLED","RGBLED"):
        color="#2b7e54"; out=pcb(76,31,168,98,color,"LED MODULE")
        if t=="SingleLED":
            out+=f'<circle cx="160" cy="76" r="27" fill="url(#led)" stroke="#a5bbc8" stroke-width="4"/><ellipse cx="151" cy="66" rx="8" ry="6" fill="#fff" opacity=".72"/>{resistor(210,90,90)}'
        else:
            out+='<circle cx="160" cy="76" r="29" fill="url(#rgb)" stroke="#d4dde2" stroke-width="4"/><ellipse cx="151" cy="66" rx="9" ry="6" fill="#fff" opacity=".72"/>'+resistor(212,91,90,"#6d5acb")
        return out
    if t=="TM1637":
        seg='<g fill="#ff342e"><path d="M0 0h18l3 3-3 3H0l-3-3z"/></g>'
        out=pcb(38,31,244,99,"#b51f2d","HW-069")+'<rect x="61" y="47" width="198" height="62" rx="5" fill="#171a1d" stroke="#31363b"/>'
        for ox in (76,119,171,214):
            out+=f'<g transform="translate({ox} 58)">{seg}<g transform="translate(0 36)">{seg}</g><g transform="translate(0 18)">{seg}</g><rect x="-2" y="5" width="6" height="14" rx="3" fill="#ff342e"/><rect x="17" y="5" width="6" height="14" rx="3" fill="#ff342e"/><rect x="-2" y="22" width="6" height="14" rx="3" fill="#ff342e"/><rect x="17" y="22" width="6" height="14" rx="3" fill="#ff342e"/></g>'
        out+='<circle cx="160" cy="73" r="2.8" fill="#ff342e"/><circle cx="160" cy="88" r="2.8" fill="#ff342e"/>'
        return out
    if t=="LCD1602":
        return pcb(31,29,258,103,"#1572a5","LCD 1602")+'<rect x="51" y="45" width="218" height="68" rx="5" fill="#b5d96a" stroke="#254f57" stroke-width="5"/>'+text(160,73,"ZEBJUS PYTHON",13,"#24442b")+text(160,95,"16 × 2 DISPLAY",13,"#24442b")+'<g fill="#e8edf0">'+''.join(f'<circle cx="{45+i*15}" cy="123" r="2"/>' for i in range(16))+'</g>'
    if t=="OLED":
        return pcb(53,30,214,101,"#1769a1","SSD1306")+'<rect x="76" y="45" width="168" height="69" rx="4" fill="#07111d" stroke="#7f9bad" stroke-width="3"/>'+text(160,75,"ZEBJUS",17,"#8be9ff")+text(160,96,"128 × 64",11,"#4fc3ff")+chip(57,89,18,18,"I²C")
    if t=="DHT11":
        vents="".join(f'<rect x="{119+c*18}" y="{51+r*16}" width="10" height="8" rx="2" fill="#d9efff" opacity=".9"/>' for r in range(5) for c in range(5))
        return pcb(87,31,146,99,"#1e6997","SENSOR MODULE")+f'<rect x="105" y="38" width="110" height="88" rx="8" fill="#278bd0" stroke="#0b5688" stroke-width="3"/>{vents}'+text(160,118,"DHT11",8,"#eefaff")+resistor(221,77,90)
    if t=="Ultrasonic":
        drums="".join(f'<g><circle cx="{cx}" cy="76" r="31" fill="url(#metal)" stroke="#69757e" stroke-width="4"/><circle cx="{cx}" cy="76" r="21" fill="#aab4bc" stroke="#59646d"/><circle cx="{cx}" cy="76" r="5" fill="#707a81"/></g>' for cx in (111,209))
        return pcb(44,31,232,99,"#16709e","HC-SR04")+drums+'<rect x="151" y="106" width="18" height="10" rx="2" fill="#c8b06a"/>'
    if t in ("Potentiometer","AnalogInput"):
        out=pcb(74,31,172,99,"#176f86","ANALOG MODULE")
        if t=="Potentiometer": out+='<circle cx="160" cy="77" r="35" fill="url(#metal)" stroke="#4f5b63" stroke-width="4"/><circle cx="160" cy="77" r="24" fill="#1d75a6" stroke="#0b4b70"/><path d="M145 77h30" stroke="#dce6eb" stroke-width="5"/>'
        else: out+=terminal(91,61,2)+chip(158,55,48,32,"LM393")+resistor(211,100,90)
        return out
    if t in ("Switch","DigitalInput"):
        out=pcb(76,31,168,99,"#276b55","BUTTON MODULE")+'<rect x="126" y="49" width="68" height="53" rx="5" fill="#c9ced2" stroke="#5f6870" stroke-width="3"/><circle cx="160" cy="75" r="22" fill="#20262b" stroke="#6f7b83" stroke-width="4"/><circle cx="160" cy="75" r="14" fill="#3d464d"/>'
        if t=="DigitalInput": out+=chip(202,52,25,24,"C")+resistor(211,102,90)
        return out
    if t=="RotaryEncoder":
        return pcb(75,29,170,102,"#1d6487","KY-040")+'<circle cx="160" cy="74" r="37" fill="url(#metal)" stroke="#58636b" stroke-width="4"/><circle cx="160" cy="74" r="24" fill="#323b42"/><rect x="154" y="39" width="12" height="45" rx="5" fill="#bfc9cf"/><path d="M160 42v30" stroke="#68747c" stroke-width="3"/>'+resistor(215,103,90)
    if t in ("DigitalOutput","PWM"):
        out=pcb(61,31,198,99,"#256b50","MOSFET DRIVER")+terminal(72,62,2)+chip(151,52,40,35,"FET")+'<rect x="207" y="48" width="27" height="54" rx="3" fill="#2c3439"/><path d="M213 52v46M220 52v46M227 52v46" stroke="#7d8990"/>'
        if t=="PWM": out+=text(220,116,"PWM",7,"#fff")
        return out
    if t=="Relay":
        return pcb(45,31,230,99,"#176e57","1-CHANNEL RELAY")+terminal(53,55,3)+'<rect x="129" y="43" width="91" height="58" rx="5" fill="#1a72b7" stroke="#0a4775" stroke-width="3"/>'+text(174,68,"SONGLE",9,"#eef8ff")+text(174,84,"5V RELAY",7,"#eef8ff")+chip(229,54,30,25,"OPTO")+'<circle cx="244" cy="101" r="5" fill="#f43f5e"/>'
    if t=="GPIOInput":
        return pcb(68,31,184,99,"#276b55","GPIO INPUT")+terminal(79,59,2)+chip(148,51,47,36,"OPTO")+'<circle cx="220" cy="65" r="7" fill="#ef4444"/>'+resistor(220,98,90)
    if t=="ADC":
        return pcb(75,29,170,102,"#176a9b","ADC BREAKOUT")+chip(129,52,62,45,"ADS1115")+''.join(resistor(100+i*40,111,0,"#5b66c8") for i in range(4))+text(160,45,"16-BIT",7,"#fff")
    if t=="PWMServo":
        return '<g><rect x="102" y="55" width="122" height="64" rx="10" fill="#405766" opacity=".2"/><rect x="99" y="50" width="122" height="64" rx="10" fill="#1674c1" stroke="#0b4d81" stroke-width="3"/><rect x="124" y="38" width="72" height="19" rx="6" fill="#155f9d"/><circle cx="160" cy="51" r="13" fill="#eef2f4" stroke="#aab4bb"/><path d="M160 51h62" stroke="#f8fafc" stroke-width="9" stroke-linecap="round"/><circle cx="213" cy="51" r="4" fill="#abb5bc"/><path d="M115 114v17M160 114v17M205 114v17" stroke-width="5" stroke-linecap="round" stroke="#8a3d31"/></g>'+text(160,82,"SG90",12,"#fff")
    if t=="MotorDriver":
        return pcb(40,28,240,105,"#b82532","L298N MOTOR DRIVER")+terminal(47,48,2,"#2a9b58")+terminal(225,48,2,"#2a9b58")+'<rect x="126" y="46" width="68" height="66" rx="3" fill="#222a2f"/><path d="M133 50v58M144 50v58M155 50v58M166 50v58M177 50v58M188 50v58" stroke="#77838b" stroke-width="3"/><circle cx="95" cy="102" r="11" fill="#26333a" stroke="#697982"/><circle cx="225" cy="102" r="11" fill="#26333a" stroke="#697982"/>'
    if t=="I2C":
        return pcb(64,34,192,94,"#7047a5","I²C HUB")+''.join(f'<rect x="{84+i*47}" y="57" width="34" height="30" rx="4" fill="#111820" stroke="#dce5ea"/><rect x="{91+i*47}" y="63" width="20" height="18" fill="#e8eef1"/>' for i in range(4))+text(160,108,"SDA · SCL",10,"#fff")
    if t=="I2CDevice":
        return pcb(77,31,166,99,"#7047a5","I²C BREAKOUT")+chip(125,54,70,42,"I²C IC")+resistor(105,108,0,"#4f68c8")+resistor(160,108,0,"#4f68c8")+resistor(215,108,0,"#4f68c8")
    if t=="UART":
        return pcb(73,32,174,96,"#176a9b","UART ADAPTER")+'<rect x="87" y="53" width="54" height="45" rx="4" fill="#d3dce1" stroke="#687780"/>'+chip(163,56,49,35,"TTL")+text(114,80,"USB",9,"#41505a")+resistor(219,100,90)
    if t=="SPI":
        return pcb(59,31,202,99,"#176a9b","SPI MODULE")+'<rect x="78" y="43" width="105" height="72" rx="3" fill="#d8dde0" stroke="#78858d"/><rect x="91" y="51" width="79" height="56" rx="2" fill="#27323a"/>'+text(130,82,"microSD",10,"#eef3f5")+chip(202,54,42,32,"SPI")
    if t in ("PulseInput","CounterInput","RPMSensor"):
        label={"PulseInput":"PULSE SENSOR","CounterInput":"COUNTER INPUT","RPMSensor":"RPM SENSOR"}[t]
        out=pcb(71,31,178,99,"#276b55",label)+'<rect x="101" y="49" width="55" height="57" rx="4" fill="#20272c"/><path d="M116 52v51M141 52v51" stroke="#77858d" stroke-width="7"/>'+chip(174,57,51,34,"LM393")
        if t=="RPMSensor": out+='<circle cx="128" cy="78" r="17" fill="#eef2f4"/><path d="M128 61v34M111 78h34" stroke="#20272c" stroke-width="7"/>'
        return out
    if t=="PulseOutput":
        return pcb(72,31,176,99,"#176a9b","PULSE GENERATOR")+chip(124,51,72,43,"NE555")+'<circle cx="215" cy="77" r="19" fill="#236c9a" stroke="#9ab6c8"/><path d="M204 77h22" stroke="#eaf2f6" stroke-width="4"/>'+resistor(101,106,90)
    if t=="HardwareTransaction":
        return pcb(42,30,236,101,"#334b5b","TIMING / TRANSACTION")+'<rect x="62" y="49" width="196" height="62" rx="5" fill="#101820" stroke="#657987"/><path d="M73 90h24V67h25v23h27V57h24v33h28V72h25v18h21" fill="none" stroke="#51d6a6" stroke-width="3"/>'+text(160,121,"LOGIC TIMING",8,"#fff")
    if t=="GPS":
        return pcb(66,30,188,101,"#176aa0","NEO-6M GPS")+'<rect x="87" y="43" width="88" height="71" rx="5" fill="#e4e0cf" stroke="#a6a08e" stroke-width="3"/><path d="M96 52l70 53M166 52l-70 53" stroke="#bbb6a6" stroke-width="2"/>'+chip(188,53,46,35,"GPS")+'<circle cx="214" cy="106" r="5" fill="#3ee083"/>'
    if t=="MPU6050":
        return pcb(83,28,154,104,"#126fa5","GY-521")+chip(128,52,64,48,"MPU6050")+'<circle cx="105" cy="73" r="9" fill="#d7b851"/><circle cx="215" cy="73" r="9" fill="#d7b851"/>'+''.join(resistor(108+i*26,113,0,"#4b62bb") for i in range(5))
    if t=="LDR":
        return pcb(72,31,176,99,"#276b55","LIGHT SENSOR")+'<circle cx="125" cy="76" r="29" fill="#e9d6a5" stroke="#8c7749" stroke-width="3"/><path d="M110 54v44M119 54v44M128 54v44M137 54v44" stroke="#9b4f34" stroke-width="3"/>'+chip(171,55,51,35,"LM393")+resistor(215,105,90)
    if t=="SoilMoisture":
        return pcb(119,28,82,42,"#176a9b","PROBE")+'<path d="M126 63v61q0 10 9 10t9-10V63M176 63v61q0 10 9 10t9-10V63" fill="#b57432" stroke="#7d4b21" stroke-width="4"/><path d="M135 73v48M185 73v48" stroke="#e2ad55" stroke-width="3"/>'+text(160,54,"FC-28",7,"#fff")
    if t=="GasSensor":
        mesh=''.join(f'<path d="M{122+i*9} 49v55M112 {58+i*9}h96" stroke="#7b858b" stroke-width="1" opacity=".7"/>' for i in range(10))
        return pcb(65,31,190,99,"#176a9b","MQ GAS SENSOR")+f'<circle cx="160" cy="76" r="43" fill="url(#metal)" stroke="#606b72" stroke-width="4"/>{mesh}<circle cx="160" cy="76" r="33" fill="none" stroke="#8e999f"/>'
    if t=="VoltageSensor":
        return pcb(71,31,178,99,"#b82532","VOLTAGE SENSOR")+terminal(82,58,2,"#2a9b58")+resistor(169,61,0,"#6a5cc2")+resistor(213,61,90,"#6a5cc2")+text(190,111,"0–25V",10,"#fff")
    if t=="SoundSensor":
        return pcb(70,31,180,99,"#276b55","MICROPHONE")+'<circle cx="118" cy="75" r="29" fill="url(#metal)" stroke="#59666e" stroke-width="3"/><circle cx="118" cy="75" r="3" fill="#333c42"/>'+chip(165,54,50,36,"LM393")+resistor(220,105,90)
    if t=="RainSensor":
        stripes=''.join(f'<path d="M{89+i*16} 48v61" stroke="#d8b24e" stroke-width="7" stroke-linecap="round"/>' for i in range(10))
        return pcb(70,31,180,99,"#176a9b","RAIN PLATE")+stripes+'<path d="M82 48h156M82 109h156" stroke="#e9c96f" stroke-width="3"/>'
    if t=="WaterLevelSensor":
        bars=''.join(f'<path d="M{89+i*13} {48+(i%2)*9}v62" stroke="#d8a840" stroke-width="6" stroke-linecap="round"/>' for i in range(12))
        return pcb(72,31,176,99,"#b82532","WATER LEVEL")+bars
    if t=="Thermistor":
        return pcb(72,31,176,99,"#276b55","NTC SENSOR")+'<path d="M123 105V84M123 84q-18-15 0-31q18 16 0 31M123 53v-8" fill="#2266a2" stroke="#173e65" stroke-width="4"/>'+chip(166,54,48,34,"LM393")+resistor(218,104,90)
    if t=="PIRSensor":
        return pcb(76,31,168,99,"#276b55","HC-SR501")+'<circle cx="160" cy="76" r="42" fill="#f1f2e9" stroke="#aeb6af" stroke-width="3"/><path d="M127 76h66M132 60h56M132 92h56M160 34v84M144 38v76M176 38v76" stroke="#c6ccc5" fill="none"/>'
    if t=="ReedSwitch":
        return pcb(68,31,184,99,"#276b55","REED SWITCH")+'<rect x="94" y="62" width="132" height="28" rx="14" fill="#d9edf1" fill-opacity=".6" stroke="#87a7ad" stroke-width="3"/><path d="M108 76h48l23-7M179 83h33" stroke="#62747a" stroke-width="3"/>'
    if t=="TouchSensor":
        return pcb(70,31,180,99,"#bd2835","TTP223 TOUCH")+'<circle cx="150" cy="77" r="37" fill="#d8ac42" stroke="#f1d476" stroke-width="3"/><circle cx="150" cy="77" r="27" fill="none" stroke="#bd2835" stroke-width="4"/>'+chip(205,56,27,25,"IC")
    if t=="FlameSensor":
        return pcb(72,31,176,99,"#276b55","FLAME SENSOR")+'<ellipse cx="121" cy="75" rx="18" ry="34" fill="#14191d" stroke="#535f66" stroke-width="4"/><ellipse cx="116" cy="64" rx="5" ry="13" fill="#752a34"/>'+chip(163,54,50,35,"LM393")+resistor(218,104,90)
    if t=="FlowSensor":
        return '<g><circle cx="164" cy="81" r="51" fill="#405766" opacity=".2"/><path d="M69 75h42M209 75h42" stroke="#2f98a8" stroke-width="28"/><circle cx="160" cy="75" r="51" fill="#35a9b8" stroke="#1b7180" stroke-width="4"/><circle cx="160" cy="75" r="33" fill="#e7f2f2" stroke="#6b8588"/><path d="M160 48l8 20 22 7-22 7-8 20-8-20-22-7 22-7z" fill="#2e8997"/><rect x="184" y="29" width="28" height="34" rx="4" fill="#27343a"/></g>'+text(160,125,"YF-S201 FLOW",8,"#315264")
    if t=="Buzzer":
        return pcb(77,31,166,99,"#276b55","ACTIVE BUZZER")+'<circle cx="160" cy="76" r="40" fill="#1b2024" stroke="#59656c" stroke-width="4"/><circle cx="160" cy="76" r="6" fill="#060809"/>'+text(160,105,"+",16,"#e8eef1")
    if t=="Joystick":
        return pcb(62,29,196,103,"#176a9b","PS2 JOYSTICK")+'<circle cx="151" cy="76" r="42" fill="#20282e" stroke="#68757e" stroke-width="5"/><circle cx="151" cy="76" r="25" fill="#303a41"/><circle cx="151" cy="76" r="15" fill="#151a1e"/><rect x="211" y="53" width="26" height="45" rx="4" fill="#20272c"/>'+resistor(222,108,90)
    if t in ("DCMotor","TTGearMotor"):
        body="#f1c21b" if t=="TTGearMotor" else "#aeb9c0"
        label="TT GEAR MOTOR" if t=="TTGearMotor" else "DC MOTOR"
        return f'<g><rect x="64" y="57" width="38" height="39" rx="5" fill="#e1e7ea" stroke="#69767e"/><rect x="96" y="43" width="139" height="68" rx="19" fill="{body}" stroke="#6d7477" stroke-width="4"/><circle cx="234" cy="77" r="26" fill="url(#metal)" stroke="#59656c" stroke-width="4"/><circle cx="234" cy="77" r="8" fill="#374047"/><path d="M260 77h35" stroke="#a9b2b8" stroke-width="8"/><circle cx="298" cy="77" r="8" fill="#293137"/></g>'+text(162,82,label,10,"#263238")
    if t=="StepperMotor":
        return '<g><circle cx="160" cy="76" r="55" fill="url(#metal)" stroke="#55616a" stroke-width="5"/><circle cx="160" cy="76" r="26" fill="#d4dde2" stroke="#66737b"/><circle cx="160" cy="76" r="8" fill="#293137"/><path d="M160 20v20M160 112v20M104 76h20M196 76h20" stroke="#59656d" stroke-width="7"/><rect x="226" y="51" width="51" height="50" rx="5" fill="#246ea0" stroke="#16496b"/></g>'+text(251,77,"ULN2003",7,"#fff")
    if t in ("BLDCESC","FanMotor"):
        blades=''.join(f'<ellipse cx="160" cy="48" rx="14" ry="34" fill="#33434d" transform="rotate({a} 160 76)"/>' for a in range(0,360,60))
        return f'<g><circle cx="160" cy="76" r="59" fill="#c9d2d7" stroke="#5e6a71" stroke-width="5"/><circle cx="160" cy="76" r="52" fill="#19242b"/>{blades}<circle cx="160" cy="76" r="17" fill="url(#metal)" stroke="#59656d"/></g>'+text(160,129,"BLDC + ESC" if t=="BLDCESC" else "12V FAN",8,"#314452")
    if t in ("WaterPump","Solenoid","VibrationMotor"):
        if t=="WaterPump": return '<g><rect x="83" y="45" width="154" height="65" rx="28" fill="#3aa0c0" stroke="#17627a" stroke-width="4"/><circle cx="109" cy="77" r="23" fill="#e8f3f5" stroke="#50818d"/><path d="M237 77h48M221 46v-22" stroke="#38879b" stroke-width="20" stroke-linecap="round"/></g>'+text(168,82,"WATER PUMP",10,"#fff")
        if t=="Solenoid": return '<g><rect x="72" y="49" width="151" height="57" rx="10" fill="#242c31" stroke="#58656d" stroke-width="4"/><rect x="87" y="56" width="113" height="43" rx="7" fill="#b87727"/><path d="M223 77h66" stroke="#bfc8cd" stroke-width="14"/><circle cx="289" cy="77" r="9" fill="#737f86"/></g>'+text(144,82,"12V COIL",10,"#fff")
        return '<g><circle cx="160" cy="76" r="48" fill="#b9c4ca" stroke="#5f6b72" stroke-width="4"/><circle cx="160" cy="76" r="30" fill="#2d363c"/><circle cx="160" cy="76" r="7" fill="#8b979d"/><path d="M118 103l-32 22M202 103l32 22" stroke="#d64b4b" stroke-width="4"/></g>'+text(160,135,"VIBRATION MOTOR",8,"#314452")
    if t=="PCA9685":
        return pcb(42,29,236,103,"#176a9b","PCA9685 SERVO DRIVER")+chip(128,52,64,43,"PCA9685")+''.join(f'<rect x="{57+i*26}" y="102" width="16" height="20" fill="#20282d"/><circle cx="{65+i*26}" cy="112" r="3" fill="#e6b84d"/>' for i in range(8))+terminal(211,52,2)
    if t in ("LSM6DS3","BME280","BMP280","ADXL345","BH1750","VL53L0X","DS3231"):
        colors={"LSM6DS3":"#1b78a6","BME280":"#6848a4","BMP280":"#6848a4","ADXL345":"#b52a3b","BH1750":"#217656","VL53L0X":"#1b1f24","DS3231":"#1e6997"}
        out=pcb(79,29,162,103,colors[t],t)+chip(126,51,68,46,t)
        if t=="VL53L0X": out+='<circle cx="160" cy="76" r="22" fill="#111" stroke="#7f8b92" stroke-width="5"/><circle cx="160" cy="76" r="7" fill="#7b1f35"/>'
        if t=="DS3231": out+='<circle cx="213" cy="94" r="19" fill="url(#metal)" stroke="#59656d"/>'
        return out
    if t=="DS18B20":
        return '<g><path d="M160 45v70" stroke="#c7d0d5" stroke-width="18" stroke-linecap="round"/><rect x="148" y="35" width="24" height="52" rx="12" fill="url(#metal)" stroke="#68747c" stroke-width="3"/><path d="M151 114l-42 25M160 114v31M169 114l42 25" stroke-width="4" stroke-linecap="round" stroke="#cf4747"/></g>'+text(160,24,"WATERPROOF TEMPERATURE PROBE",8,"#314452")
    if t in ("IRObstacle","IRReceiver","LineSensor","HallSensor","PhotoInterrupt","TiltSensor"):
        out=pcb(70,31,180,99,"#276b55",t.upper())
        if t in ("IRObstacle","LineSensor"): out+='<circle cx="125" cy="76" r="18" fill="#171b1e" stroke="#6e7a81"/><circle cx="195" cy="76" r="18" fill="#31202a" stroke="#6e7a81"/>'
        elif t=="IRReceiver": out+='<rect x="137" y="44" width="46" height="63" rx="12" fill="#171b1e"/><circle cx="160" cy="57" r="5" fill="#4f202e"/>'
        elif t=="PhotoInterrupt": out+='<path d="M123 102V53h25v34h24V53h25v49" fill="#1a2024" stroke="#68757c" stroke-width="4"/>'
        elif t=="TiltSensor": out+='<rect x="125" y="48" width="70" height="58" rx="28" fill="#c5cdd1" stroke="#66737a"/><circle cx="175" cy="77" r="14" fill="#6d767b"/>'
        else: out+=chip(131,51,58,46,"HALL")
        return out
    if t=="FlexSensor":
        return '<g><rect x="52" y="66" width="225" height="22" rx="9" fill="#d4b16d" stroke="#826538" stroke-width="3"/><path d="M65 72h196M65 82h196" stroke="#513f2a" stroke-width="3"/><rect x="277" y="63" width="24" height="28" fill="#384249"/></g>'+text(160,53,"FLEX / BEND SENSOR",10,"#314452")
    if t=="CurrentSensor":
        return pcb(67,31,186,99,"#176a9b","ACS712 CURRENT")+terminal(78,54,2)+terminal(194,54,2)+chip(129,58,62,37,"ACS712")
    if t=="HX711":
        return pcb(58,31,204,99,"#7047a5","HX711 LOAD CELL")+chip(126,52,68,43,"HX711")+terminal(69,56,2)+terminal(203,56,2)+text(160,118,"24-BIT ADC",8,"#fff")
    if t in ("RC522","MicroSD","MAX7219","LoRaSX1278","MCP2515"):
        colors={"RC522":"#b52a3b","MicroSD":"#176a9b","MAX7219":"#176a9b","LoRaSX1278":"#245c48","MCP2515":"#176a9b"};out=pcb(51,29,218,103,colors[t],t.upper())
        if t=="RC522": out+='<path d="M75 48h170v63H75zM86 58h148v43H86zM98 68h124v23H98z" fill="none" stroke="#d8b34f" stroke-width="4"/>'
        elif t=="MicroSD": out+='<rect x="91" y="43" width="138" height="76" rx="4" fill="#c9d0d4" stroke="#66737b"/><rect x="106" y="49" width="108" height="64" fill="#252d32"/>'+text(160,84,"microSD",11,"#fff")
        elif t=="MAX7219": out+=''.join(f'<circle cx="{104+c*16}" cy="{48+r*10}" r="3.2" fill="#ef3340"/>' for r in range(8) for c in range(8))
        elif t=="LoRaSX1278": out+=chip(116,52,73,42,"SX1278")+'<path d="M211 103c32-24 32-52 0-72" fill="none" stroke="#d9b74b" stroke-width="4"/>'
        else: out+=chip(116,52,73,42,"MCP2515")+terminal(201,57,2)
        return out
    if t=="NeoPixel":
        return pcb(45,39,230,82,"#f0f2f3","WS2812 STRIP")+''.join(f'<g><rect x="{62+i*48}" y="56" width="35" height="35" rx="5" fill="#dfe5e8" stroke="#8d989f"/><circle cx="{79+i*48}" cy="73" r="11" fill="url(#rgb)"/></g>' for i in range(4))
    if t=="Keypad4x4":
        labels=list("123A456B789C*0#D");return '<rect x="73" y="29" width="174" height="104" rx="8" fill="#25405b" stroke="#132b3f" stroke-width="4"/>'+''.join(f'<g><rect x="{87+c*39}" y="{38+r*23}" width="30" height="18" rx="4" fill="#e6edf1" stroke="#829099"/>{text(102+c*39,51+r*23,labels[r*4+c],8,"#213747")}</g>' for r in range(4) for c in range(4))
    if t=="LaserModule":
        return pcb(80,31,160,99,"#276b55","LASER MODULE")+'<rect x="123" y="47" width="74" height="58" rx="20" fill="#b7c2c7" stroke="#5f6c73" stroke-width="4"/><circle cx="160" cy="76" r="15" fill="#24181b"/><circle cx="160" cy="76" r="5" fill="#ef253c"/>'
    if t=="SevenSegment":
        seg='<g fill="#ef2737"><rect x="11" y="3" width="31" height="7" rx="3"/><rect x="11" y="46" width="31" height="7" rx="3"/><rect x="11" y="89" width="31" height="7" rx="3"/><rect x="3" y="12" width="7" height="31" rx="3"/><rect x="43" y="12" width="7" height="31" rx="3"/><rect x="3" y="55" width="7" height="31" rx="3"/><rect x="43" y="55" width="7" height="31" rx="3"/><circle cx="55" cy="91" r="4"/></g>'
        return '<rect x="122" y="29" width="76" height="104" rx="7" fill="#241b1e" stroke="#65414a" stroke-width="4"/>'+f'<g transform="translate(133 33)">{seg}</g>'
    return pcb(68,31,184,99,"#315b70","REAL MODULE")+chip(121,52,78,44,t[:10].upper())+traces(86,106,148,18)


def pin_row(ports):
    if not ports: return ""
    n=len(ports); out=[]
    for i,p in enumerate(ports):
        x=320*(i+1)/(n+1); kind=p.get("kind","")
        color="#e34b4b" if kind=="power" else "#4b5563" if kind=="gnd" else "#8b5cf6" if kind=="adc" else "#0ea5b7" if kind.startswith(("i2c","uart","spi")) else "#e6a728"
        out.append(f'<rect x="{x-8:.1f}" y="140" width="16" height="21" rx="3" fill="#202a31"/><circle cx="{x:.1f}" cy="150" r="5.5" fill="{color}" stroke="#f5d878" stroke-width="2"/>{text(f"{x:.1f}",172,p.get("label",p.get("name","")),7,"#283d4f")}' )
    return "".join(out)


def component_svg(c):
    label=escape(c["label"])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="{label} top view" data-realistic="top-view">
<metadata>2D top-view, real-part-inspired educational illustration. Pin order matches the ZEBJUS wiring model.</metadata>
<defs>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f7f8"/><stop offset=".42" stop-color="#aeb8bf"/><stop offset=".72" stop-color="#e4eaed"/><stop offset="1" stop-color="#7d8991"/></linearGradient>
 <linearGradient id="chip" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#39434a"/><stop offset="1" stop-color="#14191d"/></linearGradient>
 <radialGradient id="led" cx="35%" cy="28%"><stop stop-color="#fff"/><stop offset=".18" stop-color="#ffef8a"/><stop offset=".55" stop-color="#ffd234"/><stop offset="1" stop-color="#cc7b00"/></radialGradient>
 <radialGradient id="rgb" cx="35%" cy="28%"><stop stop-color="#fff"/><stop offset=".22" stop-color="#ff6580"/><stop offset=".52" stop-color="#6f82ff"/><stop offset=".8" stop-color="#40dca0"/><stop offset="1" stop-color="#2853a3"/></radialGradient>
 <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#334a5a" flood-opacity=".28"/></filter>
 <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".35"/></filter>
</defs>
<rect width="320" height="180" rx="14" fill="#f6f8fa"/>
<rect x="8" y="5" width="304" height="21" rx="7" fill="#e8eef3" stroke="#d3dde5"/>
{text(16,19,c["label"],10,"#18364c","start",800)}
{art(c["type"])}
{pin_row(c.get("ports",[]))}
</svg>'''


def legacy_board_svg():
    pins=[("GPIO4",58,42,"start"),("GPIO12",58,70,"start"),("GPIO13",58,98,"start"),("GPIO14",58,126,"start"),("GPIO16",58,154,"start"),("GPIO17",58,182,"start"),("GPIO18",58,210,"start"),("GPIO19",58,238,"start"),("GPIO21",58,266,"start"),("GPIO22",58,294,"start"),("GPIO23",282,42,"end"),("GPIO25",282,70,"end"),("GPIO26",282,98,"end"),("GPIO27",282,126,"end"),("GPIO32",282,154,"end"),("GPIO33",282,182,"end"),("GPIO34",282,210,"end"),("GPIO35",282,238,"end"),("GPIO36",282,266,"end"),("GPIO39",282,294,"end")]
    rows=[]
    for name,x,y,anchor in pins:
        label_x=82 if anchor=="start" else 258
        rows.append(f'<rect x="{x-10}" y="{y-7}" width="20" height="14" rx="3" fill="#1d262c"/><circle cx="{x}" cy="{y}" r="5" fill="#d8ad3e" stroke="#fff2a9"/>{text(label_x,y+3,name,9,"#eaf6fb",anchor,700)}')
    power=[]
    for name,x,color in (("GND",115,"#475569"),("3V3",170,"#e5484d"),("5V",225,"#e5484d")):
        power.append(f'<rect x="{x-10}" y="329" width="20" height="18" rx="3" fill="#1d262c"/><circle cx="{x}" cy="338" r="6" fill="{color}" stroke="#fff2a9"/>{text(x,369,name,10,"#eaf6fb")}' )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 390" role="img" aria-label="Legacy controller top view" data-realistic="top-view"><metadata>Legacy board generator retained for migration only.</metadata><rect width="340" height="390" rx="18" fill="#eef3f6"/>{''.join(rows)}{''.join(power)}</svg>'''


def board_svg():
    left=["3V3","EN","GPIO36","GPIO39","GPIO34","GPIO35","GPIO32","GPIO33","GPIO25","GPIO26","GPIO27","GPIO14","GPIO12","GND","GPIO13","GPIO9","GPIO10","GPIO11","5V"]
    right=["GND","GPIO23","GPIO22","GPIO1","GPIO3","GPIO21","GND","GPIO19","GPIO18","GPIO5","GPIO17","GPIO16","GPIO4","GPIO0","GPIO2","GPIO15","GPIO8","GPIO7","GPIO6"]
    pins=[]
    for side,names in (("left",left),("right",right)):
        x=54 if side=="left" else 366;anchor="start" if side=="left" else "end";lx=76 if side=="left" else 344
        for i,name in enumerate(names):
            y=36+i*28;reserved=name in {"EN","GPIO0","GPIO1","GPIO2","GPIO3","GPIO5","GPIO6","GPIO7","GPIO8","GPIO9","GPIO10","GPIO11","GPIO15"};fill="#7b8790" if reserved else "#d7aa3c"
            pins.append(f'<rect x="{x-10}" y="{y-7}" width="20" height="14" rx="3" fill="#1d262c"/><circle cx="{x}" cy="{y}" r="5" fill="{fill}" stroke="#fff2a9"/>{text(lx,y+3,name,8,"#eaf6fb",anchor,700)}')
    rails=[]
    for name,x,color in (("12V",105,"#f59e0b"),("5V",175,"#ef4444"),("3V3",245,"#dc3150"),("GND",315,"#475569")):
        rails.append(f'<rect x="{x-14}" y="572" width="28" height="28" rx="5" fill="#1e272d"/><circle cx="{x}" cy="586" r="8" fill="{color}" stroke="#fff2a9" stroke-width="2"/>{text(x,609,name,9,"#eaf6fb")}')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 620" role="img" aria-label="ZEBJUS Custom Board 38-pin expansion top view" data-realistic="top-view">
<metadata>ZEBJUS Custom Board with 38-pin controller socket and protected 12V, 5V, 3.3V and GND expansion rails.</metadata>
<defs><linearGradient id="shield" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef3f5"/><stop offset=".52" stop-color="#98a8b1"/><stop offset="1" stop-color="#e7ecee"/></linearGradient></defs>
<rect width="420" height="620" rx="20" fill="#edf3f6"/><rect x="27" y="12" width="366" height="596" rx="21" fill="#154960" stroke="#083247" stroke-width="4"/>
<path d="M42 20h336M42 556h336" stroke="#62a5bb" opacity=".55"/>
<rect x="91" y="36" width="238" height="506" rx="18" fill="#0d2938" stroke="#68a1b7" stroke-width="3"/>
<rect x="112" y="61" width="196" height="110" rx="10" fill="url(#shield)" stroke="#6c7d85"/><path d="M127 78h166v18H147v18h146v18H127" fill="none" stroke="#77868d" stroke-width="4"/>
<rect x="132" y="214" width="156" height="126" rx="10" fill="#10171b" stroke="#748188" stroke-width="3"/><circle cx="151" cy="234" r="4" fill="#66737a"/>
{text(210,268,"ZEBJUS",18,"#e9f2f5")}{text(210,292,"CORE MODULE",11,"#9ed9eb")}
<g fill="#d3b247">{''.join(f'<rect x="{111+i*17}" y="188" width="10" height="5"/>' for i in range(12))}{''.join(f'<rect x="{111+i*17}" y="360" width="10" height="5"/>' for i in range(12))}</g>
<rect x="158" y="446" width="104" height="76" rx="9" fill="#c8d0d4" stroke="#6c7880"/><rect x="175" y="477" width="70" height="45" rx="5" fill="#222a2f"/>
{text(210,400,"38-PIN CONTROLLER SOCKET",11,"#dff6ff")}{text(210,430,"ZEBJUS CUSTOM BOARD",14,"#ffffff")}
<rect x="67" y="564" width="286" height="43" rx="9" fill="#0b2736" stroke="#5c91a7"/>{''.join(pins)}{''.join(rails)}
</svg>'''


def main():
    source=(ROOT/"component-library.js").read_text(encoding="utf-8")
    base=re.search(r"const COMPONENTS=(\[.*?\]);\s*const EXTRA_COMPONENTS=",source,re.S)
    extra=re.search(r"const EXTRA_COMPONENTS=(\[.*?\]);\s*COMPONENTS\.push",source,re.S)
    if not base or not extra: raise SystemExit("Could not read component arrays from component-library.js")
    components=json.loads(base.group(1))+json.loads(extra.group(1))
    for c in components:
        slug=re.sub(r"([a-z0-9])([A-Z])",r"\1-\2",c["type"])
        slug=re.sub(r"[^a-zA-Z0-9]+","-",slug).strip("-").lower()
        (ROOT/f"{slug}-2d.svg").write_text(component_svg(c),encoding="utf-8")
    (ROOT/"zebjus-custom-board-38pin-2d.svg").write_text(board_svg(),encoding="utf-8")
    print(f"Generated {len(components)} realistic top-view component SVGs + ZEBJUS Custom Board")


if __name__=="__main__": main()
