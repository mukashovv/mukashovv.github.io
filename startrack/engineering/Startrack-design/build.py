#!/usr/bin/env python3
"""Startrack concept assembly. Source coordinates: millimetres, Z up, -Y front."""
import argparse
import json
import math
from pathlib import Path
import struct

DIR = Path(__file__).resolve().parent
VARIANTS = {
    # skid centre half-spacing, rear overhang, cover depth, filling
    "Lite": (272, 545, 32, [("Firm foam", 1)]),
    "Pro": (278, 565, 47, [("Firm foam", .58), ("Comfort foam", .42)]),
    "X": (330, 635, 61, [("Firm foam", .45), ("Comfort foam", .4), ("Surface foam", .15)]),
}
# sRGB display colour, metallic factor, roughness
MATERIALS = {
    "Frame graphite": ("42474A", .73, .36),
    "Rail anodised": ("5F6669", .78, .30),
    "Fabric ink blue": ("3C4A53", .0, .91),
    "Piping": ("253138", .0, .83),
    "Grip rubber": ("24292B", .0, .85),
    "Brushed steel": ("92999B", .86, .35),
    "Latch orange": ("ED652D", .15, .43),
    "Firm foam": ("939790", 0, .9),
    "Comfort foam": ("C0BBA4", 0, .9),
    "Surface foam": ("99B3B2", 0, .9),
}

def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def mul(a,s): return tuple(x*s for x in a)
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(a): return math.sqrt(dot(a,a))
def unit(a): return mul(a,1/norm(a))
def pos(a,b,s): return add(a,mul(unit(sub(b,a)),s))
def lerp(a,b,s): return add(a,mul(sub(b,a),s))
def centre(points): return tuple(sum(p[i] for p in points)/len(points) for i in range(3))

def round_rect(w,d,r):
    r = min(r,w*.49,d*.49)
    pts=[]
    for x,y,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for step in range(5):
            a=math.radians(start+90*step/4)
            pts.append((x+r*math.cos(a),y+r*math.sin(a)))
    return pts

class Part:
    def __init__(self,name,group,material,rings,hollow=False):
        self.name,self.group,self.material=name,group,material
        self.vertices=[p for ring in rings for p in ring]
        k,n=len(rings[0]),len(rings)
        # Cross sections run counter-clockwise when viewed from the upper end.
        f=cross(sub(rings[0][1],rings[0][0]),sub(rings[0][2],rings[0][1]))
        reverse=dot(f,sub(centre(rings[1]),centre(rings[0])))<0
        faces=[]
        for i in range(n if hollow else n-1):
            ii=(i+1)%n
            for j in range(k):
                jj=(j+1)%k
                a,b,c,d=i*k+j,i*k+jj,ii*k+jj,ii*k+j
                faces.extend([(a,b,c),(a,c,d)])
        if not hollow:
            for j in range(1,k-1):
                faces.extend([(0,j+1,j),((n-1)*k,(n-1)*k+j,(n-1)*k+j+1)])
        self.faces=[(c,b,a) if reverse else (a,b,c) for a,b,c in faces]

def cylinder(a,b,r,inner=0,segments=24):
    axis=unit(sub(b,a))
    ref=(0,1,0) if abs(axis[1])<.9 else (1,0,0)
    side=unit(cross(ref,axis)); up=cross(axis,side)
    ring=lambda c,rad:[add(c,add(mul(side,rad*math.cos(i*2*math.pi/segments)),mul(up,rad*math.sin(i*2*math.pi/segments)))) for i in range(segments)]
    rings=[ring(a,r),ring(b,r)]
    return rings+([ring(b,inner),ring(a,inner)] if inner else [])

