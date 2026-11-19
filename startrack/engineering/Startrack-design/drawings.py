#!/usr/bin/env python3
"""Dimensioned A3 sheets projected from the named model parts, dimensions in mm."""
import math
from html import escape
from pathlib import Path
from build import DIR, MATERIALS, VARIANTS, dot, make, stay_span

S = 1/3  # 1400 drawing units / 420 paper mm at 1:10
INK = '#202b33'
MUTED = '#586974'
ORANGE = '#ae4924'

def hull(points):
    points=sorted(set((round(x,4),round(y,4)) for x,y in points))
    def half(points):
        out=[]
        for p in points:
            while len(out)>1:
                a,b=out[-2:]
                if (b[0]-a[0])*(p[1]-a[1])>(b[1]-a[1])*(p[0]-a[0]):break
                out.pop()
            out.append(p)
        return out
    return half(points)[:-1]+half(reversed(points))[:-1]

class Sheet:
    def __init__(self):
        self.body=[]
    def line(self,x1,y1,x2,y2,col=INK,w=1,dash=None):
        self.body.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{col}" stroke-width="{w}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
    def text(self,x,y,t,size=14,colour=INK,weight=400,anchor='start',rot=None):
        self.body.append(f'<text x="{x:.2f}" y="{y:.2f}" font-family="Arial, sans-serif" font-size="{size}" fill="{colour}" font-weight="{weight}" text-anchor="{anchor}"'+(f' transform="rotate({rot} {x} {y})"' if rot else '')+f'>{escape(str(t))}</text>')
    def poly(self,pts,fill,stroke=INK,width=.9):
        self.body.append('<polygon points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in pts)+f'" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round"/>')
    def circle(self,x,y,r,fill,stroke=INK):
        self.body.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}"/>')
    def dimension(self,a,b,pos,label,vertical=False):
        change=lambda u,v:(v,u) if vertical else (u,v)
        # a,b and pos given in projected plane; outside witness lines.
        p,q=sorted([a[0],b[0]])
        for u,v in [a,b]:
            end=pos+(5 if pos>v else -5)
            self.line(*change(u,v),*change(u,end),MUTED,.8)
        self.line(*change(p,pos),*change(q,pos),MUTED,.9)
        for u,sgn in [(p,1),(q,-1)]:
            self.poly([change(u,pos),change(u+sgn*7,pos-2.1),change(u+sgn*7,pos+2.1)],MUTED,MUTED,.5)
        if vertical:self.text(pos-8,(p+q)/2,label,16,anchor='middle',rot=-90)
        else:self.text((p+q)/2,pos-8,label,16,anchor='middle')
    def save(self,path):
        path.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 1400 990"><rect width="1400" height="990" fill="white"/>'+''.join(self.body)+'</svg>',encoding='utf8')

def project(sheet,parts,ox,oy,right,up,camera,scale=S):
    polys=[]
    for part in parts:
        if 'foam' in part.material.lower() or 'welt' in part.name:continue
        pts=[(ox+scale*dot(p,right),oy-scale*dot(p,up)) for p in part.vertices]
        polygon=hull(pts)
        if len(polygon)<3:continue
        z=sum(dot(p,camera) for p in part.vertices)/len(part.vertices)
        if camera==(0,-1,0) and part.material=='Fabric ink blue':
            z+=2000  # Front covers enclose the back bridges.
        palette={'Frame graphite':'#b5bfc2','Rail anodised':'#ccd4d5','Grip rubber':'#89969b','Fabric ink blue':'#c9d6db','Latch orange':'#eb946d','Brushed steel':'#e3e8e8'}
        polys.append((z,polygon,palette[part.material]))
    for z,coords,c in sorted(polys,key=lambda p:p[0]):sheet.poly(coords,c)

def header(s,label,subtitle,number):
    s.text(54,51,'startrack™',29,weight=700)
    s.text(54,109,label,43,weight=600)
    s.text(1347,51,number,15,MUTED,anchor='end')
    s.text(1347,106,subtitle,17,MUTED,anchor='end')
    s.line(54,138,1347,138,'#9ba6a9')
def footer(s):
    s.line(54,887,1347,887,'#9ba6a9')
    s.text(54,925,'КОНЦЕПТ  /  РЕВИЗИЯ A',16,weight=700)
    s.text(54,955,'Для проверки компоновки. Прочность, устойчивость и допустимая нагрузка требуют испытаний.',15,MUTED)
    s.text(1347,955,'A3  ·  размеры в мм',15,MUTED,anchor='end')

