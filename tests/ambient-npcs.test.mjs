import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api} from '../api.mjs';
import {patrolSample, patrolCycleDuration, tableView, generateWanderPoints, ambientPresets, pointInPolygon} from '../table-model.mjs';
import {newCampaign} from '../model.mjs';

const tableSource = await readFile(new URL('../public/table.mjs', import.meta.url), 'utf8');
const {createTabletop} = await import('data:text/javascript;base64,' + Buffer.from(
  tableSource
    .replace("'./loot.mjs'", JSON.stringify(new URL('../public/loot.mjs', import.meta.url).href))
    .replace("'./table-vision.mjs'", JSON.stringify(new URL('../public/table-vision.mjs', import.meta.url).href))
    .replace("'./token-icons.mjs'", JSON.stringify(new URL('../token-icons.mjs', import.meta.url).href))
    .replace("'./table-rolls.mjs'", JSON.stringify(new URL('../public/table-rolls.mjs', import.meta.url).href))
    .replace("'./rolls.mjs'", JSON.stringify(new URL('../public/rolls.mjs', import.meta.url).href))
    .replace("'./table-model.mjs'", JSON.stringify(new URL('../table-model.mjs', import.meta.url).href))
    .replace("'./model.mjs'", JSON.stringify(new URL('../model.mjs', import.meta.url).href))
).toString('base64'));

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
    async putAsset(path, blob) { assets.set(path, await blob.arrayBuffer()); },
    async getAsset(path) { return assets.get(path) || null; },
    async deleteAsset(path) { assets.delete(path); }
  };
  const call = (path, method, key, body, extraHeaders = {}) => api(new Request('http://app/api/campaigns' + path, {
    method,
    headers: {...(key ? {Authorization: 'Bearer ' + key} : {}), ...extraHeaders},
    body: body === undefined ? undefined : (body instanceof Uint8Array ? body : JSON.stringify(body))
  }), store);
  const created = await (await call('', 'POST', null, {name: 'Cidade Viva', example: true})).json();
  const base = '/' + created.id;
  const act = (key, action, data = {}) => call(base + '/action', 'POST', key, {action, data});
  const view = async key => (await call(base, 'GET', key)).json();
  const join = async (seed, charId) => {
    const key = seed.repeat(64);
    assert.equal((await call(base + '/join', 'POST', created.invite, {key})).status, 200);
    if (charId) assert.equal((await act(key, 'characterClaim', {id: charId})).status, 200);
    return key;
  };
  return {created, assets, call, base, act, view, join};
}

test('patrolSample suporta pausas orgânicas com atividade, modo passagem (entrar/sair) e variação determinística de aparência', () => {
  const baseTime = 1_000_000;
  // 1. Modo return com pausa e atividade
  const routePause = {
    points: [{x: 0, y: 0}, {x: 4, y: 0}],
    mode: 'return',
    speed: 1, // 4000ms de caminhada
    pause: 5,
    seed: 42,
    activity: 'Pescando',
    started: baseTime,
    offset: 0
  };
  const moving = patrolSample(routePause, baseTime + 2000);
  assert.ok(Math.abs(moving.x - 2) < 1e-6);
  assert.equal(moving.ambientActivity, undefined); // atividade aparece ao parar quando pause > 0
  const waiting = patrolSample(routePause, baseTime + 4500);
  assert.equal(waiting.x, 4);
  assert.equal(waiting.ambientActivity, 'Pescando');
  assert.equal(waiting.motion.vx, 0);
  assert.equal(waiting.motion.vy, 0);

  // 2. Modo pass (entrar, atravessar, sair, ausência em cooldown e variar aparência no próximo ciclo)
  const routePass = {
    points: [{x: 0, y: 2}, {x: 6, y: 2}],
    mode: 'pass',
    speed: 2, // 3000ms de travessia
    cooldown: 10, // 10000ms fora da cena
    seed: 123,
    activity: 'Caminhando',
    varyAppearance: true,
    started: baseTime,
    offset: 0
  };
  const cycleMs = patrolCycleDuration(routePass);
  assert.equal(cycleMs, 13000);

  const entering = patrolSample(routePass, baseTime + 200);
  assert.equal(entering.ambientPhase, 'entering');
  assert.equal(entering.ambientAbsent, undefined);
  assert.equal(entering.ambientActivity, 'Caminhando');

  const mid = patrolSample(routePass, baseTime + 1500);
  assert.equal(mid.ambientPhase, undefined);
  assert.ok(Math.abs(mid.x - 3) < 1e-6);

  const exiting = patrolSample(routePass, baseTime + 2800);
  assert.equal(exiting.ambientPhase, 'exiting');

  const absent = patrolSample(routePass, baseTime + 5000);
  assert.equal(absent.ambientAbsent, true);
  assert.ok(absent.motion); // mantém patrolFrame ativo para reentrada

  // Próximo ciclo mantém determinismo e calcula cor/ícone
  const nextCycle = patrolSample(routePass, baseTime + cycleMs + 1500);
  assert.equal(nextCycle.ambientAbsent, undefined);
  assert.ok(nextCycle.color);
  assert.ok(nextCycle.icon);
});