def drilled_stay(name, group, material, origin, axis, start, end, outer, inner, holes):
    """Annular tube with circular transverse bores cut through both walls."""
    radius=5.25
    lateral=(1,0,0)
    tangent=cross(axis,lateral)
    vertices=[]; faces=[]; ids={}
    def vertex(s,r,angle):
        pt=add(pos(origin,add(origin,axis),s),add(mul(lateral,r*math.cos(angle)),mul(tangent,r*math.sin(angle))))
        key=tuple(round(v,7) for v in pt)
        if key not in ids:
            ids[key]=len(vertices)
            vertices.append(pt)
        return ids[key]
    def quad(a,b,c,d,reverse=False):
        for tri in ((a,b,c),(a,c,d)):
            if len(set(tri))==3:faces.append(tri[::-1] if reverse else tri)
    outline=[(start,None)]
    for hole in sorted(holes):
        if hole-radius <= start or hole+radius >= end:
            raise ValueError('Cross bore outside tube')
        for i in range(13):
            theta=math.pi*i/12
            outline.append((hole-radius*math.cos(theta),radius*math.sin(theta)))
    outline.append((end,None))
    for r,inward in ((outer,False),(inner,True)):
        for offset in (0,math.pi):
            last=None
            for s,opening in outline:
                cut=math.asin((opening or 0)/r)
                ring=[vertex(s,r,offset+cut+j*(math.pi-2*cut)/16) for j in range(17)]
                if last:
                    for j in range(16):quad(last[j],last[j+1],ring[j+1],ring[j],inward)
                last=ring
    for hole in holes:
        for offset in (0,math.pi):
            rings=[]
            for r in (outer,inner):
                ring=[]
                for i in range(24):
                    theta=2*math.pi*i/24
                    s=hole-radius*math.cos(theta)
                    cut=math.asin(radius*math.sin(theta)/r)
                    ring.append(vertex(s,r,offset+cut))
                rings.append(ring)
            for i in range(24):
                j=(i+1)%24
                quad(rings[0][i],rings[0][j],rings[1][j],rings[1][i])
    for s,first in ((start,True),(end,False)):
        for i in range(32):
            a=math.pi*i/16; b=math.pi*(i+1)/16
            quad(vertex(s,outer,a),vertex(s,outer,b),vertex(s,inner,b),vertex(s,inner,a),first)
    part=Part.__new__(Part)
    part.name,part.group,part.material=name,group,material
    part.vertices,part.faces=vertices,faces
    return part


def stay_span(rear,angle):
    rad=math.radians(angle)
    y=-85+math.sin(rad)*837+math.cos(rad)*22
    z=110+math.cos(rad)*837-math.sin(rad)*22
    return math.hypot(y-(rear-40),z-88)


def beam(a,b,w,d,r=5):
    axis=unit(sub(b,a))
    side=unit(cross((0,1,0),axis)) if abs(axis[0])>.98 else unit(sub((1,0,0),mul(axis,axis[0])))
    up=cross(axis,side)
    profile=round_rect(w,d,r)
    return [[add(c,add(mul(side,x),mul(up,y))) for x,y in profile] for c in (a,b)]

def slab(x,y,z,w,d,h,r):
    profile=round_rect(w,d,r)
    return [[(x+u,y+v,z+lift) for u,v in profile] for lift in (0,h)]

