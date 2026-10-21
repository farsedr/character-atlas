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

// Renaming the main image cannot invalidate an in-flight child analysis result.
const before=await detail(child);main=(await ok(route(main),{...main,name:'主图重命名',description:'只改描述'},'PATCH')).role;
assert.equal((await detail(child)).revision,before.revision);assert.equal((await detail(child)).imageUrl,before.imageUrl);
const vocab=JSON.parse(fs.readFileSync('skills/image-analysis-taxonomy/taxonomy.json','utf8'));
const result={taxonomy_version:'1.0.0',shortName:'月影',imagePrompt:'图片描述',summary:'独立图片',collectionNames:[],dimensions:Object.fromEntries(vocab.dimensions.map(d=>[d.id,{primary:'unknown',secondary:[],confidence:0,evidence:['证据不足'],uncertain:true}])),analysis_quality:{confidence_overall:0,visible_evidence:[],uncertain_points:[],conflicting_tags:[],missing_dimensions:[],proposed_tags:[]}};
await ok('/api/assets/'+child.id+'/analysis-result?v='+child.identity,{...ref(before),result,model:'gpt-6-luna'});
main=(await ok(route(main),{...main,projectNames:['新的灵感集']},'PATCH')).role;
assert.deepEqual((await detail(child)).projectNames,['新的灵感集']);
const template=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(child.identity),body=JSON.parse(template.body);
for(let i=0;i<131;i++)sql.prepare('INSERT INTO atlas_assets(id,body,original_key,preview_key,mime,filename,size,revision,created_at,owner_id,display_number,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?)').run('paged-'+String(i).padStart(4,'0'),JSON.stringify({...body,name:'分页'+i,relatedAssetIdentity:main.identity,uploadDraft:i>=28,uploadBatch:'paged-batch'}),template.original_key,template.preview_key,template.mime,template.filename,template.size,1,template.created_at,template.owner_id,null);
let cursor='',seen=new Set(),pages=0;do{const page=await ok('/api/assets/detail?identity='+main.identity+'&cursor='+cursor);assert(page.relatives.length<=25);assert(page.relatives.some(r=>r.identity===main.identity));for(const r of page.relatives.filter(r=>r.identity!==main.identity)){assert(!seen.has(r.identity));seen.add(r.identity)}cursor=page.collectionPage.nextCursor||'';pages++}while(cursor);assert.equal(seen.size,132);assert(pages>1);
const initial=await ok('/api/library?view=library');assert.equal(initial.drafts.length,100);assert(initial.draftCursor);
const remaining=await ok('/api/drafts?cursor='+initial.draftCursor);assert.equal(remaining.drafts.length,3);assert.equal(remaining.nextCursor,null);
assert.equal((await ok('/api/drafts?batch=paged-batch',undefined,undefined,otherCookie)).drafts.length,0);
sql.prepare("UPDATE atlas_assets SET deleted_at='2026-10-21' WHERE id LIKE 'paged-%'").run();
let recycled=new Set();for(let page=1;page<=7;page++){const r=await ok('/api/library?view=recycle&extras=0&size=20&page='+page);assert.equal(r.pagination.total,131);assert(r.recycle.length<=20);for(const row of r.recycle){assert(!recycled.has(row.identity));recycled.add(row.identity)}}assert.equal(recycled.size,131);
const last=await ok('/api/library?view=recycle&extras=0&size=20&page=999');assert.equal(last.pagination.page,7);
assert.equal((await ok('/api/library?view=recycle',undefined,undefined,otherCookie)).recycle.length,0);
sql.close();console.log('PASS: parent metadata preserves child analysis revisions/cache; group inheritance; bounded complete collection/draft/recycle pagination and owner isolation.');