test('tableView oculta figurantes ausentes para jogadores preservando hasPatrols e mantendo controle para o mestre', () => {
  const state = newCampaign('Vila', false);
  const now = Date.now();
  state.tokens.push({
    id: 'pass-1',
    name: 'Transeunte',
    color: 'amber',
    icon: 'auto',
    size: 1,
    x: 0,
    y: 0,
    ambient: true,
    patrol: {
      points: [{x: 0, y: 0}, {x: 2, y: 0}],
      mode: 'pass',
      speed: 2, // 1000ms ativo
      cooldown: 60, // 60000ms ausente
      started: now - 5000, // garantidamente em cooldown
      offset: 0,
      seed: 7
    }
  });
  const gm = tableView(state, true);
  assert.equal(gm.tokens.length, 1);
  assert.equal(gm.tokens[0].ambientAbsent, true);
  assert.equal(gm.table.hasPatrols, true);
  assert.equal(gm.table.patrolRunning, 1);

  const player = tableView(state, false);
  assert.equal(player.tokens.length, 0);
  assert.equal(player.table.hasPatrols, true);
});

test('tokenPatrol em lote cria figurantes escalonados, promote assume controle e tableSceneLife pausa/retoma tudo (só mestre)', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const player = await r.join('a', 'lyra');

  await r.act(gm, 'tokenAdd', {name: 'Aldeão', x: 1, y: 1, color: 'emerald'});
  const tokenId = (await r.view(gm)).state.tokens.at(-1).id;

  const startRes = await r.act(gm, 'tokenPatrol', {
    id: tokenId,
    operation: 'start',
    mode: 'pass',
    points: [{x: 1, y: 1}, {x: 6, y: 1}],
    speed: 1,
    pause: 3,
    cooldown: 12,
    activity: 'Conversando',
    varyAppearance: true,
    count: 4,
    ambient: true
  });
  assert.equal(startRes.status, 200);
  const afterStart = await startRes.json();
  const villagers = afterStart.state.tokens.filter(t => t.name === 'Aldeão');
  assert.equal(villagers.length, 4);
  assert.ok(villagers.every(t => t.ambient === true && t.patrol?.mode === 'pass'));
  // Offsets escalonados distintos
  assert.equal(new Set(villagers.map(t => t.patrol.offset)).size, 4);

  // Jogador não pode pausar a vida da cena (403)
  assert.equal((await r.act(player, 'tableSceneLife', {operation: 'pauseAll'})).status, 403);

  // Mestre pausa toda a vida da cena
  const paused = await (await r.act(gm, 'tableSceneLife', {operation: 'pauseAll'})).json();
  assert.equal(paused.state.table.patrolRunning, 0);
  assert.equal(paused.state.table.patrolPaused, 4);

  // Mestre retoma toda a vida da cena
  const resumed = await (await r.act(gm, 'tableSceneLife', {operation: 'resumeAll'})).json();
  assert.equal(resumed.state.table.patrolRunning, 4);
  assert.equal(resumed.state.table.patrolPaused, 0);

  // Mestre assume controle de um figurante (promote)
  const promoted = await (await r.act(gm, 'tokenPatrol', {id: tokenId, operation: 'promote'})).json();
  const target = promoted.state.tokens.find(t => t.id === tokenId);
  assert.equal(target.ambient, undefined);
  assert.equal(target.patrol, undefined);
  assert.equal(promoted.state.table.patrolRunning, 3);
});

