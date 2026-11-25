import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  staticFiles,
  staticContentType,
  sharedServerModules,
  localServerOnlyModules,
  linuxBundleModules
} from '../manifest.mjs';

const rootDir = fileURLToPath(new URL('../', import.meta.url));

async function listFilesRecursive(dir, prefix = '') {
  const entries = await readdir(dir, {withFileTypes:true});
  const results = [];
  for (const entry of entries) {
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) results.push(...await listFilesRecursive(join(dir, entry.name), rel));
    else if (entry.isFile()) results.push(rel);
  }
  return results.sort();
}

function extractRelativeImports(code) {
  const specs = new Set();
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)\s*['"](\.[^'"]+)['"]/g)) specs.add(match[1]);
  for (const match of code.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) specs.add(match[1]);
  return [...specs];
}

test('manifesto é imutável e usa nomes seguros para scripts POSIX', () => {
  assert.equal(Object.isFrozen(staticFiles), true);
  assert.equal(Object.isFrozen(sharedServerModules), true);
  assert.equal(Object.isFrozen(localServerOnlyModules), true);
  assert.equal(Object.isFrozen(linuxBundleModules), true);
  for (const mod of linuxBundleModules) {
    assert.match(mod, /^[a-z0-9-]+\.mjs$/, 'Nome inválido em linuxBundleModules: ' + mod);
  }
  assert.equal(new Set(sharedServerModules).size, sharedServerModules.length);
  assert.equal(new Set(localServerOnlyModules).size, localServerOnlyModules.length);
  assert.equal(new Set(linuxBundleModules).size, linuxBundleModules.length);
  for (const mod of [...sharedServerModules, ...localServerOnlyModules]) {
    assert.ok(linuxBundleModules.includes(mod), 'Ausente em linuxBundleModules: ' + mod);
  }
});

test('todos os arquivos de public/ estão mapeados em staticFiles sem órfãos', async () => {
  const diskPublic = (await listFilesRecursive(join(rootDir, 'public'))).map(file => 'public/' + file);
  const mappedPublic = Object.values(staticFiles).filter(file => file.startsWith('public/')).sort();
  assert.deepEqual(mappedPublic, diskPublic);
  for (const [route, file] of Object.entries(staticFiles)) {
    assert.ok(route.startsWith('/'), 'Rota deve iniciar com /: ' + route);
    assert.ok(staticContentType(file).length > 0);
  }
  assert.throws(() => staticContentType('arquivo.desconhecido'), /Tipo MIME desconhecido/);
});

test('todos os caminhos de staticFiles, sharedServerModules e linuxBundleModules existem em disco', async () => {
  const allPaths = new Set([
    ...Object.values(staticFiles),
    ...sharedServerModules,
    ...localServerOnlyModules,
    ...linuxBundleModules
  ]);
  for (const relPath of allPaths) {
    const info = await stat(join(rootDir, relPath)).catch(() => null);
    assert.equal(Boolean(info?.isFile()), true, 'Arquivo ausente em disco: ' + relPath);
  }
});

test('imports relativos do navegador estão cobertos em staticFiles', async () => {
  for (const [route, filePath] of Object.entries(staticFiles)) {
    if (!filePath.endsWith('.mjs')) continue;
    const code = await readFile(join(rootDir, filePath), 'utf8');
    for (const specifier of extractRelativeImports(code)) {
      const resolvedRoute = new URL(specifier, 'https://forja' + route).pathname;
      assert.equal(
        Object.hasOwn(staticFiles, resolvedRoute),
        true,
        `Import do navegador não mapeado em staticFiles: ${route} (${filePath}) -> ${specifier} (${resolvedRoute})`
      );
    }
  }
  const indexHtml = await readFile(join(rootDir, 'public/index.html'), 'utf8');
  for (const match of indexHtml.matchAll(/\b(?:href|src)="(\/[^"#?]+)"/g)) {
    assert.equal(Object.hasOwn(staticFiles, match[1]), true, 'Ativo de index.html ausente em staticFiles: ' + match[1]);
  }
});

test('imports relativos de worker.mjs + sharedServerModules e server.mjs + localServerOnlyModules estão cobertos', async () => {
  const sharedSet = new Set(sharedServerModules);
  for (const mod of ['worker.mjs', ...sharedServerModules]) {
    const code = await readFile(join(rootDir, mod), 'utf8');
    assert.equal(/\bfrom\s*['"]node:/.test(code), false, 'Módulo do Worker não deve importar node:*: ' + mod);
    for (const specifier of extractRelativeImports(code)) {
      if (mod === 'worker.mjs' && specifier === './assets.mjs') continue;
      const target = posix.normalize(posix.join(posix.dirname(mod), specifier));
      assert.equal(sharedSet.has(target), true, `Dependência ausente de sharedServerModules: ${mod} -> ${target}`);
    }
  }

  const linuxSet = new Set(linuxBundleModules);
  for (const mod of new Set(['server.mjs', ...localServerOnlyModules, ...linuxBundleModules])) {
    const code = await readFile(join(rootDir, mod), 'utf8');
    for (const specifier of extractRelativeImports(code)) {
      const target = posix.normalize(posix.join(posix.dirname(mod), specifier));
      assert.equal(linuxSet.has(target), true, `Dependência ausente de linuxBundleModules: ${mod} -> ${target}`);
    }
  }

  const linuxScript = await readFile(join(rootDir, 'scripts/build-linux.sh'), 'utf8');
  assert.match(linuxScript, /manifest\.mjs/);
  assert.match(linuxScript, /linuxBundleModules/);
});
