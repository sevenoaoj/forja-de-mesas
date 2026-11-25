import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sceneView} from '../api.mjs';
import {accessFor} from '../access.mjs';
import {chatRetention} from '../chat-model.mjs';
import {renderRollHistory} from '../public/rolls.mjs';

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
    async putAsset(k, b) { assets.set(k, b); },
    async getAsset(k) { return assets.get(k) || null; },
    async deleteAsset(k) { assets.delete(k); }
  };
  const call = (path, method = 'GET', key = null, body = undefined, headers = {}) => api(new Request('http://app/api/campaigns' + path, {
    method,
    headers: {...(key ? {Authorization: 'Bearer ' + key} : {}), ...headers},
    body: body === undefined ? undefined : (body instanceof Uint8Array ? body : JSON.stringify(body))
  }), store);
  const created = await (await call('', 'POST', null, {name: 'Mesa Chat', example: true})).json();
  const base = '/' + created.id;
  const act = (key, action, data = {}) => call(base + '/action', 'POST', key, {action, data});
  const view = async key => (await call(base, 'GET', key)).json();
  const sync = async (key, query = '') => (await call(base + '/sync' + query, 'GET', key)).json();
  async function join(seed, charId) {
    const key = seed.repeat(64);
    assert.equal((await call(base + '/join', 'POST', created.invite, {key})).status, 200);
    if (charId) assert.equal((await act(key, 'characterClaim', {id: charId})).status, 200);
    return key;
  }
  return {created, rows, store, call, base, act, view, sync, join};
}

test('chatSend bloqueia guest/sem ficha, valida campos e impõe autoria confiável no servidor', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const waiting = await r.join('f');
  const lyra = await r.join('a', 'lyra');

  // Guest e jogador sem personagem não podem enviar mensagens
  assert.equal((await r.act(r.created.invite, 'chatSend', {text: 'Oi'})).status, 403);
  assert.equal((await r.act(waiting, 'chatSend', {text: 'Oi'})).status, 403);

  // Validação de texto e canal
  for (const invalid of [
    {text: ''},
    {text: '    '},
    {text: 'x'.repeat(401)},
    {text: 123},
    {text: 'Olá', channel: 'global'},
    {text: 'Sussurro inválido', channel: 'whisper', targetId: 'lyra'} // auto-sussurro
  ]) {
    assert.equal((await r.act(lyra, 'chatSend', invalid)).status, 400);
  }

  // Jogador não consegue falsificar actor, fromRole ou senderCharacterId
  const sent = await r.act(lyra, 'chatSend', {
    text: '  Avanço com cautela.  ',
    channel: 'ic',
    actor: 'Mestre Falso',
    fromRole: 'master',
    senderCharacterId: 'dorian'
  });
  assert.equal(sent.status, 200);
  const msg = (await sent.json()).state.messages[0];
  assert.equal(msg.text, 'Avanço com cautela.');
  assert.equal(msg.channel, 'ic');
  assert.equal(msg.fromRole, 'player');
  assert.equal(msg.actor, 'Lyra Vesper');
  assert.equal(msg.senderCharacterId, 'lyra');

  // Mestre pode falar como Mestre em public e como NPC ou nome customizado em ic
  const npcResp = await (await r.act(gm, 'character', {name: 'Taverneiro Brom', characterType: 'npc'})).json();
  const npcId = npcResp.state.characters.at(-1).id;
  assert.equal((await r.act(gm, 'chatSend', {text: 'Bem-vindos!', channel: 'ic', speakerCharacterId: npcId})).status, 200);
  assert.equal((await r.act(gm, 'chatSend', {text: 'Voz ao longe...', channel: 'ic', speaker: 'Eco da Caverna'.padEnd(90, '!')})).status, 200);
  assert.equal((await r.act(gm, 'chatSend', {text: 'Pausa de 5 min'})).status, 200);
  assert.equal((await r.act(gm, 'chatSend', {text: 'Inexistente', channel: 'ic', speakerCharacterId: 'sumiu'})).status, 404);

  const gmMessages = (await r.view(gm)).state.messages;
  assert.equal(gmMessages[0].actor, 'Mestre');
  assert.equal(gmMessages[0].channel, 'public');
  assert.equal(gmMessages[1].actor.length, 60);
  assert.equal(gmMessages[2].actor, 'Taverneiro Brom');
});

