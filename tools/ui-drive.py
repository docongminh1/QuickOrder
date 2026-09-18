# -*- coding: utf-8 -*-
"""Tay máy đóng vai nhân viên: điều khiển app thật trên máy ảo qua adb + uiautomator, so kết quả màn hình với bộ não.
Chạy: python3 tools/ui-drive.py [số khách] [bắt đầu từ id]
"""
import json, os, re, subprocess, sys, time, unicodedata, xml.etree.ElementTree as ET
ADB = os.path.expanduser('~/Library/Android/sdk/platform-tools/adb')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = '/private/tmp/claude-501/-Users-docongminh-Desktop-AICC/0d694266-42d4-46f9-afc8-76032dd8525c/scratchpad/uidrive'
os.makedirs(SHOT, exist_ok=True)

TIMING = open(os.path.join(SHOT, 'timing.log'), 'a')
def sh(*a, timeout=30):
    t = time.time()
    try: return subprocess.run([ADB, *a], capture_output=True, timeout=timeout).stdout
    finally: TIMING.write(f"{time.time()-t:.2f} {' '.join(a[:4])}\n"); TIMING.flush()
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
IME_OFF = None
def hide_kb():
    global IME_OFF
    if IME_OFF is None: IME_OFF = (sh('shell', 'ime', 'list', '-s', timeout=10).strip() == b'')  # đã `ime disable` → không có gì để ẩn
    if IME_OFF: return
    # KHÔNG dùng BACK (keyevent 4): bàn phím vừa tự đóng thì BACK rơi vào app ở gốc tab → app thoát ra màn hình chính,
    # mọi khách sau đó đều sai (từng xảy ra ở khách 105-118). Máy ảo đã `ime disable` nên hầu như không còn bàn phím để ẩn.
    for _ in range(2):
        if not kb_shown(): return
        sh('shell', 'input', 'keyevent', '111'); time.sleep(0.4)

APP = 'com.basebs.catlieunhanh'
def ensure_app():
    """App phải đang ở trước màn; nếu lỡ bị đẩy ra ngoài (launcher, hộp thoại hệ thống) thì mở lại."""
    sh('shell', 'cmd', 'statusbar', 'collapse', timeout=8)  # vuốt trên launcher hay kéo bảng thông báo xuống che app
    for _ in range(3):
        top = sh('shell', 'dumpsys', 'activity', 'activities', timeout=15)
        m = re.search(rb'topResumedActivity=ActivityRecord\{[^}]*\}', top) or re.search(rb'ResumedActivity: ActivityRecord\{[^}]*\}', top)
        if m and APP.encode() in m.group(0): return True
        sh('shell', 'am', 'start', '-n', APP + '/.MainActivity'); time.sleep(4)
    return False

UIXML = os.path.join(SHOT, 'ui.xml')
def dump():
    """Đọc cây giao diện. Không chờ luồng `adb shell uiautomator dump` kết thúc: kênh adb trên Mac cứ ~10 lần lại treo 40-60s
    ở bước đóng luồng dù máy ảo đã ghi file xong sau ~3s (client kẹt trong read(), `adb shell echo` lúc đó vẫn 0.04s).
    Cách làm: chạy dumper tách nền trong máy (nohup … &), thăm file bằng lệnh nhỏ tới khi có </hierarchy>, rồi `adb pull`."""
    for window in (8, 8, 8, 25):  # bình thường ~3s; treo thì bỏ sau 8s và chạy lại, lần cuối chờ lâu hẳn
        raw = b''
        try:
            sh('shell', 'rm -f /sdcard/ui.xml; nohup uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 </dev/null &', timeout=8)
            t0 = time.time()
            while time.time() - t0 < window:
                time.sleep(0.4)
                tail = sh('shell', 'tail -c 16 /sdcard/ui.xml 2>/dev/null', timeout=8)
                if b'</hierarchy>' in tail: break
            else:
                continue
            if os.path.exists(UIXML): os.remove(UIXML)
            sh('pull', '/sdcard/ui.xml', UIXML, timeout=10)
            if os.path.exists(UIXML): raw = open(UIXML, 'rb').read()
        except subprocess.TimeoutExpired:
            continue
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

class Harness(Exception):
    """Lỗi của tay máy / máy ảo (không đọc được màn, mất tab…) — không phải lỗi app; khách đó sẽ được làm lại."""

def dump_or_raise():
    nodes = dump()
    if not nodes: raise Harness('không đọc được màn hình')
    return nodes

