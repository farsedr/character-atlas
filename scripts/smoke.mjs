
import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import worker from "../dist/server/index.js";
const sql=new DatabaseSync(":memory:");
for (const file of fs.readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort()) sql.exec(fs.readFileSync("drizzle/"+file,"utf8"));
const DB={prepare(q){const stmt=sql.prepare(q);let values=[];return {bind(...args){values=args;return this},async all(){return {results:stmt.all(...values)}},async first(){return stmt.get(...values)||null},async run(){stmt.run(...values);return {success:true}}}},async batch(items){sql.exec("BEGIN");try{const r=[];for(const s of items)r.push(await s.run());sql.exec("COMMIT");return r}catch(e){sql.exec("ROLLBACK");throw e}}};
const blobs=new Map();
const BUCKET={async put(k,b){blobs.set(k,new Uint8Array(b))},async get(k){const b=blobs.get(k);return b?{body:b,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}:null},async delete(k){blobs.delete(k)}};
const env={DB,BUCKET};
const call=(path,options={})=>worker.fetch(new Request("https://local.test"+path,{...options,headers:{"oai-authenticated-user-id":"test-owner",origin:"https://local.test",...options.headers}}),env,{});
assert.equal((await worker.fetch(new Request("https://local.test/api/library"),env,{})).status,401);
assert.equal((await call("/api/tags",{method:"POST",headers:{origin:"https://other.test"},body:"{}"})).status,403);
const original=fs.readFileSync("public/assets/characters.png");
const form=new FormData();form.append("file",new File([original],"原图.png",{type:"image/png"}));form.append("preview",new File([new Uint8Array([255,216,255,224,0,0])],"preview.jpg",{type:"image/jpeg"}));form.append("projectId","PRJ-001");form.append("name","测试素材");
const upload=await call("/api/assets",{method:"POST",body:form});assert.equal(upload.status,201);const {role}=await upload.json();
let download=await call(role.downloadUrl);assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),original);assert(download.headers.get("content-disposition").includes("UTF-8"));
const patch={revision:1,name:"手动标签角色",description:"用户自己维护",tags:[{dimension:"age",name:"儿童"},{dimension:"gender",name:"女性"},{dimension:"era",name:"民国"},{dimension:"style",name:"自定义绘画"},{dimension:"style",name:"水彩"}]};
let save=await call("/api/assets/"+role.id,{method:"PATCH",body:JSON.stringify(patch)});assert.equal(save.status,200);const updated=(await save.json()).role;
assert.equal(updated.classification.age,"儿童");assert.equal(updated.tags.length,5);
assert.equal((await call("/api/assets/"+role.id,{method:"PATCH",body:JSON.stringify(patch)})).status,409);
const add=await call("/api/tags",{method:"POST",body:JSON.stringify({dimension:"era",name:"架空民国"})});assert.equal(add.status,201);
await call("/api/tags",{method:"POST",body:JSON.stringify({dimension:"style",name:"自定义绘画"})});
let library=await (await call("/api/library")).json();assert.equal(library.roles.length,1);assert.equal(library.labels.filter(t=>t.name==="自定义绘画").length,1);