test('UI da mesa agrupa figurantes, exibe botão Pausar vida e permite desligar balões opcionais', () => {
  const state = newCampaign('Praça', true);
  state.tokens.push({
    id: 'amb-1',
    name: 'Pescador',
    color: 'blue',
    icon: 'auto',
    size: 1,
    x: 4,
    y: 4,
    ambient: true,
    ambientActivity: 'Pescando'
  });
  const row = {
    id: 'camp-live',
    rev: 1,
    master: true,
    state: {...state, table: {...state.table, patrolRunning: 1, patrolPaused: 0}}
  };
  const tabletop = createTabletop({
    action: async () => {},
    openCharacter() {},
    report() {},
    requestAsset: async () => new Response('')
  });
  const html = tabletop.render(row);
  assert.ok(html.includes('vtt-ambient-group'));
  assert.ok(html.includes('Figurantes (1)'));
  assert.ok(html.includes('data-table-action="ambientBubblesToggle"'));
  assert.ok(html.includes('data-table-action="sceneLifeToggle"'));
  assert.ok(html.includes('⏸ Pausar vida'));
  assert.ok(html.includes('vtt-ambient-bubble'));
  assert.ok(html.includes('Pescando'));
});

test('Pilar 3: generateWanderPoints respeita paredes, modo wander cria trajetos únicos em lote e modo idle gira suavemente no local', async () => {
  assert.deepEqual(Object.keys(ambientPresets), ['stroll', 'play', 'idle', 'guard', 'passerby']);

  // Parede vertical em x = 5 dividindo uma praça [1..9, 1..7]
  const tableWithWall = {
    grid: {columns: 16, rows: 10},
    walls: [{id: 'w1', kind: 'wall', x: 5, y: 0, toX: 5, toY: 10, open: false}]
  };
  const points = generateWanderPoints({x: 1, y: 1, width: 8, height: 6}, 1, tableWithWall, 77, {x: 2, y: 3});
  assert.ok(points.length >= 2);
  // Nenhum ponto pode atravessar a parede em x = 5 (token de tamanho 1 tem borda direita <= 5 => x <= 4.01)
  assert.ok(points.every(p => p.x <= 4.05 && p.x >= 1 && p.y >= 1 && p.y <= 6));

  // Integração via API: wander em lote (crianças brincando na praça) e idle (pescador)
  const r = await createRoom();
  const gm = r.created.key;
  await r.act(gm, 'tokenAdd', {name: 'Criança', x: 2, y: 2, color: 'gold'});
  const childId = (await r.view(gm)).state.tokens.at(-1).id;
  const wanderRes = await r.act(gm, 'tokenPatrol', {
    id: childId,
    operation: 'start',
    mode: 'wander',
    bounds: {x: 1, y: 1, width: 6, height: 5},
    speed: ambientPresets.play.speed,
    pause: ambientPresets.play.pause,
    activity: ambientPresets.play.activity,
    count: 3,
    ambient: true
  });
  assert.equal(wanderRes.status, 200);
  const kids = (await wanderRes.json()).state.tokens.filter(t => t.name === 'Criança');
  assert.equal(kids.length, 3);
  assert.ok(kids.every(k => k.patrol?.mode === 'wander' && k.patrol.points.length >= 2 && k.patrol.bounds));
  // Cada criança na praça recebe um caminho próprio distinto
  assert.equal(new Set(kids.map(k => JSON.stringify(k.patrol.points))).size, 3);

  // Modo idle (estacionário vivo): não precisa de 2 pontos, mantém x/y fixos e varia rotação
  await r.act(gm, 'tokenAdd', {name: 'Pescador', x: 8, y: 4, color: 'blue', rotation: 90});
  const fisherId = (await r.view(gm)).state.tokens.at(-1).id;
  const idleRes = await r.act(gm, 'tokenPatrol', {
    id: fisherId,
    operation: 'start',
    mode: 'idle',
    pause: 4,
    activity: 'Pescando',
    ambient: true,
    seed: 19
  });
  assert.equal(idleRes.status, 200);
  const fisher = (await idleRes.json()).state.tokens.find(t => t.id === fisherId);
  assert.equal(fisher.patrol.mode, 'idle');
  assert.equal(fisher.patrol.points.length, 1);
  const t0 = fisher.patrol.started;
  const s1 = patrolSample(fisher.patrol, t0 + 100);
  const s2 = patrolSample(fisher.patrol, t0 + 5000);
  assert.equal(s1.x, 8);
  assert.equal(s1.y, 4);
  assert.equal(s2.x, 8);
  assert.equal(s2.y, 4);
  assert.equal(s1.ambientActivity, 'Pescando');
  assert.notEqual(s1.rotation, s2.rotation);
});

