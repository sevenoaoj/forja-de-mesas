import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api} from '../api.mjs';
import {newCampaign,primaryCharacterResource} from '../model.mjs';
import {renderGmScreen} from '../public/gm-screen.mjs';

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
  const store = {
    async create(row) { rows.set(row.id, structuredClone(row)); },
    async get(id) { return structuredClone(rows.get(id)); },
    async save(row) {
      await Promise.resolve();
      if (rows.get(row.id)?.rev !== row.rev) return false;
      rows.set(row.id, structuredClone({...row, rev: row.rev + 1}));
      return true;
    }
  };
  const call = (path, method, key, body) => api(new Request('http://app/api/campaigns' + path, {
    method,
    headers: key ? {Authorization: 'Bearer ' + key} : {},
    body: body === undefined ? undefined : JSON.stringify(body)
  }), store);
  const created = await (await call('', 'POST', null, {name: 'Mesa Recursos', example: true})).json();
  const base = '/' + created.id;
  const act = (key, action, data = {}) => call(base + '/action', 'POST', key, {action, data});
  const view = async key => (await call(base, 'GET', key)).json();
  const sync = async key => (await call(base + '/sync?table=1', 'GET', key)).json();
  async function join(seed, charId) {
    const key = seed.repeat(64);
    assert.equal((await call(base + '/join', 'POST', created.invite, {key})).status, 200);
    if (charId) assert.equal((await act(key, 'characterClaim', {id: charId})).status, 200);
    return key;
  }
  return {created, rows, store, call, base, act, view, sync, join};
}

test('primaryCharacterResource prioriza injury.resource válido e faz fallback para o primeiro counter', () => {
  const state = newCampaign('Teste', true);
  const lyra = state.characters[0];
  assert.deepEqual(primaryCharacterResource(state, lyra), {
    fieldId: 'f4',
    label: 'Vitalidade',
    current: 18,
    maximum: 22
  });

  lyra.layout = [
    {id: 'local-' + '1'.repeat(32), group: 'Recursos', label: 'Mana', type: 'counter', initial: '5/10'},
    ...state.fields
  ];
  lyra.values['local-' + '1'.repeat(32)] = '7/10';
  assert.equal(primaryCharacterResource(state, lyra).fieldId, 'local-' + '1'.repeat(32));

  lyra.injury = {resource: 'f4', threshold: 25};
  assert.deepEqual(primaryCharacterResource(state, lyra), {
    fieldId: 'f4',
    label: 'Vitalidade',
    current: 18,
    maximum: 22
  });

  lyra.injury = {resource: 'f1', threshold: 25}; // f1 is number, not counter
  assert.equal(primaryCharacterResource(state, lyra).fieldId, 'local-' + '1'.repeat(32));

  assert.equal(primaryCharacterResource(state, {id: 'empty', layout: [], values: {}}), null);
  assert.equal(primaryCharacterResource(state, {id: 'zero', layout: [{id: 'hp', label: 'PV', type: 'counter', initial: '0/0'}], values: {}}), null);
});

