# /// script
# dependencies = ["numpy", "scikit-image", "fast-simplification"]
# ///
"""Original FII tortoise, fixed-income piggy bank and FI octopus meshes.
Run: uv run frontend/scripts/sculptures/animals.py [turtle|piggy|octopus].
Signed-distance sculpting, unified surfaces and genuine engraved details.
"""
import json
import sys
from pathlib import Path
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification

name = sys.argv[1]
step = .026 if name != 'octopus' else .038
lo = np.array([-2.1, -2.1, -.12])
hi = np.array([2.1, 2.1, 2.65])
if name == 'octopus':
    lo = np.array([-4.55, -4.55, -.12])
    hi = np.array([4.55, 4.55, 3.15])
axes = [np.arange(a, b + step, step, dtype=np.float32) for a, b in zip(lo, hi)]
X, Y, Z = np.meshgrid(*axes, indexing='ij')
P = np.stack([X, Y, Z], axis=-1)
field = np.full(X.shape, 10., dtype=np.float32)

def ell(c, r):
    q = (P - np.array(c, dtype=np.float32)) / np.array(r, dtype=np.float32)
    k = np.linalg.norm(q, axis=-1)
    return k * (k - 1) / np.maximum(np.linalg.norm(q / r, axis=-1), 1e-8)

def merge(d, blend=.06):
    global field
    h = np.maximum(blend - np.abs(field - d), 0) / blend
    field = np.minimum(field, d) - h * h * blend * .25

def body(c, r, blend=.06):
    merge(ell(c, r), blend)

def cut(d):
    global field
    field = np.maximum(field, -d)

def box(c, r, bevel=.012):
    q = np.abs(P - np.array(c, dtype=np.float32)) - np.array(r, dtype=np.float32)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(np.max(q, axis=-1), 0) - bevel

def segment(a, b, ra, rb=None):
    a, b = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    v = b - a
    t = np.clip(np.sum((P-a)*v, axis=-1) / np.dot(v, v), 0, 1)
    return np.linalg.norm(P-a-t[...,None]*v, axis=-1) - (ra + ((ra if rb is None else rb)-ra)*t)

def stroke(points, radii, subtract=False, blend=.035):
    # Capsules only affect a small box around each curve segment.
    for i in range(len(points)-1):
        a=np.array(points[i],dtype=np.float32); b=np.array(points[i+1],dtype=np.float32)
        margin=max(radii[i],radii[i+1])+blend+step*2
        start=np.maximum(0,np.floor((np.minimum(a,b)-margin-lo)/step).astype(int))
        end=np.minimum(np.array(field.shape),np.ceil((np.maximum(a,b)+margin-lo)/step).astype(int)+1)
        region=tuple(slice(l,r) for l,r in zip(start,end))
        q=P[region]-a; v=b-a
        t=np.clip(np.sum(q*v,axis=-1)/np.dot(v,v),0,1)
        d=np.linalg.norm(q-t[...,None]*v,axis=-1)-(radii[i]+(radii[i+1]-radii[i])*t)
        target=field[region]
        if subtract:
            field[region]=np.maximum(target,-d)
        else:
            h=np.maximum(blend-np.abs(target-d),0)/blend
            field[region]=np.minimum(target,d)-h*h*blend*.25

if name == 'turtle':
    body((0,0,.61), (1.03,.69,.39))
    body((.05,0,.77), (1.03,.74,.63), .03)
    # Project a Voronoi scute network onto the domed shell; real recessed seams.
    seeds=[]
    for x in [-.58,0,.58]:
        seeds.append((x,0))
    for y in [-.48,.48]:
        for x in [-.82,-.28,.28,.82]:
            seeds.append((x,y))
    nearest=np.full(X.shape,10.,dtype=np.float32)
    second=nearest.copy()
    for x,y in seeds:
        d=(X-x)**2+(Y-y)**2
        second=np.minimum(second,np.maximum(nearest,d)); nearest=np.minimum(nearest,d)
    seams=np.abs(second-nearest)*.5-.012
    cut(np.maximum.reduce([seams, .80-Z, -ell((.05,0,.77),(1.03,.74,.63))-.034]))
    # A continuous raised edge separates the shell from the plastron.
    pts=[(.05+1.02*np.cos(t),.72*np.sin(t),.63) for t in np.linspace(0,2*np.pi,65)]
    stroke(pts,[.033]*len(pts))
    for side in [-1,1]:
        for front in [-1,1]:
            a=(front*.63,side*.43,.53); b=(front*.88,side*.66,.22); c=(front*.98,side*.77,.10)
            stroke([a,b,c],[.22,.18,.19],blend=.08)
            for toe in [-1,0,1]:
                body((front*1.10,side*.77+toe*.075,.10),(.11,.044,.065),.012)
    stroke([(-.78,0,.60),(-1.15,0,.66),(-1.38,0,.82)],[.21,.17,.20],blend=.09)
    body((-1.48,0,.87),(.30,.205,.21))
    for side in [-1,1]:
        cut(ell((-1.55,side*.184,.93),(.075,.06,.065)))
        body((-1.55,side*.19,.93),(.040,.030,.033),.004)
        cut(ell((-1.67,side*.11,.82),(.17,.12,.018)))
    stroke([(1,0,.48),(1.32,0,.35),(1.44,.09,.26)],[.11,.06,.018])
    # A small brownstone home is integrated into the shell, not floating.
    merge(box((.15,0,1.57),(.40,.35,.35)),.035)
    # Gable ridge runs along x. Signed intersection gives crisp sloping roof.
    roof=np.maximum.reduce([np.abs(X-.15)-.48, np.abs(Y)-.44, 1.89-Z, Z-(2.24-.70*np.abs(Y))])
    merge(roof,.012)
    merge(box((.37,-.17,2.22),(.07,.07,.19)),.012)
    for side in [-1,1]:
        for x in [-.07,.35]:
            cut(box((x,side*.351,1.64),(.084,.052,.115),.004))
        cut(box((-.255,side*.17,1.58),(.045,.075,.11),.004))
    cut(box((-.255,0,1.43),(.05,.085,.16),.006))

