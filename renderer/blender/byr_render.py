# BYR2 → Blender 실사 렌더 (Cycles)
# 사용: blender -b --factory-startup -P byr_render.py -- <작업 폴더>
#   작업 폴더: scene.glb (BYR 장면) + plan.json (카메라 · 조명 · 재질 계획 · 렌더 설정)
#   결과: render.png + scene.blend
# 재질은 plan.json 의 kind(목재 · 타일 · 스테인리스 · 대리석 …)에 따라 절차 텍스처로 하나씩 새로 짠다.
import bpy, sys, json, os, math, re
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DIR = os.path.abspath(argv[0] if argv else os.path.dirname(bpy.data.filepath or '.'))
P = json.load(open(os.path.join(DIR, 'plan.json'), encoding='utf-8'))
def log(*a): print('BYR:', *a, flush=True)

# ---------- 장면 비우고 BYR 장면 불러오기 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
log('step', '장면 불러오는 중')
bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, 'scene.glb'))
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene

def V3(p): return Vector((p[0], -p[2], p[1]))   # three.js(Y 위) → Blender(Z 위)
def hexrgb(h, a=1.0):
    h = (h or '#bbbbbb').lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)
def mix(c1, c2, t): return tuple(c1[i] * (1 - t) + c2[i] * t for i in range(4))
def sinp(node, names, val):
    for n in names:
        if n in node.inputs:
            try: node.inputs[n].default_value = val
            except Exception: pass
            return node.inputs[n]
    return None