test('sussurros, fichas ocultas e grupos rivais são estritamente isolados em view, sceneView e /sync', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const lyra = await r.join('a', 'lyra');
  const dorian = await r.join('b', 'dorian');
  const mira = await r.join('c', 'mira');

  // Sussurro de Lyra para o Mestre
  assert.equal((await r.act(lyra, 'chatSend', {text: 'segredo-lyra-mestre', channel: 'whisper', targetId: 'gm'})).status, 200);
  // Sussurro do Mestre para Dorian
  assert.equal((await r.act(gm, 'chatSend', {text: 'segredo-mestre-dorian', channel: 'whisper', targetId: 'dorian'})).status, 200);
  // Sussurro entre aliados Lyra -> Dorian
  assert.equal((await r.act(lyra, 'chatSend', {text: 'segredo-lyra-dorian', channel: 'whisper', targetId: 'dorian'})).status, 200);

  // Mestre não pode sussurrar sem destinatário válido
  assert.equal((await r.act(gm, 'chatSend', {text: 'sem alvo', channel: 'whisper'})).status, 400);
  assert.equal((await r.act(gm, 'chatSend', {text: 'para gm', channel: 'whisper', targetId: 'gm'})).status, 400);

  // Separa Mira em grupo rival e cria NPC oculto
  const north = (await (await r.act(gm, 'partySave', {name: 'Norte'})).json()).state.parties.at(-1).id;
  const south = (await (await r.act(gm, 'partySave', {name: 'Sul'})).json()).state.parties.at(-1).id;
  await r.act(gm, 'characterParty', {id: 'lyra', party: north, revealed: false});
  await r.act(gm, 'characterParty', {id: 'dorian', party: north, revealed: false});
  await r.act(gm, 'characterParty', {id: 'mira', party: south, revealed: false});

  // Lyra não pode sussurrar para rival Mira
  assert.equal((await r.act(lyra, 'chatSend', {text: 'tentativa-rival', channel: 'whisper', targetId: 'mira'})).status, 400);

  // Mensagem pública/IC de Mira (rival) e de NPC oculto
  await r.act(mira, 'chatSend', {text: 'fala-rival-mira', channel: 'public'});
  const hiddenNpc = (await (await r.act(gm, 'character', {name: 'Espião Oculto', characterType: 'npc', hidden: true})).json()).state.characters.at(-1);
  await r.act(gm, 'chatSend', {text: 'fala-espiao-id', channel: 'ic', speakerCharacterId: hiddenNpc.id});
  await r.act(gm, 'chatSend', {text: 'fala-espiao-nome', channel: 'ic', speaker: 'espião oculto'});
  await r.act(gm, 'chatSend', {text: 'aviso-geral-mesa', channel: 'public'});

  const row = r.rows.get(r.created.id);

  // Verifica visão de Lyra (view, sync e sceneView)
  for (const snap of [await r.view(lyra), await r.sync(lyra), sceneView(row, accessFor(row, lyra))]) {
    const texts = snap.state.messages.map(m => m.text);
    assert.deepEqual(texts, ['aviso-geral-mesa', 'segredo-lyra-dorian', 'segredo-lyra-mestre']);
    const raw = JSON.stringify(snap);
    for (const forbidden of ['segredo-mestre-dorian', 'fala-rival-mira', 'fala-espiao-id', 'fala-espiao-nome']) {
      assert.equal(raw.includes(forbidden), false, forbidden);
    }
  }

  // Verifica visão de Dorian
  const dorianTexts = (await r.view(dorian)).state.messages.map(m => m.text);
  assert.deepEqual(dorianTexts, ['aviso-geral-mesa', 'segredo-lyra-dorian', 'segredo-mestre-dorian']);

  // Verifica visão de Mira (rival: não vê sussurros alheios nem grupo Norte, vê própria fala e aviso geral do Mestre)
  const miraSyncBefore = await r.sync(mira);
  assert.deepEqual(miraSyncBefore.state.messages.map(m => m.text), ['aviso-geral-mesa', 'fala-rival-mira']);

  // Sussurro adicional entre Lyra e Dorian NÃO altera messageVersion de Mira em /sync
  await r.act(lyra, 'chatSend', {text: 'outro-sussurro-norte', channel: 'whisper', targetId: 'dorian'});
  const miraSyncUnchanged = await r.sync(mira, '?messageVersion=' + encodeURIComponent(miraSyncBefore.messageVersion));
  assert.equal(miraSyncUnchanged.messageVersion, miraSyncBefore.messageVersion);
  assert.equal(miraSyncUnchanged.state.messages, undefined);

  // Verifica visão de Guest: apenas aviso público geral sem fichas ocultas/grupos
  const guestTexts = (await r.view(r.created.invite)).state.messages.map(m => m.text);
  assert.deepEqual(guestTexts, ['aviso-geral-mesa']);

  // Mestre vê tudo
  assert.equal((await r.view(gm)).state.messages.length, 8);
});

