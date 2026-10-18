import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync}from'node:sqlite';import worker from '../dist/server/index.js';
const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(q){const stmt=sql.prepare(q);let values=[];return {bind(...v){values=v;return this},async all(){return {results:stmt.all(...values)}},async first(){return stmt.get(...values)||null},run(){return {meta:{changes:Number(stmt.run(...values).changes)}}}}},async batch(items){sql.exec('BEGIN');try{const r=items.map(i=>i.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
let objectReads=0;const blobs=new Map(),BUCKET={async put(k,b){blobs.set(k,new Uint8Array(b))},async get(k){objectReads++;const bytes=blobs.get(k);return bytes?{body:bytes,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null},async delete(k){blobs.delete(k)}};
const env={DB,BUCKET,AI_CONFIG_KEY:Buffer.alloc(32,4).toString('base64')},origin='https://test.local';let cookie='';
async function call(path,body,method=body===undefined?'GET':'POST',as=cookie){return worker.fetch(new Request(origin+path,{method,headers:{origin,cookie:as},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),env,{waitUntil(){}})}
async function ok(path,body,method,as){const r=await call(path,body,method,as);const data=await r.json();assert(r.ok,JSON.stringify({path,status:r.status,data}));return data}
async function register(email){const r=await call('/api/auth/register',{email,name:'测试',password:'isolated-pro-test-password'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
cookie=await register('pro@example.com');const otherCookie=await register('other@example.com');const user=(await ok('/api/auth/me')).user;
const jpg=new Uint8Array([255,216,255,224,0,0]),png=fs.readFileSync('public/icon-192.png');
async function upload(name='主图',parent){const f=new FormData();f.set('file',new File([png],name+'.png',{type:'image/png'}));f.set('preview',new File([jpg],'preview.jpg',{type:'image/jpeg'}));f.set('thumbnail',new File([jpg],'thumbnail.jpg',{type:'image/jpeg'}));f.set('name',name);f.set('namingMode','custom');f.set('groupingMode','manual');f.set('projectNames','["测试集"]');f.set('allowDuplicate','1');if(parent)f.set('relatedAssetIdentity',parent.identity);return (await ok('/api/assets',f)).role}
const detail=async r=>(await ok('/api/assets/detail?identity='+r.identity)).role;
let main=await upload(),second=await upload('第二张'),child=await upload('集合',main);

const conditional=(path,etag,as=cookie)=>worker.fetch(new Request(origin+path,{headers:{origin,cookie:as,'If-None-Match':etag}}),env,{waitUntil(){}});
let response=await call(main.imageUrl);assert.equal(response.status,200);const etag=response.headers.get('etag');assert(etag);assert.equal(response.headers.get('cache-control'),'private, no-cache');
let reads=objectReads;response=await conditional(main.imageUrl,etag);assert.equal(response.status,304);assert.equal(objectReads,reads);assert.equal((await response.arrayBuffer()).byteLength,0);
assert.equal((await conditional(main.imageUrl,etag,otherCookie)).status,404);assert.equal((await conditional(main.imageUrl,etag,'')).status,401);
assert.equal((await call(main.downloadUrl)).headers.get('cache-control'),'no-store');
const thumbResponse=await call(main.thumbnailUrl);assert.equal(thumbResponse.status,200);assert.notEqual(thumbResponse.headers.get('etag'),etag);
const oldUrl=main.imageUrl;sql.prepare('UPDATE atlas_assets SET revision=revision+1 WHERE id=?').run(main.identity);main=await detail(main);assert.notEqual(main.imageUrl,oldUrl);assert.equal((await conditional(main.imageUrl,etag)).status,200);
const row=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(main.identity);assert(blobs.has(row.preview_key+'.thumb'));
// A large model result stays in detail, not list rows or collection siblings.
const evidence='evidence '.repeat(9000);sql.prepare("UPDATE atlas_assets SET body=json_set(body,'$.analysisResult',?,'$.generationPrompt',?)").run(evidence,'prompt-test');
const full=await ok('/api/library?view=all&size=100'),light=await ok('/api/library?view=library&size=100&extras=0');assert(!('labels' in light));assert(!('projects' in light));assert(!('drafts' in light));assert(light.roles.every(r=>!('analysisResult' in r)&&!('generationPrompt' in r)));assert((await detail(main)).analysisResult===evidence);
const relatives=(await ok('/api/assets/detail?identity='+main.identity)).relatives;assert(relatives.every(r=>!r.analysisResult&&!r.generationPrompt));
const fullBytes=Buffer.byteLength(JSON.stringify(full)),lightBytes=Buffer.byteLength(JSON.stringify(light));assert(lightBytes<fullBytes/5);console.log('Fixture response bytes:',fullBytes,'->',lightBytes);
const copied=(await ok('/api/assets/copy-to-collection',{mainIdentity:main.identity,mainRevision:main.revision,identity:second.identity,revision:second.revision})).role;
const copiedRow=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(copied.identity);assert(blobs.has(copiedRow.preview_key+'.thumb'));assert.notEqual(copiedRow.preview_key,row.preview_key);
await ok('/api/assets/delete',{collectionOnly:true,items:[{identity:copied.identity,revision:copied.revision}]});const deletedRow=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(copied.identity);await ok('/api/assets/purge',{items:[{identity:copied.identity,revision:deletedRow.revision}]});assert(!blobs.has(copiedRow.preview_key+'.thumb'));assert(blobs.has(row.preview_key+'.thumb'));
blobs.delete(row.preview_key);const repair=new FormData();repair.set('identity',main.identity);repair.set('revision',String(main.revision));repair.set('preview',new File([jpg],'preview.jpg',{type:'image/jpeg'}));main=(await ok('/api/assets/repair-preview',repair)).role;assert(!blobs.has(row.preview_key+'.thumb'));assert.equal(main.thumbnailUrl,main.imageUrl);assert.equal((await conditional(main.imageUrl,etag)).status,200);
const logout=await call('/api/auth/logout',{});assert.equal(logout.headers.get('clear-site-data'),'"cache"');assert.equal((await conditional(main.imageUrl,etag)).status,401);
sql.close();console.log('PASS: authenticated 304 without object reads; account isolation and logout; version invalidation; thumbnail copy/purge/repair; compact list and collection responses.');