elif name == 'piggy':
    # Long heavy barrel, broad shoulders and a low belly, following the bronze pig.
    body((.27,0,.88),(1.11,.59,.60),.14)
    body((.20,0,.60),(.83,.53,.32),.13)
    body((-.61,0,.87),(.53,.48,.51),.14)
    body((.98,0,.85),(.43,.49,.52),.10)
    body((-.99,0,.81),(.43,.35,.32),.10)
    body((-1.23,0,.74),(.29,.32,.24),.065)
    body((-1.43,0,.84),(.13,.265,.19),.028)
    for side in [-1,1]:
        # Shoulder and haunch flow into short, bent legs with cloven hooves.
        body((-.55,side*.38,.62),(.26,.23,.35),.08)
        body((.95,side*.37,.64),(.32,.25,.38),.10)
        for x in [-.60,.93]:
            stroke([(x,side*.38,.54),(x+.07,side*.41,.26),(x-.03,side*.43,.09)],[.17,.115,.14],blend=.07)
            body((x-.07,side*.43,.075),(.17,.145,.075),.025)
            cut(box((x-.10,side*.43,.07),(.16,.016,.09),.002))
        stroke([(-.77,side*.25,1.22),(-.78,side*.43,1.45),(-.68,side*.52,1.64)],[.17,.135,.014],blend=.04)
        cut(ell((-.89,side*.44,1.43),(.075,.095,.16)))
        cut(ell((-1.09,side*.32,1.015),(.078,.070,.058)))
        body((-1.09,side*.348,1.015),(.040,.022,.029),.005)
        body((-1.02,side*.32,1.085),(.14,.06,.052),.022)
        cut(ell((-1.53,side*.12,.875),(.065,.056,.052)))
        cut(ell((-1.27,side*.20,.675),(.23,.14,.020)))
        cut(ell((-.34,side*.50,.85),(.030,.05,.27)))
    tail=[]
    for t in np.linspace(0,1,42):
        a=-np.pi*.8+t*np.pi*3.1
        tail.append((1.30+.17*t,.025+.12*np.cos(a),.96+.12*np.sin(a)))
    stroke([(1.22,0,1.0)]+tail,[.050]+list(np.linspace(.038,.015,len(tail))))
    cut(box((.0,0,1.47),(.28,.025,.10),.006))

