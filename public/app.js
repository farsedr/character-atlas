"use strict";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={user:null,roles:[],labels:[],projects:[],recycle:[],view:"library",filters:{},selected:new Set(),page:1,analysisEnabled:false,authMode:"login",files:[],editTags:[]};
async function api(path,options={}){
 const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...options.headers}});
 let b;try{b=await r.json()}catch{throw new Error("服务暂不可用，请稍后重试")}
 if(!r.ok){if(r.status===401&&!path.startsWith("/api/auth/")&&!$("#closeModal")?.disabled)showAuth();throw new Error(b.error||"操作失败")}return b;
}
const post=(path,b)=>api(path,{method:"POST",body:JSON.stringify(b)});
function toast(s){$("#toast").textContent=s;$("#toast").style.display="block";clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$("#toast").style.display="none",5000)}
function modal(title,body){$("#modalContent").innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button id="closeModal" aria-label="关闭">×</button></div>'+body;$("#closeModal").onclick=()=>$("#modal").close();if(!$("#modal").open)$("#modal").showModal()}
function showAuth(){state.user=null;state.roles=[];state.labels=[];state.projects=[];state.recycle=[];state.selected.clear();$("#app").hidden=true;$("#authScreen").hidden=false;$("#modal").close();$("#userName").textContent="";$("#content").innerHTML=""}
function authMode(mode){
 state.authMode=mode;$("#authError").textContent="";$("#authForm").reset();
 $("#nameLabel").hidden=mode!=="register";$("#confirmLabel").hidden=mode==="login";$("#recoveryLabel").hidden=mode!=="recover";
 $("#authTitle").textContent={login:"登录你的素材库",register:"创建独立账号",recover:"恢复你的账号"}[mode];
 $("#authHint").textContent=mode==="register"?(state.ownerSetup?"注册后，你现有的素材将归属到这个账号。":"每个用户独立注册，素材库与其他账号完全隔离。"):"使用同一个账号，在不同设备继续整理。";
 $("#passwordLabel").textContent=mode==="recover"?"新密码":"密码";$("#authSubmit").textContent={login:"登录",register:"注册",recover:"重设密码"}[mode];
 $("#authForm").elements.password.autocomplete=mode==="login"?"current-password":"new-password";
}
async function loginReady(user){state.user=user;state.filters={};state.selected.clear();state.view="library";$("#authScreen").hidden=true;$("#app").hidden=false;$("#userName").textContent=user.name+" · "+user.email;await refresh()}
function recoveryDialog(code){
 modal("请保存账号恢复代码",'<p class="note">这是你的独立账号恢复凭据，仅本次显示。请保存到密码管理器。忘记密码后可用邮箱和此代码恢复账号。它不会发送到邮箱，也不要分享给其他人。</p><p class="code">'+esc(code)+'</p><div class="dialog-actions"><button id="copyRecovery">复制代码</button><button id="savedRecovery" class="primary">我已保存</button></div>');
 $("#copyRecovery").onclick=async()=>{try{await navigator.clipboard.writeText(code);toast("已复制")}catch{toast("请选择代码并手动复制")}};
 $("#savedRecovery").onclick=()=>$("#modal").close();
}
$("#authForm").onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget,b=Object.fromEntries(new FormData(form));
 if(state.authMode!=="login"&&b.password!==b.confirmPassword){$("#authError").textContent="两次输入的密码不一致";return}
 $("#authSubmit").disabled=true;$("#authError").textContent="";
 try{const r=await post("/api/auth/"+state.authMode,b);form.reset();await loginReady(r.user);if(r.recoveryCode)recoveryDialog(r.recoveryCode)}catch(e){$("#authError").textContent=e.message}finally{$("#authSubmit").disabled=false}
};
document.querySelectorAll("[data-auth]").forEach(b=>b.onclick=()=>authMode(b.dataset.auth));
async function refresh(silent=false){
 if(!state.user)return;try{
 const r=await api("/api/library");Object.assign(state,{roles:r.roles,labels:r.labels,projects:r.projects,recycle:r.recycle||[],analysisEnabled:r.analysisEnabled,modelConfig:r.modelConfig});
 const valid=new Set(state.roles.map(r=>r.identity));for(const id of state.selected)if(!valid.has(id))state.selected.delete(id);
 render();if(r.migrationPending)setTimeout(()=>refresh(true),1000);if(!silent)toast(r.migrationPending?"正在同步现有素材，请稍候…":"已同步云端数据");
 }catch(e){if(!silent)toast(e.message)}
}
function allProjects(){return [...new Set([...state.projects.map(p=>p.name),...state.roles.map(r=>r.projectName)])].sort((a,b)=>a.localeCompare(b,"zh-CN"))}
function labelOptions(d){return [...new Set(state.labels.filter(t=>t.dimension===d).map(t=>t.name))].sort((a,b)=>a.localeCompare(b,"zh-CN"))}
function groupedOptions(dim,selected){const byName=new Map(state.labels.filter(t=>t.dimension===dim).map(t=>[t.name,t])),groups=new Map();for(const t of byName.values()){const key=t.groupName||"自定义";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t.name)}return [...groups].map(([g,names])=>'<optgroup label="'+esc(g)+'">'+names.sort((a,b)=>a.localeCompare(b,"zh-CN")).map(n=>'<option value="'+esc(n)+'"'+(selected===n?' selected':'')+'>'+esc(n)+'</option>').join("")+'</optgroup>').join("")}
function renderFilters(){
 $("#filters").innerHTML=ATLAS.taxonomy.map(d=>'<select data-filter="'+d.id+'" aria-label="'+esc(d.name)+'"><option value="">'+esc(d.name)+'</option>'+groupedOptions(d.id,state.filters[d.id])+'</select>').join("");
 const old=$("#projectFilter").value;$("#projectFilter").innerHTML='<option value="">灵感集</option>'+allProjects().map(p=>'<option>'+esc(p)+'</option>').join("");$("#projectFilter").value=old;
}
function filtered(){
 const q=$("#search").value.trim().toLowerCase(),p=$("#projectFilter").value;
 let list=state.roles.filter(r=>(!p||r.projectName===p)&&Object.entries(state.filters).every(([dim,n])=>!n||r.tags.some(t=>t.dimension===dim&&t.name===n))&&(!q||[r.id,r.name,r.filename,r.projectName,r.generationPrompt,r.description,...r.tags.map(t=>t.name)].join(" ").toLowerCase().includes(q)));
 const sort=$("#sort").value;list.sort((a,b)=>sort==="id"?a.id.localeCompare(b.id):sort==="name"?a.name.localeCompare(b.name,"zh-CN"):b.createdAt.localeCompare(a.createdAt));return list;
}
function gcd(a,b){return b?gcd(b,a%b):a}
function aspect(r){if(!r.width||!r.height)return"待读取";const g=gcd(r.width,r.height);return r.width/g+":"+r.height/g}
function resolution(r){
 if(!r.width||!r.height)return"待读取";const longer=Math.max(r.width,r.height),shorter=Math.min(r.width,r.height);
 const label=longer>=7680?"8K":longer>=3840?"4K":longer>=2048?"2K":shorter>=1080?"1080P":shorter>=720?"720P":longer>=1024?"1K":"";
 return(label?label+" · ":"")+r.width+" × "+r.height;
}
function size(n){return n>=1048576?(n/1048576).toFixed(2)+" MB":(n/1024).toFixed(1)+" KB"}
function date(s){return new Date(s).toLocaleString("zh-CN",{hour12:false})}
function selection(){const list=filtered();$("#selectedCount").textContent="已选 "+state.selected.size+" 项";$("#deleteButton").disabled=!state.selected.size;$("#downloadButton").disabled=!state.selected.size||!!state.downloadBusy;$("#selectAll").checked=!!list.length&&list.every(r=>state.selected.has(r.identity))}
function card(r,recycle=false){
 const html='<article class="card '+(state.selected.has(r.identity)?"selected":"")+'"><input type="checkbox" class="select-card" data-select="'+r.identity+'" '+(state.selected.has(r.identity)?"checked":"")+' aria-label="选择'+esc(r.name)+'"><img class="cover" src="'+esc(r.imageUrl)+'" loading="lazy" decoding="async" alt="'+esc(r.name)+'" data-detail="'+r.identity+'"><div class="card-body"><span class="card-id">'+r.id+'</span><h3 title="'+esc(r.name)+'" data-detail="'+r.identity+'">'+esc(r.name)+'</h3><p class="card-description">'+esc(r.description||"等待一份关于它的描述。")+'</p><div class="chips">'+r.tags.slice(0,8).map(t=>'<span class="chip" title="'+esc(ATLAS.taxonomy.find(d=>d.id===t.dimension)?.name||"")+'">'+esc(t.name)+'</span>').join("")+'</div><div class="card-meta"><span>'+esc(r.projectName)+'</span><span>'+size(r.size)+'</span></div></div></article>';return recycle?html.replace(/<input[^>]*class="select-card"[^>]*>/,'').replace('</div></article>','<button data-restore="'+esc(r.identity)+'">恢复素材</button></div></article>'):html;
}
function render(){
 renderFilters();$("#navCount").textContent=state.roles.length;
 const total=state.roles.reduce((n,r)=>n+r.size,0);
 $("#stats").innerHTML=[["珍藏素材",state.roles.length],["原图体量",size(total)],["灵感标记",new Set(state.roles.flatMap(r=>r.tags.map(t=>t.dimension+":"+t.name))).size]].map(([n,v])=>'<div class="stat"><span>'+n+'</span><strong>'+v+'</strong></div>').join("");
 $("#viewTitle").textContent="灵感总览";$("#viewSubtitle").textContent="THE INSPIRATION ATLAS";$("#viewDescription").textContent="把片刻灵感，收藏成自己的图鉴。";
 const titles={library:["灵感总览","THE INSPIRATION ATLAS"],taxonomy:["标签库","CLASSIFY YOUR INSPIRATION"],projects:["灵感集","ORGANIZE YOUR COLLECTION"],recycle:["回收站","RESTORE YOUR ASSETS"]};$("#viewTitle").textContent=titles[state.view][0];$("#viewSubtitle").textContent=titles[state.view][1];$("#libraryTools").hidden=state.view!=="library";document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));if(state.view!=="library"){$("#viewDescription").textContent=state.view==="taxonomy"?"父类别固定，在输入或选择子标签中扩展词库。":state.view==="recycle"?"恢复素材，原文件保持完整。":"按灵感集整理你的素材。";renderAuxiliary();return}
 const list=filtered(),max=Math.max(1,Math.ceil(list.length/60));state.page=Math.min(state.page,max);
 $("#content").innerHTML=list.length?'<div class="results-bar"><span>发现灵感</span><button id="clearFilters" class="text-button">重置筛选</button></div><div class="grid">'+list.slice((state.page-1)*60,state.page*60).map(r=>card(r)).join("")+'</div><div class="dialog-actions"><span class="muted">共 '+list.length+' 项 · '+state.page+' / '+max+'</span><button data-page="-1" '+(state.page===1?"disabled":"")+'>上一页</button><button data-page="1" '+(state.page===max?"disabled":"")+'>下一页</button></div>':'<div class="empty">尚未发现匹配的灵感。上传图片或文件夹，开始收藏你的图鉴。<p><button id="clearFilters">重置筛选</button></p></div>';selection();
 $("#clearFilters").onclick=()=>{state.filters={};$("#search").value="";$("#projectFilter").value="";state.page=1;render()};
}
function renderAuxiliary(){
 if(state.view==="recycle"){
  $("#content").innerHTML=state.recycle.length?'<div class="grid">'+state.recycle.map(r=>card(r,true)).join("")+'</div>':'<div class="empty">回收站为空</div>';
 }else if(state.view==="taxonomy"){
  $("#content").innerHTML=ATLAS.taxonomy.map(d=>{
   const tags=state.labels.filter(t=>t.dimension===d.id),groups=[...new Set(tags.map(t=>t.groupName||"新增标签"))];
   return '<section class="panel"><div class="category-head"><div><h3>'+esc(d.name)+'</h3><span class="muted small">'+esc(d.description||"固定父类别")+' · '+tags.length+' 个子标签</span></div><button data-add-tag="'+d.id+'">＋ 添加子标签</button></div>'+groups.map(g=>'<div class="tag-group"><h4>'+esc(g)+'</h4>'+tags.filter(t=>(t.groupName||"新增标签")===g).map(t=>'<span class="chip">'+esc(t.name)+'</span>').join("")+'</div>').join("")+'</section>';
  }).join("");
 }else{
  $("#content").innerHTML='<div class="dialog-actions"><button id="newProject">＋ 新建灵感集</button></div><div class="project-grid">'+allProjects().map(p=>'<section class="panel project-card"><h3>'+esc(p)+'</h3><span class="muted small">灵感集</span><strong>'+state.roles.filter(r=>r.projectName===p).length+'</strong><button data-project="'+esc(p)+'">浏览素材</button></section>').join("")+'</div>';$("#newProject").onclick=()=>newProject();
 }
}
function roleByIdentity(id){return [...state.roles,...state.recycle].find(r=>r.identity===id)}
function assetPath(r,action=""){return"/api/assets/"+r.id+(action?"/"+action:"")+"?v="+encodeURIComponent(r.identity)}
function details(r){
 modal(r.name,'<div class="detail-grid"><div><img class="detail-image" src="'+esc(r.imageUrl)+'" alt="'+esc(r.name)+'"></div><div><p class="eyebrow">'+r.id+'</p><p>'+esc(r.description||"尚未添加描述")+'</p><div class="chips">'+r.tags.map(t=>'<span class="chip">'+esc(ATLAS.taxonomy.find(d=>d.id===t.dimension)?.name)+': '+esc(t.name)+'</span>').join("")+'</div><dl class="info-grid">'+[["源文件",r.filename],["源文件大小",size(r.size)],["分辨率",resolution(r)],["比例",aspect(r)],["上传时间",date(r.createdAt)],["灵感集",r.projectName]].map(([n,v])=>'<div><dt>'+n+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl><h3>生图提示词</h3><p class="prompt">'+esc(r.generationPrompt||"未填写，可手动添加")+'</p><div class="dialog-actions"><a href="'+esc(r.downloadUrl)+'" download>下载原图</a>'+(r.deletedAt?'':'<button id="editRole">编辑</button><button id="analyzeRole" '+(!state.analysisEnabled?"disabled":"")+'>分析标签</button>')+'</div><p class="muted small">模型仅添加固定类别下的子标签。手动标签和生图提示词会保留。</p><p id="detailError" class="error"></p></div></div>');
 if(!r.deletedAt){$("#editRole").onclick=()=>editRole(r);$("#analyzeRole").onclick=async()=>{const b=$("#analyzeRole");b.disabled=true;b.textContent="正在分析…";try{const result=await post(assetPath(r,"analyze"),{});await refresh(true);details(result.role);toast("分析完成，已添加 "+result.acceptedCount+" 个标签")}catch(e){$("#detailError").textContent=e.message;b.disabled=false;b.textContent="重试分析"}}}
}
function projectList(){return '<datalist id="projectNames">'+allProjects().map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>'}
function tagAdder(dim="style"){return '<div class="tag-add-row"><select id="tagDimension">'+ATLAS.taxonomy.map(d=>'<option value="'+d.id+'" '+(d.id===dim?"selected":"")+'>'+esc(d.name)+'</option>').join("")+'</select><input id="tagName" placeholder="输入或选择子标签" list="tagNames" maxlength="40"><button type="button" id="addTag">添加</button></div><datalist id="tagNames"></datalist><div id="tagSuggestions" class="tag-suggestions"></div>'}
function wireTagOptions(){const update=()=>{
 const dim=$("#tagDimension").value,d=ATLAS.taxonomy.find(t=>t.id===dim);$("#tagNames").innerHTML=state.labels.filter(t=>t.dimension===dim).map(t=>'<option value="'+esc(t.name)+'" label="'+esc(t.groupName||"自定义")+'">').join("");
 const context=state.editTags.filter(t=>t.dimension===dim).flatMap(t=>d.refinements?.[t.name]||[]),fallback=dim==="theme"?["仙子","魔女","剑仙","女巫","法师","太空舰长","森林","城堡"]:d.groups.flatMap(g=>g.values).slice(0,8),suggestions=[...new Set(context.length?context:fallback)].filter(n=>!state.editTags.some(t=>t.dimension===dim&&t.name===n));
 $("#tagSuggestions").innerHTML=suggestions.length?'<span class="small muted">细分参考（按画面选择）</span><div class="chips">'+suggestions.slice(0,12).map(n=>'<button type="button" data-suggest-tag="'+esc(n)+'">'+esc(n)+'</button>').join("")+"</div>":"";
 };$("#tagDimension").onchange=update;update();$("#tagSuggestions").onclick=e=>{const b=e.target.closest("[data-suggest-tag]");if(b){$("#tagName").value=b.dataset.suggestTag;$("#addTag").click();update()}}}
function editRole(r){
 state.editTags=r.tags.map(t=>({...t}));
 modal("编辑素材",'<form id="editForm"><div class="row"><label>素材名<input name="name" value="'+esc(r.name)+'" required maxlength="180"></label><label>灵感集<input name="projectName" list="projectNames" value="'+esc(r.projectName)+'" maxlength="40" required></label></div>'+projectList()+'<label>描述<textarea name="description" maxlength="1200">'+esc(r.description)+'</textarea></label><label>生图提示词<textarea name="generationPrompt" maxlength="12000">'+esc(r.generationPrompt)+'</textarea></label><h3>标签</h3><div id="editTags" class="editor-tags"></div>'+tagAdder()+'<p class="form-note">输入或选择子标签，按 Enter 或点击添加。直接保存也会收录输入的新标签。点击已有标签可移除。</p><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary" id="saveRole">保存</button></div></form>');wireTagOptions();
 const draw=()=>{$("#editTags").innerHTML=state.editTags.map((t,i)=>'<button type="button" data-remove-tag="'+i+'">'+esc(t.name)+' ×</button>').join("");$("#editTags").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.editTags.splice(Number(b.dataset.removeTag),1);draw()})};draw();
 const commitPendingTag=()=>{const t={dimension:$("#tagDimension").value,name:$("#tagName").value.normalize("NFKC").trim()};if(t.name&&!state.editTags.some(x=>x.dimension===t.dimension&&x.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g,"")===t.name.toLocaleLowerCase().replace(/\s+/g,""))){if(t.name.length>40||/[<>\x00-\x1f]/.test(t.name)){$("#formError").textContent="子标签为1至40个有效字符";return false}state.editTags.push(t);draw()}$("#tagName").value="";return true};
 $("#addTag").onclick=commitPendingTag;$("#tagName").onkeydown=e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();commitPendingTag()}};
 $("#editForm").onsubmit=async e=>{e.preventDefault();if(!commitPendingTag())return;$("#saveRole").disabled=true;try{const b=Object.fromEntries(new FormData(e.currentTarget));const result=await api(assetPath(r),{method:"PATCH",body:JSON.stringify({...b,identity:r.identity,revision:r.revision,tags:state.editTags})});await refresh(true);details(result.role);toast("素材已保存")}catch(e){$("#formError").textContent=e.message;$("#saveRole").disabled=false}};
}
function tagDialog(dimension){modal("添加子标签",'<form id="tagForm"><label>输入或选择子标签<input id="tagName" name="name" list="tagNames" maxlength="40" required></label><datalist id="tagNames">'+labelOptions(dimension).map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#tagForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/tags",{dimension,name:$("#tagName").value});await refresh(true);$("#modal").close();toast("子标签已保存")}catch(error){$("#formError").textContent=error.message}}}
function newProject(){modal("新建灵感集",'<form id="projectForm"><label>灵感集<input name="name" maxlength="40" required></label><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#projectForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/projects",{name:e.currentTarget.elements.name.value});await refresh(true);$("#modal").close();toast("灵感集已创建")}catch(error){$("#formError").textContent=error.message}}}
$("#content").onclick=async e=>{
 const el=e.target.closest("[data-detail],[data-select],[data-page],[data-restore],[data-add-tag],[data-project]");if(!el)return;
 if(el.dataset.restore){const r=roleByIdentity(el.dataset.restore);el.disabled=true;try{await post("/api/assets/restore",{identity:r.identity,revision:r.revision});await refresh(true);toast("素材已恢复")}catch(error){toast(error.message);el.disabled=false}}
 if(el.dataset.addTag)tagDialog(el.dataset.addTag);
 if(el.dataset.project){state.view="library";$("#projectFilter").value=el.dataset.project;state.page=1;render()}
 if(el.dataset.detail){const r=roleByIdentity(el.dataset.detail);if(r)details(r)}
 if(el.dataset.select){el.checked?state.selected.add(el.dataset.select):state.selected.delete(el.dataset.select);el.closest(".card").classList.toggle("selected",el.checked);selection()}
 if(el.dataset.page){state.page+=Number(el.dataset.page);render();window.scrollTo({top:0,behavior:"smooth"})}
};
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;render()});
$("#filters").onchange=e=>{state.filters[e.target.dataset.filter]=e.target.value;state.page=1;render()};
["search","projectFilter","sort"].forEach(id=>$("#"+id).addEventListener(id==="search"?"input":"change",()=>{state.page=1;render()}));
$("#selectAll").onchange=e=>{for(const r of filtered())e.target.checked?state.selected.add(r.identity):state.selected.delete(r.identity);render()};
$("#downloadButton").onclick=async()=>{const items=state.roles.filter(r=>state.selected.has(r.identity)).map(r=>({identity:r.identity,revision:r.revision}));if(!items.length||state.downloadBusy)return;state.downloadBusy=true;selection();const button=$("#downloadButton");button.textContent="正在打包…";let completed=0;try{for(let i=0;i<items.length;i+=200){const r=await fetch("/api/assets/batch-download",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:items.slice(i,i+200)})});if(!r.ok){const b=await r.json();throw new Error(b.error||"下载失败")}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="拾光图鉴素材"+(items.length>200?"-"+(i/200+1):"")+".zip";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);completed+=Math.min(200,items.length-i)}toast("已下载 "+completed+" 张素材")}catch(error){toast(error.message)}finally{state.downloadBusy=false;button.textContent="批量下载";selection()}};
$("#deleteButton").onclick=()=>{
 const items=state.roles.filter(r=>state.selected.has(r.identity)).map(r=>({identity:r.identity,revision:r.revision}));
 modal("删除 "+items.length+" 个素材",'<p>选中的素材将从图库移除，编号立即释放。</p><p id="formError" class="error"></p><div class="dialog-actions"><button id="cancelDelete">取消</button><button id="confirmDelete" class="danger">确认删除</button></div>');
 $("#cancelDelete").onclick=()=>$("#modal").close();$("#confirmDelete").onclick=async()=>{const btn=$("#confirmDelete");btn.disabled=true;try{let deleted=0;for(let i=0;i<items.length;i+=25){const r=await post("/api/assets/delete",{items:items.slice(i,i+25)});deleted+=r.deleted}state.selected.clear();await refresh(true);$("#modal").close();toast("已删除 "+deleted+" 项"+(deleted<items.length?"；部分素材已变化，请重新选择":""))}catch(e){$("#formError").textContent=e.message;btn.disabled=false}};
};
$("#refreshButton").onclick=()=>refresh();