def make(variant,angle=17.5):
    span,rear,depth,fill=VARIANTS[variant]
    a=math.radians(angle)
    def back(x,t,v):
        return (x,-85+math.sin(a)*t-math.cos(a)*v,110+math.cos(a)*t+math.sin(a)*v)
    parts=[]
    def insert(name,group,material,rings,hollow=False):
        parts.append(Part(name,group,material,rings,hollow))
    base="01 Ground frame"; deck="02 Standing deck"; tilt="03 Back frame"; adj="04 Angle adjustment"; pads="05 Upholstery"
    for side,sgn in [("L",-1),("R",1)]:
        x=sgn*span
        insert("Skid "+side,base,"Frame graphite",slab(x,(rear-435)/2,16,42,rear+435,35,13))
        for tag,y in [("front",-407),("rear",rear-29)]:
            insert("Sole "+tag+" "+side,base,"Grip rubber",slab(x,y,0,54,66,16,11))
        # The lower pivot and rear brace hinge use transverse axles on the chassis.
        for tag,y,z in [("lower",-85,110),("rear",rear-40,88)]:
            insert("Pedestal "+tag+" "+side,base,"Rail anodised",slab(sgn*224,y,51,26,53,z-51,6))
            insert("Hinge boss "+tag+" "+side,base,"Frame graphite",cylinder((sgn*211,y,z),(sgn*237,y,z),23,8),True)
        insert("Back rail "+side,tilt,"Rail anodised",beam(back(sgn*196,0,0),back(sgn*196,1470,0),30,39,7))
        insert("Rail cap "+side,tilt,"Grip rubber",beam(back(sgn*196,1469,0),back(sgn*196,1476,0),30.5,39.5,7))
        # Rear telescopic stays. Inner rod positions indexed for three nominal angles.
        low=(sgn*209,rear-40,88)
        high=back(sgn*209,837,-22)
        dist=norm(sub(high,low))
        outer=555
        inner=475
        direction=unit(sub(high,low))
        index=outer-28
        parts.append(drilled_stay("Outer stay "+side,adj,"Frame graphite",low,direction,9,outer,16,12.9,[index]))
        bores=[dist-stay_span(rear,setting)+index for setting in (15,17.5,20)]
        parts.append(drilled_stay("Sliding stay "+side,adj,"Rail anodised",low,direction,dist-inner,dist-8,12.5,8,bores))
        insert("Stay wiper "+side,adj,"Grip rubber",cylinder(pos(low,high,outer-7),pos(low,high,outer+4),17.5,12.6),True)
        for tag,at in [("foot",low),("back",high)]:
            insert("Stay eye "+tag+" "+side,adj,"Frame graphite",cylinder(add(at,(-10,0,0)),add(at,(10,0,0)),22,7),True)
            insert("Pivot "+tag+" "+side,adj,"Brushed steel",cylinder(add(at,(-16,0,0)),add(at,(16,0,0)),7))
        pin=pos(low,high,outer-28)
        insert("Index pin "+side,adj,"Brushed steel",cylinder(add(pin,(sgn*-18,0,0)),add(pin,(sgn*32,0,0)),5))
        insert("Pull knob "+side,adj,"Latch orange",cylinder(add(pin,(sgn*20,0,0)),add(pin,(sgn*36,0,0)),12))
    for tag,y in [("nose",-397),("pivot",-85),("heel",rear-40)]:
        insert("Crossmember "+tag,base,"Frame graphite",slab(0,y,21,span*2,42,30,7))
    for tag,y in [("front",-395),("rear",-95)]:
        for side,sgn in [("L",-1),("R",1)]:
            insert("Deck riser "+tag+" "+side,deck,"Frame graphite",slab(sgn*181,y,51,29,36,34,4))
    insert("Footplate",deck,"Rail anodised",slab(0,-254,85,466,340,12,22))
    insert("Tread backing",deck,"Grip rubber",slab(0,-254,97,452,326,5,18))
    for i in range(16):
        insert(f"Anti-slip tread {i+1:02}",deck,"Frame graphite",slab(0,-400+i*19.5,102,425,5,2,2.4))
    for tag,t in [("lumbar",415),("shoulders",1370),("brace",837)]:
        insert("Back bridge "+tag,tilt,"Frame graphite",beam(back(-196,t,-2),back(196,t,-2),35,26))
    for tag,t in [("lumbar",415),("shoulders",1370)]:
        insert("Pad attachment "+tag,tilt,"Grip rubber",beam(back(-137,t,16),back(137,t,16),32,21))
    insert("Main hinge axle",tilt,"Brushed steel",cylinder((-238,-85,110),(238,-85,110),8))
    for sgn in [-1,1]:
        insert("Headrest support "+str(sgn),tilt,"Rail anodised",beam(back(sgn*115,1400,14),back(sgn*115,1610,14),18,23))
    # Rounded sections with a high, tapered shoulder and a separate head pad.
    body=[(332,250),(340,284),(365,304),(525,343),(762,360),(900,354),(1080,378),(1295,421),(1405,414),(1434,392),(1442,361)]
    head=[(1460,260),(1468,285),(1502,299),(1588,290),(1616,273),(1628,245)]
    def pad(name,sizes,shell_depth):
        offset=22
        def rings(bottom,top,margin=0):
            result=[]
            for idx,(t,w) in enumerate(sizes):
                bevel=(.72 if idx==0 or idx==len(sizes)-1 else 1)
                clearance=margin if idx==0 else -margin if idx==len(sizes)-1 else 0
                d=(top-bottom)*bevel
                mid=(top+bottom)/2
                result.append([back(x,t+clearance,mid+v) for x,v in round_rect(w-margin*2,d,min(13,d*.36))])
            return result
        insert(name+" cover",pads,"Fabric ink blue",rings(offset,offset+shell_depth))
        start=offset+2
        for material,proportion in fill:
            end=start+(shell_depth-4)*proportion
            insert(name+" "+material.lower(),pads,material,rings(start,end,3))
            start=end
        # Narrow sewn welt follows the entire outside edge of the front face.
        left=[back(-w/2+8,t,offset+shell_depth*.84) for t,w in sizes]
        right=[back(w/2-8,t,offset+shell_depth*.84) for t,w in sizes]
        stroke=left+list(reversed(right))+[left[0]]
        for i,(p,q) in enumerate(zip(stroke,stroke[1:])):
            insert(f"{name} welt {i+1:02}",pads,"Piping",cylinder(p,q,1.8,segments=8))
    pad("Body pad",body,depth)
    pad("Head pad",head,depth+12)
    return parts

