# -*- coding: utf-8 -*-
"""Tay máy đóng vai nhân viên: điều khiển app thật trên máy ảo qua adb + uiautomator, so kết quả màn hình với bộ não.
Chạy: python3 tools/ui-drive.py [số khách] [bắt đầu từ id]
"""
import json, os, re, subprocess, sys, time, unicodedata, xml.etree.ElementTree as ET
ADB = os.path.expanduser('~/Library/Android/sdk/platform-tools/adb')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = '/private/tmp/claude-501/-Users-docongminh-Desktop-AICC/0d694266-42d4-46f9-afc8-76032dd8525c/scratchpad/uidrive'
os.makedirs(SHOT, exist_ok=True)

def sh(*a, timeout=30):
    return subprocess.run([ADB, *a], capture_output=True, timeout=timeout).stdout
def tap(x, y, wait=0.6): sh('shell', 'input', 'tap', str(int(x)), str(int(y))); time.sleep(wait)
def swipe(y1, y2, wait=0.8): sh('shell', 'input', 'swipe', '540', str(y1), '540', str(y2), '250'); time.sleep(wait)
def type_text(t, wait=0.6): sh('shell', 'input', 'text', t.replace(' ', '%s')); time.sleep(wait)
def type_into(field_pred, text, wait=0.8, tries=3):
    """Gõ vào ô rồi SOÁT lại chữ trên màn (máy ảo quá tải hay nuốt/đúp phím: "khan tieng" → "khhan tien").
    Sai thì bấm ✕ xoá, bấm lại ô, gõ lại. Trả True nếu chữ trên màn đúng chữ đã gõ."""
    for k in range(tries):
        type_text(text, wait)
        if find(dump(), lambda t: norm(t) == norm(text)): return True
        x = find(dump(), exact('✕'))
        if x: tap(x[0], x[1], 0.5)
        if not tap_text(field_pred, scroll=(k > 0)): return False
    return False
def norm(s):
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('đ', 'd').replace('Đ', 'D').lower().strip()
def kb_shown():
    return b'mInputShown=true' in sh('shell', 'dumpsys', 'input_method')
def hide_kb():
    if kb_shown(): sh('shell', 'input', 'keyevent', '111'); time.sleep(0.4)
    if kb_shown(): sh('shell', 'input', 'keyevent', '4'); time.sleep(0.4)

