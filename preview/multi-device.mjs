// 多设备场景：设备 A 首次上传 → 设备 B 拉取比对 → 设备 B 回传，模拟 Kazumi 换设备的完整往返
// 用法: node preview/multi-device.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:18437/dav').replace(/\/+$/, '') + '/';
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const req = (m, p, h = {}, b) =>
  fetch(BASE + p.replace(/^\/+/, ''), { method: m, headers: { Authorization: AUTH, ...h }, body: b });
const strip = (x) => x.replace(/<(\/?)[A-Za-z0-9_.-]+:/g, '<$1');

// 等价 webdav_client.readDir：返回 [{name,isDir,size}]
async function readDir(path) {
  const p = path.endsWith('/') ? path : path + '/';
  const r = await req('PROPFIND', p, { Depth: '1' });
  if (r.status !== 207) throw new Error(`readDir(${p}) status=${r.status}`);
  const xml = strip(await r.text());
  const out = [];
  let first = true;
  for (const raw of xml.split('<response>').slice(1)) {
    const seg = raw.split('</response>')[0];
    const prop = (seg.match(/<prop>([\s\S]*?)<\/prop>/) || [, ''])[1];
    const isDir = /<collection\s*\/>/.test(prop);
    if (first) { first = false; if (isDir) continue; throw new Error('self 不是 collection'); }
    const href = (seg.match(/<href>([^<]*)<\/href>/) || [, ''])[1];
    const len = (prop.match(/<getcontentlength>(\d+)</) || [, '0'])[1];
    out.push({ name: decodeURIComponent(href.replace(/\/+$/, '')).split('/').pop(), isDir, size: +len });
  }
  return out;
}
const getText = async (p) => {
  const r = await req('GET', p);
  if (r.status !== 200) throw new Error(`GET ${p} status=${r.status}`);
  return r.text();
};
const putText = (p, t) => req('PUT', p, { 'Content-Length': String(Buffer.byteLength(t)) }, t);

let failed = 0;
const check = async (name, fn) => {
  try { const v = await fn(); console.log(`  [PASS] ${name}${v ? ' -> ' + v : ''}`); }
  catch (e) { failed++; console.log(`  [FAIL] ${name}\n         ${e.message}`); }
};

const DEV_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DEV_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ROOT = '/md/kazumiSync';
const HIST = `${ROOT}/history`;
const CHANGES = `${HIST}/changes`;