def mesh_buffers(part):
    """Keep machined shoulders sharp and round the adjoining curved sections."""
    locations=[(x/1000,z/1000,-y/1000) for x,y,z in part.vertices]
    pivot=tuple((min(col)+max(col))/2 for col in zip(*locations))
    locations=[sub(p,pivot) for p in locations]
    at_vertex=[[] for _ in locations]
    faces=[]
    for tri in part.faces:
        a,b,c=[locations[i] for i in tri]
        n=cross(sub(b,a),sub(c,a))
        if norm(n)<1e-13:continue
        n=unit(n)
        faces.append((tri,n))
        for corner,v in enumerate(tri):
            a=unit(sub(locations[tri[(corner+1)%3]],locations[v]))
            b=unit(sub(locations[tri[(corner+2)%3]],locations[v]))
            angle=math.acos(max(-1,min(1,dot(a,b))))
            at_vertex[v].append((n,angle))
    positions=[]; normals=[]; indices=[]; cached={}
    for tri,n in faces:
        for v in tri:
            blended=(0,0,0)
            for face_normal,angle in at_vertex[v]:
                if dot(n,face_normal)>.72:
                    blended=add(blended,mul(face_normal,angle))
            normal=unit(blended)
            key=(v,tuple(round(x,6) for x in normal))
            if key not in cached:
                cached[key]=len(positions)
                positions.append(locations[v])
                normals.append(normal)
            indices.append(cached[key])
    return positions,normals,indices,pivot


def glb(parts,variant,angle,out):
    names=list(MATERIALS)
    binary=bytearray(); views=[]; access=[]; nodes=[]; meshes=[]
    def buffer(data,target,component,count,typ,bounds=None):
        while len(binary)%4:binary.append(0)
        idx=len(views)
        views.append(dict(buffer=0,byteOffset=len(binary),byteLength=len(data),target=target))
        binary.extend(data)
        acc=dict(bufferView=idx,componentType=component,count=count,type=typ)
        if bounds:acc.update(min=bounds[0],max=bounds[1])
        access.append(acc)
        return len(access)-1
    groups={}
    for p in parts:
        if p.group not in groups:
            groups[p.group]=len(nodes)
            nodes.append(dict(name=p.group,children=[]))
        coords,uv,indices,pivot=mesh_buffers(p)
        floats=lambda vs:b''.join(struct.pack('<fff',*v) for v in vs)
        acc=buffer(floats(coords),34962,5126,len(coords),"VEC3",([min(xs) for xs in zip(*coords)],[max(xs) for xs in zip(*coords)]))
        n=buffer(floats(uv),34962,5126,len(uv),"VEC3")
        ind=buffer(struct.pack('<'+'H'*len(indices),*indices),34963,5123,len(indices),"SCALAR")
        meshes.append(dict(name=p.name,primitives=[dict(attributes={"POSITION":acc,"NORMAL":n},indices=ind,material=names.index(p.material))]))
        nodes[groups[p.group]]["children"].append(len(nodes))
        nodes.append(dict(name=p.name,mesh=len(meshes)-1,translation=pivot))
    mats=[]
    for n in names:
        s,m,r=MATERIALS[n]
        c=[int(s[i:i+2],16)/255 for i in (0,2,4)]
        c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
        mats.append(dict(name=n,pbrMetallicRoughness=dict(baseColorFactor=c+[1],metallicFactor=m,roughnessFactor=r)))
    while len(binary)%4:binary.append(0)
    doc=dict(asset=dict(version="2.0",generator="Startrack design study"),scene=0,scenes=[dict(name="Startrack "+variant,nodes=list(groups.values()))],nodes=nodes,meshes=meshes,materials=mats,buffers=[dict(byteLength=len(binary))],bufferViews=views,accessors=access,extras=dict(variant=variant,tiltDegreesFromVertical=angle,status="Concept geometry - untested"))
    data=json.dumps(doc,separators=(',',':')).encode()
    data+=b' '*((-len(data))%4)
    out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(binary))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(binary),b'BIN\0')+binary)

def main():
    arg=argparse.ArgumentParser(description=__doc__)
    arg.add_argument('--variant',choices=list(VARIANTS),action='append')
    arg.add_argument('--angle',type=float,choices=[15,17.5,20],default=17.5)
    arg.add_argument('--output',type=Path,default=DIR/'models')
    opt=arg.parse_args()
    opt.output.mkdir(parents=True,exist_ok=True)
    for v in opt.variant or VARIANTS:
        parts=make(v,opt.angle)
        glb(parts,v,opt.angle,opt.output/f'Startrack-{v}.glb')
        print(v,len(parts),'parts')
if __name__=='__main__':main()
