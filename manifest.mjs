const mediaTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
});

export function staticContentType(filePath) {
  const match = /\.[^.]+$/.exec(filePath);
  const type = match && mediaTypes[match[0]];
  if (!type) throw new Error('Tipo MIME desconhecido para ativo estático: ' + filePath);
  return type;
}

export const staticFiles = Object.freeze({
  '/': 'public/index.html',
  '/FONT-AWESOME-LICENSE.txt': 'public/FONT-AWESOME-LICENSE.txt',
  '/app.mjs': 'public/app.mjs',
  '/audio.mjs': 'public/audio.mjs',
  '/chat-model.mjs': 'chat-model.mjs',
  '/cinematic-elements.mjs': 'public/cinematic-elements.mjs',
  '/cinematic.mjs': 'public/cinematic.mjs',
  '/cover.webp': 'public/cover.webp',
  '/dice-scene.mjs': 'public/dice-scene.mjs',
  '/dnd-ui.mjs': 'public/dnd-ui.mjs',
  '/dnd.css': 'public/dnd.css',
  '/dnd.mjs': 'dnd.mjs',
  '/fog-geometry.mjs': 'fog-geometry.mjs',
  '/gm-screen.css': 'public/gm-screen.css',
  '/gm-screen.mjs': 'public/gm-screen.mjs',
  '/inventory.css': 'public/inventory.css',
  '/inventory.mjs': 'public/inventory.mjs',
  '/journal.css': 'public/journal.css',
  '/journal.mjs': 'public/journal.mjs',
  '/loot-data.mjs': 'loot-data.mjs',
  '/loot.mjs': 'public/loot.mjs',
  '/media.mjs': 'media.mjs',
  '/model.mjs': 'model.mjs',
  '/music.css': 'public/music.css',
  '/music.mjs': 'public/music.mjs',
  '/narration-style.mjs': 'narration-style.mjs',
  '/narration.mjs': 'public/narration.mjs',
  '/player-access.mjs': 'public/player-access.mjs',
  '/rolls.css': 'public/rolls.css',
  '/rolls.mjs': 'public/rolls.mjs',
  '/scene-model.mjs': 'scene-model.mjs',
  '/scenes.mjs': 'public/scenes.mjs',
  '/session-log-ui.mjs': 'public/session-log-ui.mjs',
  '/sheet-history-controller.mjs': 'public/sheet-history-controller.mjs',
  '/sheet-history.css': 'public/sheet-history.css',
  '/sheet-history.mjs': 'public/sheet-history.mjs',
  '/sheet-inline.mjs': 'public/sheet-inline.mjs',
  '/sheet-layout.mjs': 'sheet-layout.mjs',
  '/sheet-mosaic.css': 'public/sheet-mosaic.css',
  '/sheet-mosaic.mjs': 'public/sheet-mosaic.mjs',
  '/sheet-packing.mjs': 'public/sheet-packing.mjs',
  '/sheet-resources.mjs': 'public/sheet-resources.mjs',
  '/sheet-template-model.mjs': 'sheet-template-model.mjs',
  '/sheet-templates.css': 'public/sheet-templates.css',
  '/sheet-templates.mjs': 'public/sheet-templates.mjs',
  '/sound-catalog.mjs': 'sound-catalog.mjs',
  '/soundboard-model.mjs': 'soundboard-model.mjs',
  '/soundboard.css': 'public/soundboard.css',
  '/soundboard.mjs': 'public/soundboard.mjs',
  '/style.css': 'public/style.css',
  '/table-live.mjs': 'public/table-live.mjs',
  '/table-model.mjs': 'table-model.mjs',
  '/table-rolls.mjs': 'public/table-rolls.mjs',
  '/table-vision.mjs': 'public/table-vision.mjs',
  '/table.css': 'public/table.css',
  '/table.mjs': 'public/table.mjs',
  '/token-editor.mjs': 'public/token-editor.mjs',
  '/token-icons.mjs': 'token-icons.mjs',
  '/token-motion.mjs': 'token-motion.mjs',
  '/token-voice.mjs': 'public/token-voice.mjs',
  '/vault-canvas.mjs': 'public/vault-canvas.mjs',
  '/vision-model.mjs': 'vision-model.mjs'
});

export const sharedServerModules = Object.freeze([
  'access.mjs',
  'api.mjs',
  'browser-session.mjs',
  'campaign-backup.mjs',
  'chat-model.mjs',
  'dnd.mjs',
  'etag.mjs',
  'exploration-model.mjs',
  'fog-geometry.mjs',
  'gm-screen-model.mjs',
  'inventory-model.mjs',
  'item-assets.mjs',
  'journal-model.mjs',
  'loot-data.mjs',
  'loot-model.mjs',
  'manifest.mjs',
  'media.mjs',
  'model.mjs',
  'music-model.mjs',
  'narration-model.mjs',
  'narration-style.mjs',
  'player-sharing.mjs',
  'request-json.mjs',
  'scene-model.mjs',
  'session-log.mjs',
  'sheet-history.mjs',
  'sheet-layout.mjs',
  'sheet-template-model.mjs',
  'sound-catalog.mjs',
  'sound-pack-import.mjs',
  'soundboard-model.mjs',
  'storage.mjs',
  'table-model.mjs',
  'table-realtime.mjs',
  'token-icons.mjs',
  'token-motion.mjs',
  'vision-model.mjs',
  'zip-audio.mjs'
]);

export const localServerOnlyModules = Object.freeze([
  'data-backup.mjs',
  'data-directory.mjs',
  'diagnostics.mjs',
  'network.mjs',
  'server.mjs'
]);

export const linuxBundleModules = Object.freeze([
  ...new Set([...sharedServerModules, ...localServerOnlyModules])
]);
