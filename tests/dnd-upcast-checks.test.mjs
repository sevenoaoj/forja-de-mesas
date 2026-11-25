import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../api.mjs';
import {
  dndCharacter,
  dndClasses,
  dndSpells,
  dndCatalog,
  dndSpellFormula,
  dndSpellSlotsForLevel,
  syncDndSpellSlots
} from '../dnd.mjs';
import {newCampaign} from '../model.mjs';
import {renderTableRollContent} from '../public/table-rolls.mjs';

function dndConfig(classId = 'wizard') {
  const cls = dndClasses.find(c => c.id === classId);
  const bg = classId === 'wizard' ? 'sage' : 'soldier';
  const bgSkills = bg === 'sage' ? ['arcana', 'history'] : ['athletics', 'intimidation'];
  const skills = cls.skills.filter(id => !bgSkills.includes(id)).slice(0, cls.count);
  return {
    classId,
    speciesId: 'human',
    backgroundId: bg,
    scoreMethod: 'array',
    scores: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((id, i) => [id, cls.array[i]])),
    boost2: bg === 'sage' ? 'int' : 'str',
    boost1: bg === 'sage' ? 'wis' : 'con',
    skills,
    expertise: classId === 'rogue' ? skills.slice(0, 2) : []
  };
}

async function createRoom(options = {name: 'Mesa Testes e Magias', example: true}) {
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
  const call = (path, method = 'GET', key = null, body = undefined) => api(new Request('http://app/api/campaigns' + path, {
    method,
    headers: key ? {Authorization: 'Bearer ' + key} : {},
    body: body === undefined ? undefined : JSON.stringify(body)
  }), store);
  const created = await (await call('', 'POST', null, options)).json();
  const base = '/' + created.id;
  const act = (key, action, data = {}) => call(base + '/action', 'POST', key, {action, data});
  const view = async key => (await call(base, 'GET', key)).json();
  async function join(seed, charId) {
    const key = seed.repeat(64);
    assert.equal((await call(base + '/join', 'POST', created.invite, {key})).status, 200);
    if (charId) assert.equal((await act(key, 'characterClaim', {id: charId})).status, 200);
    return key;
  }
  return {created, rows, store, call, base, act, view, join};
}

test('P2-5: pedidos de teste em fórmula livre e heterogêneos com allowFallback funcionam com ajuda e dados físicos', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const playerLyra = await r.join('a', 'lyra');

  // Cria uma ficha Herdeiros do Destino (sem perícia Percepção e sem atributo Força) para testar mesa heterogênea
  const playerAnuki = await r.join('b');
  const anukiResp = await (await r.act(playerAnuki, 'character', {
    name: 'Anuki',
    preset: 'herdeiros-destino',
    values: {'hd-power': '2', 'hd-cunning': '1', 'hd-essence': '3'}
  })).json();
  const anukiId = anukiResp.characterId;

  // 1. Sem allowFallback, pedir Percepção para [lyra, anuki] continua falhando com 400 (compatibilidade estrita)
  assert.equal((await r.act(gm, 'checkCreate', {
    characterIds: ['lyra', anukiId],
    test: 'skill:percepcao'
  })).status, 400);

  // 2. Com allowFallback: true, Lyra usa sua perícia Percepção (1d20+4+1) e Anuki recebe fallback '1d20'
  const fallbackCreate = await r.act(gm, 'checkCreate', {
    characterIds: ['lyra', anukiId],
    test: 'skill:percepcao',
    allowFallback: true,
    dc: 12,
    showDc: true
  });
  assert.equal(fallbackCreate.status, 200);
  const fallbackCheck = (await fallbackCreate.json()).state.checkRequests[0];
  assert.equal(fallbackCheck.label, 'Percepção');

  const lyraRoll = await (await r.act(playerLyra, 'checkRespond', {id: fallbackCheck.id})).json();
  assert.equal(lyraRoll.state.checkRequests[0].targets[0].result.formula, '1d20+4+1');

  const anukiRoll = await (await r.act(playerAnuki, 'checkRespond', {id: fallbackCheck.id})).json();
  assert.equal(anukiRoll.state.checkRequests[0].targets[0].result.formula, '1d20');

  await r.act(gm, 'checkClose', {id: fallbackCheck.id});

  // 3. Pedido em modo fórmula livre (com mode: 'free' e com freeFormula shorthand)
  for (const badFree of [
    {mode: 'free', formula: '@{f1}', label: 'Atributo não permitido', characterIds: ['lyra']},
    {mode: 'free', formula: '51d20', label: 'Excesso', characterIds: ['lyra']},
    {mode: 'free', formula: '1d20', label: '', characterIds: ['lyra']},
    {mode: 'free', formula: '1d20', label: 'x'.repeat(81), characterIds: ['lyra']}
  ]) {
    assert.equal((await r.act(gm, 'checkCreate', badFree)).status, 400);
  }
  assert.equal((await r.act(playerLyra, 'checkCreate', {freeFormula: '1d20', characterIds: ['lyra']})).status, 403);

  const freeResp = await r.act(gm, 'checkCreate', {
    mode: 'free',
    label: 'Teste de Sorte',
    formula: '2d6+2',
    allowHelp: true,
    characterIds: ['lyra', anukiId]
  });
  assert.equal(freeResp.status, 200);
  const freeCheck = (await freeResp.json()).state.checkRequests[0];
  assert.equal(freeCheck.label, 'Teste de Sorte');

  // Oferta de ajuda em 2d6+2: vantagem deve ser rejeitada (não é d20), +1d4 funciona
  assert.equal((await r.act(playerAnuki, 'assistOffer', {id: freeCheck.id, target: 'lyra', reason: 'Amuleto de sorte'})).status, 200);
  const offerId = (await r.view(gm)).state.checkRequests[0].targets.find(t => t.characterId === 'lyra').help.id;
  assert.equal((await r.act(gm, 'assistDecide', {id: freeCheck.id, target: 'lyra', offer: offerId, effect: 'advantage'})).status, 400);
  assert.equal((await r.act(gm, 'assistDecide', {id: freeCheck.id, target: 'lyra', offer: offerId, effect: '1d4'})).status, 200);

  const freeRespond = await (await r.act(playerLyra, 'checkRespond', {id: freeCheck.id})).json();
  assert.equal(freeRespond.state.checkRequests[0].targets[0].result.formula, '2d6+2+1d4');

  // checkPhysical funciona em Anuki (e também em pedidos livres sem allowHelp)
  assert.equal((await r.act(gm, 'checkPhysical', {id: freeCheck.id, target: anukiId, total: 11})).status, 200);
  assert.equal((await r.view(playerAnuki)).state.checkRequests[0].targets[0].result.total, 11);

  const shorthandCheck = (await (await r.act(gm, 'checkCreate', {freeFormula: '1d100', characterIds: ['lyra']})).json()).state.checkRequests[0];
  assert.equal(shorthandCheck.label, 'Teste · 1d100');
  assert.equal((await r.act(gm, 'checkPhysical', {id: shorthandCheck.id, target: 'lyra', total: 42})).status, 200);
});