# ---------- 절차 재질 ----------
def build(mat, spec):
    kind = spec.get('kind', 'plain'); col = hexrgb(spec.get('color')); rough = spec.get('rough'); scale = float(spec.get('scale') or 1)
    mat.use_nodes = True; nt = mat.node_tree; N = nt.nodes; L = nt.links
    old = [n for n in N if n.type == 'BSDF_PRINCIPLED']
    keep_tex = spec.get('keep')  # 간판 · 그림처럼 이미지가 있는 재질은 이미지 유지, 값만 다듬기
    if keep_tex and old:
        b = old[0]
        if rough is not None: sinp(b, ['Roughness'], rough)
        if spec.get('emit'): sinp(b, ['Emission Strength'], float(spec.get('emit')))
        return
    N.clear(); out = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled'); L.new(b.outputs[0], out.inputs[0])
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); L.new(tc.outputs['Object'], mp.inputs['Vector'])
    def S(x, y=None, z=None): mp.inputs['Scale'].default_value = (x * scale, (y if y is not None else x) * scale, (z if z is not None else x) * scale)
    def bump(src, strength=0.15, dist=0.002):
        bn = N.new('ShaderNodeBump'); bn.inputs['Strength'].default_value = strength; bn.inputs['Distance'].default_value = dist; L.new(src, bn.inputs['Height']); L.new(bn.outputs['Normal'], b.inputs['Normal'])
    def noise(sc_, det=6, rough_=0.55):
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = sc_; nz.inputs['Detail'].default_value = det; sinp(nz, ['Roughness'], rough_); L.new(mp.outputs['Vector'], nz.inputs['Vector']); return nz
    def ramp(src, c1, c2, p1=0.3, p2=0.7):
        cr = N.new('ShaderNodeValToRGB'); e = cr.color_ramp.elements; e[0].position = p1; e[0].color = c1; e[1].position = p2; e[1].color = c2; L.new(src, cr.inputs['Fac']); return cr
    sinp(b, ['Base Color'], col); sinp(b, ['Roughness'], 0.5)
    if kind in ('plain', 'paint', 'matte', 'film'):
        nz = noise(40, 4); bump(nz.outputs['Fac'], 0.03); sinp(b, ['Roughness'], rough if rough is not None else 0.6)
    elif kind in ('plastic', 'gloss'):
        sinp(b, ['Roughness'], rough if rough is not None else 0.32); sinp(b, ['Specular IOR Level', 'Specular'], 0.5)
    elif kind in ('wood', 'plywood', 'filmwood'):
        S(1.0, 1.0, 1.0); wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'RINGS'; wv.inputs['Scale'].default_value = 6; wv.inputs['Distortion'].default_value = 6; wv.inputs['Detail'].default_value = 3
        mp2 = N.new('ShaderNodeMapping'); L.new(tc.outputs['Object'], mp2.inputs['Vector']); mp2.inputs['Scale'].default_value = (1 * scale, 8 * scale, 1 * scale); L.new(mp2.outputs['Vector'], wv.inputs['Vector'])
        nz = noise(30, 8); mx_ = N.new('ShaderNodeMath'); mx_.operation = 'ADD'; L.new(wv.outputs['Fac'], mx_.inputs[0]); m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; m2.inputs[1].default_value = 0.35; L.new(nz.outputs['Fac'], m2.inputs[0]); L.new(m2.outputs[0], mx_.inputs[1])
        cr = ramp(mx_.outputs[0], mix(col, (0, 0, 0, 1), 0.38), mix(col, (1, 1, 1, 1), 0.12), 0.25, 0.85); L.new(cr.outputs['Color'], b.inputs['Base Color'])
        bump(mx_.outputs[0], 0.08); sinp(b, ['Roughness'], rough if rough is not None else 0.45)
    elif kind in ('tile', 'epoxy_tile'):
        bt = N.new('ShaderNodeTexBrick'); L.new(mp.outputs['Vector'], bt.inputs['Vector']); bt.offset = 0.0; bt.inputs['Scale'].default_value = 1.0 / scale
        sinp(bt, ['Brick Width'], 0.6); sinp(bt, ['Row Height'], 0.6); sinp(bt, ['Mortar Size'], 0.003); sinp(bt, ['Mortar Smooth'], 0.2)
        bt.inputs['Color1'].default_value = col; bt.inputs['Color2'].default_value = mix(col, (0.5, 0.5, 0.5, 1), 0.08); bt.inputs['Mortar'].default_value = mix(col, (0.75, 0.75, 0.72, 1), 0.6)
        L.new(bt.outputs['Color'], b.inputs['Base Color']); inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; L.new(bt.outputs['Fac'], inv.inputs[1]); bump(inv.outputs[0], 0.25)
        sinp(b, ['Roughness'], rough if rough is not None else 0.25)
    elif kind == 'brick':
        bt = N.new('ShaderNodeTexBrick'); L.new(mp.outputs['Vector'], bt.inputs['Vector']); bt.inputs['Scale'].default_value = 1.0 / scale
        sinp(bt, ['Brick Width'], 0.21); sinp(bt, ['Row Height'], 0.065); sinp(bt, ['Mortar Size'], 0.008)
        bt.inputs['Color1'].default_value = col; bt.inputs['Color2'].default_value = mix(col, (0.1, 0.05, 0.03, 1), 0.25); bt.inputs['Mortar'].default_value = (0.55, 0.53, 0.5, 1)
        L.new(bt.outputs['Color'], b.inputs['Base Color']); inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; L.new(bt.outputs['Fac'], inv.inputs[1]); bump(inv.outputs[0], 0.5)
        sinp(b, ['Roughness'], rough if rough is not None else 0.85)
    elif kind in ('steel', 'metal'):
        sinp(b, ['Metallic'], 1.0); mp.inputs['Scale'].default_value = (400 * scale, 2 * scale, 2 * scale); nz = noise(1, 2, 0.5)
        cr = ramp(nz.outputs['Fac'], (0.18, 0.18, 0.18, 1), (0.34, 0.34, 0.34, 1)); L.new(cr.outputs['Color'], b.inputs['Roughness']) if rough is None else sinp(b, ['Roughness'], rough)
        sinp(b, ['Anisotropic'], 0.5); sinp(b, ['Base Color'], mix(col, (0.8, 0.8, 0.8, 1), 0.5))
    elif kind == 'marble':
        nz = noise(3, 12, 0.6); wv = N.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 2; wv.inputs['Distortion'].default_value = 12; L.new(mp.outputs['Vector'], wv.inputs['Vector'])
        cr = ramp(wv.outputs['Fac'], mix(col, (0.25, 0.25, 0.27, 1), 0.55), col, 0.02, 0.12); L.new(cr.outputs['Color'], b.inputs['Base Color']); sinp(b, ['Roughness'], rough if rough is not None else 0.12)
    elif kind in ('glass', 'frost'):
        sinp(b, ['Transmission Weight', 'Transmission'], 1.0); sinp(b, ['IOR'], 1.45); sinp(b, ['Roughness'], rough if rough is not None else (0.35 if kind == 'frost' else 0.02))
        sinp(b, ['Base Color'], mix(col, (1, 1, 1, 1), 0.6))
    elif kind in ('concrete', 'asphalt', 'ground'):
        nz = noise(8 if kind != 'asphalt' else 60, 10, 0.6); cr = ramp(nz.outputs['Fac'], mix(col, (0, 0, 0, 1), 0.15), mix(col, (1, 1, 1, 1), 0.08)); L.new(cr.outputs['Color'], b.inputs['Base Color']); bump(nz.outputs['Fac'], 0.12)
        sinp(b, ['Roughness'], rough if rough is not None else 0.85)
    elif kind in ('epoxy',):
        nz = noise(5, 4); cr = ramp(nz.outputs['Fac'], mix(col, (0, 0, 0, 1), 0.05), mix(col, (1, 1, 1, 1), 0.05)); L.new(cr.outputs['Color'], b.inputs['Base Color']); sinp(b, ['Roughness'], rough if rough is not None else 0.12)
    elif kind in ('grass', 'turf', 'fabric'):
        nz = noise(120 if kind != 'fabric' else 300, 6, 0.7); cr = ramp(nz.outputs['Fac'], mix(col, (0, 0, 0, 1), 0.3), mix(col, (1, 1, 0.8, 1), 0.1)); L.new(cr.outputs['Color'], b.inputs['Base Color']); bump(nz.outputs['Fac'], 0.4)
        sinp(b, ['Roughness'], rough if rough is not None else 0.95); sinp(b, ['Sheen Weight', 'Sheen'], 0.4 if kind == 'fabric' else 0)
    elif kind == 'emit':
        sinp(b, ['Emission Color', 'Emission'], col); sinp(b, ['Emission Strength'], float(spec.get('emit') or 4)); sinp(b, ['Roughness'], 0.4)
    if spec.get('alpha') is not None and spec.get('alpha') < 1 and kind not in ('glass', 'frost'):
        sinp(b, ['Alpha'], float(spec['alpha']))
    if spec.get('emit') and kind != 'emit':
        sinp(b, ['Emission Color', 'Emission'], hexrgb(spec.get('emitColor') or spec.get('color'))); sinp(b, ['Emission Strength'], float(spec['emit']))