def dump():
    for _ in range(3):
        raw = sh('exec-out', 'uiautomator', 'dump', '/dev/tty', timeout=40)
        i = raw.find(b'<?xml')
        if i >= 0:
            xml = raw[i:]; j = xml.rfind(b'</hierarchy>')
            if j > 0:
                try:
                    root = ET.fromstring(xml[:j + 12]); nodes = []
                    for n in root.iter('node'):
                        t = n.get('text') or ''
                        b = re.findall(r'\d+', n.get('bounds', ''))
                        if t and len(b) == 4:
                            x1, y1, x2, y2 = map(int, b); nodes.append((t, (x1 + x2) // 2, (y1 + y2) // 2, y1, y2))
                    return nodes
                except ET.ParseError: pass
        time.sleep(0.5)
    return []

def find(nodes, pred):
    for t, cx, cy, y1, y2 in nodes:
        if pred(t): return (cx, cy, y1, y2, t)
    return None
def exact(s): return lambda t: t.strip() == s
def starts(s): return lambda t: t.strip().startswith(s)
def contains(s): return lambda t: norm(s) in norm(t)

def tap_text(pred, scroll=True, tries=6):
    """Tìm chữ trên màn, cuộn nếu chưa thấy, rồi bấm. Trả True nếu bấm được."""
    for k in range(tries):
        nodes = dump(); hit = find(nodes, pred)
        if hit and 60 < hit[1] < 2200:
            tap(hit[0], hit[1]); return True
        if not scroll: return False
        swipe(1700, 900) if k < 4 else swipe(900, 1700)
    return False
def visible(pred):
    return find(dump(), pred) is not None

def go_tab(name):
    nodes = dump(); hit = find(nodes, lambda t: t.strip() == name and True)
    # tab ở đáy: chọn node thấp nhất có chữ đó
    cands = [n for n in nodes if n[0].strip() == name]
    if cands:
        c = max(cands, key=lambda n: n[2]); tap(c[1], c[2], 1.0)

def new_customer():
    nodes = dump()
    hit = find(nodes, exact('Khách mới'))
    if hit: tap(hit[0], hit[1], 0.8)
    else:
        swipe(600, 1900); nodes = dump(); hit = find(nodes, exact('Khách mới'))
        if hit: tap(hit[0], hit[1], 0.8)

def screen_texts(scrolls=3):
    texts = []
    for k in range(scrolls):
        texts += [n[0] for n in dump()]
        swipe(1800, 700)
    return texts

def run_dose(c):
    """Trả về (ok, ghi chú)"""
    go_tab('Cắt liều'); new_customer()
    swipe(600, 1900)  # về đầu trang
    hide_kb()
    # 1. ai uống
    if c['audience'] == 'Trẻ em':
        if not tap_text(exact('Trẻ em'), scroll=False): return False, 'không thấy nút Trẻ em'
        if c['kg'] is not None:
            time.sleep(1.0); type_text(str(c['kg']))
            # số kg phải nằm TRONG ô Cân (cùng dòng với nhãn "Cân"); lạc vào ô tìm thì xoá và gõ lại vào đúng ô
            def kg_ok():
                nodes = dump(); lab = find(nodes, exact('Cân')); val = find(nodes, exact(str(c['kg'])))
                return bool(lab and val and abs(val[1] - lab[1]) < 60)
            for _ in range(2):
                if kg_ok(): break
                x = find(dump(), exact('✕'))
                if x: tap(x[0], x[1], 0.4)
                lab = find(dump(), exact('Cân'))
                if lab: tap(lab[0] + 120, lab[1], 0.6); type_text(str(c['kg']))
            if not kg_ok(): return False, 'không gõ được số kg vào ô Cân'
        hide_kb()
    # 2. tình trạng
    if c['cond']:
        ok = tap_text(exact('Đau dạ dày'), scroll=False)
    else:
        ok = tap_text(exact('Không có gì đặc biệt'), scroll=False)
    if not ok: return False, 'không bấm được bước 2'
    # 3. cờ đỏ
    if c['flag']:
        if not tap_text(starts('Xem câu hỏi'), scroll=False): return False, 'không mở được câu hỏi cờ đỏ'
        if not tap_text(starts('Khó thở'), scroll=True): return False, 'không thấy cờ đỏ Khó thở'
    else:
        if not tap_text(starts('✓ Không có dấu hiệu'), scroll=False): return False, 'không bấm được bước 3'
    # 4. triệu chứng qua ô tìm
    for sym, typed in zip(c['symptoms'], c['typed']):
        if not tap_text(starts('Gõ lời khách nói'), scroll=True): return False, 'không thấy ô tìm triệu chứng'
        if not type_into(starts('Gõ lời khách nói'), typed): return False, f'máy ảo gõ sai chữ "{typed}" (3 lần)'
        hide_kb()
        if not tap_text(exact(sym), scroll=True, tries=3):
            return False, f'không thấy chip "{sym}" sau khi gõ "{typed}"'
    # 5. kết quả
    if c['flag']:
        swipe(1800, 600); swipe(1800, 600)
        texts = screen_texts(2)
        stop = any('KHÔNG CẮT THUỐC' in t for t in texts)
        return stop, 'khối đỏ KHÔNG CẮT THUỐC' if stop else 'THIẾU khối đỏ khi có cờ đỏ'
    if not tap_text(starts('↓ Xem thuốc'), scroll=False):
        # cuộn lên đầu để thấy nút
        swipe(600, 1900); swipe(600, 1900)
        if not tap_text(starts('↓ Xem thuốc'), scroll=False): return False, 'không thấy nút Xem thuốc'
    time.sleep(0.6)
    texts = screen_texts(3)
    joined = '\n'.join(texts)
    notes = []; ok = True
    e = c['expect']
    if e['needsWeight']:
        if not any(t.startswith('Hỏi khách: bé nặng') for t in texts): ok = False; notes.append('thiếu nhắc nhập kg')
        else: notes.append('nhắc kg ✓')
    if c['cond']:
        if 'gọi dược sĩ duyệt' not in joined: ok = False; notes.append('thiếu khung đỏ gọi dược sĩ')
        else: notes.append('khung gọi dược sĩ ✓')
    n_caution = 0
    for it in e['items']:
        if it['drug'] not in texts: ok = False; notes.append(f"thiếu thẻ {it['drug']}")
        if it['total'] and it['total'] not in texts: ok = False; notes.append(f"thiếu dòng '{it['total']}'")
        if it.get('caution'): n_caution += 1
    n_stop = sum(1 for t in texts if t.startswith('⛔ KHÔNG TỰ CẮT'))
    if n_caution and n_stop < n_caution: ok = False; notes.append(f'mong {n_caution} khung KHÔNG TỰ CẮT, thấy {n_stop}')
    elif n_caution: notes.append(f'{n_caution} khung KHÔNG TỰ CẮT ✓')
    if e['noRule'] and 'Chưa có hướng dẫn' not in joined: ok = False; notes.append('thiếu báo chưa có luật')
    if not e['items'] and not e['noRule'] and not e['needsWeight']: notes.append('không có thuốc?')
    who = 'TRẺ EM' if c['audience'] == 'Trẻ em' else 'NGƯỜI LỚN'
    if not any(t.startswith('Đang tính cho: ' + who) for t in texts): ok = False; notes.append('dòng "Đang tính cho" sai/thiếu')
    return ok, '; '.join(notes) or f"{len(e['items'])} thẻ đúng"

def run_lookup(c):
    go_tab('Tra thuốc')
    nodes = dump()
    x = find(nodes, exact('✕'))
    if x: tap(x[0], x[1])
    if not tap_text(starts('Gõ tên thuốc'), scroll=False): return False, 'không thấy ô tra'
    if not type_into(starts('Gõ tên thuốc'), norm(c['query']), 1.0): return False, f'máy ảo gõ sai chữ "{norm(c["query"])}" (3 lần)'
    hide_kb()
    texts = [n[0] for n in dump()]
    e = c['expect']
    if e.get('none'):
        ok = any('Không có thuốc tên này' in t for t in texts) or any('Có phải bạn tìm' in t for t in texts)
        return ok, 'báo chưa có / gợi ý ✓' if ok else 'không báo chưa có'
    ok = e['first'] in texts
    loc_ok = (not e['location']) or any(e['location'] in t for t in texts)
    x = find(dump(), exact('✕'));
    if x: tap(x[0], x[1], 0.3)
    return ok and loc_ok, f"{e['first']}{' 📍' + e['location'] if e['location'] else ''}{'' if ok and loc_ok else ' KHÔNG THẤY'}"

def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    cust = json.load(open(os.path.join(ROOT, 'tools/customers.json')))
    cust = [c for c in cust if c['id'] >= start][:n]
    res = []; t0 = time.time()
    for c in cust:
        t1 = time.time()
        try:
            ok, note = run_dose(c) if c['kind'] == 'dose' else run_lookup(c)
        except Exception as ex:
            ok, note = False, f'lỗi tay máy: {ex}'
        if not ok:
            sh('exec-out', 'screencap', '-p'); open(f"{SHOT}/fail-{c['id']}.png", 'wb').write(sh('exec-out', 'screencap', '-p'))
        desc = f"{c['kind']} {c.get('audience','')} {c.get('kg') or ''} {'+'.join(c.get('symptoms', [])) or c.get('query','')}{' CỜ ĐỎ' if c.get('flag') else ''}{' ĐẶC BIỆT' if c.get('cond') else ''}"
        line = f"#{c['id']:3d} {'✓' if ok else '✗'} {desc.strip()} → {note} ({time.time()-t1:.0f}s)"
        print(line, flush=True); res.append((c['id'], ok, desc, note))
    okn = sum(1 for r in res if r[1])
    print(f"\nKẾT QUẢ UI: {okn}/{len(res)} khách đúng, {time.time()-t0:.0f}s"); 
    json.dump(res, open(os.path.join(SHOT, f'result-{start}.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__': main()
