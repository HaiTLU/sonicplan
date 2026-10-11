#!/usr/bin/env python3
"""Đưa Worker lên Cloudflare bằng API, không cần wrangler.

Dùng khi máy không tải được gói npm (môi trường mạng hạn chế). Đọc wrangler.jsonc,
tải trang tĩnh trong public/, tải mã src/ dạng module, gắn D1, R2, AI, biến, lịch chạy,
tên miền riêng và tắt địa chỉ workers.dev. Có mạng npm thì dùng `npx wrangler deploy`.

Cần biến môi trường CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
Chạy: python3 scripts/trien-khai.py

Giới hạn: gói postal-mime (đọc thư Email Routing) không đóng gói được theo cách này nên
được thay bằng bản tạm báo lỗi; khi bật nhận thư (EMAIL_DOMAIN) phải triển khai bằng wrangler.
"""

import base64
import hashlib
import json
import mimetypes
import os
import pathlib
import re
import sys

import requests

GOC = pathlib.Path(__file__).resolve().parent.parent
API = 'https://api.cloudflare.com/client/v4'
TK = os.environ['CLOUDFLARE_ACCOUNT_ID']
DAU = {'Authorization': f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}"}

BAN_TAM_POSTAL_MIME = """// Bản tạm: triển khai bằng scripts/trien-khai.py không đóng gói được postal-mime.
export default {
  parse() {
    throw new Error('Chưa có bộ đọc thư: triển khai bằng npx wrangler deploy để bật nhận thư.');
  },
};
"""


def bo_chu_thich(chu):
    """Bỏ chú thích // và /* */ ngoài chuỗi trong JSONC."""
    ra, i, trong_chuoi = [], 0, False
    while i < len(chu):
        c = chu[i]
        if trong_chuoi:
            ra.append(c)
            if c == '\\':
                ra.append(chu[i + 1])
                i += 1
            elif c == '"':
                trong_chuoi = False
        elif c == '"':
            trong_chuoi = True
            ra.append(c)
        elif chu.startswith('//', i):
            i = chu.find('\n', i)
            if i < 0:
                break
            continue
        elif chu.startswith('/*', i):
            i = chu.find('*/', i) + 2
            continue
        else:
            ra.append(c)
        i += 1
    return re.sub(r',(\s*[}\]])', r'\1', ''.join(ra))


def goi(phuong_thuc, duong, **kw):
    kw.setdefault('headers', {}).update(DAU)
    r = requests.request(phuong_thuc, f'{API}{duong}', timeout=120, **kw)
    try:
        d = r.json()
    except ValueError:
        sys.exit(f'{phuong_thuc} {duong}: {r.status_code} {r.text[:300]}')
    if not d.get('success'):
        sys.exit(f'{phuong_thuc} {duong}: {json.dumps(d.get("errors"), ensure_ascii=False)}')
    return d.get('result')


def tai_trang_tinh(ten, cau_hinh):
    thu_muc = GOC / cau_hinh['directory']
    tep = {}
    for p in sorted(thu_muc.rglob('*')):
        if p.is_file():
            noi_dung = p.read_bytes()
            b64 = base64.b64encode(noi_dung).decode()
            ma = hashlib.sha256((b64 + p.suffix.lstrip('.')).encode()).hexdigest()[:32]
            tep['/' + p.relative_to(thu_muc).as_posix()] = {'hash': ma, 'size': len(noi_dung), 'b64': b64, 'p': p}
    phien = goi('POST', f'/accounts/{TK}/workers/scripts/{ten}/assets-upload-session',
                json={'manifest': {k: {'hash': v['hash'], 'size': v['size']} for k, v in tep.items()}})
    ve, theo_ma = phien['jwt'], {v['hash']: v for v in tep.values()}
    for nhom in phien.get('buckets') or []:
        phan = [(m, (m, theo_ma[m]['b64'], mimetypes.guess_type(theo_ma[m]['p'].name)[0] or 'application/octet-stream'))
                for m in nhom]
        r = requests.post(f'{API}/accounts/{TK}/workers/assets/upload?base64=true',
                          headers={'Authorization': f'Bearer {phien["jwt"]}'}, files=phan, timeout=120)
        d = r.json()
        if not d.get('success'):
            sys.exit(f'Tải trang tĩnh lỗi: {d.get("errors")}')
        ve = (d.get('result') or {}).get('jwt') or ve
    print(f'Trang tĩnh: {len(tep)} tệp, tải mới {sum(len(n) for n in phien.get("buckets") or [])}')
    return ve


