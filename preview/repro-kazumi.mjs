// 忠实复现 Kazumi 依赖的 webdav_client 1.2.2 全链路，用于定位「能上传但拉不回来」
// 解析逻辑逐行移植自：
//   webdav_client/lib/src/xml.dart   -> WebdavXml.toFiles
//   webdav_client/lib/src/utils.dart -> str2LocalTime / path2Name
//   dart:core DateTime.parse 的 _parseFormat（非 ISO-8601 直接抛 FormatException）
// 用法: node preview/repro-kazumi.mjs [baseUrl]
//   默认 baseUrl = http://127.0.0.1:18437/dav  （相当于 Kazumi 里填写的服务器地址）
const BASE = (process.argv[2] || 'http://127.0.0.1:18437/dav').replace(/\/+$/, '') + '/';
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');

const DART_PARSE = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/;
function dartDateTimeParse(s) {
  if (!DART_PARSE.test(String(s))) {
    throw new Error(`FormatException: Invalid date format "${s}"`);
  }
  return String(s);
}

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
// utils.dart: str2LocalTime —— 不是 RFC1123 时返回 null（不抛）
function str2LocalTime(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  if (!s.endsWith('gmt')) return null;
  const list = s.split(' ');
  if (list.length !== 6) return null;
  const month = MONTHS[list[2]];
  if (!month) return null;
  return dartDateTimeParse(`${list[3]}-${month}-${list[1].padStart(2, '0')}T${list[4]}Z`);
}

// Dart xml 的 namespace '*' 语义：忽略前缀
const strip = (x) => x.replace(/<(\/?)[A-Za-z0-9_.-]+:/g, '<$1');

// WebdavXml.toFiles 等价实现
function toFiles(xmlText, skipSelf = true) {
  const files = [];
  for (const raw of strip(xmlText).split(/<response[\s>]/).slice(1)) {
    const seg = raw.split('</response>')[0];
    const href = (seg.match(/<href>([\s\S]*?)<\/href>/) || [, ''])[1];
    const propstat = (seg.match(/<propstat>([\s\S]*?)<\/propstat>/) || [])[1];
    if (!propstat) continue;
    const status = (propstat.match(/<status>([\s\S]*?)<\/status>/) || [, ''])[1];
    if (!status.includes('200')) continue;
    const prop = (propstat.match(/<prop>([\s\S]*?)<\/prop>/) || [])[1];
    if (prop === undefined) continue;

    const isDir = /<collection\s*\/?>/.test(prop);
    if (skipSelf) {
      skipSelf = false;
      if (isDir) continue;
      throw new Error('xml parse error(405)：首个 response 不是 collection');
    }

    const lenM = prop.match(/<getcontentlength>([\s\S]*?)<\/getcontentlength>/);
    const size = !isDir && lenM ? parseInt(lenM[1], 10) : 0;

    // ★ creationdate 非空就必然 DateTime.parse
    const cM = prop.match(/<creationdate>([\s\S]*?)<\/creationdate>/);
    if (cM) dartDateTimeParse(cM[1]);

    const mM = prop.match(/<getlastmodified>([\s\S]*?)<\/getlastmodified>/);
    if (mM) str2LocalTime(mM[1]);

    let name = '';
    try { name = decodeURIComponent(href.replace(/\/+$/, '')).split('/').pop() || '/'; }
    catch (e) { throw new Error(`Uri.decodeFull 失败: ${e.message}`); }
    files.push({ name, isDir, size });
  }
  return files;
}

const PROPFIND_BODY = "<d:propfind xmlns:d='DAV:'><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getcontenttype/><d:getetag/><d:getlastmodified/></d:prop></d:propfind>";

const req = (method, path, headers = {}, body) =>
  fetch(BASE + path.replace(/^\/+/, ''), { method, headers: { Authorization: AUTH, ...headers }, body });