mats = P.get('materials', {}); done = 0
for m in bpy.data.materials:
    key = m.name.split('.')[0]
    if key in mats:
        try: build(m, mats[key]); done += 1
        except Exception as e: log('warn', 'material', key, e)
log('step', f'재질 {done}개')

# ---------- 조명 ----------
for i, Lt in enumerate(P.get('lights', [])):
    kind = Lt.get('kind', 'point'); d = bpy.data.lights.new(f'BYR_light_{i}', 'SPOT' if kind == 'spot' else 'POINT'); d.color = hexrgb(Lt.get('color'))[:3]
    d.energy = float(Lt.get('watt', 60)); d.shadow_soft_size = float(Lt.get('radius', 0.05))
    if kind == 'spot': d.spot_size = float(Lt.get('angle', 1.0)); d.spot_blend = float(Lt.get('blend', 0.5))
    o = bpy.data.objects.new(d.name, d); sc.collection.objects.link(o); o.location = V3(Lt['pos'])
    if kind == 'spot' and Lt.get('target'): o.rotation_euler = (V3(Lt['target']) - o.location).to_track_quat('-Z', 'Y').to_euler()
sun = P.get('sun')
if sun and sun.get('strength', 0) > 0:
    d = bpy.data.lights.new('BYR_sun', 'SUN'); d.energy = float(sun['strength']); d.angle = math.radians(1.5); d.color = hexrgb(sun.get('color', '#fff4e5'))[:3]
    o = bpy.data.objects.new('BYR_sun', d); sc.collection.objects.link(o); o.rotation_euler = V3(sun['dir']).to_track_quat('-Z', 'Y').to_euler()  # 빛이 가는 방향 = 램프의 -Z
w = bpy.data.worlds.new('BYR_world'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = hexrgb(P.get('world', {}).get('color', '#dfe7f0')); bg.inputs['Strength'].default_value = float(P.get('world', {}).get('strength', 0.6))

# ---------- 카메라 ----------
C = P['camera']; cd = bpy.data.cameras.new('BYR_cam'); cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(C['fov']); cd.clip_start = 0.05; cd.clip_end = 5000
cam = bpy.data.objects.new('BYR_cam', cd); sc.collection.objects.link(cam); cam.location = V3(C['pos']); cam.rotation_euler = (V3(C['target']) - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam

# ---------- 렌더 설정 ----------
R = P.get('render', {}); sc.render.engine = 'CYCLES'; sc.render.resolution_x = int(R.get('w', 1920)); sc.render.resolution_y = int(R.get('h', 1080)); sc.render.resolution_percentage = 100
sc.cycles.samples = int(R.get('samples', 160)); sc.cycles.use_denoising = True
try: sc.cycles.use_adaptive_sampling = True
except Exception: pass
dev = 'CPU'
try:
    pr = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
        try:
            pr.compute_device_type = t; pr.get_devices(); ds = [x for x in pr.devices if x.type != 'CPU']
            if ds:
                for x in pr.devices: x.use = True
                dev = t; break
        except Exception: pass
except Exception as e: log('warn', 'gpu', e)
sc.cycles.device = 'GPU' if dev != 'CPU' else 'CPU'; log('device', dev)
for vt in ('AgX', 'Filmic'):
    try: sc.view_settings.view_transform = vt; break
    except Exception: pass
try: sc.view_settings.look = R.get('look', 'AgX - Medium High Contrast') if sc.view_settings.view_transform == 'AgX' else 'Medium High Contrast'
except Exception: pass
sc.view_settings.exposure = float(R.get('exposure', 0))
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.join(DIR, 'render.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DIR, 'scene.blend'))
log('step', f'렌더 시작 ({sc.cycles.samples} 샘플 · {dev})')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DIR, 'scene.blend'))
log('done', os.path.join(DIR, 'render.png'))
