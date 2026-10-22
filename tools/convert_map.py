# -*- coding: utf-8 -*-
"""把 DataV.GeoAtlas 中国全境 GeoJSON 转为轻量 SVG path 数据。
数据源: https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json (源自自然资源部标准地图数据)
投影: Web Mercator; 精简: 坐标取整到 0.05° + Douglas-Peucker; 台湾省/香港/澳门/南海诸岛强制保留。
"""
import json, math

SRC = 'china_full.json'
OUT = 'china-map.js'

# 省级简称（地图标注用）
SHORT = {
    110000:'北京',120000:'天津',130000:'河北',140000:'山西',150000:'内蒙古',
    210000:'辽宁',220000:'吉林',230000:'黑龙江',310000:'上海',320000:'江苏',
    330000:'浙江',340000:'安徽',350000:'福建',360000:'江西',370000:'山东',
    410000:'河南',420000:'湖北',430000:'湖南',440000:'广东',450000:'广西',
    460000:'海南',500000:'重庆',510000:'四川',520000:'贵州',530000:'云南',
    540000:'西藏',610000:'陕西',620000:'甘肃',630000:'青海',640000:'宁夏',
    650000:'新疆',710000:'台湾',810000:'香港',820000:'澳门',
}

def merc_y(lat):
    # 转为「角度当量」单位，与 lon 同一量纲，保证宽高比正确
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))

# 小行政区/敏感区域强制精保：坐标取整 0.02°，容差 0.01°，不过滤小面
FORCE_KEEP = {710000, 810000, 820000, '100000_JD'}
# 标签坐标覆写（用行政中心/城区坐标，避开几何质心偏移与拥挤）
LABEL_OVERRIDE = {
    310000: (122.75, 31.05),   # 上海：标签移到东侧海面，避开江苏/浙江
    120000: (118.45, 38.72),   # 天津：移到渤海湾，避开北京
    110000: (115.55, 41.05),   # 北京：移到西北侧
    810000: (115.85, 21.55),   # 香港：移到东南海面
    820000: (112.15, 21.35),   # 澳门：移到西南海面
    440000: (113.95, 23.55),   # 广东：省域中部，给港澳让位
    710000: (121.10, 24.15),   # 台湾：略北移
    140000: (111.50, 38.30),   # 山西：西移，避开河北
    130000: (115.20, 37.30),   # 河北：南移到省域腹地
    460000: (109.55, 19.30),   # 海南：略左移
    640000: (106.24, 37.36), 500000: (107.50, 29.85),
    '100000_JD': (111.50, 11.50),
}

def dp_simplify(points, tol):
    """Douglas-Peucker, points = [(x,y), ...]"""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        ax, ay = points[i]; bx, by = points[j]
        dx, dy = bx - ax, by - ay
        seg = math.hypot(dx, dy)
        dmax, idx = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k]
            if seg == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / seg
            if d > dmax:
                dmax, idx = d, k
        if dmax > tol:
            keep[idx] = True
            stack.append((i, idx)); stack.append((idx, j))
    return [p for p, k in zip(points, keep) if k]

def ring_area(ring):
    s = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % len(ring)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

def build_paths(coords, adcode):
    """coords: Polygon=[ring,...] 或 MultiPolygon=[[ring,...],...] 的点序列(投影前经纬度)"""
    polys = coords if coords and isinstance(coords[0][0][0], list) else [coords]
    is_jd = (adcode == '100000_JD')
    force = adcode in FORCE_KEEP
    digits, tol = (2, 0.01) if force else (1, 0.08)
    out = []
    for poly in polys:
        ring = poly[0]
        pts = []
        for lon, lat in ring:
            p = (round(lon, digits), round(lat, digits))
            if not pts or pts[-1] != p:
                pts.append(p)
        if len(pts) < 4:
            continue
        pts = dp_simplify(pts, tol)
        if len(pts) < 4:
            continue
        if not (is_jd or force):
            if ring_area(pts) < 0.02:
                continue
        out.append(pts)
    return out

def main():
    d = json.load(open(SRC, encoding='utf-8'))
    feats = d['features']
    # ---- 计算投影范围 ----
    all_lon, all_y = [], []
    for f in feats:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for lon, lat in poly[0]:
                all_lon.append(lon); all_y.append(merc_y(lat))
    lon_min, lon_max = min(all_lon), max(all_lon)
    y_min, y_max = min(all_y), max(all_y)
    pad_x = (lon_max - lon_min) * 0.01
    lon_min -= pad_x; lon_max += pad_x
    y_rng = y_max - y_min
    y_min -= y_rng * 0.01; y_max += y_rng * 0.01
    W = 1000.0
    sx = W / (lon_max - lon_min)
    H = (y_max - y_min) * sx
    def proj(lon, lat):
        # y 轴向下：高纬 → 小 y（页面顶部）
        return (round((lon - lon_min) * sx, 1), round((y_max - merc_y(lat)) * sx, 1))

    provinces = []
    for f in feats:
        p = f['properties']
        adcode = p['adcode']
        is_jd = (adcode == '100000_JD')
        name = '南海诸岛' if is_jd else p['name']
        short = '南海诸岛' if is_jd else SHORT[adcode]
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        plists = build_paths(polys, adcode)
        if not plists:
            continue
        parts = []
        for pts in plists:
            seg = 'M' + 'L'.join('%s,%s' % proj(lon, lat) for lon, lat in pts) + 'Z'
            parts.append(seg)
        dpath = ''.join(parts)
        # 标注点：优先覆写坐标，其次 centroid
        if adcode in LABEL_OVERRIDE:
            label = proj(*LABEL_OVERRIDE[adcode])
        elif is_jd:
            xs, ys = [], []
            for pts in plists:
                for lon, lat in pts:
                    xs.append(lon); ys.append(lat)
            label = proj((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
        else:
            c = p.get('centroid') or p.get('center')
            label = proj(c[0], c[1])
        provinces.append({
            'adcode': adcode, 'name': name, 'short': short,
            'label': list(label), 'd': dpath,
            'tiny': 1 if adcode in (110000, 120000, 310000, 810000, 820000) else 0,
        })

    js = ('// 中国省级行政区 SVG 路径数据（Web Mercator 投影，viewBox 0 0 %d %d）\n'
          '// 数据源: DataV.GeoAtlas areas_v3 100000_full（自然资源部标准地图数据）\n'
          '// 生成: .workbuddy/convert_map.py；含台湾省/香港/澳门/南海诸岛，请勿手动改边界\n'
          'module.exports = %s;\n') % (
        round(W), round(H),
        json.dumps({'width': round(W), 'height': round(H), 'provinces': provinces},
                   ensure_ascii=False, separators=(',', ':')))
    open(OUT, 'w', encoding='utf-8').write(js)
    total = sum(len(p['d']) for p in provinces)
    print('provinces:', len(provinces), 'viewBox: 0 0 %d %d' % (round(W), round(H)))
    print('file size: %.1f KB' % (len(js.encode("utf-8")) / 1024))
    print('path chars total:', total)
    for p in provinces:
        print(' ', p['adcode'], p['short'], 'label', p['label'], 'd.len', len(p['d']))

if __name__ == '__main__':
    main()
