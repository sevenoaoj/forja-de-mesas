import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {api,campaignViewEtag} from '../api.mjs';
import {accessFor} from '../access.mjs';
import {createMemoryStaticHandler} from '../etag.mjs';
import {serveStatic} from '../server.mjs';

async function createRoom() {
  const rows = new Map();
  const assets = new Map();
  const store = {
    async create(row) { rows.set(row.id, structuredClone(row)); },
    async get(id) { return structuredClone(rows.get(id)); },
    async save(row) {
      await Promise.resolve();
      if (rows.get(row.id)?.rev !== row.rev) return false;
      rows.set(row.id, structuredClone({...row, rev: row.rev + 1}));
      return true;
    },
    async putAsset(key, blob) { assets.set(key, blob); },
    async getAsset(key) { return assets.get(key); },
    async deleteAsset(key) { assets.delete(key); }
  };
  const call = (path, method, key, body, headers = {}) => api(new Request('http://app/api/campaigns' + path, {
    method,
    headers: {...(key ? {Authorization: 'Bearer ' + key} : {}), ...headers},
    body: body === undefined ? undefined : JSON.stringify(body)
  }), store);
  const created = await (await call('', 'POST', null, {name: 'Mesa ETag', example: true})).json();
  const base = '/' + created.id;
  async function join(seed, characterId) {
    const key = seed.repeat(64);
    assert.equal((await call(base + '/join', 'POST', created.invite, {key})).status, 200);
    if (characterId) {
      assert.equal((await call(base + '/action', 'POST', key, {action: 'characterClaim', data: {id: characterId}})).status, 200);
    }
    return key;
  }
  return {created, rows, store, call, base, join};
}

test('GET /api/campaigns/:id emite ETag forte por papel/jogador, responde 304 e isola credenciais', async () => {
  const r = await createRoom();
  const playerA = await r.join('a', 'lyra');
  const playerB = await r.join('b', 'dorian');
  await r.call(r.base + '/action', 'POST', r.created.key, {action: 'notes', data: {text: 'Segredo exclusivo do mestre'}});

  const roles = [
    ['master', r.created.key],
    ['guest', r.created.invite],
    ['playerA', playerA],
    ['playerB', playerB]
  ];
  const etags = new Map();

  for (const [label, key] of roles) {
    const res = await r.call(r.base, 'GET', key);
    assert.equal(res.status, 200, label);
    const etag = res.headers.get('ETag');
    assert.match(etag, /^"[0-9a-f]{32}"$/, 'ETag forte esperado para ' + label);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-cache');
    assert.equal(res.headers.get('Vary'), 'Authorization, Cookie');
    etags.set(label, etag);

    // 304 Not Modified com ETag idêntico, fraco (W/) e lista separada por vírgulas
    for (const header of [etag, 'W/' + etag, '"outro-etag", ' + etag]) {
      const notModified = await r.call(r.base, 'GET', key, undefined, {'If-None-Match': header});
      assert.equal(notModified.status, 304, label + ' com ' + header);
      assert.equal(await notModified.text(), '');
      assert.equal(notModified.headers.get('ETag'), etag);
      assert.equal(notModified.headers.get('Cache-Control'), 'private, no-cache');
      assert.equal(notModified.headers.get('Vary'), 'Authorization, Cookie');
    }
  }

  // Todos os ETags devem ser distintos entre mestre, convite e jogadores diferentes
  assert.equal(new Set(etags.values()).size, roles.length);

  // Trocar Authorization mantendo ETag de outro papel/jogador NUNCA retorna 304
  for (const [viewerLabel, viewerKey] of roles) {
    for (const [otherLabel, otherEtag] of etags.entries()) {
      if (viewerLabel === otherLabel) continue;
      const cross = await r.call(r.base, 'GET', viewerKey, undefined, {'If-None-Match': otherEtag});
      assert.equal(cross.status, 200, `${viewerLabel} não pode receber 304 com ETag de ${otherLabel}`);
      assert.equal(cross.headers.get('ETag'), etags.get(viewerLabel));
      const payload = await cross.json();
      if (viewerLabel !== 'master') {
        assert.equal(payload.state.notes, undefined);
        assert.ok(!JSON.stringify(payload).includes('Segredo exclusivo do mestre'));
      }
      if (viewerLabel === 'playerB') {
        assert.equal(payload.characterId, 'dorian');
        assert.equal(payload.state.characters.find(c => c.id === 'lyra').values, undefined);
      }
    }
    // Wildcard If-None-Match: * em rota privada nunca deve responder 304
    const wildcard = await r.call(r.base, 'GET', viewerKey, undefined, {'If-None-Match': '*'});
    assert.equal(wildcard.status, 200);
  }

  // Token inválido com ETag válido deve falhar com 403
  const forbidden = await r.call(r.base, 'GET', 'f'.repeat(64), undefined, {'If-None-Match': etags.get('master')});
  assert.equal(forbidden.status, 403);

  // Cenas diferentes para o mestre geram ETags distintos
  await r.call(r.base + '/action', 'POST', r.created.key, {action: 'sceneCreate', data: {name: 'Cripta'}});
  const scenes = (await (await r.call(r.base, 'GET', r.created.key)).json()).state.sceneLibrary.scenes;
  const secondScene = scenes.find(s => s.id !== 'scene-initial');
  const activeRes = await r.call(r.base + '?scene=scene-initial', 'GET', r.created.key);
  const criptaRes = await r.call(r.base + '?scene=' + secondScene.id, 'GET', r.created.key);
  assert.notEqual(activeRes.headers.get('ETag'), criptaRes.headers.get('ETag'));
  assert.equal((await r.call(r.base + '?scene=' + secondScene.id, 'GET', r.created.key, undefined, {'If-None-Match': activeRes.headers.get('ETag')})).status, 200);
  assert.equal((await r.call(r.base + '?scene=' + secondScene.id, 'GET', r.created.key, undefined, {'If-None-Match': criptaRes.headers.get('ETag')})).status, 304);
});

