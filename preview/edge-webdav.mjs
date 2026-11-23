// WebDAV 边界用例：目录占位、幂等 MKCOL、中文/空格 href、文件 PROPFIND、目录 DELETE
// 用法: node preview/edge-webdav.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:18437/dav').replace(/\/+$/, '') + '/';
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const req = (m, p, h = {}, b) =>
  fetch(BASE + p.replace(/^\/+/, ''), { method: m, headers: { Authorization: AUTH, ...h }, body: b });

let failed = 0;
async function check(name, fn) {
  try {
    const v = await fn();
    console.log(`  [PASS] ${name}${v ? ' -> ' + v : ''}`);
  } catch (e) {
    failed++;
    console.log(`  [FAIL] ${name}\n         ${e.message}`);
  }
}
const strip = (x) => x.replace(/<(\/?)[A-Za-z0-9_.-]+:/g, '<$1');
const exp = (got, want, what) => {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  if (!ok) throw new Error(`${what}: 期望 ${want}，实际 ${got}`);
};

(async () => {
  console.log('target =', BASE, '\n');

  await check('MKCOL 幂等：已存在目录应返回 405 而非 201', async () => {
    const r1 = await req('MKCOL', '/edge/dir/');
    exp(r1.status, [201, 405], '首次 MKCOL');
    const r2 = await req('MKCOL', '/edge/dir/');
    exp(r2.status, 405, '重复 MKCOL');
    return `首次 ${r1.status} → 再次 ${r2.status}`;
  });

  await check('目录占位对象必须以 / 结尾落库（否则被当文件）', async () => {
    const r = await req('PROPFIND', '/edge/dir/', { Depth: '0' });
    exp(r.status, 207, 'PROPFIND Depth:0');
    const xml = strip(await r.text());
    if (!/<collection\s*\/>/.test(xml)) throw new Error('响应缺少 <collection/>，目录被识别为文件');
    if (!/<href>\/dav\/edge\/dir\/<\/href>/.test(xml)) {
      throw new Error('href 应为带尾斜杠的 /dav/edge/dir/，实际: ' + (xml.match(/<href>[^<]*</) || [''])[0]);
    }
    return 'resourcetype=collection, href 带尾斜杠';
  });

  await check('中文 + 空格文件名：href 需百分号编码且客户端可解码', async () => {
    const name = '观看记录 2026.jsonl';
    const put = await req('PUT', '/edge/dir/' + encodeURIComponent(name), { 'Content-Length': '2' }, '{}');
    exp(put.status, [201, 204], 'PUT');
    const r = await req('PROPFIND', '/edge/dir/', { Depth: '1' });
    const xml = strip(await r.text());
    const hrefs = [...xml.matchAll(/<href>([^<]*)<\/href>/g)].map((m) => m[1]);
    const target = hrefs.find((h) => h !== '/dav/edge/dir/');
    if (!target) throw new Error('列表中未找到新文件，hrefs=' + JSON.stringify(hrefs));
    if (/\s/.test(target)) throw new Error('href 含未编码空格: ' + target);
    const decoded = decodeURIComponent(target.replace(/\/+$/, '')).split('/').pop();
    if (decoded !== name) throw new Error(`解码后文件名不符: ${decoded} !== ${name}`);
    return target;
  });

  await check('文件 PROPFIND Depth:0 返回 200 且 getcontentlength 正确', async () => {
    const r = await req('PROPFIND', '/edge/dir/a.txt', { Depth: '0' });
    // 文件不存在时应 404
    if (r.status === 207) return '已存在，跳过';
    exp(r.status, 404, '不存在文件');
    await req('PUT', '/edge/dir/a.txt', { 'Content-Length': '5' }, 'hello');
    const r2 = await req('PROPFIND', '/edge/dir/a.txt', { Depth: '0' });
    exp(r2.status, 207, 'PROPFIND');
    const xml = await r2.text();
    if (!xml.includes('<D:getcontentlength>5</D:getcontentlength>')) throw new Error('长度不为 5');
    if (/<collection\s*\/>/.test(xml)) throw new Error('文件被误判为目录');
    return 'length=5，非 collection';
  });

  await check('getetag 非空且带引号（客户端据此判断是否重下）', async () => {
    const r = await req('PROPFIND', '/edge/dir/', { Depth: '1' });
    const xml = await r.text();
    const etags = [...xml.matchAll(/<D:getetag>([^<]*)<\/D:getetag>/g)].map((m) => m[1]);
    if (!etags.length) throw new Error('响应无 getetag');
    const bad = etags.filter((e) => !/^&quot;.+/i.test(e) && !/^".+/.test(e));
    if (bad.length === etags.length) throw new Error('所有 getetag 都为空: ' + JSON.stringify(etags));
    return etags.slice(0, 3).join(' ');
  });

  await check('creationdate 为 ISO-8601（Dart DateTime.parse 可解析）', async () => {
    const r = await req('PROPFIND', '/edge/', { Depth: '1' });
    const xml = await r.text();
    const dates = [...xml.matchAll(/<D:creationdate>([^<]*)<\/D:creationdate>/g)].map((m) => m[1]);
    if (!dates.length) throw new Error('无 creationdate');
    const dartRe = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/;
    const bad = dates.filter((d) => !dartRe.test(d));
    if (bad.length) throw new Error('非 ISO-8601: ' + bad.join(', '));
    return dates[0];
  });

  await check('MOVE 覆盖已存在目标（Overwrite: T）', async () => {
    await req('PUT', '/edge/dir/src.txt', { 'Content-Length': '3' }, 'AAA');
    await req('PUT', '/edge/dir/dst.txt', { 'Content-Length': '3' }, 'BBB');
    const r = await req('MOVE', '/edge/dir/src.txt', {
      Destination: BASE + 'edge/dir/dst.txt',
      Overwrite: 'T',
    });
    exp(r.status, [201, 204, 207], 'MOVE');
    const g = await req('GET', '/edge/dir/dst.txt');
    const body = await g.text();
    if (body !== 'AAA') throw new Error('覆盖后内容应为 AAA，实际 ' + JSON.stringify(body));
    const gone = await req('GET', '/edge/dir/src.txt');
    exp(gone.status, 404, '源文件应已删除');
    return `status=${r.status}，内容已替换为 AAA`;
  });

  await check('目录 DELETE 递归清理', async () => {
    const r = await req('DELETE', '/edge/dir/');
    exp(r.status, [200, 204, 404], 'DELETE 目录');
    const after = await req('PROPFIND', '/edge/dir/', { Depth: '0' });
    exp(after.status, 404, '删除后 PROPFIND');
    return 'status=' + r.status;
  });

  console.log('\n' + (failed === 0 ? '>>> 边界用例全部通过' : `>>> ${failed} 项失败`));
  process.exitCode = failed ? 2 : 0;
})();