test('sheetCounter e gmResourceChange aplicam delta inteiro seguro com clamp, histórico e trava otimista', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const playerA = await r.join('a', 'lyra');

  // Jogador aplica dano (-5) e cura (+100 clampada no máximo 22) na própria ficha
  let res = await r.act(playerA, 'sheetCounter', {id: 'lyra', field: 'f4', delta: -5});
  assert.equal(res.status, 200);
  let body = await res.json();
  let lyra = body.state.characters.find(c => c.id === 'lyra');
  assert.equal(lyra.values.f4, '13/22');
  assert.equal(lyra.sheetHistory.entries[0].action, 'sheetCounter');

  res = await r.act(playerA, 'sheetCounter', {id: 'lyra', field: 'f4', delta: -999});
  assert.equal((await res.json()).state.characters.find(c => c.id === 'lyra').values.f4, '0/22');

  res = await r.act(playerA, 'sheetCounter', {id: 'lyra', field: 'f4', delta: 1_000_000});
  assert.equal((await res.json()).state.characters.find(c => c.id === 'lyra').values.f4, '22/22');

  // Rejeita entradas inválidas ou não autorizadas
  for (const bad of [
    {id: 'lyra', field: 'f4', delta: 1.5},
    {id: 'lyra', field: 'f4', delta: '5'},
    {id: 'lyra', field: 'f4', delta: 1_000_001},
    {id: 'lyra', field: 'f4', delta: -1_000_001},
    {id: 'lyra', field: 'f4', delta: -2, step: -1}
  ]) {
    assert.equal((await r.act(playerA, 'sheetCounter', bad)).status, 400);
  }
  assert.equal((await r.act(playerA, 'sheetCounter', {id: 'dorian', field: 'f4', delta: -5})).status, 403);

  // Recurso privado do mestre com delta e trava de versão
  const createdRes = await (await r.act(gm, 'gmResourceChange', {
    id: 'lyra',
    operation: 'save',
    name: 'Corrupção',
    current: 10,
    maximum: 15,
    color: '#9933cc'
  })).json();
  const priv = createdRes.state.gmResources.lyra[0];

  assert.equal((await r.act(playerA, 'gmResourceChange', {id: 'lyra', resourceId: priv.id, delta: -3})).status, 403);
  assert.equal((await r.act(gm, 'gmResourceChange', {id: 'lyra', resourceId: priv.id, operation: 'delta', delta: -4, version: priv.version})).status, 200);
  // Versão antiga deve falhar com 409
  assert.equal((await r.act(gm, 'gmResourceChange', {id: 'lyra', resourceId: priv.id, operation: 'delta', delta: -2, version: priv.version})).status, 409);
  const updatedPriv = (await r.view(gm)).state.gmResources.lyra[0];
  assert.equal(updatedPriv.current, 6);
  // Sem version explícita também ajusta com segurança e faz clamp
  assert.equal((await r.act(gm, 'gmResourceChange', {id: 'lyra', resourceId: priv.id, delta: 50})).status, 200);
  assert.equal((await r.view(gm)).state.gmResources.lyra[0].current, 15);
  assert.equal((await r.act(gm, 'gmResourceChange', {id: 'lyra', resourceId: priv.id, delta: 2.5})).status, 400);
});

test('resourceBar respeita isolamento estrito: nunca vaza PV de NPCs, monstros, ocultos, rivais ou aliados para não-mestres', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const playerLyra = await r.join('a', 'lyra');
  const playerDorian = await r.join('b', 'dorian');
  const waitingMember = await r.join('f');

  // Cria um NPC/monstro, uma ficha oculta e um grupo rival para Mira
  const npcResp = await (await r.act(gm, 'character', {
    name: 'Dragão Ancião',
    characterType: 'npc',
    values: {f4: '180/200'}
  })).json();
  const npcId = npcResp.state.characters.at(-1).id;
  await r.act(gm, 'tokenAdd', {name: 'Dragão', characterId: npcId, x: 2, y: 2});
  const npcTokenId = (await r.view(gm)).state.tokens.at(-1).id;

  const hiddenResp = await (await r.act(gm, 'character', {
    name: 'Assassino Oculto',
    hidden: true,
    values: {f4: '33/40'}
  })).json();
  const hiddenCharId = hiddenResp.state.characters.at(-1).id;
  await r.act(gm, 'tokenAdd', {name: 'Vulto', characterId: hiddenCharId, x: 3, y: 3});
  const hiddenTokenId = (await r.view(gm)).state.tokens.at(-1).id;

  const partyNorth = (await (await r.act(gm, 'partySave', {name: 'Norte'})).json()).state.parties.at(-1).id;
  const partySouth = (await (await r.act(gm, 'partySave', {name: 'Sul'})).json()).state.parties.at(-1).id;
  await r.act(gm, 'characterParty', {id: 'lyra', party: partyNorth, revealed: true});
  await r.act(gm, 'characterParty', {id: 'dorian', party: partyNorth, revealed: true}); // aliado de outro jogador
  await r.act(gm, 'characterParty', {id: 'mira', party: partySouth, revealed: true}); // rival

  await r.act(gm, 'combatSet', {
    entries: [
      {id: 'c-lyra', name: 'Lyra', value: 20, tokenId: 'lyra'},
      {id: 'c-dorian', name: 'Dorian', value: 18, tokenId: 'dorian'},
      {id: 'c-mira', name: 'Mira', value: 15, tokenId: 'mira'},
      {id: 'c-npc', name: 'Dragão', value: 12, tokenId: npcTokenId},
      {id: 'c-hid', name: 'Vulto', value: 10, tokenId: hiddenTokenId}
    ]
  });

  // 1. Mestre vê resourceBar em TODOS os tokens e entradas vinculadas a fichas
  const gmView = await r.view(gm);
  assert.equal(gmView.state.tokens.filter(t => t.resourceBar).length, 5);
  assert.equal(gmView.state.table.combat.entries.filter(e => e.resourceBar).length, 5);
  assert.equal(gmView.state.tokens.find(t => t.id === npcTokenId).resourceBar.current, 180);

  // 2. Jogadora de Lyra vê resourceBar ESTRITAMENTE em Lyra (token + combate), nunca em Dorian, Mira, Dragão ou Vulto
  for (const snapshot of [await r.view(playerLyra), await r.sync(playerLyra)]) {
    const tokensWithBar = snapshot.state.tokens.filter(t => t.resourceBar !== undefined);
    assert.deepEqual(tokensWithBar.map(t => t.id), ['lyra']);
    assert.deepEqual(tokensWithBar[0].resourceBar, {fieldId: 'f4', label: 'Vitalidade', current: 18, maximum: 22});

    const entriesWithBar = snapshot.state.table.combat.entries.filter(e => e.resourceBar !== undefined);
    assert.deepEqual(entriesWithBar.map(e => e.id), ['c-lyra']);
    const serialized = JSON.stringify(snapshot);
    assert.equal(serialized.includes('180/200'), false);
    assert.equal(serialized.includes('"current":180'), false);
    assert.equal(serialized.includes('25/28'), false); // Dorian 25/28
    assert.equal(serialized.includes('"current":25'), false);
    assert.equal(serialized.includes('33/40'), false); // Oculto 33/40
    assert.equal(serialized.includes('"current":33'), false);
    assert.equal(snapshot.state.tokens.find(t => t.id === 'dorian')?.resourceBar, undefined);
    assert.equal(snapshot.state.characters?.find(c => c.id === 'dorian')?.values, undefined);
  }

  // 3. Jogador de Dorian vê ESTRITAMENTE Dorian
  const dorianView = await r.view(playerDorian);
  assert.deepEqual(dorianView.state.tokens.filter(t => t.resourceBar).map(t => t.id), ['dorian']);
  assert.deepEqual(dorianView.state.table.combat.entries.filter(e => e.resourceBar).map(e => e.id), ['c-dorian']);

  // 4. Guest (convite) e membro sem ficha nunca recebem resourceBar
  for (const key of [r.created.invite, waitingMember]) {
    const snap = await r.view(key);
    assert.deepEqual(snap.state.tokens.filter(t => t.resourceBar), []);
    assert.deepEqual(snap.state.table.combat.entries.filter(e => e.resourceBar), []);
  }
});