test('retenção limita 60 mensagens públicas/ic e 40 sussurros independentemente e backup valida/limpa mensagens', async () => {
  const r = await createRoom();
  const gm = r.created.key;
  const lyra = await r.join('a', 'lyra');

  for (let i = 0; i < 65; i++) {
    await r.act(gm, 'chatSend', {text: 'pub-' + i, channel: i % 2 ? 'ic' : 'public'});
  }
  for (let i = 0; i < 45; i++) {
    await r.act(lyra, 'chatSend', {text: 'whisp-' + i, channel: 'whisper', targetId: 'gm'});
  }
  const all = (await r.view(gm)).state.messages;
  const shared = all.filter(m => m.channel !== 'whisper');
  const whispers = all.filter(m => m.channel === 'whisper');
  assert.equal(shared.length, chatRetention.shared); // 60
  assert.equal(whispers.length, chatRetention.whisper); // 40
  assert.equal(shared[0].text, 'pub-64');
  assert.equal(whispers[0].text, 'whisp-44');

  // Backup exporta limpando mensagens efêmeras e rejeita mensagens corrompidas na importação
  const backupRes = await r.call(r.base + '/backup', 'GET', gm);
  assert.equal(backupRes.status, 200);
  const bytes = new Uint8Array(await backupRes.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes).includes('whisp-44'), false);

  const imported = await r.call('/import', 'POST', null, bytes);
  assert.equal(imported.status, 201);
  const copy = await imported.json();
  assert.deepEqual(copy.state.messages, []);

  // Reescreve cabeçalho do backup com mensagem malformada -> deve recusar com 400
  const magicLen = new TextEncoder().encode('FORJA-BACKUP/1\n').length;
  const headerLen = Number(new TextDecoder().decode(bytes.slice(magicLen, magicLen + 9)));
  const start = magicLen + 9;
  const bundle = JSON.parse(new TextDecoder().decode(bytes.slice(start, start + headerLen)));
  bundle.state.messages = [{id: '1', channel: 'hack', fromRole: 'master', actor: 'X', text: 'Y', at: Date.now()}];
  const badHeader = new TextEncoder().encode(JSON.stringify(bundle));
  const badDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', badHeader));
  const badArchive = new Uint8Array(await new Blob([
    bytes.slice(0, magicLen),
    new TextEncoder().encode(String(badHeader.length).padStart(8, '0') + '\n'),
    badHeader,
    badDigest,
    bytes.slice(start + headerLen + 32)
  ]).arrayBuffer());
  assert.equal((await r.call('/import', 'POST', null, badArchive)).status, 400);
});

test('feed unificado filtra Tudo/Rolagens/Mensagens, exibe badges em português e escapa XSS', () => {
  const row = {
    id: 'room-1',
    master: false,
    characterId: 'lyra',
    needsCharacter: false,
    rev: 3,
    state: {
      characters: [{id: 'lyra', name: 'Lyra'}, {id: 'dorian', name: 'Dorian'}],
      rolls: [{
        id: 'r1',
        at: 2000,
        actor: 'Lyra',
        label: 'Percepção',
        formula: '1d20+2',
        total: 17,
        modifier: 2,
        visibility: 'public',
        rolledBy: 'player',
        groups: [{faces: 20, sign: 1, dice: [15]}]
      }],
      messages: [
        {id: 'm-xss', at: 3000, channel: 'ic', fromRole: 'player', senderCharacterId: 'lyra', actor: '<img src=x onerror=alert(1)>', text: '<script>alert("xss")</script>'},
        {id: 'm-whisp', at: 1000, channel: 'whisper', fromRole: 'player', senderCharacterId: 'lyra', targetCharacterId: 'dorian', targetName: 'Dorian <B>', actor: 'Lyra', text: 'Cuidado na porta'},
        {id: 'm-other-whisp', at: 4000, channel: 'whisper', fromRole: 'master', targetCharacterId: 'dorian', targetName: 'Dorian', actor: 'Mestre', text: 'Segredo alheio'}
      ]
    }
  };

  const allHtml = renderRollHistory(row, {filter: 'all'});
  assert.ok(allHtml.includes('Tudo'));
  assert.ok(allHtml.includes('Rolagens'));
  assert.ok(allHtml.includes('Mensagens'));
  assert.ok(allHtml.includes('Em personagem'));
  assert.ok(allHtml.includes('Sussurro · para Dorian &lt;B&gt;'));
  assert.ok(allHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  assert.ok(allHtml.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.equal(allHtml.includes('<script>'), false);
  assert.equal(allHtml.includes('<img src=x'), false);
  assert.equal(allHtml.includes('Segredo alheio'), false);
  // Ordem por timestamp decrescente: m-xss (3000) antes de r1 (2000) antes de m-whisp (1000)
  assert.ok(allHtml.indexOf('data-message-id="m-xss"') < allHtml.indexOf('data-roll-id="r1"'));
  assert.ok(allHtml.indexOf('data-roll-id="r1"') < allHtml.indexOf('data-message-id="m-whisp"'));

  const onlyRolls = renderRollHistory(row, {filter: 'rolls'});
  assert.ok(onlyRolls.includes('data-roll-id="r1"'));
  assert.equal(onlyRolls.includes('data-message-id='), false);

  const onlyMessages = renderRollHistory(row, {filter: 'messages'});
  assert.ok(onlyMessages.includes('data-message-id="m-xss"'));
  assert.equal(onlyMessages.includes('data-roll-id="r1"'), false);
});
