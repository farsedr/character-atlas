import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createLocalRuntime} from '../desktop/local-runtime.mjs';

const origin = 'https://atlas.test';
const png = await readFile(new URL('../public/icon-192.png', import.meta.url));
const vocabulary = JSON.parse(await readFile(new URL('../skills/image-analysis-taxonomy/taxonomy.json', import.meta.url)));
const directory = await mkdtemp(path.join(tmpdir(), 'atlas-backup-fidelity-'));
let runtime, cookie = '';

async function call(route, body) {
  return runtime.fetch(new Request(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {origin, cookie},
    body: body instanceof FormData ? body : JSON.stringify(body)
  }));
}

async function ok(route, body) {
  const response = await call(route, body);
  const data = await response.json();
  assert.ok(response.ok, route + ' ' + JSON.stringify(data));
  return data;
}

async function register(email) {
  const response = await call('/api/auth/register', {name:'测试', email, password:'isolated-fidelity-tests'});
  assert.equal(response.status, 200);
  cookie = response.headers.get('set-cookie').split(';')[0];
}

async function upload(name, parent) {
  const form = new FormData();
  form.set('file', new File([png], name + '.png', {type:'image/png'}));
  form.set('preview', new File([Uint8Array.from([255,216,255,224])], 'preview.jpg', {type:'image/jpeg'}));
  form.set('name', name);
  form.set('namingMode', 'custom');
  form.set('groupingMode', 'manual');
  form.set('tags', JSON.stringify([{dimension:'style', name:'手工风格'}]));
  form.set('allowDuplicate', '1');
  if (parent) form.set('relatedAssetIdentity', parent.identity);
  return (await ok('/api/assets', form)).role;
}

const ref = role => ({identity:role.identity, revision:role.revision});
async function analyze(role, material) {
  const dimensions = Object.fromEntries(vocabulary.dimensions.map(({id}) =>
    [id, {primary:'unknown', secondary:[], confidence:0, evidence:[], uncertain:true}]));
  dimensions.material = {primary:material, secondary:[], confidence:.9, evidence:['表面光泽'], uncertain:false};
  const result = {taxonomy_version:'1.0.0', summary:'材料测试', shortName:'样本', dimensions,
    analysis_quality:{confidence_overall:.9, visible_evidence:[], uncertain_points:[], conflicting_tags:[], missing_dimensions:[], proposed_tags:[]}};
  return (await ok('/api/assets/' + role.id + '/analysis-result?v=' + role.identity, {...ref(role), result})).role;
}

try {
  runtime = await createLocalRuntime({dataDirectory:directory, workerURL:new URL('../dist/server/index.js', import.meta.url),
    migrationsDirectory:fileURLToPath(new URL('../drizzle/', import.meta.url)), key:Buffer.alloc(32, 7).toString('base64')});
  await register('source@example.com');
  const main = await analyze(await upload('主图'), '金属');
  const grouped = await upload('随组删除', main);
  const separate = await upload('单独删除', main);
  await ok('/api/assets/delete', {items:[ref(separate)], collectionOnly:true});
  await ok('/api/assets/delete', {items:[ref(main)]});
  const exported = await call('/api/library/backup');
  assert.equal(exported.status, 200);
  const records = (await exported.text()).trim().split('\n').map(JSON.parse);
  assert.equal(records.at(-1).count, 3);

  await register('target@example.com');
  const batch = 'fidelity-roundtrip';
  for (const record of records.slice(1, -1)) await ok('/api/library/backup', {action:'record', batch, record});
  await ok('/api/library/backup', {action:'finish', batch, count:3, metadata:records[0]});
  const recycle = (await ok('/api/library?view=recycle')).recycle;
  const importedMain = recycle.find(item => item.name === main.name);
  assert.notEqual(importedMain.identity, main.identity);
  await ok('/api/assets/restore', ref(importedMain));
  const library = await ok('/api/library?view=all');
  assert.deepEqual(library.collections.map(child => [child.name, child.relatedAssetIdentity]), [[grouped.name, importedMain.identity]]);
  assert.deepEqual(library.recycle.map(child => child.name), [separate.name]);
  await ok('/api/assets/restore', ref(library.recycle[0]));
  assert.equal((await ok('/api/library?view=all')).collections.length, 2);

  const restored = (await ok('/api/assets/detail?identity=' + importedMain.identity)).role;
  assert.deepEqual(restored.tags, main.tags);
  assert.equal(restored.tags.find(tag => tag.name === '金属').confidence, .9);
  const updated = await analyze(restored, '丝绸');
  assert.ok(updated.tags.some(tag => tag.name === '手工风格' && tag.source === 'manual'));
  assert.ok(updated.tags.some(tag => tag.name === '丝绸' && tag.source === 'ai'));
  assert.ok(!updated.tags.some(tag => tag.name === '金属'));
  console.log('PASS: restored collection trash membership, AI tag metadata and reanalysis after import.');
} finally {
  await runtime?.close();
  if (path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith('atlas-backup-fidelity-')) {
    await rm(directory, {recursive:true, force:true});
  }
}