(async () => {
  console.log('target =', BASE, '\n');

  await check('设备A 初始化目录树（Kazumi _ensureHistoryStorage）', async () => {
    for (const d of [ROOT, HIST, CHANGES]) {
      const r = await req('MKCOL', d + '/');
      if (![201, 405].includes(r.status)) throw new Error(`${d} status=${r.status}`);
    }
    return 'kazumiSync / history / changes 就绪';
  });

  await check('设备A 首次全量上传（无远端数据 → 走 _updateBox 发布）', async () => {
    for (const box of ['collectibles.tmp', 'collectchanges.tmp']) {
      const r = await putText(`${ROOT}/${box}.cache`, `{"device":"${DEV_A}","box":"${box}"}`);
      if (![201, 204].includes(r.status)) throw new Error(`PUT ${box}.cache status=${r.status}`);
      const mv = await req('MOVE', `${ROOT}/${box}.cache`, {
        Destination: BASE + ROOT.replace(/^\//, '') + `/${box}`,
        Overwrite: 'T',
      });
      if (![201, 204, 207].includes(mv.status)) throw new Error(`MOVE ${box} status=${mv.status}`);
    }
    const list = await readDir(ROOT);
    const names = list.map((f) => f.name).sort();
    if (!names.includes('collectibles.tmp') || !names.includes('collectchanges.tmp')) {
      throw new Error('发布后目录内容不符: ' + names.join(', '));
    }
    return names.join(', ');
  });

  await check('设备B 首次连接：readDir 能列出设备A的文件（换设备报错点）', async () => {
    const list = await readDir(ROOT);
    const hit = list.filter((f) => f.name.endsWith('.tmp') && !f.isDir);
    if (hit.length < 2) throw new Error('未列出设备A的文件: ' + JSON.stringify(list));
    return hit.map((f) => `${f.name}(${f.size}B)`).join(', ');
  });

  await check('设备B 下载设备A的备份（read2File 全链路）', async () => {
    const t1 = await getText(`${ROOT}/collectibles.tmp`);
    const t2 = await getText(`${ROOT}/collectchanges.tmp`);
    if (!t1.includes(DEV_A) || !t2.includes(DEV_A)) throw new Error('内容不是设备A写入的: ' + t1 + ' | ' + t2);
    return `collectibles=${t1.length}B, collectchanges=${t2.length}B`;
  });

  await check('设备A 发布观看记录快照（snapshot.json）', async () => {
    const tmp = `${HIST}/snapshot.json.${DEV_A}.cache`;
    await putText(tmp, JSON.stringify({ histories: [{ id: 1, dev: DEV_A }], itemVersions: {}, progressVersions: {}, deletedVersions: {}, clearVersion: null }));
    const mv = await req('MOVE', tmp, {
      Destination: BASE + HIST.replace(/^\//, '') + '/snapshot.json',
      Overwrite: 'T',
    });
    if (![201, 204, 207].includes(mv.status)) throw new Error('MOVE status=' + mv.status);
    const list = await readDir(HIST);
    if (!list.some((f) => f.name === 'snapshot.json')) {
      throw new Error('快照未出现在列表中: ' + list.map((f) => f.name).join(', '));
    }
    return 'snapshot.json 已发布，列表: ' + list.map((f) => f.name).join(', ');
  });

  await check('设备B 读取快照（远端与本地的比对依据）', async () => {
    const s = JSON.parse(await getText(`${HIST}/snapshot.json`));
    if (s.histories[0].dev !== DEV_A) throw new Error('快照内容不符');
    return '读到 ' + s.histories.length + ' 条历史';
  });

  await check('设备B 上传自己的事件日志（多设备并发不覆盖）', async () => {
    await putText(`${CHANGES}/${DEV_A}.jsonl`, '{"dev":"a","seq":1}\n');
    await putText(`${CHANGES}/${DEV_B}.jsonl`, '{"dev":"b","seq":1}\n');
    const list = await readDir(CHANGES);
    const jsonl = list.filter((f) => f.name.endsWith('.jsonl') && f.size > 0);
    if (jsonl.length !== 2) throw new Error('事件日志数量应为 2，实际 ' + jsonl.length);
    return jsonl.map((f) => `${f.name}(${f.size}B)`).join(', ');
  });

  await check('设备A 清理自己的事件日志（checkpoint 后）', async () => {
    const r = await req('DELETE', `${CHANGES}/${DEV_A}.jsonl`);
    if (![200, 204, 404].includes(r.status)) throw new Error('status=' + r.status);
    const list = await readDir(CHANGES);
    const left = list.filter((f) => f.name.endsWith('.jsonl')).map((f) => f.name);
    if (left.includes(`${DEV_A}.jsonl`) || !left.includes(`${DEV_B}.jsonl`)) {
      throw new Error('删除结果不符: ' + left.join(', '));
    }
    return '剩余: ' + left.join(', ');
  });

  await check('文件名含 % 与空格时仍可往返', async () => {
    const name = '100% 完成 记录.jsonl';
    const p = `${CHANGES}/${encodeURIComponent(name)}`;
    const w = await putText(p, 'x');
    if (![201, 204].includes(w.status)) throw new Error('PUT status=' + w.status);
    const list = await readDir(CHANGES);
    if (!list.some((f) => f.name === name)) {
      throw new Error('列表中文件名不符: ' + list.map((f) => f.name).join(' | '));
    }
    if ((await getText(p)) !== 'x') throw new Error('下载内容不符');
    return name;
  });

  console.log('\n' + (failed === 0 ? '>>> 多设备往返全部通过' : `>>> ${failed} 项失败`));
  process.exitCode = failed ? 2 : 0;
})();
