import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';

const sql = new DatabaseSync(':memory:');
for (const file of fs.readdirSync('drizzle').filter(name => /^000[0-7].*\.sql$/.test(name)).sort()) {
  sql.exec(fs.readFileSync('drizzle/' + file, 'utf8'));
}
const objects = new Map();
let onPut, onDelete, beforeTransaction, afterTransaction, auditRecordReads = false;
const DB = {
  prepare(query) {
    const statement = sql.prepare(query);
    let values = [];
    function checkRead() {
      if (!auditRecordReads || !/\bfrom\s+atlas_assets\b/i.test(query)) return;
      assert(!/\$\.backupPending|backup-pending/i.test(query) || /\bid\s*=\s*\?/i.test(query),
        'record must not scan the staged batch: ' + query);
    }
    return {
      bind(...params) { values = params; return this; },
      async all() { checkRead(); return {results: statement.all(...values)}; },
      async first() { checkRead(); return statement.get(...values) || null; },
      run() { return {meta: {changes: Number(statement.run(...values).changes)}}; }
    };
  },
  async batch(statements) {
    if (beforeTransaction) await beforeTransaction();
    sql.exec('BEGIN');
    let results;
    try {
      results = statements.map(statement => statement.run());
      sql.exec('COMMIT');
    } catch (error) {
      sql.exec('ROLLBACK');
      throw error;
    }
    if (afterTransaction) await afterTransaction();
    return results;
  }
};
const BUCKET = {
  async put(key, bytes) {
    if (onPut) await onPut();
    objects.set(key, Buffer.from(bytes));
  },
  async delete(key) {
    if (onDelete) await onDelete();
    objects.delete(key);
  },
  async get(key) {
    const bytes = objects.get(key);
    if (!bytes) return null;
    return {body: bytes, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer};
  }
};
const env = {DB, BUCKET, AI_CONFIG_KEY: Buffer.alloc(32, 1).toString('base64')};
const origin = 'https://test.local', endpoint = '/api/library/backup';
let cookie = '';
async function request(path, payload) {
  return worker.fetch(new Request(origin + path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: {origin, cookie, 'Content-Type': 'application/json'},
    body: payload === undefined ? undefined : JSON.stringify(payload)
  }), env, {waitUntil() {}});
}
async function ok(response) {
  response = await response;
  const data = await response.json();
  assert(response.ok, JSON.stringify({status: response.status, data}));
  return data;
}
const register = await request('/api/auth/register', {email: 'concurrency@example.com', name: 'test user', password: 'isolated-backup-test-password'});
await ok(register);
cookie = register.headers.get('set-cookie').split(';')[0];
const owner = (await ok(request('/api/auth/me'))).user.id;
const original = Buffer.from([255,216,255,55,0,255,217]), preview = Buffer.from([255,216,255,66,0,255,217]);
const meta = {projects: ['风景', '待整理'], labels: []};
function record(id, projectNames = ['风景'], parent = '') {
  const data = {
    identity: id, filename: id + '.jpg', size: original.length, mime: 'image/jpeg',
    createdAt: '2026-01-03T00:00:00Z', deletedAt: null,
    body: {name: id, projectNames, tags: [], relatedAssetIdentity: parent},
    files: [original.toString('base64'), preview.toString('base64')]
  };
  return {data, checksum: createHash('sha256').update(JSON.stringify(data)).digest('base64')};
}
const send = (batch, action, fields = {}) => request(endpoint, {action, batch, ...fields});
const stage = (batch, data) => send(batch, 'record', {record: data});
const finish = (batch, count) => send(batch, 'finish', {count, metadata: meta});
const pending = async () => (await ok(request(endpoint + '?pending=1'))).pending.map(row => row.batch);
const stateOf = batch => ok(send(batch, 'status'));
function latch() {
  const entered = Promise.withResolvers(), resumed = Promise.withResolvers();
  return {entered: entered.promise, release: resumed.resolve, pause() { entered.resolve(); return resumed.promise; }};
}
const rowByFile = filename => sql.prepare('SELECT * FROM atlas_assets WHERE owner_id=? AND filename=?').get(owner, filename);
function assertFiles(row) {
  assert(row);
  assert.deepEqual(objects.get(row.original_key), original);
  assert.deepEqual(objects.get(row.preview_key), preview);
}

// Start at the old schema with an interrupted import; the deployed migration must pick it up.
const legacyBody = {name: 'legacy', projectNames: ['风景'], tags: [], uploadDraft: true, backupPending: 'legacy-import'};
sql.prepare("INSERT INTO atlas_assets(id,owner_id,body,original_key,preview_key,mime,filename,size,revision,created_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,1,?,'backup-pending')")
  .run('legacy-row', owner, JSON.stringify(legacyBody), 'originals/legacy', 'previews/legacy', 'image/jpeg', 'legacy.jpg', original.length, '2026-01-03T00:00:00Z');
objects.set('originals/legacy', original); objects.set('previews/legacy', preview);
// The first backup request also installs the upgrade on existing hosted databases.
assert((await pending()).includes('legacy-import'));
assert.equal((await ok(finish('legacy-import', 1))).imported, 1);
assertFiles(rowByFile('legacy.jpg'));