def assembly_sheet(variant,idx,dest):
    parts=make(variant)
    xs,ys,zs=zip(*(p for part in parts for p in part.vertices))
    xlo,xhi,ylo,yhi,zt=min(xs),max(xs),min(ys),max(ys),max(zs)
    s=Sheet()
    header(s,f'{variant} / Общий вид','Компоновочный чертёж  ·  1:10',f'ST–{variant.upper()}–GA  /  {idx:02d}')
    ground,front,side=783,246,660
    s.text(246,190,'Вид спереди',18,anchor='middle')
    s.text(660,190,'Вид справа',18,anchor='middle')
    s.text(1134,190,'Вид сверху',18,anchor='middle')
    for x in (430,905):s.line(x,164,x,852,'#e3e7e7',1)
    s.line(82,ground,397,ground,'#aab3b6')
    s.line(465,ground,887,ground,'#aab3b6')
    project(s,parts,front,ground,(1,0,0),(0,0,1),(0,-1,0))
    project(s,parts,side,ground,(0,1,0),(0,0,1),(1,0,0))
    project(s,parts,1135,455,(1,0,0),(0,1,0),(0,0,1))
    s.dimension((front+xlo*S,ground),(front+xhi*S,ground),831,round(xhi-xlo))
    s.dimension((ground-zt*S,front-28),(ground,front+xlo*S),75,round(zt),True)
    s.dimension((side+ylo*S,ground),(side+yhi*S,ground),831,round(yhi-ylo))
    px,py=side-85*S,ground-110*S
    s.line(px,py-145,px,py-400,MUTED,.9,'5 4')
    s.line(px,py-145,px+math.tan(math.radians(17.5))*145,py-145,ORANGE,.8,'3 3')
    # Mark the measured inclination between a plumb line and the moving frame.
    rad=200
    arc=[(px+rad*math.sin(math.radians(i*17.5/20)),py-rad*math.cos(math.radians(i*17.5/20))) for i in range(21)]
    for a,b in zip(arc,arc[1:]):s.line(*a,*b,ORANGE,1.7)
    s.line(px-72,py-209,px+19,py-198,ORANGE,.8)
    s.text(px-74,py-212,'17,5°',17,ORANGE,600,'end')
    s.text(940,674,'Площадка',16,MUTED)
    s.text(1325,674,'466 × 340',18,weight=600,anchor='end')
    s.line(940,690,1325,690,'#d8dfe0')
    s.text(940,722,'Верх настила',16,MUTED)
    s.text(1325,722,'104',18,weight=600,anchor='end')
    s.line(940,737,1325,737,'#d8dfe0')
    s.text(940,769,'Наклон спинки',16,MUTED)
    s.text(1325,769,'15° / 17,5° / 20°',18,weight=600,anchor='end')
    s.line(940,784,1325,784,'#d8dfe0')
    s.text(940,816,'Размеры указаны при наклоне 17,5°.',15,MUTED)
    footer(s);s.save(dest/f'Startrack-{variant}-GA.svg')

def stay_sheet(dest):
    s=Sheet()
    header(s,'Pro / Фиксация наклона','Продольная схема и карта отверстий','ST–PRO–ADJ  /  04')
    s.text(54,199,'Две телескопические распорки',24,weight=600)
    s.text(54,233,'Показана правая распорка. Продольные размеры отсчитываются от осей шарниров.',17,MUTED)
    rear=VARIANTS['Pro'][1]
    span=stay_span(rear,17.5)
    scale=1.19
    origin=130
    at=lambda distance:origin+distance*scale
    def rectangle(left,top,right,bottom,fill):
        s.poly([(left,top),(right,top),(right,bottom),(left,bottom)],fill)
    y=374
    # The sleeve and rod share a horizontal centreline on this developed view.
    rectangle(at(9),y-16*scale,at(555),y+16*scale,'#b5bfc2')
    rectangle(at(555),y-12.5*scale,at(span-8),y+12.5*scale,'#ccd4d5')
    rectangle(at(548),y-17.5*scale,at(559),y+17.5*scale,'#89969b')
    for u in (0,span):
        s.circle(at(u),y,22*scale,'#b5bfc2')
        s.circle(at(u),y,7*scale,'white')
    s.line(at(-29),y,at(span+29),y,MUTED,.8,'8 4 2 4')
    s.circle(at(527),y,12*scale,'#eb946d')
    s.dimension((at(0),y-27),(at(span),y-27),292,f'{span:.1f}'.replace('.',','))
    s.dimension((at(0),y+27),(at(527),y+16),457,527)
    s.text(at(527)+23,429,'Съёмный палец Ø10',16,ORANGE)
    s.text(at(span)-7,456,'Положение 17,5°',17,MUTED,anchor='end')
    s.line(54,495,1347,495,'#d5dcde')
    s.text(54,554,'Внутренняя трубка',23,weight=600)
    s.text(54,584,'Наружный Ø25 · внутренний Ø16 · три сквозных отверстия Ø10,5',17,MUTED)
    # Measured centre locations along the rod from the upper pivot.
    left,right=at(span-475),at(span-8)
    y=690
    rectangle(left,y-12.5*scale,right,y+12.5*scale,'#ccd4d5')
    s.line(left-15,y,right+16,y,MUTED,.8,'8 4 2 4')
    for idx,setting in enumerate((15,17.5,20)):
        u=span-stay_span(rear,setting)+527
        s.circle(at(u),y,5.25*scale,'white')
        s.line(at(u),y-8,at(u),y-34-(2-idx)*16,MUTED,.75)
    s.dimension((left,y+16),(right,y+16),750,467)
    s.text(54,649,'От торца у верхнего шарнира',17,weight=600)
    for idx,setting in enumerate((15,17.5,20)):
        distance=stay_span(rear,setting)-527-8
        label=f'{str(setting).replace(".",",")}°'
        s.text(54,692+32*idx,label,17,MUTED)
        s.text(244,692+32*idx,f'{distance:.1f} мм'.replace('.',','),17,anchor='end')
    s.text(54,839,'Наружная трубка Ø32 / Ø25,8, длина 546 мм. Нижний вид показывает отдельную внутреннюю трубку.',16,MUTED)
    footer(s);s.save(dest/'Startrack-Pro-adjustment.svg')

if __name__=='__main__':
    dest=DIR/'drawings';dest.mkdir(exist_ok=True)
    for idx,v in enumerate(VARIANTS,1):assembly_sheet(v,idx,dest)
    stay_sheet(dest)