test('ETag de campanha invalida imediatamente após mutação (rev + 1) e janelas temporais', async () => {
  const r = await createRoom();
  const playerA = await r.join('a', 'lyra');

  const beforeMaster = await r.call(r.base, 'GET', r.created.key);
  const beforePlayer = await r.call(r.base, 'GET', playerA);
  const masterEtag1 = beforeMaster.headers.get('ETag');
  const playerEtag1 = beforePlayer.headers.get('ETag');

  // Qualquer mutação incrementa rev e invalida o ETag imediatamente
  await r.call(r.base + '/action', 'POST', playerA, {action: 'sheetCounter', data: {id: 'lyra', field: 'f4', step: -1}});

  const afterMaster = await r.call(r.base, 'GET', r.created.key, undefined, {'If-None-Match': masterEtag1});
  const afterPlayer = await r.call(r.base, 'GET', playerA, undefined, {'If-None-Match': playerEtag1});
  assert.equal(afterMaster.status, 200);
  assert.equal(afterPlayer.status, 200);
  assert.notEqual(afterMaster.headers.get('ETag'), masterEtag1);
  assert.notEqual(afterPlayer.headers.get('ETag'), playerEtag1);

  // Janelas temporais efêmeras (cinemática, compartilhamento, ping e patrulha ativa) alteram ETag sem mudar rev
  const row = r.rows.get(r.created.id);
  const masterAccess = accessFor(row, r.created.key);
  const playerAccess = accessFor(row, playerA);
  const t0 = 1_700_000_000_000;

  row.state.cinematicRun = {id: 'cine-1', text: 'Ato I', intro: 0, duration: 5, startedAt: t0, revealAt: t0, endsAt: t0 + 5000};
  const cineActive = await campaignViewEtag(row, masterAccess, undefined, t0 + 1000);
  const cineSameWindow = await campaignViewEtag(row, masterAccess, undefined, t0 + 2000);
  const cineExpired = await campaignViewEtag(row, masterAccess, undefined, t0 + 5000);
  assert.equal(cineActive, cineSameWindow);
  assert.notEqual(cineActive, cineExpired);

  row.state.materialShares = [{id: 'share-1', until: t0 + 60_000}];
  const shareActive = await campaignViewEtag(row, playerAccess, undefined, t0 + 1000);
  const shareExpired = await campaignViewEtag(row, playerAccess, undefined, t0 + 60_000);
  assert.notEqual(shareActive, shareExpired);

  row.state.table = {pings: [{id: 'ping-1', x: 2, y: 2, at: t0}]};
  const pingActive = await campaignViewEtag(row, playerAccess, undefined, t0 + 500);
  const pingExpired = await campaignViewEtag(row, playerAccess, undefined, t0 + 1600);
  assert.notEqual(pingActive, pingExpired);

  row.state.tokens = [{id: 'guard', name: 'Guarda', x: 1, y: 1, patrol: {mode: 'loop', speed: 1, started: t0, offset: 0, points: [{x: 1, y: 1}, {x: 4, y: 1}]}}];
  const patrolT1 = await campaignViewEtag(row, masterAccess, undefined, t0 + 100);
  const patrolT2 = await campaignViewEtag(row, masterAccess, undefined, t0 + 200);
  assert.notEqual(patrolT1, patrolT2);
});

