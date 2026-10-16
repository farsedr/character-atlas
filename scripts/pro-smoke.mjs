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
async function upload(name='主图',parent){const f=new FormData();f.set('file',new File([png],name+'.png',{type:'image/png'}));f.set('preview',new File([jpg],'preview.jpg',{type:'image/jpeg'}));f.set('name',name);f.set('namingMode','custom');f.set('groupingMode','manual');f.set('projectNames','["测试集"]');f.set('allowDuplicate','1');if(parent)f.set('relatedAssetIdentity',parent.identity);return (await ok('/api/assets',f)).role}
const detail=async r=>(await ok('/api/assets/detail?identity='+r.identity)).role;
let main=await upload(),second=await upload('第二张'),child=await upload('集合',main);
const ref=r=>({identity:r.identity,revision:r.revision});
await ok('/api/assets/batch-edit',{action:'addTags',items:[ref(main),ref(second)],tags:[{dimension:'style',name:'测试风格'},{dimension:'theme',name:'测试题材'}]});main=await detail(main);second=await detail(second);assert.equal(main.tags.length,2);assert(main.tags.every(t=>t.source==='manual'));
const before=await detail(main);assert.equal((await call('/api/assets/batch-edit',{action:'removeTags',items:[ref(main),{...ref(second),revision:0}],tags:main.tags})).status,409);assert.deepEqual((await detail(main)).tags,before.tags);
assert.equal((await call('/api/assets/batch-edit',{action:'addTags',items:[ref(main)],tags:main.tags},'POST',otherCookie)).status,404);
await ok('/api/assets/batch-edit',{action:'replaceProjects',items:[ref(main)],projectNames:['新的归属']});main=await detail(main);child=await detail(child);assert.deepEqual(child.projectNames,['新的归属']);assert.equal(child.name,main.name);
await ok('/api/assets/batch-edit',{action:'removeTags',items:[ref(second)],tags:[{dimension:'style',name:'测试风格'}]});second=await detail(second);assert.equal(second.tags.length,1);
const path=r=>'/api/assets/'+r.id+'?v='+r.identity;
main=(await ok(path(main),{...main,description:'已确认描述',generationPrompt:'已确认提示词',analysisLocks:['tags','description']},'PATCH')).role;
const vocab=JSON.parse(fs.readFileSync('skills/image-analysis-taxonomy/taxonomy.json','utf8'));
const output={taxonomy_version:'1.0.0',summary:'全新的模型描述',shortName:'新图',imagePrompt:'全新的模型提示词',collectionNames:['模型分组'],dimensions:Object.fromEntries(vocab.dimensions.map(d=>[d.id,{primary:'unknown',secondary:[],confidence:0,evidence:['不可见'],uncertain:true}])),analysis_quality:{confidence_overall:.9,visible_evidence:['图像清晰'],uncertain_points:[],conflicting_tags:[],missing_dimensions:[],proposed_tags:[]}};
output.dimensions.material={primary:'金属',secondary:[],confidence:.9,evidence:['反光表面'],uncertain:false};
const source={model:'gpt-6-luna',reasoning:'low'},analysisPath=r=>'/api/assets/'+r.id+'/analysis-result?v='+r.identity;
const sizeBefore=sql.prepare('SELECT COUNT(*) n FROM atlas_projects').get().n;
let review=await ok(analysisPath(main),{...ref(main),result:output,...source,preview:true});assert.equal(review.proposal.description,'已确认描述');assert.deepEqual(review.proposal.tags,main.tags);assert.equal(review.proposal.generationPrompt,'全新的模型提示词');assert.equal((await detail(main)).generationPrompt,'已确认提示词');assert.equal((await detail(main)).revision,main.revision);assert.equal(sql.prepare('SELECT COUNT(*) n FROM atlas_projects').get().n,sizeBefore);
main=(await ok('/api/assets/analysis-apply',{...ref(main),result:review.result,source:review.source,fields:['description','generationPrompt','tags']})).role;assert.equal(main.description,'已确认描述');assert.equal(main.generationPrompt,'全新的模型提示词');assert.deepEqual(main.tags,before.tags);
assert.equal((await call('/api/assets/analysis-apply',{identity:main.identity,revision:main.revision-1,result:output,fields:['tags']})).status,409);
assert.equal((await call('/api/assets/analysis-apply',{...ref(main),result:output,fields:['bad']})).status,400);
// Locks are enforced on automatic analysis as well as review/apply.
main=(await ok(analysisPath(main),{...ref(main),result:output,...source})).role;assert.equal(main.description,'已确认描述');assert.deepEqual(main.tags,before.tags);
await ok('/api/assets/visual-index',{items:[{...ref(main),hash:'0123456789abcdef'},{...ref(second),hash:'0123456789abcdee'}]});assert.equal((await detail(main)).revision,main.revision);
assert.equal((await call('/api/assets/visual-index',{items:[{...ref(main),hash:'0123456789abcdef'}]},'POST',otherCookie)).status,404);
sql.prepare("UPDATE atlas_assets SET body=json_set(body,'$.contentHash','distinct-test-hash') WHERE id=?").run(second.identity);
const matches=await ok('/api/assets/similar?identity='+main.identity);assert(matches.matches.some(m=>m.role.identity===second.identity&&m.distance===1&&!m.exact));assert(!matches.matches.some(m=>m.role.identity===main.identity));assert.equal((await call('/api/assets/similar?identity='+main.identity,undefined,'GET',otherCookie)).status,404);
const copied=(await ok('/api/assets/copy-to-collection',{mainIdentity:main.identity,mainRevision:main.revision,...ref(second)})).role;assert.equal(copied.id,'collection');assert.equal(copied.relatedAssetIdentity,main.identity);assert.equal(copied.name,main.name);assert.deepEqual(copied.projectNames,main.projectNames);assert.equal((await detail(second)).id,second.id);
const oldRow=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(second.identity),copyRow=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(copied.identity);assert.notEqual(oldRow.original_key,copyRow.original_key);assert(blobs.has(copyRow.original_key));
await ok('/api/assets/delete',{collectionOnly:true,items:[ref(copied)]});assert((await detail(main)).identity);assert(blobs.has(oldRow.original_key));
const summary=await ok('/api/library/health');assert(summary.summary.some(s=>s.category==='recycle'));assert(summary.summary.every(s=>s.originalBytes>=0));
const mainRow=sql.prepare('SELECT * FROM atlas_assets WHERE id=?').get(main.identity);blobs.delete(mainRow.preview_key);const health=await ok('/api/library/health?scan=1');assert(health.issues.some(i=>i.role.identity===main.identity&&i.problems.includes('预览丢失')));assert(!health.issues.some(i=>i.role.identity===main.identity&&i.problems.includes('原图丢失')));
const form=new FormData();form.set('identity',main.identity);form.set('revision',String(main.revision));form.set('preview',new File([jpg],'preview.jpg',{type:'image/jpeg'}));main=(await ok('/api/assets/repair-preview',form)).role;assert((await call(main.imageUrl)).ok);assert.equal((await call('/api/assets/repair-preview',form)).status,409);
const candidatePage=await ok('/api/library/feature-candidates');assert(!candidatePage.roles.some(r=>r.identity===main.identity));
// API preview performs a model request but never writes its proposed fields.
await ok('/api/model-config',{provider:'custom',protocol:'openai',baseUrl:'https://api.vendor.com/v1',model:'vision-test',apiKey:'isolated-test-key'},'PUT');
const realFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify(output)}}]});
try{const old=await detail(main);const apiReview=await ok('/api/assets/'+main.id+'/analyze?v='+main.identity,{preview:true,revision:main.revision});assert(apiReview.proposal);assert.equal((await detail(main)).revision,old.revision)}finally{globalThis.fetch=realFetch}
console.log('PASS: batch atomic conflicts and ownership; collection inheritance; preview without writes; selective apply and server locks; visual search, copy without number or shared files; capacity, missing files and preview repair; API preview.');sql.close();