assert.equal((await call("/api/assets/"+role.id+"/analyze",{method:"POST",body:"{}"})).status,503);
const configBody={provider:"custom",protocol:"openai",baseUrl:"https://api.vendor.com/v1",model:"vision-test",apiKey:"test-key-not-a-real-credential"};
assert.equal((await call("/api/model-config",{method:"PUT",body:JSON.stringify(configBody)})).status,503);
env.AI_CONFIG_KEY=Buffer.alloc(32,7).toString("base64");
for(const baseUrl of ["http://localhost:8000","https://127.0.0.1","https://api.vendor.com/v1?key=hidden","https://user:secret@api.vendor.com","https://[::1]"]){
assert.equal((await call("/api/model-config",{method:"PUT",body:JSON.stringify({...configBody,baseUrl})})).status,400);
}
let cr=await call("/api/model-config",{method:"PUT",body:JSON.stringify(configBody)});assert.equal(cr.status,200);assert(!(await cr.text()).includes(configBody.apiKey));
assert(!sql.prepare("SELECT key_cipher FROM atlas_model_config").get().key_cipher.includes(configBody.apiKey));
cr=await call("/api/model-config");assert(!(await cr.text()).includes(configBody.apiKey));
assert.equal((await (await call("/api/model-config",{headers:{"oai-authenticated-user-id":"another-user"}})).json()).config,null);
assert.equal((await call("/api/model-config",{method:"PUT",body:JSON.stringify({...configBody,apiKey:"",baseUrl:"https://other.vendor.com/v1"})})).status,400);
assert.equal((await call("/api/model-config",{method:"PUT",body:JSON.stringify({...configBody,apiKey:""})})).status,200);
const realFetch=globalThis.fetch;
const analysis={description:"模型的视觉描述",tags:[{dimension:"age",name:"儿童",confidence:.95},{dimension:"era",name:"中世纪",confidence:.8},{dimension:"theme",name:"星港童话",confidence:.9},{dimension:"material",name:"薄雾玻璃",confidence:.3}]};
for(const protocol of ["openai","responses","anthropic","gemini"]){
assert.equal((await call("/api/model-config",{method:"PUT",body:JSON.stringify({...configBody,protocol})})).status,200);
globalThis.fetch=async(url,options)=>{
const b=JSON.parse(options.body);if(options.redirect==="error")throw new TypeError("Invalid redirect value, must be one of follow or manual");assert.equal(options.redirect,"manual");if(protocol!=="gemini")assert.equal(b.model,"vision-test");
if(protocol==="openai"){assert(url.endsWith("/chat/completions"));assert.equal(options.headers.Authorization,"Bearer "+configBody.apiKey);assert(b.messages[0].content[1].image_url.url.startsWith("data:image/jpeg;base64,"));return Response.json({choices:[{message:{content:JSON.stringify(analysis)}}]})}
if(protocol==="responses"){assert(url.endsWith("/responses"));assert.equal(b.store,false);assert(b.input[0].content[1].image_url);return Response.json({output:[{content:[{type:"output_text",text:JSON.stringify(analysis)}]}]})}
if(protocol==="anthropic"){assert(url.endsWith("/messages"));assert.equal(options.headers["x-api-key"],configBody.apiKey);assert(b.messages[0].content[0].source.data);return Response.json({content:[{type:"text",text:JSON.stringify(analysis)}]})}
assert(url.endsWith("/models/vision-test:generateContent"));assert.equal(options.headers["x-goog-api-key"],configBody.apiKey);assert(b.contents[0].parts[0].inline_data.data);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(analysis)}]}}]});
};
const ar=await call("/api/assets/"+role.id+"/analyze",{method:"POST",body:"{}"});assert.equal(ar.status,200,await ar.clone().text());const out=await ar.json();
assert(out.role.tags.some(t=>t.name==="民国"));assert(out.role.tags.some(t=>t.name==="中世纪"));assert(out.role.tags.some(t=>t.name==="星港童话"));assert(!out.role.tags.some(t=>t.name==="薄雾玻璃"));
}
let redirectCalls=0;globalThis.fetch=async(url,options)=>{redirectCalls++;assert.equal(options.redirect,"manual");return new Response("",{status:302,headers:{Location:"https://other.vendor.com/stolen"}})};
const redirected=await call("/api/assets/"+role.id+"/analyze",{method:"POST",body:"{}"});assert.equal(redirected.status,502);assert((await redirected.json()).error.includes("重定向"));assert.equal(redirectCalls,1);
globalThis.fetch=async()=>new Response("Unauthorized",{status:401});
let failed=await call("/api/assets/"+role.id+"/analyze",{method:"POST",body:"{}"});assert.equal(failed.status,502);assert(!(await failed.text()).includes(configBody.apiKey));
assert.equal((await call(role.downloadUrl)).status,200);
globalThis.fetch=async()=>{
const row=sql.prepare("SELECT * FROM atlas_assets WHERE id=?").get(role.id);const body=JSON.parse(row.body);body.notes="concurrent manual edit";sql.prepare("UPDATE atlas_assets SET body=?,revision=revision+1 WHERE id=?").run(JSON.stringify(body),role.id);
return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({description:"x",tags:[{dimension:"theme",name:"冲突不入库",confidence:.9}]})}]}}]});
};
assert.equal((await call("/api/assets/"+role.id+"/analyze",{method:"POST",body:"{}"})).status,409);
assert.equal(JSON.parse(sql.prepare("SELECT body FROM atlas_assets WHERE id=?").get(role.id).body).notes,"concurrent manual edit");
assert.equal(sql.prepare("SELECT count(*) AS n FROM atlas_labels WHERE name='冲突不入库'").get().n,0);
globalThis.fetch=realFetch;
library=await (await call("/api/library")).json();assert.equal(library.analysisEnabled,true);assert(!library.labels.some(t=>t.name==="薄雾玻璃"));
assert.equal((await call("/api/model-config",{method:"DELETE"})).status,200);
assert.equal((await (await call("/api/library")).json()).analysisEnabled,false);

const bad=new FormData();bad.append("file",new File(["not an image"],"bad.png",{type:"image/png"}));assert.equal((await call("/api/assets",{method:"POST",body:bad})).status,400);
assert.equal((await worker.fetch(new Request("https://local.test/"),env,{})).status,200);
const elements=new Map();
const el=s=>{if(!elements.has(s))elements.set(s,{style:{},dataset:{},innerHTML:"",textContent:"",value:"",hidden:false,open:false,disabled:false,classList:{toggle(){}},setAttribute(){},addEventListener(){},insertAdjacentHTML(){},reset(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(s)};
const document={querySelector:el,querySelectorAll:()=>[],addEventListener(){},activeElement:{tagName:"BODY"},body:el("body")};
const context=vm.createContext({document,window:{addEventListener(){}},structuredClone,console,FormData,fetch:async()=>new Response(JSON.stringify(library)),AbortController});
const source=["data.js","app.js","manage.js"].map(f=>fs.readFileSync("public/"+f,"utf8")).join("\n");
vm.runInContext(source,context);await new Promise(r=>setTimeout(r,20));
const run=s=>vm.runInContext(s,context);
assert.equal(run("taxonomy.length"),10);
run('state.filters={age:"儿童",era:"民国"};update()');assert.equal(run("matchRoles().length"),1);
run('detail(roles.find(r=>!r.sample).id)');assert(el("#detail-content").innerHTML.includes("下载原图"));assert(el("#detail-content").innerHTML.includes("儿童"));
el('#edit-dimension').value='style';run('editor()');assert(el("#edit-dialog").open);
console.log("PASS: upload, exact original download, persistent labels, deduplication, revision conflict, auth, origin, encrypted configuration, four vision protocols, edge redirect compatibility, redirect rejection, provider failures, concurrent edits, 10 dimensions, combined filters, details, editor.");
sql.close();
