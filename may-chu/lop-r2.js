// Lớp thay R2: lưu tệp trên đĩa. Siêu dữ liệu (kiểu nội dung) nằm ở thư mục m/ song song với v/.
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

export function moR2(goc) {
  const thuMucVat = resolve(goc, 'v');
  const thuMucMeta = resolve(goc, 'm');

  const duong = (khoa, thuMuc) => {
    if (typeof khoa !== 'string' || !khoa || khoa.includes('\0') || khoa.split('/').some((p) => p === '..')) {
      throw new Error(`Khóa R2 không hợp lệ: ${String(khoa).slice(0, 80)}`);
    }
    const d = resolve(thuMuc, khoa);
    if (!d.startsWith(thuMuc + sep)) throw new Error('Khóa R2 ra ngoài thư mục lưu trữ.');
    return d;
  };

  const docMeta = async (khoa) => {
    try {
      return JSON.parse(await readFile(`${duong(khoa, thuMucMeta)}.json`, 'utf8'));
    } catch {
      return {};
    }
  };

  const dungVat = async (khoa, st) => {
    const d = duong(khoa, thuMucVat);
    const httpMetadata = await docMeta(khoa);
    return {
      key: khoa,
      size: st.size,
      httpMetadata,
      get body() { return Readable.toWeb(createReadStream(d)); },
      arrayBuffer: async () => { const b = await readFile(d); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
      text: async () => readFile(d, 'utf8'),
      json: async () => JSON.parse(await readFile(d, 'utf8')),
    };
  };

  const quet = async (thuMuc, tienTo = '') => {
    const ra = [];
    let muc;
    try {
      muc = await readdir(thuMuc, { withFileTypes: true });
    } catch {
      return ra;
    }
    for (const m of muc) {
      if (m.isDirectory()) ra.push(...(await quet(join(thuMuc, m.name), `${tienTo}${m.name}/`)));
      else ra.push(`${tienTo}${m.name}`);
    }
    return ra;
  };

  return {
    put: async (khoa, duLieu, tuyChon = {}) => {
      const d = duong(khoa, thuMucVat);
      let bytes = duLieu;
      if (duLieu && typeof duLieu.getReader === 'function') bytes = new Uint8Array(await new Response(duLieu).arrayBuffer());
      else if (duLieu instanceof ArrayBuffer) bytes = new Uint8Array(duLieu);
      await mkdir(dirname(d), { recursive: true });
      await writeFile(d, bytes);
      const m = `${duong(khoa, thuMucMeta)}.json`;
      await mkdir(dirname(m), { recursive: true });
      await writeFile(m, JSON.stringify(tuyChon.httpMetadata || {}));
      return { key: khoa };
    },
    get: async (khoa) => {
      try {
        return await dungVat(khoa, await stat(duong(khoa, thuMucVat)));
      } catch (e) {
        if (e.code === 'ENOENT' || e.code === 'EISDIR') return null;
        throw e;
      }
    },
    head: async (khoa) => {
      try {
        const st = await stat(duong(khoa, thuMucVat));
        return st.isFile() ? { key: khoa, size: st.size, httpMetadata: await docMeta(khoa) } : null;
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    delete: async (khoa) => {
      for (const k of [].concat(khoa)) {
        await rm(duong(k, thuMucVat), { force: true });
        await rm(`${duong(k, thuMucMeta)}.json`, { force: true });
      }
    },
    list: async ({ prefix = '', cursor, limit = 1000 } = {}) => {
      const tatCa = (await quet(thuMucVat)).filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      const lat = tatCa.slice(0, limit);
      const objects = [];
      for (const key of lat) objects.push({ key, size: (await stat(duong(key, thuMucVat))).size });
      const conNua = tatCa.length > limit;
      return { objects, truncated: conNua, cursor: conNua ? lat[lat.length - 1] : undefined };
    },
  };
}