test('Galeria de imagens na rota preserva retratos em cópias e varyAppearance, autoriza assets aos jogadores e facilita exclusão rápida', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const player = await r.join('a', 'lyra');

  await r.act(gm, 'tokenAdd', {name: 'Viajante', x: 1, y: 2, color: 'blue', icon: 'rogue'});
  const initialView = await r.view(gm);
  const tokenId = initialView.state.tokens.at(-1).id;
  const sceneId = initialView.state.sceneId;

  // Envia 2 imagens para a galeria do token via X-Portrait-Pool: append
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
  for (const fileName of ['aldeao-1.png', 'aldeao-2.png']) {
    const up = await r.call(r.base + '/token-portrait', 'POST', gm, pngBytes, {
      'Content-Type': 'image/png',
      'X-File-Name': encodeURIComponent(fileName),
      'X-Scene-Id': sceneId,
      'X-Portrait-Pool': 'append',
      'X-Token-Data': encodeURIComponent(JSON.stringify({id: tokenId, sceneId}))
    });
    assert.equal(up.status, 201);
  }

  // Inicia rota de passagem com 3 figurantes e varyAppearance: true
  const startRes = await r.act(gm, 'tokenPatrol', {
    id: tokenId,
    operation: 'start',
    mode: 'pass',
    points: [{x: 0, y: 2}, {x: 8, y: 2}],
    speed: 1,
    cooldown: 5,
    varyAppearance: true,
    count: 3,
    ambient: true
  });
  assert.equal(startRes.status, 200);
  const gmState = (await startRes.json()).state;
  const travelers = gmState.tokens.filter(t => t.name === 'Viajante');
  assert.equal(travelers.length, 3);
  // Todos os figurantes criados automaticamente recebem a galeria de imagens e icon === 'auto' (nunca revertem para ícone padrão!)
  for (const t of travelers) {
    assert.equal(t.icon, 'auto');
    assert.ok(t.portrait?.id);
    assert.equal(t.portraits?.length, 2);
  }
  const poolIds = travelers[0].portraits.map(p => p.id);
  assert.notEqual(poolIds[0], poolIds[1]);

  // patrolSample com varyAppearance + galeria alterna entre os retratos importados mantendo icon: 'auto'
  const sampled = patrolSample(travelers[0].patrol, travelers[0].patrol.started + 500, travelers[0]);
  assert.equal(sampled.icon, 'auto');
  assert.ok(poolIds.includes(sampled.portrait.id));

  // Jogador consegue carregar ambos os retratos da galeria em GET /:id/asset/:assetId
  for (const pid of poolIds) {
    const assetRes = await r.call(r.base + '/asset/' + pid, 'GET', player);
    assert.equal(assetRes.status, 200);
  }

  // UI expõe botões rápidos de exclusão (✕ na lista, Remover todos os figurantes e Remover na seleção)
  const gmRow = await r.view(gm);
  const tabletop = createTabletop({
    action: async () => {},
    openCharacter() {},
    report() {},
    requestAsset: async () => new Response('')
  });
  const html = tabletop.render(gmRow);
  assert.ok(html.includes('vtt-token-quick-delete'));
  assert.ok(html.includes('data-table-action="clearAmbient"'));

  // clearAmbient remove todos os figurantes de uma vez sem tocar nos tokens principais
  const cleared = await (await r.act(gm, 'tableSceneLife', {operation: 'clearAmbient'})).json();
  assert.equal(cleared.state.tokens.filter(t => t.ambient).length, 0);
  assert.ok(cleared.state.tokens.some(t => t.id === 'lyra'));
});