def main():
    ch = json.loads(bo_chu_thich((GOC / 'wrangler.jsonc').read_text()))
    ten = ch['name']

    rang_buoc = [{'type': 'plain_text', 'name': k, 'text': v} for k, v in ch.get('vars', {}).items()]
    rang_buoc += [{'type': 'd1', 'name': d['binding'], 'id': d['database_id']} for d in ch.get('d1_databases', [])]
    rang_buoc += [{'type': 'r2_bucket', 'name': b['binding'], 'bucket_name': b['bucket_name']} for b in ch.get('r2_buckets', [])]
    if 'ai' in ch:
        rang_buoc.append({'type': 'ai', 'name': ch['ai']['binding']})

    meta = {
        'main_module': pathlib.Path(ch['main']).name,
        'compatibility_date': ch['compatibility_date'],
        'compatibility_flags': ch.get('compatibility_flags', []),
        'bindings': rang_buoc,
        'observability': ch.get('observability', {'enabled': False}),
        'keep_bindings': ['secret_text'],  # giữ khóa bí mật đã đặt bằng wrangler secret put
    }
    if 'assets' in ch:
        a = ch['assets']
        rang_buoc.append({'type': 'assets', 'name': a['binding']})
        meta['assets'] = {'jwt': tai_trang_tinh(ten, a), 'config': {
            k: a[k] for k in ('run_worker_first', 'not_found_handling', 'html_handling') if k in a}}

    thu_muc_ma = (GOC / ch['main']).parent
    phan = [('metadata', (None, json.dumps(meta), 'application/json'))]
    for p in sorted(thu_muc_ma.glob('*.js')):
        ma = p.read_text()
        if "from 'postal-mime'" in ma:
            ma = ma.replace("from 'postal-mime'", "from './postal-mime-tam.js'")
        phan.append((p.name, (p.name, ma, 'application/javascript+module')))
    phan.append(('postal-mime-tam.js', ('postal-mime-tam.js', BAN_TAM_POSTAL_MIME, 'application/javascript+module')))
    kq = goi('PUT', f'/accounts/{TK}/workers/scripts/{ten}', files=phan)
    print(f'Mã Worker: đã tải ({kq.get("etag", "")[:12]})')

    lich = ch.get('triggers', {}).get('crons', [])
    goi('PUT', f'/accounts/{TK}/workers/scripts/{ten}/schedules', json=[{'cron': c} for c in lich])
    print(f'Lịch chạy: {", ".join(lich)}')

    goi('POST', f'/accounts/{TK}/workers/scripts/{ten}/subdomain',
        json={'enabled': bool(ch.get('workers_dev', True)), 'previews_enabled': bool(ch.get('preview_urls', False))})

    for tuyen in ch.get('routes', []):
        if not tuyen.get('custom_domain'):
            continue
        ten_mien = tuyen['pattern']
        goc = '.'.join(ten_mien.split('.')[-2:])
        vung = goi('GET', '/zones', params={'name': goc})
        if not vung:
            sys.exit(f'Không thấy vùng {goc} trong tài khoản')
        goi('PUT', f'/accounts/{TK}/workers/domains', json={
            'hostname': ten_mien, 'service': ten, 'zone_id': vung[0]['id'], 'environment': 'production'})
        print(f'Tên miền: https://{ten_mien}')


if __name__ == '__main__':
    main()
