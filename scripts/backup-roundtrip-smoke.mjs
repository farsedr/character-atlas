import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync}from'node:sqlite';import worker from '../dist/server/index.js';
const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(q){const stmt=sql.prepare(q);let values=[];return {bind(...v){values=v;return this},async all(){return {results:stmt.all(...values)}},async first(){return stmt.get(...values)||null},run(){return {meta:{changes:Number(stmt.run(...values).changes)}}}}},async batch(items){sql.exec('BEGIN');try{const r=items.map(i=>i.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const blobs=new Map(),BUCKET={async put(k,b){blobs.set(k,new Uint8Array(b))},async get(k){const bytes=blobs.get(k);return bytes?{body:bytes,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null},async delete(k){blobs.delete(k)}};
const env={DB,BUCKET,AI_CONFIG_KEY:Buffer.alloc(32,4).toString('base64')},origin='https://test.local';let cookie='';
async function call(path,body,method=body===undefined?'GET':'POST',as=cookie){return worker.fetch(new Request(origin+path,{method,headers:{origin,cookie:as},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),env,{waitUntil(){}})}
async function ok(path,body,method,as){const r=await call(path,body,method,as);const data=await r.json();assert(r.ok,JSON.stringify({path,status:r.status,data}));return data}
async function register(email){const r=await call('/api/auth/register',{email,name:'测试',password:'isolated-pro-test-password'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
cookie=await register('pro@example.com');const otherCookie=await register('other@example.com');const user=(await ok('/api/auth/me')).user;
const jpg=new Uint8Array([255,216,255,224,0,0]),png=fs.readFileSync('public/icon-192.png');
async function upload(name='主图',parent,mode='custom'){const f=new FormData();f.set('file',new File([png],name+'.png',{type:'image/png'}));f.set('preview',new File([jpg],'preview.jpg',{type:'image/jpeg'}));f.set('name',name);f.set('namingMode',mode);f.set('groupingMode','manual');f.set('projectNames','["测试集"]');f.set('allowDuplicate','1');if(parent)f.set('relatedAssetIdentity',parent.identity);return (await ok('/api/assets',f)).role}
const detail=async r=>(await ok('/api/assets/detail?identity='+r.identity)).role;
let main=await upload(),second=await upload('第二张'),child=await upload('集合',main);

const route=r=>'/api/assets/'+r.id+'?v='+r.identity,ref=r=>({identity:r.identity,revision:r.revision});

const exported=await call('/api/library/backup');const records=(await exported.text()).trim().split('\n').map(JSON.parse);assert.equal(records[0].version,1);assert.equal(records.at(-1).count,3);
const batch='roundtrip-backup';cookie=otherCookie;
for(const record of records.slice(1,-1))await ok('/api/library/backup',{action:'record',batch,record});
assert.equal((await ok('/api/library?view=library')).roles.length,0);assert.equal((await ok('/api/library?view=recycle')).recycle.length,0);
assert.equal((await call('/api/library/backup',{action:'finish',batch,count:4})).status,400);
const done=await ok('/api/library/backup',{action:'finish',batch,count:3,metadata:records[0]});assert.equal(done.imported,3);
const library=await ok('/api/library?view=all');assert.equal(library.roles.length,2);assert.equal(library.collections.length,1);const restored=library.collections[0];assert(library.roles.some(r=>r.identity===restored.relatedAssetIdentity));assert.equal(restored.name,child.name);
const r=await call(restored.downloadUrl);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array(png));
assert.equal((await call('/api/library/backup',{action:'record',batch:'corrupt-backup',record:{...records[1],checksum:'wrong'}})).status,400);
const row=sql.prepare('SELECT * FROM atlas_assets WHERE owner_id=? LIMIT 1').get((await ok('/api/auth/me')).user.id),roleBody=JSON.parse(row.body);roleBody.uploadBatch='retry-post-save';roleBody.relatedAssetIdentity='';roleBody.tags=[{dimension:'style',name:'登记恢复测试',source:'manual'}];sql.prepare('UPDATE atlas_assets SET body=? WHERE id=?').run(JSON.stringify(roleBody),row.id);
sql.exec("CREATE TEMP TRIGGER fail_labels BEFORE INSERT ON atlas_labels BEGIN SELECT RAISE(ABORT,'injected label failure'); END;");const failed=await ok('/api/upload-batches',{batch:'retry-post-save',action:'save',mode:'collection'});assert(failed.backupError);assert.equal((await ok('/api/library/post-save')).pending.length,1);sql.exec('DROP TRIGGER fail_labels');const retried=await ok('/api/upload-batches',{batch:'retry-post-save',action:'save',mode:'collection'});assert.equal(retried.backupError,'');assert.equal((await ok('/api/library/post-save')).pending.length,0);
console.log('PASS: full backup roundtrip across accounts, files, names, relationships, staged invisibility, count and checksum rejection.');sql.close();