async function readDir(path) {
  const r = await req('PROPFIND', path, {
    Depth: '1',
    'Content-Type': 'application/xml;charset=UTF-8',
    Accept: 'application/xml,text/xml',
    'accept-charset': 'utf-8',
  }, PROPFIND_BODY);
  const text = await r.text();
  if (r.status !== 207) throw new Error(`PROPFIND 期望 207，实际 ${r.status}｜${text.slice(0, 120)}`);
  return toFiles(text);
}

let failed = 0;
async function step(name, fn) {
  try {
    const v = await fn();
    console.log(`  [PASS] ${name}${v ? ' -> ' + v : ''}`);
  } catch (e) {
    failed++;
    console.log(`  [FAIL] ${name}\n         ${e.message}`);
  }
}

(async () => {
  console.log('target =', BASE, '\n');

  await step('ping()  OPTIONS /dav/', async () => {
    const r = await req('OPTIONS', '/');
    if (r.status !== 200) throw new Error('status=' + r.status);
    return 'status=200, DAV=' + (r.headers.get('dav') || '-');
  });

  await step('mkdir()  MKCOL /kazumiSync/', async () => {
    const r = await req('MKCOL', '/kazumiSync/');
    if (![201, 405].includes(r.status)) throw new Error('status=' + r.status);
    return 'status=' + r.status;
  });

  await step('mkdir()  MKCOL /kazumiSync/history/changes/', async () => {
    const r = await req('MKCOL', '/kazumiSync/history/changes/');
    if (![201, 405].includes(r.status)) throw new Error('status=' + r.status);
    return 'status=' + r.status;
  });

  await step('readDir()  空目录 PROPFIND /kazumiSync/  ← 解析入口', async () => {
    const files = await readDir('/kazumiSync/');
    return `解析 ${files.length} 项`;
  });

  const devFile = '/kazumiSync/history/changes/0123456789abcdef0123456789abcdef.jsonl';
  await step('writeFromFile()  PUT 观看记录事件日志', async () => {
    const payload = '{"seq":1,"dev":"a"}\n';
    const r = await req('PUT', devFile, { 'Content-Length': String(Buffer.byteLength(payload)), 'Content-Type': 'application/octet-stream' }, payload);
    if (![200, 201, 204].includes(r.status)) throw new Error('status=' + r.status);
    return 'status=' + r.status;
  });

  await step('readDir()  PROPFIND /kazumiSync/history/changes/  ← 用户报错点', async () => {
    const files = await readDir('/kazumiSync/history/changes/');
    return `解析 ${files.length} 项: ` + files.map((f) => `${f.name}(${f.size}B)`).join(', ');
  });

  await step('read2File()  OPTIONS + GET 下载', async () => {
    const o = await req('OPTIONS', devFile, { Depth: '0' });
    if (o.status !== 200) throw new Error('OPTIONS status=' + o.status);
    const g = await req('GET', devFile);
    if (g.status !== 200) throw new Error('GET status=' + g.status);
    const text = await g.text();
    if (!text.includes('seq')) throw new Error('内容不符: ' + JSON.stringify(text));
    return `GET 200, len=${g.headers.get('content-length')}`;
  });

  await step('rename()  MOVE 覆盖（发布 snapshot 用）', async () => {
    await req('PUT', devFile, { 'Content-Length': '2' }, '{}');
    const r = await req('MOVE', devFile, {
      Destination: BASE + 'kazumiSync/history/snapshot.json',
      Overwrite: 'T',
    });
    if (![201, 204, 207].includes(r.status)) throw new Error('status=' + r.status);
    const after = await readDir('/kazumiSync/history/');
    return 'status=' + r.status + ', 目录: ' + after.map((f) => f.name).join(', ');
  });

  await step('remove()  DELETE', async () => {
    const r = await req('DELETE', '/kazumiSync/history/snapshot.json');
    if (![200, 204, 404].includes(r.status)) throw new Error('status=' + r.status);
    return 'status=' + r.status;
  });

  console.log('\n' + (failed === 0
    ? '>>> 全部通过：Kazumi 可正常上传 / 比对 / 下载'
    : `>>> ${failed} 项失败：Kazumi 会显示「请检查网络或服务器配置后重试」`));
  process.exitCode = failed === 0 ? 0 : 2;
})();