async function preview(file){
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>64e6){bitmap.close();throw new Error("图片超过6400万像素")}
 const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));if(!blob)throw new Error("无法生成预览");return new File([blob],"preview.jpg",{type:"image/jpeg"});
}
function uploadDialog(){
 state.files=[];
 modal("上传素材",'<form id="uploadForm"><div class="dropzone"><p>选择图片，或选择整个文件夹。原文件保存到云端，登录其他设备后可下载。</p><div class="upload-options"><button type="button" id="chooseFiles">选择图片</button><button type="button" id="chooseFolder">上传文件夹</button></div><input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><input id="folderInput" type="file" webkitdirectory directory multiple hidden><p class="muted small">PNG / JPEG / WebP · 单张不超过20MB · 文件夹中其他格式会跳过</p><div id="fileList" class="file-list"></div></div><div class="row"><label>灵感集<input name="projectName" value="未分组" list="projectNames" maxlength="40" required></label><label>命名方式<select name="namingMode" id="namingMode"><option value="original">保留原文件名称</option><option value="custom">手动自定义命名</option><option value="ai" '+(!state.analysisEnabled?"disabled":"")+'>模型自动命名（最多4个字）</option></select></label></div>'+projectList()+'<div id="customNames" class="file-list" hidden></div><label>生图提示词（本次素材共用，可分别编辑）<textarea name="generationPrompt" maxlength="12000"></textarea></label><label class="check"><input type="checkbox" name="autoAnalyze" id="autoAnalyze" '+(!state.analysisEnabled?"disabled":"")+'>上传后自动分析并添加子标签</label><p class="form-note">自动命名需要配置视觉模型。分析失败时原图保留，可在详情中重试。原始文件名始终保留。</p><p id="uploadError" class="error"></p><div id="uploadProgress" class="progress" hidden></div><div class="dialog-actions"><button id="startUpload" class="primary" disabled>上传到云端</button></div></form>');
 const choose=(files)=>{
  const supported=[...files].filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name));state.files=supported.map(file=>({file,name:file.name.replace(/\.[^.]+$/,"")}));
  $("#fileList").textContent=state.files.length+" 张图片 · "+size(supported.reduce((n,f)=>n+f.size,0))+(files.length>supported.length?" · 已跳过 "+(files.length-supported.length)+" 个其他文件":"");
  $("#startUpload").disabled=!supported.length;
  $("#customNames").innerHTML=state.files.map((entry,i)=>'<label class="file-row">'+esc(entry.file.name)+'<input data-custom-name="'+i+'" value="'+esc(entry.name)+'" maxlength="80"></label>').join("");
 };
 $("#chooseFiles").onclick=()=>$("#fileInput").click();$("#chooseFolder").onclick=()=>$("#folderInput").click();
 $("#fileInput").onchange=e=>choose(e.target.files);$("#folderInput").onchange=e=>choose(e.target.files);
 $("#namingMode").onchange=e=>{$("#customNames").hidden=e.target.value!=="custom";$("#autoAnalyze").checked=e.target.value==="ai";$("#autoAnalyze").disabled=e.target.value==="ai"||!state.analysisEnabled};
 $("#uploadForm").onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form)),mode=fields.namingMode,auto=mode==="ai"||$("#autoAnalyze").checked;
  const entries=state.files.map((entry,i)=>({...entry,name:$("#customNames").querySelector('[data-custom-name="'+i+'"]')?.value||entry.name}));
  if(mode==="custom"&&entries.some(entry=>!entry.name.trim())){$("#uploadError").textContent="请为每个素材输入名称";return}
  for(const control of form.querySelectorAll("input,select,textarea,button"))control.disabled=true;$("#closeModal").disabled=true;
  $("#uploadProgress").hidden=false;let ok=0,failed=0,aiFailed=0;
  for(let i=0;i<entries.length;i++){
   const entry=entries[i];$("#uploadProgress").textContent="正在上传 "+(i+1)+" / "+entries.length+"： "+entry.file.name+"\n成功 "+ok+"，上传失败 "+failed+"，分析失败 "+aiFailed;
   try{
    if(entry.file.size>20*1048576)throw new Error("超过20MB");
    const f=new FormData();f.append("file",entry.file);f.append("preview",await preview(entry.file));f.append("projectName",fields.projectName);f.append("namingMode",mode);f.append("name",entry.name);f.append("generationPrompt",fields.generationPrompt||"");
    const result=await api("/api/assets",{method:"POST",body:f});ok++;
    if(auto){try{await post(assetPath(result.role,"analyze"),{})}catch(error){aiFailed++;console.warn("analysis failed for upload");$("#uploadError").textContent="最近一次分析错误："+error.message}}
   }catch(error){failed++;$("#uploadError").textContent="最近一次上传错误："+entry.file.name+" · "+error.message}
  }
  await refresh(true);$("#closeModal").disabled=false;
  $("#uploadProgress").textContent="完成：上传成功 "+ok+" 张，上传失败 "+failed+" 张，分析失败 "+aiFailed+" 张。失败项请重新选择或在素材详情重试。";
  $("#startUpload").textContent="完成";$("#startUpload").disabled=false;$("#startUpload").type="button";$("#startUpload").onclick=()=>$("#modal").close();
 };
}
$("#uploadButton").onclick=uploadDialog;
const presets={
 openai:{name:"OpenAI",protocol:"responses",base:"https://api.openai.com/v1"},claude:{name:"Anthropic Claude",protocol:"anthropic",base:"https://api.anthropic.com/v1"},gemini:{name:"Google Gemini",protocol:"gemini",base:"https://generativelanguage.googleapis.com/v1beta"},
 qwen:{name:"通义千问",protocol:"openai",base:"https://dashscope.aliyuncs.com/compatible-mode/v1"},glm:{name:"智谱 GLM",protocol:"openai",base:"https://open.bigmodel.cn/api/paas/v4"},doubao:{name:"豆包",protocol:"openai",base:"https://ark.cn-beijing.volces.com/api/v3"},siliconflow:{name:"硅基流动",protocol:"openai",base:"https://api.siliconflow.cn/v1"},openrouter:{name:"OpenRouter",protocol:"openai",base:"https://openrouter.ai/api/v1"},custom:{name:"自定义兼容接口",protocol:"openai",base:""}
};
async function modelDialog(){
 try{
  const {config,available}=await api("/api/model-config"),c=config||{};
  modal("模型设置",'<p class="note">配置保存在你自己的账号中，跨设备同步。密钥在服务端加密保存，不会返回页面。请选择支持图片输入的视觉模型，费用由所选服务商收取。</p><form id="modelForm"><div class="row"><label>服务商<select name="provider" id="provider">'+Object.entries(presets).map(([id,p])=>'<option value="'+id+'" '+(id===(c.provider||"gemini")?"selected":"")+'>'+p.name+'</option>').join("")+'</select></label><label>接口格式<select name="protocol" id="protocol">'+[["openai","OpenAI Chat Completions"],["responses","OpenAI Responses"],["anthropic","Anthropic Messages"],["gemini","Gemini 原生"]].map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join("")+'</select></label></div><label>服务地址<input type="url" name="baseUrl" id="baseUrl" required value="'+esc(c.baseUrl||presets.gemini.base)+'"></label><label>视觉模型 ID<input name="model" value="'+esc(c.model||"")+'" placeholder="服务商实际支持的视觉模型名称" required maxlength="160"></label><label>API 密钥<input name="apiKey" type="password" autocomplete="off" placeholder="'+(c.hasKey?"已保存；留空保留":"请输入你的密钥")+'"></label><p id="modelError" class="error"></p><div class="dialog-actions"><button type="button" id="removeConfig" class="danger">删除配置</button><button class="primary" '+(!available?"disabled":"")+'>保存配置</button></div></form>');
  $("#protocol").value=c.protocol||presets.gemini.protocol;$("#provider").onchange=e=>{const p=presets[e.target.value];$("#protocol").value=p.protocol;$("#baseUrl").value=p.base};
  $("#modelForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/model-config",{method:"PUT",body:JSON.stringify(b)});e.target.elements.apiKey.value="";await refresh(true);$("#modal").close();$("#modalContent").innerHTML="";toast("模型配置已保存")}catch(e){$("#modelError").textContent=e.message}};
  $("#removeConfig").onclick=async()=>{try{await api("/api/model-config",{method:"DELETE"});await refresh(true);$("#modal").close();$("#modalContent").innerHTML="";toast("配置已删除")}catch(e){$("#modelError").textContent=e.message}};
 }catch(e){toast(e.message)}
}
$("#modelButton").onclick=modelDialog;
async function accountDialog(){
 try{
  const {sessions}=await api("/api/auth/sessions");
  modal("账号安全",'<p><strong>'+esc(state.user.name)+'</strong> · '+esc(state.user.email)+'</p><p class="note">这是你的独立账号，没有管理员或子账号归属。其他设备登录同一账号即可同步素材。密码修改或账号恢复会撤销全部旧会话。</p><h3>修改密码</h3><form id="passwordForm"><label>当前密码<input type="password" name="oldPassword" autocomplete="current-password" required></label><div class="row"><label>新密码<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>确认新密码<input name="confirm" type="password" minlength="12" autocomplete="new-password" required></label></div><p id="accountError" class="error"></p><div class="dialog-actions"><button class="primary">更新密码</button></div></form><h3>已登录设备</h3>'+sessions.map(s=>'<div class="account-session"><span>'+esc(s.agent)+'<br><span class="muted">'+date(s.created_at)+(s.current?" · 当前设备":"")+'</span></span>'+(s.current?'':'<button data-revoke="'+esc(s.hash)+'">退出此设备</button>')+'</div>').join("")+'<div class="dialog-actions"><button id="revokeAll">退出其他所有设备</button></div>');
  $("#passwordForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));if(b.password!==b.confirm){$("#accountError").textContent="两次新密码不一致";return}try{await api("/api/auth/password",{method:"PUT",body:JSON.stringify(b)});e.target.reset();toast("密码已更新，其他设备已退出");await accountDialog()}catch(e){$("#accountError").textContent=e.message}};
  const revoke=async h=>{try{await api("/api/auth/sessions",{method:"DELETE",body:JSON.stringify({hash:h})});await accountDialog();toast("会话已撤销")}catch(e){toast(e.message)}};
  $("#modalContent").querySelectorAll("[data-revoke]").forEach(b=>b.onclick=()=>revoke(b.dataset.revoke));$("#revokeAll").onclick=()=>revoke("all");
 }catch(e){toast(e.message)}
}
$("#accountButton").onclick=accountDialog;
$("#logoutButton").onclick=async()=>{try{await post("/api/auth/logout",{});showAuth();authMode("login")}catch(e){toast(e.message)}};
let installPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e});
$("#installButton").onclick=async()=>{
 if(installPrompt){await installPrompt.prompt();installPrompt=null;return}
 modal("安装拾光图鉴",'<p>本应用连接同一份云端素材库，安装后使用你的独立账号登录。</p><ul><li>Windows / macOS / Linux：使用 Chrome 或 Edge 打开本站，点击地址栏的安装图标。</li><li>Android：使用 Chrome 菜单中的「安装应用」或「添加到主屏幕」。</li><li>iPhone / iPad：在 Safari 中点击分享，选择「添加到主屏幕」。</li></ul><p class="muted">需要联网同步。服务端代码和密钥不会分发到设备。</p><p><a href="/share/拾光图鉴分享包.zip" download>下载跨平台分享包</a></p>');
};
$("#modal").addEventListener("close",()=>{$("#modalContent").innerHTML=""});
$("#modal").addEventListener("cancel",e=>{if($("#closeModal")?.disabled)e.preventDefault()});
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
setInterval(()=>{if(state.user&&!document.hidden&&!$("#modal").open)refresh(true)},30000);
(async()=>{try{const r=await api("/api/auth/me");state.ownerSetup=r.ownerSetup;authMode(r.ownerSetup?"register":"login");if(r.user)await loginReady(r.user)}catch(e){$("#authError").textContent=e.message}})();
