// 本地预览服务器：无需 Cloudflare，把 worker.js 原封不动跑起来
// 用内存模拟 R2 和 KV，网页界面 + WebDAV 都能本地验证
// 用法：node preview/server.mjs  （可设环境变量 PORT 和 WEBDAV_PASSWORD）
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);

// 1) 拷贝 worker.js 为 .mjs，保证预览代码与源码一致（每次启动都重新同步）
const workerSrc = readFileSync(join(repoRoot, 'worker.js'), 'utf8');
const workerMjsPath = join(__dirname, 'worker.preview.mjs');
writeFileSync(workerMjsPath, workerSrc);
const { default: workerModule } = await import(pathToFileURL(workerMjsPath).href);
const workerFetch = workerModule.fetch;

// 2) 内存版 R2
function createMemoryBucket() {
  const store = new Map();
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function toBytes(value) {
    if (value == null) return new Uint8Array(0);
    if (typeof value === 'string') return enc.encode(value);
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (value && typeof value.getReader === 'function') {
      const reader = value.getReader();
      const chunks = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.byteLength; }
      return out;
    }
    throw new Error('memory-bucket: unsupported value type');
  }

  function etagOf(bytes) {
    let h = 0;
    for (let i = 0; i < bytes.length; i++) h = ((h << 5) - h + bytes[i]) | 0;
    return '"' + (h >>> 0).toString(16) + '"';
  }

  function makeRef(key, obj) {
    return {
      key,
      size: obj.data.byteLength,
      etag: obj.etag,
      httpMetadata: obj.httpMetadata || {},
      customMetadata: obj.customMetadata || {},
      uploaded: obj.uploaded,
      body: new ReadableStream({
        start(c) { c.enqueue(obj.data); c.close(); },
      }),
      async text() { return dec.decode(obj.data); },
      async arrayBuffer() {
        return obj.data.buffer.slice(obj.data.byteOffset, obj.data.byteOffset + obj.data.byteLength);
      },
    };
  }

  return {
    async put(key, value, opts = {}) {
      const data = await toBytes(value);
      const prev = store.get(key);
      const obj = {
        data,
        httpMetadata: opts.httpMetadata || (prev && prev.httpMetadata) || {},
        customMetadata: opts.customMetadata || (prev && prev.customMetadata) || {},
        uploaded: new Date(),
        etag: etagOf(data),
      };
      store.set(key, obj);
      return makeRef(key, obj);
    },
    async get(key) {
      const obj = store.get(key);
      return obj ? makeRef(key, obj) : null;
    },
    async head(key) {
      const obj = store.get(key);
      return obj ? makeRef(key, obj) : null;
    },
    async delete(key) {
      return store.delete(key);
    },
    async list(opts = {}) {
      const prefix = opts.prefix || '';
      const limit = opts.limit || 1000;
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = opts.cursor ? parseInt(opts.cursor, 10) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return {
        objects: page.map((k) => makeRef(k, store.get(k))),
        truncated,
        cursor: truncated ? String(start + limit) : undefined,
      };
    },
  };
}

// 3) 内存版 KV（用于 WebDAV LOCK）
function createMemoryKv() {
  const store = new Map();
  return {
    async put(key, value) { store.set(key, String(value)); },
    async get(key) {
      const v = store.get(key);
      return v == null ? null : { async text() { return v; } };
    },
    async delete(key) { store.delete(key); },
  };
}

// 4) 构造 env（与 wrangler.toml 的 binding 对应）
const env = {
  'file-transfer': createMemoryBucket(), // CONFIG.BUCKET_NAME 默认 'file-transfer'
  WEBDAV_LOCKS: createMemoryKv(),
  // 本地预览默认密码 admin（生产务必用环境变量 WEBDAV_PASSWORD 覆盖）
  WEBDAV_PASSWORD: process.env.WEBDAV_PASSWORD || 'admin',
};

// 预览专用：预置站点登录凭据 admin/admin，方便本地测试登录流程
// （生产环境请通过设置界面或预先写入 _config/site 配置）
const previewBucket = env['file-transfer'];
await previewBucket.put('_config/site', JSON.stringify({
  authUser: 'admin',
  authPassSalt: 'preview0salt01234',
  authPassHash: await (async () => {
    // 与 worker hashPassword 一致：SHA-256(password + salt)
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update('admin' + 'preview0salt01234').digest('hex');
  })(),
  bgUrl: '',
  updatedAt: Date.now(),
}), { httpMetadata: { contentType: 'application/json' } });

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 仅预览用：从 worker 模块里拿到 UI HTML（通过测试导出，不影响生产代码）
function serveStatic(html, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + PORT);

    // 仅预览测试用：?cred=btoa(user:pass) 时预注入 Basic Auth，
    // 让无头浏览器能直接进入登录后的界面截图（生产环境无此逻辑）
    if (url.searchParams.has('cred')) {
      const cred = url.searchParams.get('cred');
      const path = url.searchParams.get('path') || '';
      let html = workerModule.__WEBDAV_UI_HTML__ || '<h1>preview: html unavailable</h1>';
      html = html.replace(
        '<script>',
        '<script>sessionStorage.setItem("wdav_cred", "' + cred + '");',
        { once: true }
      );
      // 截图用：注入初始路径（主脚本 var 声明会覆盖，所以在末尾追加脚本重新赋值并渲染）
      if (path) {
        html += '<script>currentPath = ' + JSON.stringify(path) + '; render();</script>';
      }
      return serveStatic(html, res);
    }
    // 仅预览测试用：?asuser=1 直接为主页签发会话 Cookie（模拟已登录，生产无此逻辑）
    if (url.searchParams.has('asuser')) {
      const payload = 's' + Date.now() + '.preview1';
      const { createHmac } = await import('node:crypto');
      // 与 worker signSession 密钥一致：getSecretKey({}) + ':session'
      // getSecretKey({}) = CONFIG.SHARE_SECRET_KEY('') || 'default-secret-key-change-in-production'
      const secret = 'default-secret-key-change-in-production:session';
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      const token = payload + '.' + sig;
      const path = url.searchParams.get('page') === 'davui' ? '/dav-ui' : '/';
      res.statusCode = 302;
      res.setHeader('Set-Cookie', 'dsh_session=' + token + '; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax');
      res.setHeader('Location', path);
      return res.end();
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else headers.append(k, v);
    }
    const method = req.method || 'GET';
    const body = (method === 'GET' || method === 'HEAD') ? undefined : await readBody(req);

    const request = new Request(url.toString(), {
      method,
      headers,
      body: body && body.length ? body : undefined,
    });

    const response = await workerFetch(request, env, {});

    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
      }
    }
    res.end();
  } catch (err) {
    console.error('[preview]', err);
    res.statusCode = 500;
    res.end(String(err && err.stack ? err.stack : err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('==============================================');
  console.log('  本地预览已启动（无需 Cloudflare）');
  console.log('  网页界面: http://127.0.0.1:' + PORT + '/');
  console.log('  WebDAV:   http://127.0.0.1:' + PORT + '/dav/');
  console.log('  WebDAV 账号: admin / ' + env.WEBDAV_PASSWORD);
  console.log('==============================================');
});