// Cleaning wins while a finalizer is trying to commit and another item arrives.
const cleaning = 'cleanup-wins';
await ok(stage(cleaning, record('clean-me')));
assert(!(await pending()).includes(cleaning));
assert.equal((await send(cleaning, 'cancel', {onlyInactive: true})).status, 409);
sql.prepare('UPDATE atlas_backup_imports SET updated_at=? WHERE batch=? AND owner_id=?').run(Date.now()-16*60*1000, cleaning, owner);
assert((await pending()).includes(cleaning));
const deletion = latch();
onDelete = () => { onDelete = undefined; return deletion.pause(); };
const cleaningRequest = send(cleaning, 'cancel', {onlyInactive: true});
await deletion.entered;
try {
  assert.equal((await stateOf(cleaning)).state, 'cancelling');
  assert((await pending()).includes(cleaning));
  assert.equal((await finish(cleaning, 1)).status, 409);
  assert.equal((await stage(cleaning, record('too-late'))).status, 409);
} finally { deletion.release(); }
await ok(cleaningRequest);
assert.equal(rowByFile('clean-me.jpg'), undefined);
assert.equal((await stateOf(cleaning)).state, 'cancelled');
assert(!(await pending()).includes(cleaning));

// Commit wins, but the browser is still waiting for its acknowledgement when cancel arrives.
const closing = 'commit-wins';
await ok(stage(closing, record('keep-me')));
const committed = latch();
afterTransaction = () => { afterTransaction = undefined; return committed.pause(); };
const finishRequest = finish(closing, 1);
await committed.entered;
try {
  const cancellation = await ok(send(closing, 'cancel'));
  assert.equal(cancellation.state, 'completed');
  assert.equal(cancellation.imported, 1);
  assertFiles(rowByFile('keep-me.jpg'));
  assert.equal((await stage(closing, record('after-commit'))).status, 409);
} finally { committed.release(); }
assert.equal((await ok(finishRequest)).imported, 1);
assert.equal((await ok(finish(closing, 1))).imported, 1);

// File writes which started before cancellation must not recreate staged data or leave objects.
const later = 'late-file-write', beforeLate = objects.size, putting = latch();
onPut = () => { onPut = undefined; return putting.pause(); };
const lateRequest = stage(later, record('in-flight'));
await putting.entered;
try { await ok(send(later, 'cancel')); }
finally { putting.release(); }
assert.equal((await lateRequest).status, 409);
assert.equal(rowByFile('in-flight.jpg'), undefined);
assert.equal(objects.size, beforeLate);

// Race two copies of the same record; the loser must not unlink the winner's files.
const twin = 'concurrent-copy', twinRecord = record('twin'), beforeTwin = objects.size, firstPut = latch();
onPut = () => { onPut = undefined; return firstPut.pause(); };
const first = stage(twin, twinRecord);
await firstPut.entered;
try { await ok(stage(twin, twinRecord)); }
finally { firstPut.release(); }
await ok(first);
assert.equal((await ok(finish(twin, 1))).imported, 1);
assert.equal(objects.size, beforeTwin + 2);
assertFiles(rowByFile('twin.jpg'));

// Concurrent finalizers may both plan the same new project and display number.
const allocated=latch();
await ok(stage('parallel-one',record('first-parallel',['共同灵感集'])));
await ok(stage('parallel-two',record('second-parallel',['共同灵感集'])));
beforeTransaction=()=>{beforeTransaction=undefined;return allocated.pause()};
const firstFinish=finish('parallel-one',1);
await allocated.entered;
try{await ok(finish('parallel-two',1))}finally{allocated.release()}
await ok(firstFinish);
const parallelRows=['first-parallel.jpg','second-parallel.jpg'].map(rowByFile);
assert.notEqual(parallelRows[0].display_number,parallelRows[1].display_number);
assert.equal(JSON.parse(parallelRows[0].body).projectId,JSON.parse(parallelRows[1].body).projectId);

// A large collection uses small image fixtures, but exercises the full public record route.
const large = 'thousand-records', groups = ['风景','人物'];
auditRecordReads = true;
try {
  for (let i=0; i<1000; i++) await ok(stage(large, record('large-'+i, groups, i ? 'large-0' : '')));
} finally { auditRecordReads = false; }
assert.equal((await ok(finish(large, 1000))).imported, 1000);
const main = rowByFile('large-0.jpg');
assert(main.display_number > 0);
const projects = sql.prepare('SELECT id,name FROM atlas_projects WHERE owner_id=?').all(owner);
assert(projects.some(p => p.name === '待整理'));
const ids = groups.map(name => projects.find(p => p.name === name).id);
const largeRows = sql.prepare("SELECT * FROM atlas_assets WHERE owner_id=? AND filename LIKE 'large-%'").all(owner);
assert.equal(largeRows.length, 1000);
for (const row of largeRows) {
  const body = JSON.parse(row.body);
  assert.equal(row.deleted_at, null);
  assert.equal(body.uploadDraft, false);
  assert.deepEqual(body.projectNames, groups);
  assert.deepEqual(body.projectIds, ids);
  if (row.id !== main.id) { assert.equal(body.relatedAssetIdentity, main.id); assert.equal(row.display_number, null); }
  assertFiles(row);
}
assert.equal((await stateOf(large)).imported, 1000);
sql.close();
console.log('PASS: staged migration, inactive-only cleanup, cancel/finish races, delayed and duplicate records, and 1000-record collection import.');