test('ativos estáticos em server.mjs e Worker retornam ETag forte e 304 Not Modified', async () => {
  // 1. Servidor local (disco)
  const first = await serveStatic(new Request('http://localhost/app.mjs'));
  assert.equal(first.status, 200);
  const etag = first.headers.get('ETag');
  assert.match(etag, /^"[0-9a-f]{32}"$/);
  assert.equal(first.headers.get('Cache-Control'), 'no-cache');
  assert.equal(first.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
  assert.equal(first.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(first.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  const bodyText = await first.text();
  assert.ok(bodyText.length > 1000);

  const hit = await serveStatic(new Request('http://localhost/app.mjs', {headers: {'If-None-Match': '"antigo", ' + etag}}));
  assert.equal(hit.status, 304);
  assert.equal(await hit.text(), '');
  assert.equal(hit.headers.get('ETag'), etag);
  assert.equal(hit.headers.get('Cache-Control'), 'no-cache');

  const miss = await serveStatic(new Request('http://localhost/app.mjs', {headers: {'If-None-Match': '"outro"'}}));
  assert.equal(miss.status, 200);
  assert.equal(await miss.text(), bodyText);

  assert.equal((await serveStatic(new Request('http://localhost/nao-existe.mjs'))).status, 404);

  // 2. Handler em memória do Worker
  const serveWorker = createMemoryStaticHandler({
    '/style.css': ['text/css; charset=utf-8', Buffer.from('body{color:#fff}').toString('base64')]
  });
  const wFirst = await serveWorker(new Request('https://forja.example/style.css'), '/style.css');
  assert.equal(wFirst.status, 200);
  const wEtag = wFirst.headers.get('ETag');
  assert.match(wEtag, /^"[0-9a-f]{32}"$/);
  assert.equal(await wFirst.text(), 'body{color:#fff}');

  const wHit = await serveWorker(new Request('https://forja.example/style.css', {headers: {'If-None-Match': wEtag}}), '/style.css');
  assert.equal(wHit.status, 304);
  assert.equal(await wHit.text(), '');
  assert.equal(wHit.headers.get('ETag'), wEtag);

  const wWeakHit = await serveWorker(new Request('https://forja.example/style.css', {headers: {'If-None-Match': 'W/' + wEtag}}), '/style.css');
  assert.equal(wWeakHit.status, 304);

  const wMiss = await serveWorker(new Request('https://forja.example/style.css', {headers: {'If-None-Match': '"diferente"'}}), '/style.css');
  assert.equal(wMiss.status, 200);
  assert.equal((await serveWorker(new Request('https://forja.example/ausente.css'), '/ausente.css')).status, 404);
});

test('cliente public/app.mjs envia If-None-Match em refresh(), preserva tela no 304 e limpa ETag ao trocar cena ou campanha', async () => {
  const r = await createRoom();
  const second = await (await r.call('', 'POST', null, {name: 'Segunda mesa', example: true})).json();
  await r.call(r.base + '/action', 'POST', r.created.key, {action: 'sceneCreate', data: {name: 'Torre'}});
  const scenes = (await (await r.call(r.base, 'GET', r.created.key)).json()).state.sceneLibrary.scenes;
  const towerScene = scenes.find(s => s.name === 'Torre');

  class Element extends EventTarget {
    constructor(dataset = {}) {
      super();
      this.dataset = dataset;
      this.nodes = new Map();
      this.innerHTML = '';
      this.textContent = '';
      this.open = false;
      this.style = {setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; }};
      this.clientWidth = 800;
      this.clientHeight = 500;
      this.classList = {toggle() {}, add() {}, remove() {}};
    }
    querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
    setAttribute(k, v) { this[k] = v; }
    querySelectorAll() { return []; }
    contains(n) { return Boolean(n?.inDialog); }
    closest(s) { return s === '[data-act]' && this.dataset.act ? this : null; }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return {left: 0, top: 0, width: this.clientWidth, height: this.clientHeight}; }
    matches() { return false; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    replaceChildren() { this.innerHTML = ''; }
  }

  const original = {
    document: globalThis.document,
    location: globalThis.location,
    history: globalThis.history,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    setInterval: globalThis.setInterval,
    setTimeout: globalThis.setTimeout,
    fetch: globalThis.fetch
  };

  const storage = new Map([
    ['forja.active', JSON.stringify(r.created.id)],
    ['forja.campaigns', JSON.stringify({
      [r.created.id]: {id: r.created.id, key: r.created.key, name: 'Mesa ETag', master: true},
      [second.id]: {id: second.id, key: second.key, name: 'Segunda mesa', master: true}
    })]
  ]);
  const intervals = new Map();
  const campaignPolls = [];

  globalThis.document = new Element();
  document.hidden = false;
  globalThis.location = {origin: 'http://localhost:3000', hostname: 'localhost', pathname: '/', search: '', hash: ''};
  globalThis.history = {replaceState() {}};
  globalThis.window = {scrollTo() {}, YT: {Player: class { destroy() {} }}};
  globalThis.localStorage = {
    getItem: k => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: k => storage.delete(k)
  };
  globalThis.setInterval = (fn, ms) => intervals.set(ms, fn);
  globalThis.setTimeout = (fn, ms) => { const t = original.setTimeout(fn, ms); t.unref(); return t; };
  globalThis.fetch = async (url, options = {}) => {
    const req = new Request(new URL(url, location.origin), options);
    const res = await api(req, r.store);
    const parsed = new URL(req.url);
    if (req.method === 'GET' && /^\/api\/campaigns\/[\da-f-]{36}$/.test(parsed.pathname)) {
      campaignPolls.push({
        url: parsed.pathname + parsed.search,
        ifNoneMatch: req.headers.get('If-None-Match'),
        status: res.status,
        etag: res.headers.get('ETag')
      });
    }
    return res;
  };

  const moduleURL = source => {
    const resolved = source.replace(/from\s+(['"])(\.{1,2}\/[^'"]+\.mjs)\1/g, (_m, _q, p) => {
      const local = new URL('../public/' + p, import.meta.url);
      return 'from ' + JSON.stringify((existsSync(local) ? local : new URL('../' + p, import.meta.url)).href);
    });
    return 'data:text/javascript;base64,' + Buffer.from(resolved + '\n//# sourceURL=etag-client.mjs').toString('base64');
  };
  const rewrite = async rel => moduleURL(
    (await readFile(new URL(rel, import.meta.url), 'utf8'))
      .replaceAll("'./media.mjs'", JSON.stringify(new URL('../media.mjs', import.meta.url).href))
      .replaceAll("'./model.mjs'", JSON.stringify(new URL('../model.mjs', import.meta.url).href))
      .replaceAll("'./dnd.mjs'", JSON.stringify(new URL('../dnd.mjs', import.meta.url).href))
      .replaceAll("'./table-model.mjs'", JSON.stringify(new URL('../table-model.mjs', import.meta.url).href))
      .replaceAll("'./token-icons.mjs'", JSON.stringify(new URL('../token-icons.mjs', import.meta.url).href))
      .replaceAll("'./loot.mjs'", JSON.stringify(new URL('../public/loot.mjs', import.meta.url).href))
      .replaceAll("'./table-vision.mjs'", JSON.stringify(new URL('../public/table-vision.mjs', import.meta.url).href))
      .replaceAll("'./table-rolls.mjs'", JSON.stringify(new URL('../public/table-rolls.mjs', import.meta.url).href))
      .replaceAll("'./rolls.mjs'", JSON.stringify(new URL('../public/rolls.mjs', import.meta.url).href))
  );

  try {
    const audio = await rewrite('../public/audio.mjs');
    const table = await rewrite('../public/table.mjs');
    const dndUI = await rewrite('../public/dnd-ui.mjs');
    const appCode = (await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8'))
      .replace("'./audio.mjs'", JSON.stringify(audio))
      .replace("'./table.mjs'", JSON.stringify(table))
      .replace("'./dnd-ui.mjs'", JSON.stringify(dndUI));
    await import(moduleURL(appCode));

    const main = document.querySelector('#main');
    const dispatch = (type, target) => {
      const event = new Event(type, {cancelable: true});
      Object.defineProperty(event, 'target', {value: target});
      document.dispatchEvent(event);
    };
    const waitFor = async predicate => {
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise(resolve => original.setTimeout(resolve, 5));
      }
      assert.ok(predicate());
    };

    await waitFor(() => main.innerHTML.includes('<h1>Mesa ETag</h1>'));
    campaignPolls.length = 0;

    // 1º refresh captura ETag (200); 2º refresh envia If-None-Match e recebe 304 mantendo a tela intacta
    await intervals.get(2500)();
    assert.equal(campaignPolls.at(-1).status, 200);
    const savedEtag = campaignPolls.at(-1).etag;
    assert.ok(savedEtag);

    await intervals.get(2500)();
    assert.equal(campaignPolls.at(-1).ifNoneMatch, savedEtag);
    assert.equal(campaignPolls.at(-1).status, 304);
    assert.ok(main.innerHTML.includes('<h1>Mesa ETag</h1>'));
    assert.equal(document.querySelector('#notice').textContent, '');

    // Trocar de cena limpa ETag anterior e passa a usar o ETag da nova cena
    dispatch('click', new Element({act: 'sceneView', id: towerScene.id}));
    await waitFor(() => campaignPolls.some(p => p.url.includes('scene=' + towerScene.id)));
    assert.equal(campaignPolls.at(-1).ifNoneMatch, null);
    const towerEtag = campaignPolls.at(-1).etag;
    assert.notEqual(towerEtag, savedEtag);

    await intervals.get(2500)();
    assert.equal(campaignPolls.at(-1).ifNoneMatch, towerEtag);
    assert.equal(campaignPolls.at(-1).status, 304);

    // Trocar de campanha limpa o ETag salvo
    dispatch('click', new Element({act: 'switch', id: second.id}));
    await waitFor(() => main.innerHTML.includes('<h1>Segunda mesa</h1>'));
    await intervals.get(2500)();
    assert.notEqual(campaignPolls.at(-1).ifNoneMatch, towerEtag);
    assert.equal(campaignPolls.at(-1).status, 200);
  } finally {
    Object.assign(globalThis, original);
  }
});