POS = {}  # toạ độ đã học (tab đáy, nút Khách mới) — cố định giữa các khách, đỡ 2 lần đọc màn mỗi khách
def go_tab(name):
    ensure_app()
    if name in POS: tap(*POS[name], 1.0); return
    nodes = dump_or_raise()
    cands = [n for n in nodes if n[0].strip() == name]   # tab ở đáy: chọn node thấp nhất có chữ đó
    if not cands: raise Harness(f'không thấy tab {name}')
    c = max(cands, key=lambda n: n[2]); POS[name] = (c[1], c[2]); tap(c[1], c[2], 1.0)

def new_customer():
    if 'Khách mới' in POS: tap(*POS['Khách mới'], 0.8); return
    nodes = dump_or_raise(); hit = find(nodes, exact('Khách mới'))
    if not hit and not find(nodes, exact('Cân')):
        swipe(600, 1900); nodes = dump_or_raise(); hit = find(nodes, exact('Khách mới'))
    if hit: POS['Khách mới'] = (hit[0], hit[1]); tap(hit[0], hit[1], 0.8)
    elif not find(nodes, exact('Cân')): raise Harness('không thấy nút Khách mới lẫn đầu trang Cắt liều')
    # không có nút Khách mới nhưng thấy đầu trang → app vừa mở, chưa có gì để xoá: đi tiếp

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
    top = dump_or_raise()
    if not find(top, exact('Cân')):
        POS.clear(); go_tab('Cắt liều'); new_customer(); swipe(600, 1900); top = dump_or_raise()  # toạ độ nhớ sai? học lại
        if not find(top, exact('Cân')): raise Harness('không thấy đầu trang Cắt liều')
    def top_tap(pred):
        h = find(top, pred)
        if not h or not (60 < h[1] < 2200): return False
        tap(h[0], h[1]); return True
    # 1. ai uống
    if c['audience'] == 'Trẻ em':
        if not top_tap(exact('Trẻ em')): return False, 'không thấy nút Trẻ em'
        if c['kg'] is not None:
            time.sleep(0.8); type_text(str(c['kg']))
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
        top = dump_or_raise()   # chọn Trẻ em xong bước 2 mất chip 'Có thai'/'Trên 65' → mọi thứ bên dưới dịch lên: đọc lại toạ độ
    # 2. tình trạng + 3. cờ đỏ: bấm theo toạ độ đã đọc ở đầu trang (bố cục trên không đổi), rồi đọc 1 lần để kiểm
    step2 = exact('Đau dạ dày') if c['cond'] else exact('Không có gì đặc biệt')
    if not top_tap(step2): return False, 'không bấm được bước 2'
    if c['flag']:
        if not top_tap(starts('Xem câu hỏi')): return False, 'không mở được câu hỏi cờ đỏ'
        if not tap_text(starts('Khó thở'), scroll=True): return False, 'không thấy cờ đỏ Khó thở'
        nodes = dump_or_raise()
    else:
        if not top_tap(starts('✓ Không có dấu hiệu')): return False, 'không bấm được bước 3'
        nodes = dump_or_raise()
        for _fix in range(2):
            pend = [n for n in nodes if n[0].strip() == 'chưa hỏi']   # nhãn cạnh tiêu đề bước còn thiếu
            if not pend: break
            h2 = find(nodes, starts('2 · ')); h3 = find(nodes, starts('3 · '))
            for n in pend:   # bấm lại ĐÚNG bước còn thiếu (chip là công tắc, bấm thừa sẽ tắt)
                if h2 and abs(n[2] - h2[1]) < 40:
                    if not tap_text(step2, scroll=False): return False, 'không bấm được bước 2'
                elif h3 and abs(n[2] - h3[1]) < 40:
                    if not tap_text(starts('✓ Không có dấu hiệu'), scroll=False): return False, 'không bấm được bước 3'
            nodes = dump_or_raise()
        if any(n[0].strip() == 'chưa hỏi' for n in nodes): return False, 'bước 2/3 chưa nhận sau 2 lần bấm'
    # 4. triệu chứng qua ô tìm: gõ xong đọc 1 lần vừa soát chữ vừa tìm chip
    for i_sym, (sym, typed) in enumerate(zip(c['symptoms'], c['typed'])):
        box = find(nodes, starts('Gõ lời khách nói')) if (nodes and i_sym == 0) else None
        if box and 60 < box[1] < 2200: tap(box[0], box[1])
        elif not tap_text(starts('Gõ lời khách nói'), scroll=True): return False, 'không thấy ô tìm triệu chứng'
        type_text(typed, 0.8); nodes = dump_or_raise(); typed_ok = bool(find(nodes, lambda t: norm(t) == norm(typed)))
        for _retry in range(2):
            if typed_ok: break
            x = find(nodes, exact('✕'))                 # máy ảo nuốt/đúp phím → xoá, gõ lại
            if x: tap(x[0], x[1], 0.5)
            if not tap_text(starts('Gõ lời khách nói'), scroll=True): return False, 'không thấy ô tìm triệu chứng'
            type_text(typed, 0.8); nodes = dump_or_raise(); typed_ok = bool(find(nodes, lambda t: norm(t) == norm(typed)))
        if not typed_ok: return False, f'máy ảo gõ sai chữ "{typed}" (3 lần)'
        hide_kb()
        chip = find(nodes, exact(sym))
        if chip and 60 < chip[1] < 2200: tap(chip[0], chip[1])
        elif not tap_text(exact(sym), scroll=True, tries=3):
            return False, f'không thấy chip "{sym}" sau khi gõ "{typed}"'
        nodes = None
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
        # nhãn trên màn in HOA ("CÓ PHẢI BẠN TÌM") → so không phân biệt hoa/thường/dấu
        ok = any(norm('Không có thuốc tên này') in norm(t) for t in texts) or any(norm('Có phải bạn tìm') in norm(t) for t in texts)
        return ok, 'báo chưa có / gợi ý ✓' if ok else 'không báo chưa có'
    ok = e['first'] in texts
    loc_ok = (not e['location']) or any(e['location'] in t for t in texts)
    x = find(dump(), exact('✕'));
    if x: tap(x[0], x[1], 0.3)
    return ok and loc_ok, f"{e['first']}{' 📍' + e['location'] if e['location'] else ''}{'' if ok and loc_ok else ' KHÔNG THẤY'}"

