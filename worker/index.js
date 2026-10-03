
const MAX_FILE=20*1024*1024;
const dimensions=()=>SEED.taxonomy.map(d=>d.id);
const normalize=s=>s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g,"");
const clean=s=>{if(typeof s!=="string")throw new HttpError(400,"标签必须是文本");s=s.normalize("NFKC").trim();if(!s||s.length>40||/[<>\x00-\x1f]/.test(s))throw new HttpError(400,"标签须为1—40个有效字符");return s};
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const getDb=env=>{if(!env.DB)throw new HttpError(503,"素材数据库暂不可用，请稍后重试");return env.DB};
const bucket=env=>{if(!env.BUCKET)throw new HttpError(503,"素材存储暂不可用，请稍后重试");return env.BUCKET};
const query=(env,sql,...values)=>getDb(env).prepare(sql).bind(...values);
async function registry(env){const rows=await query(env,"SELECT * FROM atlas_labels ORDER BY created_at").all();return [...SEED.taxonomy.flatMap(d=>d.groups.flatMap(g=>g.values.map(name=>({dimension:d.id,name,source:"builtin",key:d.id+":"+normalize(name)})))),...rows.results]}
async function canonicalTags(env,input,source="manual"){if(!Array.isArray(input)||input.length>36)throw new HttpError(400,"标签数量无效");const known=await registry(env), seen=new Set(), tags=[];
for(const t of input){if(!t||!dimensions().includes(t.dimension))throw new HttpError(400,"标签维度不存在");let name=clean(t.name),key=t.dimension+":"+normalize(name);const found=known.find(k=>k.key===key);name=found?.name||name;
if(!seen.has(key)){seen.add(key);tags.push({dimension:t.dimension,name,source:source})}}
return tags}
function labelStatements(env,tags){return tags.map(t=>query(env,"INSERT OR IGNORE INTO atlas_labels (key,dimension,name,source,created_at) VALUES (?,?,?,?,?)",t.dimension+":"+normalize(t.name),t.dimension,t.name,t.source,new Date().toISOString()))}
function bodyRole(row){const r=JSON.parse(row.body);return {...r,revision:row.revision,imageUrl:"/api/assets/"+row.id+"/preview",downloadUrl:"/api/assets/"+row.id+"/download",filename:row.filename,size:row.size}}
function classify(tags){return Object.fromEntries(dimensions().map(d=>[d,tags.find(t=>t.dimension===d)?.name||"待标注"]))}
function signature(bytes){if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return "image/png";if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";return ""}
async function upload(request,env){
const length=Number(request.headers.get("content-length"));if(length>MAX_FILE+3*1024*1024)throw new HttpError(413,"单张图片最大20MB");
const form=await request.formData(),file=form.get("file"),preview=form.get("preview");
if(!(file instanceof File)||!file.size||file.size>MAX_FILE)throw new HttpError(400,"请选择20MB以内的PNG、JPEG或WebP图片");
const bytes=await file.arrayBuffer(), mime=signature(new Uint8Array(bytes));if(!mime)throw new HttpError(400,"图片格式无效，支持PNG、JPEG、WebP");
if(!(preview instanceof File)||!preview.size||preview.size>2*1024*1024)throw new HttpError(400,"无法生成预览图，请换一张图片");
const previewBytes=await preview.arrayBuffer();if(signature(new Uint8Array(previewBytes))!=="image/jpeg")throw new HttpError(400,"预览图格式无效");
const projectId=String(form.get("projectId")||SEED.projects[0].id);if(!SEED.projects.some(p=>p.id===projectId))throw new HttpError(400,"项目不存在");
const name=clean(String(form.get("name")||file.name.replace(/\.[^.]+$/,"")).slice(0,40));
const filename=file.name.replace(/[\x00-\x1f\/\\]/g,"_").slice(0,180);
const id="AST-CHAR-"+crypto.randomUUID().toUpperCase(),originalKey="originals/"+id,previewKey="previews/"+id;
const date=new Date().toISOString();
const role={id,name,en:"MY ASSET",description:"新上传素材，等待标签与设定补充。",classification:classify([]),tags:[],projectId,invariants:[],notes:"",missingViews:[],version:"v001",status:"已上传",sample:false,updated:date.slice(0,10),};
const b=bucket(env);
try{await b.put(originalKey,bytes,{httpMetadata:{contentType:mime}});await b.put(previewKey,previewBytes,{httpMetadata:{contentType:"image/jpeg"}});
await query(env,"INSERT INTO atlas_assets (id,body,original_key,preview_key,mime,filename,size,revision,created_at) VALUES (?,?,?,?,?,?,?,?,?)",id,JSON.stringify(role),originalKey,previewKey,mime,filename,file.size,1,date).run();
}catch(e){await Promise.allSettled([b.delete(originalKey),b.delete(previewKey)]);throw e}
return json({role:{...role,revision:1,imageUrl:"/api/assets/"+id+"/preview",downloadUrl:"/api/assets/"+id+"/download",filename,size:file.size}},201);
}
async function saveRole(env,row,input){
if(!input||input.revision!==row.revision)throw new HttpError(409,"档案已更新，请刷新后再保存");
const tags=await canonicalTags(env,input.tags||[]),role={...JSON.parse(row.body),tags,classification:classify(tags),name:clean(input.name),description:typeof input.description==="string"?input.description.slice(0,1200):"",updated:new Date().toISOString().slice(0,10)};
await getDb(env).batch(labelStatements(env,tags));
const updated=await query(env,"UPDATE atlas_assets SET body=?,revision=revision+1 WHERE id=? AND revision=? RETURNING *",JSON.stringify(role),row.id,row.revision).first();
if(!updated)throw new HttpError(409,"档案已更新，请刷新后再保存");return json({role:bodyRole(updated)});
}
async function handleApi(request,env,url){
if(!request.headers.get("oai-authenticated-user-id"))throw new HttpError(401,"请通过ChatGPT登录后使用素材库");
if(!["GET","HEAD"].includes(request.method)){const origin=request.headers.get("origin");if(origin&&origin!==url.origin)throw new HttpError(403,"请求来源无效");if(Number(request.headers.get("content-length"))>MAX_FILE+3*1024*1024)throw new HttpError(413,"文件过大")}
if(url.pathname==="/api/library"&&request.method==="GET"){const rows=await query(env,"SELECT * FROM atlas_assets ORDER BY created_at DESC").all();const tags=await query(env,"SELECT * FROM atlas_labels ORDER BY created_at").all();return json({roles:rows.results.map(bodyRole),labels:tags.results})}
if(url.pathname==="/api/assets"&&request.method==="POST")return upload(request,env);
if(url.pathname==="/api/tags"&&request.method==="POST"){const body=await request.json();const tags=await canonicalTags(env,[{dimension:body.dimension,name:body.name}]);await getDb(env).batch(labelStatements(env,tags));return json({tag:tags[0]},201)}
const match=url.pathname.match(/^\/api\/assets\/([A-Z0-9-]+)(?:\/(preview|download))?$/);
if(match){const row=await query(env,"SELECT * FROM atlas_assets WHERE id=?",match[1]).first();if(!row)throw new HttpError(404,"素材不存在");
if(!match[2]&&request.method==="PATCH")return saveRole(env,row,await request.json());
if(["preview","download"].includes(match[2])&&request.method==="GET"){const original=match[2]==="download",object=await bucket(env).get(original?row.original_key:row.preview_key);if(!object)throw new HttpError(404,"图片文件不存在");
return new Response(object.body,{headers:{"Content-Type":original?row.mime:"image/jpeg","X-Content-Type-Options":"nosniff","Cache-Control":"private, max-age=60",...(original?{"Content-Disposition":"attachment; filename=\"image\"; filename*=UTF-8''"+encodeURIComponent(row.filename)}:{})}})}
}
throw new HttpError(404,"接口不存在");
}
export default {async fetch(request,env,ctx){
const url=new URL(request.url);
try{if(url.pathname.startsWith("/api/"))return await handleApi(request,env,url);
if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});
const key=url.pathname==="/"?"/index.html":url.pathname,asset=STATIC[key];if(!asset)return new Response("Not found",{status:404});
const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));return new Response(request.method==="HEAD"?null:bytes,{headers:{"Content-Type":asset.type,"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin"}});
}catch(e){if(!(e instanceof HttpError))console.error("asset_library_error",e.name);return json({error:e instanceof HttpError?e.message:"素材库暂不可用，请稍后重试"},e instanceof HttpError?e.status:503)}
}};
