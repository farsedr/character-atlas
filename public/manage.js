
"use strict";
let libraryReady=false,currentId="",editTags=[];
const builtin=structuredClone(ATLAS);
const countTerms=()=>taxonomy.reduce((n,d)=>n+terms(d).length,0);
const tagValues=(r,d)=>r.tags?.filter(t=>t.dimension===d).map(t=>t.name)||[r.classification[d]];
async function api(path,options={}){
const res=await fetch(path,{...options,headers:{...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...options.headers}});
let data;try{data=await res.json()}catch{throw Error("服务器暂不可用，请稍后重试")}
if(!res.ok)throw Error(data.error||"操作未成功");return data;
}
function notice(message,error=false){const box=$("#library-message");box.textContent=message;box.classList.toggle("error",error);box.hidden=!message}
function taxonomyAdd(dimension,name){const d=taxonomy.find(d=>d.id===dimension);if(!d||terms(d).includes(name))return;let group=d.groups.find(g=>g.name==="新增标签");if(!group){group={name:"新增标签",values:[]};d.groups.push(group)}group.values.push(name)}
function controls(){
$("#filters").innerHTML=taxonomy.map(d=>'<label>'+d.name+'<select data-filter="'+d.id+'" aria-label="按'+d.name+'筛选"><option value="">全部'+d.name+'</option>'+d.groups.map(g=>'<optgroup label="'+escapeHtml(g.name)+'">'+g.values.map(v=>'<option>'+escapeHtml(v)+'</option>').join("")+'</optgroup>').join("")+'</select></label>').join("")+'<label>项目<select data-filter="project" aria-label="按项目筛选"><option value="">全部项目</option>'+projects.map(p=>'<option value="'+p.id+'">'+escapeHtml(p.name)+'</option>').join("")+'</select></label>';
$("#taxonomy").innerHTML=taxonomy.map((d,i)=>'<article class="dimension"><h2>'+String(i+1).padStart(2,"0")+' · '+d.name+'<small>'+terms(d).length+' 个词条</small></h2><p>'+d.description+'</p>'+d.groups.map(g=>'<div class="term-group"><span>'+escapeHtml(g.name)+'</span><div class="terms">'+g.values.map(t=>'<button class="term" data-dimension="'+d.id+'" data-term="'+escapeHtml(t)+'">'+escapeHtml(t)+'<small>'+roles.filter(r=>tagValues(r,d.id).includes(t)).length+'</small></button>').join("")+'</div></div>').join("")+'</article>').join("");
$("#style-nav").innerHTML=taxonomy[0].groups.map(g=>'<button class="style-link" data-group="'+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'<b>'+roles.filter(r=>tagValues(r,"style").some(t=>g.values.includes(t))).length+'</b></button>').join("");
$("#projects").innerHTML=projects.map(p=>'<article class="project-card" style="--project-color:'+p.color+'"><small>'+p.id+'</small><h2>'+escapeHtml(p.name)+'</h2><p>'+escapeHtml(p.description)+'</p><div class="meta">'+p.deliverables+'<br>'+roles.filter(r=>r.projectId===p.id).length+' 份档案</div><button class="secondary" data-project="'+p.id+'">浏览项目素材</button></article>').join("");
$(".taxonomy-intro").innerHTML='<strong>'+taxonomy.length+' 个独立维度 · '+countTerms()+' 个分类词条</strong><p>词库支持手动新增。年龄表示外观阶段，时代按服饰与道具判断；同一素材可拥有多个标签。</p><button class="secondary" id="add-global-tag">新增标签</button>';
}
const oldUpdate=update;
update=function(){
oldUpdate();
const total=roles.length,uploaded=roles.filter(r=>!r.sample).length;
document.querySelector('[data-view="library"] b').textContent=total;
document.querySelector('[data-view="taxonomy"] b').textContent=countTerms();
if(state.view==="library")$("#page-title").innerHTML="角色与素材库<span> / "+total+"</span>";
if(state.view==="taxonomy")$("#page-title").innerHTML="分类字典<span> / "+countTerms()+"</span>";
$("#page-description").textContent=state.view==="library"?"上传原图，沉淀自己的角色素材与分类。":$("#page-description").textContent;
$(".results-bar>span").textContent=uploaded+" 份上传素材 · "+(total-uploaded)+" 份示例概念";
$("footer>span:last-child").textContent=taxonomy.length+" 个分类维度 · "+total+" 份档案";
};
const oldShow=showView;showView=function(v){oldShow(v);update()};
async function refreshLibrary(){
try{
const data=await api("/api/library");
roles.splice(0,roles.length,...data.roles,...structuredClone(builtin.roles));
taxonomy.splice(0,taxonomy.length,...structuredClone(builtin.taxonomy));
for(const t of data.labels)taxonomyAdd(t.dimension,t.name);
controls();update();libraryReady=true;$("#upload-open").disabled=false;
$("#storage-status").textContent="素材库已连接 · 手动标签";
notice("");
return data;
}catch(e){notice(e.message+" · 可点击“重新连接”重试。",true);throw e}
}
function openUpload(){if(!libraryReady)return;$("#upload-status").textContent="";$("#upload-form").reset();$("#upload-hint").textContent="上传后打开素材档案，手动添加年龄、时代、性别等标签。";$("#upload-dialog").showModal()}
async function previewFile(file){
if(file.size>20*1024*1024)throw Error(file.name+" 超过20MB");
const image=await createImageBitmap(file);
try{if(image.width*image.height>64000000)throw Error("图片像素过大，请使用6400万像素以内的文件");const scale=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("无法生成预览图")),"image/jpeg",.86))}finally{image.close()}
}
async function uploadFiles(e){
e.preventDefault();const form=$("#upload-form"),files=[...$("#upload-files").files];
if(!files.length||files.length>10){$("#upload-status").textContent="每批请选择1—10张图片";return}
const project=$("#upload-project").value,name=$("#upload-name").value;
$("#upload-submit").disabled=true;$("#upload-cancel").disabled=true;let success=0,errors=[];
try{for(let i=0;i<files.length;i++){
const file=files[i];$("#upload-status").textContent="正在上传 "+(i+1)+"/"+files.length+"："+file.name;
try{const preview=await previewFile(file),body=new FormData();body.append("file",file);body.append("preview",preview,"preview.jpg");body.append("projectId",project);if(files.length===1&&name.trim())body.append("name",name.trim());
const data=await api("/api/assets",{method:"POST",body});success++;

}catch(err){errors.push(file.name+"："+err.message)}
}
await refreshLibrary();showView("library");
$("#upload-status").textContent="已保存 "+success+" 张原图。"+(errors.length?"\n"+errors.join("\n"):"");
if(success===files.length&&!errors.length){$("#upload-dialog").close();notice("已上传 "+success+" 张图片");}
}catch(err){$("#upload-status").textContent=err.message}
finally{$("#upload-submit").disabled=false;$("#upload-cancel").disabled=false}
}
const oldDetail=detail;
detail=function(id){
oldDetail(id);currentId=id;const r=roles.find(r=>r.id===id);
if(!r.sample){const art=$("#detail-art");art.className="detail-art uploaded-art";art.style.backgroundImage='url("'+r.imageUrl+'")';$("#detail-content").innerHTML='<div class="detail-code">'+escapeHtml(r.id)+' · 修订 '+r.revision+'</div><h2 id="detail-name">'+escapeHtml(r.name)+'</h2><p>'+escapeHtml(r.description)+'</p><div class="detail-actions"><a class="secondary" href="'+r.downloadUrl+'">下载原图</a><button class="secondary" id="edit-asset">编辑档案与标签</button></div><p class="help">'+"标签由你手动添加，保存后新词会加入分类字典。"+'</p><h3>分类标签</h3>'+taxonomy.map(d=>'<div class="detail-tag-row"><span>'+d.name+'</span><div class="tags">'+tagValues(r,d.id).map(v=>'<span class="tag">'+escapeHtml(v)+'</span>').join("")+'</div></div>').join("")+'<h3>素材信息</h3><p>'+escapeHtml(r.filename)+'<br>'+Math.round(r.size/1024)+' KB · '+escapeHtml(byProject(r.projectId).name)+'</p>'+'<p id="detail-status" class="help" role="status"></p>';
}else{$("#detail-art").style.backgroundImage="";$("#detail-content").insertAdjacentHTML("beforeend",'<p class="help">年龄：'+escapeHtml(r.classification.age)+' · 时代：'+escapeHtml(r.classification.era)+'</p><a class="secondary" href="assets/characters.png" download="角色示例合集.png">下载示例合集图</a>')}
};
function editor(){
const r=roles.find(r=>r.id===currentId);if(!r||r.sample)return;
editTags=structuredClone(r.tags||[]);$("#edit-name").value=r.name;$("#edit-description").value=r.description;$("#edit-status").textContent="";
$("#edit-dimension").innerHTML=taxonomy.map(d=>'<option value="'+d.id+'">'+d.name+'</option>').join("");
$("#edit-tag-name").value="";tagSuggestions();renderEditTags();
$("#detail").close();$("#edit-dialog").showModal();
}
function tagSuggestions(){const d=taxonomy.find(d=>d.id===$("#edit-dimension").value);$("#tag-suggestions").innerHTML=terms(d).map(v=>'<option value="'+escapeHtml(v)+'"></option>').join("")}
function renderEditTags(){$("#edit-tags").innerHTML=editTags.map((t,i)=>'<button type="button" class="filter-chip" data-remove-edit="'+i+'">'+labels[t.dimension]+'：'+escapeHtml(t.name)+' ×</button>').join("")}
function addEditTag(dimension,name){name=name.trim();if(!name||name.length>40){$("#edit-status").textContent="标签需要1—40个字符";return}if(!editTags.some(t=>t.dimension===dimension&&t.name===name))editTags.push({dimension,name,source:"manual"});renderEditTags()}
async function saveEdit(e){e.preventDefault();const r=roles.find(r=>r.id===currentId);$("#edit-save").disabled=true;try{
await api("/api/assets/"+r.id,{method:"PATCH",body:JSON.stringify({revision:r.revision,name:$("#edit-name").value,description:$("#edit-description").value,tags:editTags})});
await refreshLibrary();$("#edit-dialog").close();detail(r.id);
}catch(err){$("#edit-status").textContent=err.message}finally{$("#edit-save").disabled=false}}
async function newGlobal(e){e.preventDefault();$("#global-save").disabled=true;try{await api("/api/tags",{method:"POST",body:JSON.stringify({dimension:$("#global-dimension").value,name:$("#global-name").value})});await refreshLibrary();$("#global-dialog").close();notice("新标签已保存到分类字典")}catch(err){$("#global-status").textContent=err.message}finally{$("#global-save").disabled=false}}
$(".toolbar").insertAdjacentHTML("beforeend",'<button class="primary" id="upload-open" disabled>上传图片</button>');
$("main").insertAdjacentHTML("afterbegin",'<div class="library-connect"><span id="storage-status">正在连接素材库…</span><button class="text-button" id="reconnect">重新连接</button></div><div id="library-message" class="message" role="status" hidden></div>');
$(".edition").innerHTML='LIBRARY<br><strong>YOUR ASSETS</strong>';
$(".workspace-label span").textContent="V0.2";
$(".sidebar-bottom").innerHTML='<span class="sample-tag">个人素材工作空间</span><p>原图云端保存<br>用户手动标注 · 随时可编辑</p>';
$(".workflow p").textContent="上传原图后建立素材档案，按维度手动标注，再补充角色设定并审核归档。示例概念保留供分类参考。";
document.body.insertAdjacentHTML("beforeend",'<dialog id="upload-dialog" class="manage-dialog" aria-labelledby="upload-title"><form id="upload-form"><h2 id="upload-title">上传图片素材</h2><p class="help">支持 PNG、JPEG、WebP，单张最大20MB，每批最多10张。保留完整原图，另生成浏览预览。</p><label>选择图片<input id="upload-files" type="file" accept="image/png,image/jpeg,image/webp" multiple required></label><label>素材名称<input id="upload-name" maxlength="40" placeholder="单张时可填写；留空使用文件名"></label><label>所属项目<select id="upload-project">'+projects.map(p=>'<option value="'+p.id+'">'+escapeHtml(p.name)+'</option>').join("")+'</select></label><p id="upload-hint" class="help"></p><p id="upload-status" class="form-status" role="status"></p><div class="form-actions"><button type="button" id="upload-cancel" class="secondary">关闭</button><button id="upload-submit" class="primary">开始上传</button></div></form></dialog><dialog id="edit-dialog" class="manage-dialog" aria-labelledby="edit-title"><form id="edit-form"><h2 id="edit-title">编辑档案与标签</h2><label>素材名称<input id="edit-name" maxlength="40" required></label><label>素材描述<textarea id="edit-description" maxlength="1200" rows="3"></textarea></label><h3>已选标签</h3><div id="edit-tags" class="tags"></div><div class="tag-entry"><select id="edit-dimension" aria-label="标签维度"></select><input id="edit-tag-name" list="tag-suggestions" maxlength="40" placeholder="选择已有词或填写新标签" aria-label="标签名称"><datalist id="tag-suggestions"></datalist><button class="secondary" type="button" id="edit-add">添加</button></div><p class="help">同一维度可添加多个标签。点击已选标签可移除；新词将在保存时加入分类字典。</p><p id="edit-status" class="form-status" role="status"></p><div class="form-actions"><button type="button" id="edit-cancel" class="secondary">取消</button><button id="edit-save" class="primary">保存档案</button></div></form></dialog><dialog id="global-dialog" class="manage-dialog" aria-labelledby="global-title"><form id="global-form"><h2 id="global-title">新增词库标签</h2><label>维度<select id="global-dimension">'+taxonomy.map(d=>'<option value="'+d.id+'">'+d.name+'</option>').join("")+'</select></label><label>标签名称<input id="global-name" maxlength="40" required placeholder="例如：民国、青年、赛博侦探"></label><p id="global-status" class="form-status" role="status"></p><div class="form-actions"><button type="button" id="global-cancel" class="secondary">取消</button><button id="global-save" class="primary">保存标签</button></div></form></dialog>');
$("#upload-open").addEventListener("click",openUpload);$("#upload-form").addEventListener("submit",uploadFiles);
$("#upload-cancel").addEventListener("click",()=>$("#upload-dialog").close());
$("#upload-dialog").addEventListener("cancel",e=>{if($("#upload-submit").disabled)e.preventDefault()});
$("#edit-form").addEventListener("submit",saveEdit);$("#edit-cancel").addEventListener("click",()=>$("#edit-dialog").close());
$("#edit-add").addEventListener("click",()=>{addEditTag($("#edit-dimension").value,$("#edit-tag-name").value);$("#edit-tag-name").value=""});
$("#edit-dimension").addEventListener("change",tagSuggestions);
$("#global-form").addEventListener("submit",newGlobal);$("#global-cancel").addEventListener("click",()=>$("#global-dialog").close());
$("#reconnect").addEventListener("click",()=>refreshLibrary().catch(()=>{}));
document.addEventListener("click",e=>{
if(e.target.closest("#add-global-tag")){if(!libraryReady){notice("请先连接素材库",true);return}$("#global-form").reset();$("#global-status").textContent="";$("#global-dialog").showModal()}
if(e.target.closest("#edit-asset"))editor();
const rm=e.target.closest("[data-remove-edit]");if(rm){editTags.splice(Number(rm.dataset.removeEdit),1);renderEditTags()}
});
controls();update();refreshLibrary().catch(()=>{});
