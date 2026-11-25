import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newCampaign} from '../model.mjs';

const tableSource = await readFile(new URL('../public/table.mjs', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');

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

test('P1-2: Mesa Virtual expõe Consulta rápida e chama quickInspect no botão e no duplo clique em token de personagem', () => {
  const state = newCampaign('Mesa Gaveta', true);
  const row = {
    id: 'camp-1',
    rev: 1,
    master: false,
    characterId: 'lyra',
    state: {
      ...state,
      characters: [
        {...state.characters[0], access: 'full'},
        {id: 'dorian', name: 'Dorian', concept: 'Guardião', color: 'amber', characterType: 'player', access: 'summary'}
      ]
    }
  };
  const openedFull = [];
  const openedQuick = [];
  const tabletop = createTabletop({
    action: async () => {},
    openCharacter: id => openedFull.push(id),
    quickInspect: id => openedQuick.push(id),
    report() {},
    requestAsset: async () => new Response('')
  });

  // Render inicial + clique em token aliado (access: 'summary') deve oferecer Consulta rápida mas não Abrir ficha
  const html = tabletop.render(row);
  assert.ok(html.includes('vtt-stage'));

  const listeners = new Map();
  const makeNode = (dataset = {}) => ({
    dataset,
    closest: sel => {
      if (sel === '[data-table-quick-character]' && dataset.tableQuickCharacter) return {dataset};
      if (sel === '[data-table-token]' && dataset.tableToken) return {dataset};
      return null;
    }
  });
  const selectionBox = {innerHTML: ''};
  const viewportListeners = new Map();
  const viewport = {
    clientWidth: 800,
    clientHeight: 600,
    dataset: {},
    addEventListener: (type, fn) => viewportListeners.set(type, fn),
    getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}),
    querySelectorAll: () => []
  };
  const root = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    querySelector: sel => {
      if (sel === '.vtt-viewport') return viewport;
      if (sel === '.vtt-world') return {style: {setProperty() {}}, classList: {toggle() {}}, getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600})};
      if (sel === '[data-table-selection]') return selectionBox;
      if (sel === '.vtt-map') return {style: {}};
      if (sel === '.vtt-connection' || sel === '[data-table-connection]') return {textContent: '', dataset: {}};
      return null;
    },
    querySelectorAll: () => []
  };
  tabletop.mount(root, row);

  // Clique em botão Consulta rápida dispara quickInspect sem chamar openCharacter
  listeners.get('click')({target: makeNode({tableQuickCharacter: 'dorian'})});
  assert.deepEqual(openedQuick, ['dorian']);
  assert.deepEqual(openedFull, []);

  // Duplo clique em token de personagem dispara quickInspect
  let prevented = false;
  viewportListeners.get('dblclick')({
    target: makeNode({tableToken: 'lyra'}),
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.deepEqual(openedQuick, ['dorian', 'lyra']);
  assert.deepEqual(openedFull, []);
});

test('P1-2, P1-5 e P2-6: app.mjs implementa gaveta rápida sem desmontar VTT, rascunho persistente com beforeunload e CTA de convite na home', () => {
  assert.ok(appSource.includes('function openQuickDrawer('));
  assert.ok(appSource.includes('quickInspect:id=>openQuickDrawer(id,\'summary\')'));
  assert.ok(appSource.includes('Visualização pública do aliado'));
  assert.ok(appSource.includes('function readGmNoteDraft('));
  assert.ok(appSource.includes('function writeGmNoteDraft('));
  assert.ok(appSource.includes('function clearGmNoteDraft('));
  assert.ok(appSource.includes("addEventListener?.('beforeunload'"));
  assert.ok(appSource.includes("button('Convidar jogadores','invite','','invite')"));
});