def wait_for_calm():
    """Mac đang bận (Chrome/VS Code của chủ máy) thì máy ảo đọc màn không kịp → toàn ca sai giả. Tải >20 thì đứng chờ, <14 chạy tiếp."""
    paused = False
    while True:
        load = os.getloadavg()[0]
        if load < (14 if paused else 20):
            if paused: print(f"▶ tải máy {load:.0f}, chạy tiếp", flush=True)
            return
        if not paused: print(f"⏸ tải máy {load:.0f} quá cao, tạm dừng chờ máy rảnh", flush=True); paused = True
        time.sleep(30)

def run_one(c):
    try:
        return run_dose(c) if c['kind'] == 'dose' else run_lookup(c)
    except Harness as ex:
        return None, f'lỗi tay máy: {ex}'
    except Exception as ex:
        return None, f'lỗi tay máy: {type(ex).__name__}: {ex}'

def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    cust = json.load(open(os.path.join(ROOT, 'tools/customers.json')))
    cust = [c for c in cust if c['id'] >= start][:n]
    res = []; t0 = time.time()
    for c in cust:
        wait_for_calm(); t1 = time.time()
        ok, note = run_one(c)
        if ok is None:                       # lỗi tay máy → mở lại app, làm lại khách này 1 lần
            POS.clear(); ensure_app(); time.sleep(3); wait_for_calm()
            ok2, note2 = run_one(c)
            if ok2 is None: ok, note = False, note2 + ' (đã thử lại)'
            else: ok, note = ok2, note2
        if not ok:
            try: open(f"{SHOT}/fail-{c['id']}.png", 'wb').write(sh('exec-out', 'screencap', '-p', timeout=20))
            except Exception: pass
        desc = f"{c['kind']} {c.get('audience','')} {c.get('kg') or ''} {'+'.join(c.get('symptoms', [])) or c.get('query','')}{' CỜ ĐỎ' if c.get('flag') else ''}{' ĐẶC BIỆT' if c.get('cond') else ''}"
        line = f"#{c['id']:3d} {'✓' if ok else '✗'} {desc.strip()} → {note} ({time.time()-t1:.0f}s)"
        print(line, flush=True); res.append((c['id'], ok, desc, note))
    okn = sum(1 for r in res if r[1])
    print(f"\nKẾT QUẢ UI: {okn}/{len(res)} khách đúng, {time.time()-t0:.0f}s"); 
    json.dump(res, open(os.path.join(SHOT, f'result-{start}.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__': main()