test('P3-1: progressão de espaços D&D 2024, syncDndSpellSlots ao mudar nível e dndCast em círculos 2+ e upcast', async () => {
  // Preserva as 13 magias originais e inclui magias de 2º e 3º círculos
  assert.ok(dndSpells.length >= 20);
  for (const id of ['spell-misty-step', 'spell-scorching-ray', 'spell-invisibility', 'spell-hold-person', 'spell-fireball', 'spell-counterspell', 'spell-revivify']) {
    assert.ok(dndCatalog.some(entry => entry.id === id), id);
  }

  // Tabela de espaços por classe e nível
  assert.deepEqual(dndSpellSlotsForLevel(1, 'wizard'), {1: 2});
  assert.deepEqual(dndSpellSlotsForLevel(3, 'wizard'), {1: 4, 2: 2});
  assert.deepEqual(dndSpellSlotsForLevel(5, 'wizard'), {1: 4, 2: 3, 3: 2});
  assert.deepEqual(dndSpellSlotsForLevel(20, 'wizard'), {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1});
  assert.deepEqual(dndSpellSlotsForLevel(1, 'paladin'), {1: 2});
  assert.deepEqual(dndSpellSlotsForLevel(5, 'paladin'), {1: 4, 2: 2});
  assert.deepEqual(dndSpellSlotsForLevel(1, 'warlock'), {1: 1});
  assert.deepEqual(dndSpellSlotsForLevel(5, 'warlock'), {3: 2});
  assert.deepEqual(dndSpellSlotsForLevel(10, 'fighter'), {});

  // Verifica que dndSpellFormula aceita tanto (character, spell, slotLevel) quanto (spell, character, slotLevel)
  const wizUnit = dndCharacter(dndConfig('wizard'));
  const fireball = dndCatalog.find(s => s.id === 'spell-fireball');
  assert.equal(dndSpellFormula(wizUnit, fireball, 'effect', 3), '8d6');
  assert.equal(dndSpellFormula(wizUnit, fireball, 4), '9d6');
  assert.equal(dndSpellFormula(fireball, wizUnit, 5), '10d6');

  // Integração via API: subir nível em sheetValue sincroniza slots preservando gastos, conjura e faz upcast
  const r = await createRoom({name: 'D&D Círculos', ruleset: 'dnd-2024'});
  const gm = r.created.key;
  const createdSheet = await (await r.act(gm, 'character', {name: 'Elara', dnd: dndConfig('wizard')})).json();
  const id = createdSheet.state.characters[0].id;

  // Gasta 1 espaço de 1º círculo no nível 1 (fica 1/2)
  await r.act(gm, 'dndAdd', {id, entryId: 'spell-cure-wounds', allowExtra: true});
  await r.act(gm, 'dndCast', {id, entryId: 'spell-cure-wounds'});
  assert.equal((await r.view(gm)).state.characters[0].values['dd-slot-1'], '1/2');

  // Sobe para nível 5 via sheetValue: dd-slot-1 passa de 1/2 para 3/4 (+2 novos espaços), dd-slot-2 = 3/3, dd-slot-3 = 2/2
  assert.equal((await r.act(gm, 'sheetValue', {id, field: 'dd-level', before: '1', value: '5'})).status, 200);
  let char = (await r.view(gm)).state.characters[0];
  assert.equal(char.values['dd-slot-1'], '3/4');
  assert.equal(char.values['dd-slot-2'], '3/3');
  assert.equal(char.values['dd-slot-3'], '2/2');

  // Adiciona Bola de Fogo (3º círculo) e Passo Nebuloso (2º círculo, utilidade sem rolagem)
  await r.act(gm, 'dndAdd', {id, entryId: 'spell-fireball'});
  await r.act(gm, 'dndAdd', {id, entryId: 'spell-misty-step'});

  // Rejeita conjurar Bola de Fogo em círculo inferior (2º) ou inválido (10º)
  assert.equal((await r.act(gm, 'dndCast', {id, entryId: 'spell-fireball', slotLevel: 2})).status, 400);
  assert.equal((await r.act(gm, 'dndCast', {id, entryId: 'spell-fireball', slotLevel: 10})).status, 400);

  // Conjura Bola de Fogo no 3º círculo base
  let castRes = await r.act(gm, 'dndCast', {id, entryId: 'spell-fireball', visibility: 'public'});
  assert.equal(castRes.status, 200);
  let state = (await castRes.json()).state;
  assert.equal(state.characters[0].values['dd-slot-3'], '1/2');
  assert.equal(state.rolls[0].formula, '8d6');
  assert.equal(state.rolls[0].label, 'Conjurar · Bola de Fogo');

  // Upcast: conjura Curar Ferimentos (1º círculo) usando o último espaço de 3º círculo -> 6d8+3 e rótulo "(3º círculo)"
  castRes = await r.act(gm, 'dndCast', {id, entryId: 'spell-cure-wounds', slotLevel: 3, visibility: 'public'});
  assert.equal(castRes.status, 200);
  state = (await castRes.json()).state;
  assert.equal(state.characters[0].values['dd-slot-3'], '0/2');
  assert.equal(state.characters[0].values['dd-slot-1'], '3/4');
  assert.equal(state.rolls[0].formula, '6d8+3');
  assert.equal(state.rolls[0].label, 'Conjurar · Curar Ferimentos (3º círculo)');

  // Sem espaços de 3º círculo restantes -> 409
  assert.equal((await r.act(gm, 'dndCast', {id, entryId: 'spell-fireball'})).status, 409);

  // Conjura Passo Nebuloso em 2º círculo e disputa concorrente quando resta 1 espaço
  await r.act(gm, 'sheetCounter', {id, field: 'dd-slot-2', current: 1, maximum: 3});
  const concurrent = await Promise.all([
    r.act(gm, 'dndCast', {id, entryId: 'spell-misty-step'}),
    r.act(gm, 'dndCast', {id, entryId: 'spell-misty-step'})
  ]);
  assert.deepEqual(concurrent.map(x => x.status).sort(), [200, 409]);
  assert.equal((await r.view(gm)).state.characters[0].values['dd-slot-2'], '0/3');

  // UI da mesa exibe seletor de círculo quando há múltiplos espaços >= spell.level ou apenas círculos superiores
  await r.act(gm, 'dndRest', {id, kind: 'long'});
  char = (await r.view(gm)).state.characters[0];
  assert.equal(char.values['dd-slot-3'], '2/2');

  const actionsHtml = renderTableRollContent(
    {master: true, state: newCampaign('UI')},
    char,
    {tab: 'actions', query: '', base: '1d20', formula: '1d20', mode: 'normal', masteryId: '', castSlots: {'spell-cure-wounds': 2}}
  );
  assert.ok(actionsHtml.includes('data-table-cast-slot="spell-cure-wounds"'));
  assert.ok(actionsHtml.includes('Gasta 1 espaço de 2º círculo'));

  // Reduzir nível para 3 clampa dd-slot-2 (3/3 -> 2/2) e remove dd-slot-3
  assert.equal((await r.act(gm, 'sheetValue', {id, field: 'dd-level', before: '5', value: '3'})).status, 200);
  char = (await r.view(gm)).state.characters[0];
  assert.equal(char.values['dd-slot-2'], '2/2');
  assert.equal(char.values['dd-slot-3'], undefined);
  assert.equal(char.layout.some(f => f.id === 'dd-slot-3'), false);
});