elif name == 'octopus':
    # A rock is part of the cast, sharing the animal's selected material.
    planes=[(.15,.10,1,1.30),(-.38,.16,1,1.44),(.48,-.20,1,1.50),
            (1,0,.40,3.47),(-1,0,.45,3.48),(0,1,.40,3.36),(0,-1,.38,3.33),
            (.72,.72,.38,3.85),(-.72,.72,.36,3.77),(.72,-.72,.42,3.88),(-.72,-.72,.43,3.82)]
    rock=np.maximum.reduce([(nx*X+ny*Y+nz*Z-limit)/np.sqrt(nx*nx+ny*ny+nz*nz) for nx,ny,nz,limit in planes])
    merge(np.maximum(rock,.035-Z),.015)
    # Two subordinate angular stones break the silhouette of the main boulder.
    rock2=np.maximum.reduce([np.abs(X-3.08)-.48,np.abs(Y+.93)-.49,Z-.45-.06*X,.025-Z])
    merge(rock2,.025)
    # The mantle is large and heavy below the high eyes, swept behind the
    # narrow upright body. No projecting muzzle: an octopus has no nose.
    body((-.24,0,1.67),(.28,.32,.67),.11)
    body((.57,-.08,1.98),(1.22,.76,.88),.13)
    body((.95,-.08,1.78),(.62,.55,.58),.10)
    # Small, sagging folds join only the roots of neighbouring arms. The
    # concave edge and variable height avoid a flat eight-pointed star.
    radius=np.sqrt((X+.20)**2+Y**2)
    theta=np.arctan2(Y,X+.20)
    scallop=.5+.5*np.cos(theta*8)
    web_radius=.72+.88*scallop
    web_z=1.80-.38*radius-.15*(1-scallop)
    web=np.maximum.reduce([np.abs(Z-web_z)-(.022+.022*scallop), radius-web_radius, .34-radius])
    merge(web,.075)
    for arm in range(8):
        a=arm*np.pi/4
        sign=1 if arm%2 else -1
        length=3.88+.22*np.sin(arm*1.8)
        points=[]
        for t in np.linspace(0,1,68):
            if t<.69:
                u=t/.69
                r=.20+(length-.42)*u
                lateral=sign*.18*np.sin(u*np.pi)
                # Trace the rock crest, then slip across its angular shoulder.
                px=-.20+r*np.cos(a)-lateral*np.sin(a); py=r*np.sin(a)+lateral*np.cos(a)
                rock_top=max(.18,min((limit-nx*px-ny*py)/nz for nx,ny,nz,limit in planes))
                z=rock_top+.19+.46*(1-u)**3
            else:
                curl=(t-.69)/.31
                r=length-.42+.48*np.sin(curl*np.pi*.85)
                lateral=sign*.42*(1-np.cos(curl*np.pi*1.45))
                z=.16+.58*(1-curl)**2+.09*np.sin(curl*np.pi*1.7)
            # Two arms arch above the rock instead of repeating the same pose.
            if arm in [2,5]:
                z+=.52*np.sin(np.pi*t)**2
            points.append((-.20+r*np.cos(a)-lateral*np.sin(a),r*np.sin(a)+lateral*np.cos(a),z))
        # Smooth the transitions over the boulder's angular shoulders.
        for _ in range(3):
            points=[points[0]]+[tuple((np.array(points[j-1])+2*np.array(points[j])+np.array(points[j+1]))/4) for j in range(1,len(points)-1)]+[points[-1]]
        radii=list(.17*(1-np.linspace(0,1,68))**1.05+.023)
        stroke(points,radii,blend=.055)
        for j in range(10,62,4):
            p=np.array(points[j]); tangent=np.array(points[min(j+1,67)])-np.array(points[j-1]); tangent/=np.linalg.norm(tangent)
            sideways=np.array([-tangent[1],tangent[0],0])
            radius=radii[j]
            for sign in [-1,1]:
                c=p+sideways*sign*radius*.70+np.array([0,0,radius*.56])
                body(c,(radius*.40,radius*.40,radius*.30),.006)
                cut(ell(c+np.array([0,0,radius*.22]),(radius*.19,radius*.19,radius*.17)))
    for side in [-1,1]:
        body((-.33,side*.31,2.33),(.16,.15,.17),.035)
        cut(ell((-.38,side*.43,2.35),(.090,.070,.090)))
        body((-.38,side*.45,2.35),(.058,.031,.058),.004)
        # Dark siphon opening behind the eye, as in the bronze reference.
        cut(ell((-.12,side*.48,2.04),(.08,.045,.15)))

else:
    raise ValueError(name)

vertices,faces,_,_=marching_cubes(field,level=0,spacing=(step,)*3,allow_degenerate=False)
vertices+=lo
vertices,faces=fast_simplification.simplify(vertices,faces,target_count=36000 if name == 'octopus' else 24000,agg=5)
a,b,c=vertices[faces[:,0]],vertices[faces[:,1]],vertices[faces[:,2]]
if np.sum(a*np.cross(b,c))<0:
    faces=faces[:,::-1]
normal=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
normals=np.zeros_like(vertices)
for i in range(3):
    np.add.at(normals,faces[:,i],normal)
normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
vertices=np.stack([vertices[:,1],-vertices[:,0],vertices[:,2]],axis=-1)
normals=np.stack([normals[:,1],-normals[:,0],normals[:,2]],axis=-1)
path=Path(__file__).resolve().parents[2]/f'src/components/ui/iso/models/{name}.json'
path.write_text(json.dumps({'vertices':np.round(vertices,5).tolist(),'normals':np.round(normals,5).tolist(),'faces':faces.tolist()},separators=(',',':'))+'\n')
print(f'{name}: {len(faces)} faces, {path.stat().st_size//1024} KiB',flush=True)