test('Área desenhada livremente (polígono em L / laço): mantém NPCs estritamente dentro do contorno e sem cortar por fora', async () => {
  // Polígono em formato de "L" (rua dobrando esquina: braço vertical x=1..4, y=1..8 + braço horizontal x=1..9, y=5..8)
  const lShapeArea = [
    {x: 1, y: 1}, {x: 4, y: 1}, {x: 4, y: 5},
    {x: 9, y: 5}, {x: 9, y: 8}, {x: 1, y: 8}
  ];
  assert.equal(pointInPolygon({x: 2.5, y: 2.5}, lShapeArea), true);
  assert.equal(pointInPolygon({x: 7.0, y: 6.5}, lShapeArea), true);
  assert.equal(pointInPolygon({x: 7.0, y: 2.5}, lShapeArea), false); // canto externo fora do L!

  const r = await createRoom();
  const gm = r.created.key;
  // Token começa fora do L (em 12, 1) — ao iniciar área desenhada, entra automaticamente no polígono!
  await r.act(gm, 'tokenAdd', {name: 'Morador', x: 12, y: 1, color: 'jade'});
  const villagerId = (await r.view(gm)).state.tokens.at(-1).id;

  const res = await r.act(gm, 'tokenPatrol', {
    id: villagerId,
    operation: 'start',
    mode: 'wander',
    area: lShapeArea,
    speed: 1.2,
    pause: 2,
    count: 3,
    ambient: true,
    seed: 101
  });
  assert.equal(res.status, 200);
  const state = (await res.json()).state;
  const residents = state.tokens.filter(t => t.name === 'Morador');
  assert.equal(residents.length, 3);
  for (const resident of residents) {
    assert.equal(resident.patrol.area.length, 6);
    assert.ok(resident.patrol.points.length >= 2);
    // Todos os centros dos pontos gerados e os pontos médios entre paradas ficam estritamente dentro do polígono L!
    const pts = resident.patrol.points;
    for (let i = 0; i < pts.length; i++) {
      assert.equal(pointInPolygon({x: pts[i].x + 0.5, y: pts[i].y + 0.5}, lShapeArea), true);
      if (i > 0) {
        const mid = {x: (pts[i - 1].x + pts[i].x) / 2 + 0.5, y: (pts[i - 1].y + pts[i].y) / 2 + 0.5};
        assert.equal(pointInPolygon(mid, lShapeArea), true);
      }
    }
  }
});

test('Grupo Figurantes permanece aberto durante movimento a 60 FPS e clearAmbient funciona sem precisar selecionar token', async () => {
  const state = newCampaign('Rua em Movimento', true);
  const now = Date.now();
  state.tokens.push({
    id: 'mov-1',
    name: 'Corredor',
    color: 'gold',
    icon: 'auto',
    size: 1,
    x: 2,
    y: 2,
    ambient: true,
    motion: {at: now, ms: 1200, vx: 0.002, vy: 0}
  });
  const row = {
    id: 'camp-moving',
    rev: 5,
    serverTime: now,
    master: true,
    state: {...state, table: {...state.table, patrolRunning: 1, patrolPaused: 0}}
  };
  const calls = [];
  const tabletop = createTabletop({
    action: async (name, data) => calls.push({name, data}),
    openCharacter() {},
    confirm: async () => true,
    report() {},
    requestAsset: async () => new Response('')
  });
  const html = tabletop.render(row);
  assert.ok(html.includes('data-table-toolbar-clear-ambient'));

  const listeners = new Map();
  let listWriteCount = 0;
  let detailsOpen = false;
  const listHost = {
    dataset: {},
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; listWriteCount++; },
    querySelector: sel => sel === '.vtt-ambient-group' ? {get open() { return detailsOpen; }} : null
  };
  const viewport = {
    clientWidth: 800, clientHeight: 600, dataset: {},
    addEventListener() {},
    getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}),
    querySelectorAll: () => []
  };
  const root = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    querySelector: sel => {
      if (sel === '.vtt-viewport') return viewport;
      if (sel === '.vtt-world') return {style: {setProperty() {}}, classList: {toggle() {}}, getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600})};
      if (sel === '[data-table-token-list]') return listHost;
      if (sel === '.vtt-map') return {style: {}};
      return null;
    },
    querySelectorAll: () => []
  };
  tabletop.mount(root, row);

  // Usuário abre <details class="vtt-ambient-group"> sem ter nenhum token selecionado
  detailsOpen = true;
  listeners.get('toggle')({target: {open: true, matches: s => s === '.vtt-ambient-group'}});

  // Chegam múltiplos quadros de movimento (syncScene) enquanto figurante se move: details permanece aberto e sem reescrever DOM repetidamente!
  tabletop.syncScene({...row, serverTime: now + 400});
  const writesAfterOpen = listWriteCount;
  assert.ok(listHost.innerHTML.includes('<details class="vtt-ambient-group" open>'));
  tabletop.syncScene({...row, serverTime: now + 800});
  assert.equal(listWriteCount, writesAfterOpen); // zero destruição de botão durante o movimento!

  // Clique em clearAmbient dispara tableSceneLife imediatamente mesmo sem nenhum figurante selecionado
  await listeners.get('click')({
    target: {
      closest: sel => sel === '[data-table-action]' ? {dataset: {tableAction: 'clearAmbient'}} : null
    },
    preventDefault() {}
  });
  assert.deepEqual(calls, [{name: 'tableSceneLife', data: {operation: 'clearAmbient'}}]);
});