test('UI da mesa e do escudo renderizam barras de recurso e controles rápidos de delta', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const playerLyra = await r.join('a', 'lyra');
  await r.act(gm, 'combatSet', {entries: [{id: 'c-lyra', name: 'Lyra', value: 18, tokenId: 'lyra'}]});
  await r.act(gm, 'gmResourceChange', {id: 'lyra', operation: 'save', name: 'Tensão', current: 3, maximum: 6, color: '#cc5577'});

  const playerRow = await r.view(playerLyra);
  const actions = [];
  const tabletop = createTabletop({
    action: async (name, data) => actions.push({name, data}),
    openCharacter() {},
    report() {},
    requestAsset: async () => new Response('')
  });
  const html = tabletop.render(playerRow);
  assert.ok(html.includes('vtt-token-bar'));
  assert.ok(html.includes('vtt-combat-bar'));
  assert.ok(html.includes('18/22'));

  const gmRow = await r.view(gm);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const ui = {
    esc,
    button: (label, act, style, icon, id) => '<button data-act="' + act + '" data-id="' + esc(id) + '">' + esc(label) + '</button>',
    head: title => '<h1>' + title + '</h1>',
    input: (name, label, value) => '<input name="' + name + '" value="' + esc(value) + '">',
    area: (name, label, value) => '<textarea name="' + name + '">' + esc(value) + '</textarea>',
    submit: label => '<button>' + label + '</button>',
    select: (name, label, options) => '<select name="' + name + '">' + Object.entries(options).map(([id, t]) => '<option value="' + esc(id) + '">' + esc(t) + '</option>').join('') + '</select>'
  };
  const shieldHtml = renderGmScreen(gmRow, ui);
  assert.ok(shieldHtml.includes('lyra/f4/-5'));
  assert.ok(shieldHtml.includes('lyra/f4/5'));
  assert.ok(shieldHtml.includes('data-form="gmCounterDelta"'));
  assert.ok(shieldHtml.includes('data-form="gmPrivateDelta"'));
  assert.ok(shieldHtml.includes('Tensão'));
});
