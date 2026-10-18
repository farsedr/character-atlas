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
assert.equal(child.name,'集合');assert.notEqual(main.name,child.name);
child=(await ok(route(child),{...child,name:'独立子图',analysisLocks:['name']},'PATCH')).role;assert.equal((await detail(child)).name,'独立子图');
main=(await ok(route(main),{...main,name:'主图改名'},'PATCH')).role;child=await detail(child);assert.equal(child.name,'独立子图');assert.deepEqual(child.projectNames,main.projectNames);
const vocab=JSON.parse(fs.readFileSync('skills/image-analysis-taxonomy/taxonomy.json','utf8'));
const result={taxonomy_version:'1.0.0',shortName:'月下倩影',imagePrompt:'人物位于月光下',summary:'独立分析的图片',collectionNames:['其他分类'],dimensions:Object.fromEntries(vocab.dimensions.map(d=>[d.id,{primary:'unknown',secondary:[],confidence:0,evidence:['证据不足'],uncertain:true}])),analysis_quality:{confidence_overall:.7,visible_evidence:[],uncertain_points:[],conflicting_tags:[],missing_dimensions:[],proposed_tags:[]}};
const analyze=async r=>(await ok('/api/assets/'+r.id+'/analysis-result?v='+r.identity,{...ref(r),result,model:'gpt-6-luna',reasoning:'low'})).role;
child=await analyze(child);assert.equal(child.name,'独立子图');
let ai=await upload('待分析子图',main,'ai');ai=await analyze(ai);assert.equal(ai.name,'月下倩影');assert.deepEqual(ai.projectNames,main.projectNames);
const copied=(await ok('/api/assets/copy-to-collection',{mainIdentity:main.identity,mainRevision:main.revision,...ref(second)})).role;assert.equal(copied.name,second.name);
const oldNumber=main.id,oldMainIdentity=main.identity;const promoted=await ok('/api/assets/promote',{mainIdentity:main.identity,mainRevision:main.revision,...ref(ai),deletePrevious:false});assert.equal(promoted.role.name,'月下倩影');assert.equal(promoted.role.id,oldNumber);assert.equal((await detail({identity:oldMainIdentity})).name,'主图改名');assert.equal((await detail(child)).name,'独立子图');
const now=promoted.role;const replace=await ok('/api/assets/promote',{mainIdentity:now.identity,mainRevision:now.revision,...ref(await detail(child)),deletePrevious:true});assert.equal(replace.role.name,'独立子图');assert.equal(replace.role.id,oldNumber);assert.equal((await detail(second)).name,'第二张');
const download=await call(replace.role.downloadUrl);assert(decodeURIComponent(download.headers.get('content-disposition')).includes('独立子图.png'));
sql.close();console.log('PASS: independent child upload/edit/name lock/AI name; parent rename isolation; copy preserves name; promotion and deletion replacement preserve individual names and display number.');
