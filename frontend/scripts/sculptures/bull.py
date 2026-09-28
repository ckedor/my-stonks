# /// script
# dependencies = ["numpy", "scikit-image", "fast-simplification"]
# ///
"""Author the charging bull's continuous surface. Run with `uv run scripts/sculptures/bull.py`.
Coordinates and anatomy are original; no downloaded model or runtime dependency.
"""
import json
from pathlib import Path
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification

STEP = 0.019
lo = np.array([-1.95, -1.08, -0.10])
hi = np.array([1.78, 1.08, 2.32])
axes = [np.arange(a, b + STEP, STEP) for a, b in zip(lo, hi)]
X, Y, Z = np.meshgrid(*axes, indexing='ij')
P = np.stack([X, Y, Z], axis=-1).astype(np.float32)
field = np.full(X.shape, 10., dtype=np.float32)

def ellipsoid(center, radii, angle=0):
    p = P - center
    if angle:
        c, s = np.cos(angle), np.sin(angle)
        px, pz = p[..., 0].copy(), p[..., 2].copy()
        p[..., 0] = c * px + s * pz
        p[..., 2] = -s * px + c * pz
    q = p / radii
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / radii, axis=-1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-8)

def merge(d, k=.10):
    global field
    h = np.maximum(k - np.abs(field - d), 0) / k
    field = np.minimum(field, d) - h * h * k * .25

def body(c, r, angle=0, blend=.10):
    merge(ellipsoid(c, r, angle), blend)

def capsule(a, b, ra, rb=None, blend=.035):
    a, b = np.array(a), np.array(b)
    pa, ba = P - a, b - a
    t = np.clip(np.sum(pa * ba, axis=-1) / np.dot(ba, ba), 0, 1)
    d = np.linalg.norm(pa - t[..., None] * ba, axis=-1) - (ra + ((rb or ra) - ra) * t)
    merge(d, blend)

def carve(c, r, angle=0):
    global field
    field = np.maximum(field, -ellipsoid(c, r, angle))

# Barrel with lifted haunches, a low belly and a thick, sloping shoulder.
body((.02, 0, .99), (.92, .40, .48), -.04, .16)
body((-.58, 0, 1.16), (.46, .46, .51), -.18, .18)
body((.73, 0, 1.12), (.48, .395, .44), .14, .15)
body((-.98, 0, .88), (.37, .30, .34), -.48, .14)
# Neck/dewlap continues into the low forehead, tapered muzzle and lower jaw.
body((-1.23, 0, .72), (.33, .26, .28), -.32, .12)
body((-1.47, 0, .57), (.28, .20, .16), -.20, .075)
body((-1.60, 0, .53), (.16, .23, .12), 0, .04)
body((-1.40, 0, .44), (.26, .155, .075), -.08, .035)
body((-.98, 0, .55), (.25, .17, .18), .25, .065)

for side in [-1, 1]:
    # Scapula and triceps are integrated, not separate balls.
    body((-.64, side*.315, 1.02), (.29, .22, .40), -.30, .13)
    body((-.71, side*.34, .78), (.21, .18, .30), -.40, .09)
    # Forelegs stretch forward, with a pronounced elbow and slim cannon bone.
    offset = .12 if side < 0 else 0
    capsule((-.74, side*.34, .78), (-.96+offset, side*.37, .44), .145, .09, .075)
    capsule((-.96+offset, side*.37, .44), (-1.28+offset, side*.40, .20), .086, .062, .045)
    body((-1.34+offset, side*.405, .12), (.17, .108, .108), -.10, .022)
    # Powerful hind thigh, hock pointing back, then the planted rear hoof.
    body((.76, side*.29, .92), (.29, .21, .37), .26, .12)
    capsule((.79, side*.30, .84), (1.00, side*.34, .48), .17, .095, .075)
    capsule((1.00, side*.34, .48), (.77+offset, side*.37, .20), .084, .065, .04)
    body((.72+offset, side*.38, .11), (.17, .105, .10), -.12, .025)
    # Brows frame recessed eyes; elongated ears tuck under the horn roots.
    body((-1.23, side*.213, .81), (.14, .07, .07), -.25, .028)
    body((-1.02, side*.33, .89), (.19, .15, .055), -.22, .028)
    # Swept horns: thick roots, outwards sweep, upturned fine tips.
    points = []
    for t in np.linspace(0, 1, 28):
        points.append(([-1.08+.15*t-.14*t*t, side*(.19+.60*np.sin(t*1.48)), .93+.10*t+.54*t*t], .105*(1-t)**.82+.006))
    for (a, ra), (b, rb) in zip(points, points[1:]): capsule(a, b, ra, rb, .022)

# Raised looping tail, laid back across the rump, as in a charging bronze.
points=[]
for t in np.linspace(0, 1, 48):
    a = -.9 + t * 5.1
    points.append(([1.01+.49*np.cos(a), .04+.10*t, 1.63+.48*np.sin(a)], .037-.014*t))
capsule((1.02, .02, 1.30), points[0][0], .055, .038, .04)
for (a, ra), (b, rb) in zip(points, points[1:]): capsule(a, b, ra, rb, .014)
body(points[-1][0], (.065,.055,.105), .5, .015)

# Anatomical cuts provide actual shading, including the cloven hooves.
for side in [-1,1]:
    carve((-1.29, side*.239, .756), (.09,.056,.062), -.2)
    carve((-1.62, side*.175, .575), (.068,.065,.040), -.28)
    carve((-1.48, side*.12, .46), (.205,.16,.017), -.14)
    carve((-1.02, side*.415, .92), (.125,.11,.024), -.22)
    # Shallow crease behind the shoulder and under the haunch.
    carve((-.29, side*.407, 1.04), (.028,.055,.24), -.28)
    carve((.48, side*.375, .95), (.023,.040,.18), .4)
    offset=.12 if side<0 else 0
    carve((-1.42+offset, side*.405, .07), (.15,.014,.09))
    carve((.65+offset, side*.38, .06), (.13,.013,.08))
# Small inset eyeballs, with the socket remaining visible around them.
for side in [-1,1]: body((-1.29,side*.228,.755),(.043,.026,.033),0,.005)

vertices, faces, _, _ = marching_cubes(field, level=0, spacing=(STEP,)*3, allow_degenerate=False)
vertices += lo
vertices, faces = fast_simplification.simplify(vertices, faces, target_count=18000, agg=5)
# Winding from the signed volume, then area-weighted smooth vertex normals.
a,b,c=vertices[faces[:,0]],vertices[faces[:,1]],vertices[faces[:,2]]
if np.sum(a*np.cross(b,c)) < 0: faces=faces[:,::-1]
face_normals=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
normals=np.zeros_like(vertices)
for i in range(3): np.add.at(normals,faces[:,i],face_normals)
normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
# Face toward the viewer's left in the isometric scene.
vertices=np.stack([vertices[:,1],-vertices[:,0],vertices[:,2]],axis=-1)
normals=np.stack([normals[:,1],-normals[:,0],normals[:,2]],axis=-1)
output=Path(__file__).resolve().parents[2]/'src/components/ui/iso/models/bull.json'
output.write_text(json.dumps({'vertices':np.round(vertices,5).tolist(),'normals':np.round(normals,5).tolist(),'faces':faces.tolist()},separators=(',',':'))+'\n')
print(f'{len(vertices)} vertices, {len(faces)} faces, {output.stat().st_size//1024} KiB: {output}')
