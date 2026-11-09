import re
import xml.etree.ElementTree as ET

def get_bbox(path_str):
    tokens = re.findall(r'[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', path_str)
    curr_x, curr_y = 0.0, 0.0
    start_x, start_y = 0.0, 0.0
    xs, ys = [], []
    i = 0
    cmd = 'M'
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            i += 1
            continue
        try:
            if cmd in 'mM':
                dx, dy = float(tokens[i]), float(tokens[i+1])
                curr_x = curr_x + dx if cmd == 'm' else dx
                curr_y = curr_y + dy if cmd == 'm' else dy
                start_x, start_y = curr_x, curr_y
                xs.append(curr_x); ys.append(curr_y)
                i += 2
                cmd = 'l' if cmd == 'm' else 'L'
            elif cmd in 'lL':
                dx, dy = float(tokens[i]), float(tokens[i+1])
                curr_x = curr_x + dx if cmd == 'l' else dx
                curr_y = curr_y + dy if cmd == 'l' else dy
                xs.append(curr_x); ys.append(curr_y)
                i += 2
            elif cmd in 'hH':
                dx = float(tokens[i])
                curr_x = curr_x + dx if cmd == 'h' else dx
                xs.append(curr_x); ys.append(curr_y)
                i += 1
            elif cmd in 'vV':
                dy = float(tokens[i])
                curr_y = curr_y + dy if cmd == 'v' else dy
                xs.append(curr_x); ys.append(curr_y)
                i += 1
            elif cmd in 'c':
                for k in range(0, 6, 2):
                    xs.append(curr_x + float(tokens[i+k]))
                    ys.append(curr_y + float(tokens[i+k+1]))
                curr_x += float(tokens[i+4])
                curr_y += float(tokens[i+5])
                i += 6
            elif cmd in 'C':
                for k in range(0, 6, 2):
                    xs.append(float(tokens[i+k]))
                    ys.append(float(tokens[i+k+1]))
                curr_x = float(tokens[i+4])
                curr_y = float(tokens[i+5])
                i += 6
            elif cmd in 'zZ':
                curr_x, curr_y = start_x, start_y
                i += 1
            else:
                i += 1
        except Exception:
            i += 1
    if not xs:
        return 0, 0, 0, 0
    return min(xs), max(xs), min(ys), max(ys)

def analyze(filepath):
    print(f"\n=================== {filepath} ===================")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # check transform in g
    tx, ty = 0.0, 0.0
    m = re.search(r'transform="translate\(([-+]?[\d.]+),([-+]?[\d.]+)\)"', content)
    if m:
        tx, ty = float(m.group(1)), float(m.group(2))
        print(f"Group translation: ({tx}, {ty})")

    # viewBox
    m_vb = re.search(r'viewBox="([^"]+)"', content)
    print(f"Current viewBox: {m_vb.group(1) if m_vb else 'None'}")

    root = ET.fromstring(content)
    paths = root.findall('.//{http://www.w3.org/2000/svg}path') + root.findall('.//path')
    for idx, p in enumerate(paths):
        d = p.attrib.get('d', '')
        minx, maxx, miny, maxy = get_bbox(d)
        print(f"Raw bbox path {idx}: X:[{minx:.2f}, {maxx:.2f}] (w={maxx-minx:.2f}), Y:[{miny:.2f}, {maxy:.2f}] (h={maxy-miny:.2f})")
        # with group transform:
        t_minx, t_maxx = minx + tx, maxx + tx
        t_miny, t_maxy = miny + ty, maxy + ty
        print(f"Transformed bbox: X:[{t_minx:.2f}, {t_maxx:.2f}] (w={t_maxx-t_minx:.2f}), Y:[{t_miny:.2f}, {t_maxy:.2f}] (h={t_maxy-t_miny:.2f})")

analyze('client/public/MEMENTO_LOGO.svg')
analyze('client/public/MEMENTO_FRASE.svg')
analyze('client/public/arturo_sinterminar.svg')
analyze('client/public/miriam_pegatina.svg')

