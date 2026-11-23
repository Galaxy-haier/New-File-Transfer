// 直连 worker 模块的单元测试：覆盖 HTTP 层不方便构造的兼容场景
//   - 旧版遗留的「无尾斜杠目录占位」（仅靠 customMetadata.isDir 识别）
//   - 路径穿越（%2e%2e / .. ）不得越出 dav/ 前缀
// 用法: node preview/unit-webdav.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const tmp = join(__dirname, '.worker.unit.mjs');
writeFileSync(tmp, readFileSync(join(repoRoot, 'worker.js'), 'utf8'));
const { default: worker } = await import(pathToFileURL(tmp).href);

const enc = new TextEncoder();
const dec = new TextDecoder();
function makeBucket() {
  const store = new Map();
  const ref = (k, o) => ({
    key: k, size: o.data.byteLength, etag: '"' + o.data.byteLength + '-' + k.length + '"',
    httpMetadata: o.httpMetadata || {}, customMetadata: o.customMetadata || {}, uploaded: o.uploaded,
    body: new ReadableStream({ start(c) { c.enqueue(o.data); c.close(); } }),
    async text() { return dec.decode(o.data); },
  });
  return {
    store,
    async put(k, v, opts = {}) {
      const data = typeof v === 'string' ? enc.encode(v) : (v instanceof Uint8Array ? v : new Uint8Array(await new Response(v).arrayBuffer()));
      const o = { data, httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {}, uploaded: new Date() };
      store.set(k, o);
      return ref(k, o);
    },
    async get(k) { const o = store.get(k); return o ? ref(k, o) : null; },
    async head(k) { const o = store.get(k); return o ? ref(k, o) : null; },
    async delete(k) { return store.delete(k); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? +cursor : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map((k) => ref(k, store.get(k))), truncated, cursor: truncated ? String(start + limit) : undefined };
    },
  };
}

const bucket = makeBucket();
const env = {
  'file-transfer': bucket,
  WEBDAV_PASSWORD: 'admin',
};
await bucket.put('_config/site', JSON.stringify({
  authUser: 'admin',
  authPassSalt: 'unitsalt01234567',
  authPassHash: createHash('sha256').update('admin' + 'unitsalt01234567').digest('hex'),
  bgUrl: '', updatedAt: Date.now(),
}), { httpMetadata: { contentType: 'application/json' } });

const AUTH = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
const call = (method, path, headers = {}, body) =>
  worker.fetch(new Request('https://x.test' + path, { method, headers: { ...AUTH, ...headers }, body }), env, {});

let failed = 0;
const check = async (name, fn) => {
  try { const v = await fn(); console.log(`  [PASS] ${name}${v ? ' -> ' + v : ''}`); }
  catch (e) { failed++; console.log(`  [FAIL] ${name}\n         ${e.message}`); }
};
const strip = (x) => x.replace(/<(\/?)[A-Za-z0-9_.-]+:/g, '<$1');

console.log('unit tests (in-process worker)\n');

await check('旧版遗留「无尾斜杠目录」仍按 collection 返回', async () => {
  // 模拟老版本写入的目录：key 无尾斜杠，仅 customMetadata.isDir=1
  await bucket.put('dav/legacyDir', new Uint8Array(0), {
    httpMetadata: { contentType: 'httpd/unix-directory' },
    customMetadata: { webdav: '1', isDir: '1' },
  });
  const r = await call('PROPFIND', '/dav/', { Depth: '1' });
  if (r.status !== 207) throw new Error('status=' + r.status);
  const xml = strip(await r.text());
  const seg = xml.split('<response>').find((s) => s.includes('legacyDir'));
  if (!seg) throw new Error('列表中未出现 legacyDir');
  if (!/<collection\s*\/>/.test(seg)) throw new Error('legacyDir 被识别成文件');
  if (!/<href>\/dav\/legacyDir\/<\/href>/.test(seg)) throw new Error('href 未补尾斜杠: ' + seg.slice(0, 120));
  return 'collection + href 带尾斜杠';
});

await check('路径穿越 %2e%2e 不得越出 dav/ 前缀', async () => {
  const r = await call('PUT', '/dav/%2e%2e/%2e%2e/escape.txt', { 'Content-Length': '1' }, 'x');
  const keys = [...bucket.store.keys()];
  const leaked = keys.filter((k) => !k.startsWith('dav/') && k !== '_config/site');
  if (leaked.length) throw new Error('越界写入: ' + leaked.join(', '));
  return `status=${r.status}，未产生越界 key`;
});

await check('编码目录名 PUT 后能以明文 key 命中（不落 %XX 字面量）', async () => {
  const dir = encodeURIComponent('同步目录');
  const mk = await call('MKCOL', `/dav/${dir}/`);
  if (![201, 405].includes(mk.status)) throw new Error('MKCOL status=' + mk.status);
  const put = await call('PUT', `/dav/${dir}/${encodeURIComponent('记录 1.jsonl')}`, { 'Content-Length': '3' }, 'abc');
  if (![201, 204].includes(put.status)) throw new Error('PUT status=' + put.status);
  const keys = [...bucket.store.keys()];
  if (!keys.includes('dav/同步目录/记录 1.jsonl')) {
    throw new Error('未生成明文 key，实际: ' + keys.filter((k) => k.startsWith('dav/')).join(' | '));
  }
  const get = await call('GET', `/dav/${dir}/${encodeURIComponent('记录 1.jsonl')}`);
  if (get.status !== 200) throw new Error('GET status=' + get.status);
  if ((await get.text()) !== 'abc') throw new Error('内容不符');
  return 'dav/同步目录/记录 1.jsonl';
});

await check('目录 PROPFIND 的 href 与自身项不重复列出', async () => {
  const r = await call('PROPFIND', `/dav/${encodeURIComponent('同步目录')}/`, { Depth: '1' });
  const xml = strip(await r.text());
  const hrefs = [...xml.matchAll(/<href>([^<]*)<\/href>/g)].map((m) => m[1]);
  const self = hrefs.filter((h) => decodeURIComponent(h) === '/dav/同步目录/');
  if (self.length !== 1) throw new Error('自身项数量异常: ' + self.length + ' | ' + JSON.stringify(hrefs));
  return `共 ${hrefs.length} 条（含自身 1 条）`;
});

await check('PUT 覆盖返回 204，新建返回 201，ETag 为真实值', async () => {
  const a = await call('PUT', '/dav/etag.txt', { 'Content-Length': '1' }, 'a');
  const b = await call('PUT', '/dav/etag.txt', { 'Content-Length': '1' }, 'b');
  if (a.status !== 201) throw new Error('首次应 201，实际 ' + a.status);
  if (b.status !== 204) throw new Error('覆盖应 204，实际 ' + b.status);
  const etag = b.headers.get('etag');
  if (!etag || !etag.startsWith('"')) throw new Error('ETag 缺失或未加引号: ' + etag);
  const pf = strip(await (await call('PROPFIND', '/dav/etag.txt', { Depth: '0' })).text());
  if (!pf.includes('getetag')) throw new Error('PROPFIND 无 getetag');
  return `201→204，ETag=${etag}`;
});

await check('LOCK 未绑定 KV 时回 405（客户端可容忍）', async () => {
  const r = await call('LOCK', '/dav/etag.txt');
  if (r.status !== 405) throw new Error('status=' + r.status);
  return 'status=405';
});

console.log('\n' + (failed === 0 ? '>>> 单元用例全部通过' : `>>> ${failed} 项失败`));
process.exitCode = failed ? 2 : 0;
