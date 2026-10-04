"use strict";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={user:null,roles:[],labels:[],projects:[],recycle:[],view:"library",filters:{},filtersExpanded:false,selected:new Set(),recycleSelected:new Set(),page:1,analysisEnabled:false,authMode:"login",files:[],editTags:[]};
async function api(path,options={}){
 const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...options.headers}});
 let b;try{b=await r.json()}catch{throw new Error("服务暂不可用，请稍后重试")}
 if(!r.ok){if(r.status===401&&!path.startsWith("/api/auth/")&&!$("#closeModal")?.disabled)showAuth();throw new Error(b.error||"操作失败")}return b;
}
const post=(path,b)=>api(path,{method:"POST",body:JSON.stringify(b)});


const codexLocal={token:"",connected:false,model:"gpt-6-luna",reasoning:"low",provider:"codex",providers:{},models:[]};
const effortNames={default:"模型默认",low:"低",medium:"中",high:"高",xhigh:"极高",max:"最高"};
const canAnalyze=()=>codexLocal.connected&&codexLocal.models.length>0||state.analysisEnabled;
const codexPreferenceKey=()=>"atlas-codex-options:"+state.user?.id;
function loadCodexPreference(){
 codexLocal.model="gpt-6-luna";codexLocal.reasoning="low";codexLocal.provider="codex";
 try{const value=JSON.parse(localStorage.getItem(codexPreferenceKey())||"null");if(value){codexLocal.model=value.model;codexLocal.reasoning=value.reasoning;codexLocal.provider=value.provider||"codex"}}catch{}
}
function saveCodexPreference(){try{localStorage.setItem(codexPreferenceKey(),JSON.stringify({model:codexLocal.model,reasoning:codexLocal.reasoning,provider:codexLocal.provider}))}catch{}}
async function codexRequest(action,options={}){
 let response;try{response=await fetch("http://127.0.0.1:4379/"+action,{...options,headers:{"X-Atlas-Token":codexLocal.token,...options.headers},signal:AbortSignal.timeout(action==="analyze"?250000:10000)})}catch{throw new Error("无法连接本机模型，请启动连接程序，并允许浏览器访问本地网络。")}
 const data=await response.json();if(!response.ok)throw new Error(data.error||"本机模型请求失败");return data;
}
async function analyzeAsset(role,choice=codexLocal.connected?codexLocal.provider+":"+codexLocal.model:"api"){
 if(choice==="api"){if(!state.analysisEnabled)throw new Error("请先配置 API 模型");return post(assetPath(role,"analyze"),{})}
 if(!codexLocal.connected)throw new Error("请先连接本机模型");
 const model=choice.slice(choice.indexOf(":")+1),supported=codexLocal.models.find(m=>m.id===model);if(!supported)throw new Error("请选择可用的本机模型");
 const options={model,reasoning:supported.efforts.includes(codexLocal.reasoning)?codexLocal.reasoning:(supported.efforts.includes("low")?"low":supported.efforts[0])};
 const response=await fetch(role.imageUrl,{credentials:"same-origin"});
 if(!response.ok)throw new Error("无法读取预览图");
 const bytes=new Uint8Array(await response.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const installed=await api("/api/analysis-skill");const result=await codexRequest("analyze",{method:"POST",headers:{"Content-Type":"application/json","X-Atlas-Model":options.model,"X-Atlas-Reasoning":options.reasoning},body:JSON.stringify({image:btoa(binary),skill:installed.skill?.content||"",collections:allProjects().slice(0,200)})});
 return post(assetPath(role,"analysis-result"),{identity:role.identity,revision:role.revision,result:result.result,model:result.model,reasoning:result.reasoning});
}

function analysisModelSelect(id){
 const choices=codexLocal.connected?codexLocal.models.map(m=>({value:(m.provider||"codex")+":"+m.id,name:"本机 "+(m.provider==="gemini"?"Gemini":"Codex")+" · "+m.name})):[];
 if(state.analysisEnabled)choices.push({value:"api",name:"API · "+(state.modelConfig?.model||"已配置模型")});
 if(!choices.length)return "";
 const current=codexLocal.connected?codexLocal.provider+":"+codexLocal.model:"api";
 return '<label>分析模型<select id="'+id+'">'+choices.map(c=>'<option value="'+esc(c.value)+'" '+(c.value===current?"selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select></label>';
}

function codexControls(){
 return '<section class="codex-settings"><h3>本机模型</h3><p class="note">本机 Codex 使用 ChatGPT 登录；本机 Gemini 使用 Google 登录，无需填写 API 密钥。每位用户在自己的电脑上安装并配对。默认选择轻量模型，实际可用性和额度以账号为准。</p><div class="dialog-actions"><a href="/share/local-connector.zip" download>下载通用连接包（Codex / Gemini）</a><a href="/connection-guide.html" target="_blank" rel="noreferrer">Codex / Gemini 安装与连接指引</a></div><p id="codexStatus"></p><label>本机来源<select id="localProvider"><option value="codex">本机 Codex</option><option value="gemini">本机 Gemini</option></select></label><div class="row"><label>模型<select id="codexModel"></select></label><label>推理强度<select id="codexReasoning"></select></label></div><p class="form-note">选择在本设备保存。分析时也可以单独选择模型；不会因失败而自动升级模型。</p><label>连接码<input id="codexPairCode" type="password" autocomplete="off" placeholder="从本机连接页面复制"></label><div class="dialog-actions"><a href="http://127.0.0.1:4379/" target="_blank" rel="noreferrer">打开本机连接页</a><button type="button" id="connectCodex">连接</button><button type="button" id="disconnectCodex">断开连接</button><button type="button" id="resetCodexOptions">重置默认</button></div><p id="codexError" class="error"></p></section><hr>';
}
function chooseLocalDefault(){const candidates=codexLocal.models.filter(m=>(m.provider||"codex")===codexLocal.provider);const preferred=codexLocal.provider==="gemini"?"gemini-2.5-flash-lite":"gpt-6-luna";const found=candidates.find(m=>m.id===preferred)||candidates[0];if(found){codexLocal.model=found.id;codexLocal.reasoning=found.efforts.includes("low")?"low":found.efforts[0]}}
function renderCodexChoices(){
 const model=$("#codexModel"),effort=$("#codexReasoning");if(!model)return;
 $("#localProvider").value=codexLocal.provider;const candidates=codexLocal.models.filter(m=>(m.provider||"codex")===codexLocal.provider);model.disabled=effort.disabled=!codexLocal.connected||!candidates.length;
 model.innerHTML=candidates.length?candidates.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join(""):'<option>请安装并登录所选 CLI 后连接</option>';model.value=codexLocal.model;
 const selected=candidates.find(m=>m.id===codexLocal.model);effort.innerHTML=(selected?.efforts||["default"]).map(e=>'<option value="'+esc(e)+'">'+esc(effortNames[e]||e)+'</option>').join("");effort.value=codexLocal.reasoning;
 const status=codexLocal.providers[codexLocal.provider];$("#codexStatus").textContent=(codexLocal.connected?"连接程序已配对":"尚未连接")+(status?" · "+status.status:"")+(selected?" · "+selected.id:"");
}
function bindCodexControls(){
 renderCodexChoices();$("#localProvider").onchange=e=>{codexLocal.provider=e.target.value;chooseLocalDefault();saveCodexPreference();renderCodexChoices()};
 $("#codexModel").onchange=e=>{codexLocal.model=e.target.value;const levels=codexLocal.models.find(m=>m.id===codexLocal.model)?.efforts||[];if(!levels.includes(codexLocal.reasoning))codexLocal.reasoning=levels.includes("low")?"low":levels[0];saveCodexPreference();renderCodexChoices()};
 $("#codexReasoning").onchange=e=>{codexLocal.reasoning=e.target.value;saveCodexPreference()};
 $("#connectCodex").onclick=async()=>{const token=$("#codexPairCode").value.trim();if(!/^[a-f0-9]{48}$/.test(token)){$("#codexError").textContent="请输入本机连接页面显示的完整连接码";return}const button=$("#connectCodex");button.disabled=true;codexLocal.token=token;try{const info=await codexRequest("health");if(info.version!==3)throw Error("请下载新版通用连接包，并重新启动");codexLocal.models=(info.models||[]).filter(m=>typeof m.id==="string"&&Array.isArray(m.efforts)&&m.efforts.length);codexLocal.providers=info.providers||{};if(!codexLocal.models.some(m=>m.id===codexLocal.model&&(m.provider||"codex")===codexLocal.provider))chooseLocalDefault();codexLocal.connected=true;$("#codexPairCode").value="";$("#codexError").textContent="";renderCodexChoices();toast("本机连接已配对，请检查所选 CLI 的登录状态")}catch(e){codexLocal.token="";codexLocal.connected=false;renderCodexChoices();$("#codexError").textContent=e.message}finally{button.disabled=false}};
 $("#disconnectCodex").onclick=()=>{codexLocal.token="";codexLocal.connected=false;codexLocal.models=[];codexLocal.providers={};renderCodexChoices();toast("已断开本机连接")};
 $("#resetCodexOptions").onclick=()=>{chooseLocalDefault();saveCodexPreference();renderCodexChoices()};
}
function skillControls(){return '<section><h3>分析 Skill</h3><p id="skillStatus">正在读取…</p><p class="form-note">安装自己的 SKILL.md，补充分析细节和标签规则。固定父标签、输出格式和视觉证据约束始终保留；适用于本机模型与 API 模型。</p><input id="skillFile" type="file" accept=".md,text/markdown"><div class="dialog-actions"><a href="/share/analysis-SKILL.md" download>下载 Skill 模板</a><button type="button" id="installSkill">安装 Skill</button><button type="button" id="resetSkill">恢复内置 Skill</button></div><p id="skillError" class="error"></p></section><hr>'}
async function bindSkillControls(){const render=async()=>{const result=await api("/api/analysis-skill");$("#skillStatus").textContent=result.skill?"已安装："+result.skill.name:"使用内置 24 维分析 Skill"};try{await render()}catch(e){$("#skillError").textContent=e.message}$("#installSkill").onclick=async()=>{try{const file=$("#skillFile").files[0];if(!file)throw Error("请选择 SKILL.md 文件");if(file.size>96000)throw Error("Skill 文件过大");await api("/api/analysis-skill",{method:"PUT",body:JSON.stringify({content:await file.text()})});await render();toast("分析 Skill 已安装")}catch(e){$("#skillError").textContent=e.message}};$("#resetSkill").onclick=async()=>{try{await api("/api/analysis-skill",{method:"DELETE"});await render();toast("已恢复内置 Skill")}catch(e){$("#skillError").textContent=e.message}}}
function toast(s){$("#toast").textContent=s;$("#toast").style.display="block";clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$("#toast").style.display="none",5000)}
function modal(title,body){$("#modalContent").innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button id="closeModal" aria-label="关闭">×</button></div>'+body;$("#closeModal").onclick=()=>$("#modal").close();if(!$("#modal").open)$("#modal").showModal()}
function showAuth(){codexLocal.token="";codexLocal.connected=false;codexLocal.models=[];codexLocal.providers={};closeFilterPopover();state.user=null;state.roles=[];state.labels=[];state.projects=[];state.recycle=[];state.selected.clear();state.recycleSelected.clear();$("#app").hidden=true;$("#authScreen").hidden=false;$("#modal").close();$("#userName").textContent="";$("#content").innerHTML=""}
function authMode(mode){
 state.authMode=mode;$("#authError").textContent="";$("#authForm").reset();
 $("#nameLabel").hidden=mode!=="register";$("#confirmLabel").hidden=mode==="login";$("#recoveryLabel").hidden=mode!=="recover";
 $("#authTitle").textContent={login:"登录你的素材库",register:"创建独立账号",recover:"恢复你的账号"}[mode];
 $("#authHint").textContent=mode==="register"?(state.ownerSetup?"注册后，你现有的素材将归属到这个账号。":"每个用户独立注册，素材库与其他账号完全隔离。"):"使用同一个账号，在不同设备继续整理。";
 $("#passwordLabel").textContent=mode==="recover"?"新密码":"密码";$("#authSubmit").textContent={login:"登录",register:"注册",recover:"重设密码"}[mode];
 $("#authForm").elements.password.autocomplete=mode==="login"?"current-password":"new-password";
}
async function loginReady(user){state.user=user;loadCodexPreference();state.filters={};state.selected.clear();state.view="library";$("#authScreen").hidden=true;$("#app").hidden=false;$("#userName").textContent=user.name+" · "+user.email;await refresh()}
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
 const recycled=new Set(state.recycle.map(r=>r.identity));for(const id of state.recycleSelected)if(!recycled.has(id))state.recycleSelected.delete(id);
 render();if(r.migrationPending)setTimeout(()=>refresh(true),1000);if(!silent)toast(r.migrationPending?"正在同步现有素材，请稍候…":"已同步云端数据");
 }catch(e){if(!silent)toast(e.message)}
}
function allProjects(){return [...new Set([...state.projects.map(p=>p.name),...state.roles.map(r=>r.projectName)])].sort((a,b)=>a.localeCompare(b,"zh-CN"))}
function labelOptions(d){return [...new Set(state.labels.filter(t=>t.dimension===d).map(t=>t.name))].sort((a,b)=>a.localeCompare(b,"zh-CN"))}
function groupedOptions(dim,selected){const byName=new Map(state.labels.filter(t=>t.dimension===dim).map(t=>[t.name,t])),groups=new Map();for(const t of byName.values()){const key=t.groupName||"自定义";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t.name)}return [...groups].map(([g,names])=>'<optgroup label="'+esc(g)+'">'+names.sort((a,b)=>a.localeCompare(b,"zh-CN")).map(n=>'<option value="'+esc(n)+'"'+(selected===n?' selected':'')+'>'+esc(n)+'</option>').join("")+'</optgroup>').join("")}
function renderFilters(){
 closeFilterPopover();
 $("#filters").innerHTML=ATLAS.taxonomy.map((d,i)=>'<div class="filter-control"'+(!state.filtersExpanded&&i>=3&&!state.filters[d.id]?' hidden':'')+'><select hidden data-filter="'+d.id+'" aria-label="'+esc(d.name)+'"><option value="">'+esc(d.name)+'</option>'+groupedOptions(d.id,state.filters[d.id])+'</select><button class="filter-trigger" data-filter-trigger="'+d.id+'" aria-haspopup="listbox" aria-expanded="false"><span>'+esc(state.filters[d.id]?d.name+' · '+state.filters[d.id]:d.name)+'</span><span aria-hidden="true">⌄</span></button></div>').join("");
 $("#toggleFilters").textContent=state.filtersExpanded?"收起筛选":"更多筛选";$("#toggleFilters").setAttribute("aria-expanded",String(state.filtersExpanded));const count=Object.values(state.filters).filter(Boolean).length;$("#filterSummary").textContent=count?"已选 "+count+" 个条件":"";
 const old=$("#projectFilter").value;$("#projectFilter").innerHTML='<option value="">灵感集</option>'+allProjects().map(p=>'<option>'+esc(p)+'</option>').join("");$("#projectFilter").value=old;
}
function closeFilterPopover(focus=false){const popup=$("#filterPopover");if(!popup)return;const trigger=document.querySelector('[data-filter-trigger="'+popup.dataset.dimension+'"]');popup.remove();trigger?.setAttribute("aria-expanded","false");if(focus)trigger?.focus()}
function openFilterPopover(trigger){const dim=trigger.dataset.filterTrigger;if($("#filterPopover")?.dataset.dimension===dim){closeFilterPopover(true);return}closeFilterPopover();const d=ATLAS.taxonomy.find(d=>d.id===dim),popup=document.createElement("div");popup.id="filterPopover";popup.className="filter-popover";popup.dataset.dimension=dim;popup.innerHTML='<input class="filter-search" aria-label="搜索'+esc(d.name)+'标签" placeholder="搜索'+esc(d.name)+'标签"><div class="filter-options" role="listbox" aria-label="'+esc(d.name)+'"></div>';document.body.append(popup);trigger.setAttribute("aria-expanded","true");const search=popup.querySelector("input"),list=popup.querySelector(".filter-options");
const options=[{name:"不限"+d.name,value:"",group:""},...[...new Map(state.labels.filter(t=>t.dimension===dim).map(t=>[t.name,t])).values()].sort((a,b)=>(a.groupName||"").localeCompare(b.groupName||"","zh-CN")||a.name.localeCompare(b.name,"zh-CN")).map(t=>({name:t.name,value:t.name,group:t.groupName||"自定义"}))];
function update(){const q=search.value.trim().toLowerCase();let group=null;list.innerHTML=options.filter(t=>!q||t.name.toLowerCase().includes(q)||t.group.toLowerCase().includes(q)).map(t=>{let head=t.group&&group!==t.group?'<div class="filter-group">'+esc(t.group)+'</div>':"";group=t.group;return head+'<button role="option" aria-selected="'+String((state.filters[dim]||"")===t.value)+'" data-value="'+esc(t.value)+'">'+esc(t.name)+'</button>'}).join("")||'<p class="filter-empty">没有匹配的标签</p>'}update();search.oninput=update;
list.onclick=e=>{const option=e.target.closest("[data-value]");if(!option)return;state.filters[dim]=option.dataset.value;state.page=1;render();document.querySelector('[data-filter-trigger="'+dim+'"]')?.focus()};popup.onkeydown=e=>{if(e.key==="Escape"){e.preventDefault();closeFilterPopover(true)}else if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const buttons=[...list.querySelectorAll("button")],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length]?.focus()}};
const rect=trigger.getBoundingClientRect(),width=Math.min(Math.max(rect.width,240),window.innerWidth-24),below=window.innerHeight-rect.bottom-12,above=rect.top-12,space=Math.max(100,Math.min(300,Math.max(below,above)));popup.style.width=width+"px";popup.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+"px";popup.style.maxHeight=space+"px";if(below>=Math.min(300,above))popup.style.top=rect.bottom+6+"px";else popup.style.bottom=window.innerHeight-rect.top+6+"px";search.focus()}
$("#toggleFilters").onclick=()=>{state.filtersExpanded=!state.filtersExpanded;renderFilters()};$("#filters").onclick=e=>{const trigger=e.target.closest("[data-filter-trigger]");if(trigger)openFilterPopover(trigger)};
document.addEventListener("pointerdown",e=>{if(!e.target.closest("#filterPopover")&&!e.target.closest("[data-filter-trigger]"))closeFilterPopover()});window.addEventListener("resize",()=>closeFilterPopover());window.addEventListener("scroll",e=>{if(!e.target.closest?.("#filterPopover"))closeFilterPopover()},true);
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
 const html='<article class="card '+(state.selected.has(r.identity)?"selected":"")+'"><input type="checkbox" class="select-card" data-select="'+r.identity+'" '+(state.selected.has(r.identity)?"checked":"")+' aria-label="选择'+esc(r.name)+'"><img class="cover" src="'+esc(r.imageUrl)+'" loading="lazy" decoding="async" alt="'+esc(r.name)+'" data-detail="'+r.identity+'"><div class="card-body"><span class="card-id">'+r.id+'</span><h3 title="'+esc(r.name)+'" data-detail="'+r.identity+'">'+esc(r.name)+'</h3><p class="card-description">'+esc(r.description||"等待一份关于它的描述。")+'</p><div class="chips">'+r.tags.slice(0,8).map(t=>'<span class="chip" title="'+esc(ATLAS.taxonomy.find(d=>d.id===t.dimension)?.name||"")+'">'+esc(t.name)+'</span>').join("")+'</div><div class="card-meta"><span>'+esc(r.projectName)+'</span><span>'+size(r.size)+'</span></div></div></article>';return recycle?html.replace('data-select="'+r.identity+'"','data-recycle-select="'+r.identity+'"').replace('class="card '+(state.selected.has(r.identity)?"selected":"")+'"','class="card '+(state.recycleSelected.has(r.identity)?"selected":"")+'"').replace(' '+(state.selected.has(r.identity)?"checked":"")+' aria-label',' '+(state.recycleSelected.has(r.identity)?"checked":"")+' aria-label').replace('</div></article>','<button data-restore="'+esc(r.identity)+'" '+(r.purgePending?'disabled':'')+'>恢复素材</button><button class="danger" data-purge="'+esc(r.identity)+'">删除素材</button></div></article>'):html;
}
function render(){
 renderFilters();$(".header-actions").hidden=state.view==="recycle";
 $("#viewTitle").textContent="灵感总览";$("#viewSubtitle").textContent="THE INSPIRATION ATLAS";$("#viewDescription").textContent="把片刻灵感，收藏成自己的图鉴。";
 const titles={library:["灵感总览","THE INSPIRATION ATLAS"],taxonomy:["标签库","CLASSIFY YOUR INSPIRATION"],projects:["灵感集","ORGANIZE YOUR COLLECTION"],recycle:["回收站","RESTORE YOUR ASSETS"]};$("#viewTitle").textContent=titles[state.view][0];$("#viewSubtitle").textContent=titles[state.view][1];$("#libraryTools").hidden=state.view!=="library";document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));if(state.view!=="library"){$("#viewDescription").textContent=state.view==="taxonomy"?"父类别固定，在输入或选择子标签中扩展词库。":state.view==="recycle"?"恢复素材，原文件保持完整。":"按灵感集整理你的素材。";renderAuxiliary();return}
 const list=filtered(),max=Math.max(1,Math.ceil(list.length/60));state.page=Math.min(state.page,max);
 $("#content").innerHTML=list.length?'<div class="results-bar"><span>发现灵感</span><button id="clearFilters" class="text-button">重置筛选</button></div><div class="grid">'+list.slice((state.page-1)*60,state.page*60).map(r=>card(r)).join("")+'</div><div class="dialog-actions"><span class="muted">共 '+list.length+' 项 · '+state.page+' / '+max+'</span><button data-page="-1" '+(state.page===1?"disabled":"")+'>上一页</button><button data-page="1" '+(state.page===max?"disabled":"")+'>下一页</button></div>':'<div class="empty">尚未发现匹配的灵感。上传图片或文件夹，开始收藏你的图鉴。<p><button id="clearFilters">重置筛选</button></p></div>';selection();
 $("#clearFilters").onclick=()=>{state.filters={};$("#search").value="";$("#projectFilter").value="";state.page=1;render()};
}
function renderAuxiliary(){
 if(state.view==="recycle"){
  $("#content").innerHTML='<div class="selection-bar"><label class="check"><input id="recycleAll" type="checkbox">全选</label><span id="recycleCount"></span><button id="purgeSelected" class="danger">删除选中</button><button id="clearRecycle" class="danger">清空</button></div>'+(state.recycle.length?'<div class="grid">'+state.recycle.map(r=>card(r,true)).join("")+'</div>':'<div class="empty">回收站为空</div>');recycleSelection();$("#recycleAll").onchange=e=>{for(const r of state.recycle)e.target.checked?state.recycleSelected.add(r.identity):state.recycleSelected.delete(r.identity);renderAuxiliary()};$("#purgeSelected").onclick=()=>purgeDialog(state.recycle.filter(r=>state.recycleSelected.has(r.identity)));$("#clearRecycle").onclick=()=>purgeDialog([...state.recycle],true);
 }else if(state.view==="taxonomy"){
  $("#content").innerHTML=ATLAS.taxonomy.map(d=>{
   const tags=state.labels.filter(t=>t.dimension===d.id),groups=[...new Set(tags.map(t=>t.groupName||"新增标签"))];
   return '<section class="panel"><div class="category-head"><div><h3>'+esc(d.name)+'</h3><span class="muted small">'+esc(d.description||"固定父类别")+' · '+tags.length+' 个子标签</span></div><button data-add-tag="'+d.id+'">＋ 添加子标签</button></div>'+groups.map(g=>'<div class="tag-group"><h4>'+esc(g)+'</h4>'+tags.filter(t=>(t.groupName||"新增标签")===g).map(t=>'<span class="chip">'+esc(t.name)+'</span>').join("")+'</div>').join("")+'</section>';
  }).join("");
 }else{
  $("#content").innerHTML='<div class="dialog-actions"><button id="newProject">新建灵感集</button></div><div class="project-grid">'+allProjects().filter(p=>state.roles.some(r=>r.projectName===p)).map(p=>'<section class="panel project-card"><h3>'+esc(p)+'</h3><span class="muted small">灵感集</span><strong>'+state.roles.filter(r=>r.projectName===p).length+'</strong><button data-project="'+esc(p)+'">浏览素材</button></section>').join("")+'</div>';$("#newProject").onclick=()=>newProject();
 }
}
function recycleSelection(){const count=state.recycleSelected.size;$("#recycleCount").textContent="已选 "+count+" 项";$("#purgeSelected").disabled=!count;$("#clearRecycle").disabled=!state.recycle.length;$("#recycleAll").checked=!!state.recycle.length&&state.recycle.every(r=>state.recycleSelected.has(r.identity));$("#recycleAll").indeterminate=count>0&&count<state.recycle.length}
function purgeDialog(roles,clear=false){if(!roles.length)return;const items=roles.map(r=>({identity:r.identity,revision:r.revision}));modal(clear?"清空回收站":"永久删除素材",'<p>将永久删除这 '+items.length+' 份素材及其原文件，删除后无法恢复。</p><p id="purgeError" class="error"></p><div class="dialog-actions"><button id="cancelPurge">取消</button><button id="confirmPurge" class="danger">确认永久删除</button></div>');$("#cancelPurge").onclick=()=>$("#modal").close();$("#confirmPurge").onclick=async()=>{const button=$("#confirmPurge");button.disabled=true;$("#closeModal").disabled=true;try{let deleted=0,failed=0;for(let i=0;i<items.length;i+=25){const r=await post("/api/assets/purge",{items:items.slice(i,i+25)});deleted+=r.deleted;failed+=r.failed||0}await refresh(true);$("#modal").close();toast("已永久删除 "+deleted+" 项"+(failed?"；部分文件删除失败，可重新选择重试":deleted<items.length?"；部分素材已变化，请重新选择":""))}catch(e){await refresh(true);$("#purgeError").textContent=e.message;button.disabled=false}finally{if($("#closeModal"))$("#closeModal").disabled=false}}}
function roleByIdentity(id){return [...state.roles,...state.recycle].find(r=>r.identity===id)}
function assetPath(r,action=""){return"/api/assets/"+r.id+(action?"/"+action:"")+"?v="+encodeURIComponent(r.identity)}
function groupedTags(tags){return '<dl class="analysis-tags">'+ATLAS.taxonomy.map(d=>{const names=[...new Set(tags.filter(t=>t.dimension===d.id).map(t=>t.name))];return names.length?'<div><dt>'+esc(d.name)+'</dt><dd>'+names.map(n=>'<span class="chip">'+esc(n)+'</span>').join("")+'</dd></div>':""}).join("")+'</dl>'}
function details(r){
 modal(r.name,'<div class="detail-grid"><div><img class="detail-image" src="'+esc(r.imageUrl)+'" alt="'+esc(r.name)+'"></div><div><p class="eyebrow">'+r.id+'</p><p>'+esc(r.description||"尚未添加描述")+'</p>'+groupedTags(r.tags)+'<dl class="info-grid">'+[["源文件",r.filename],["源文件大小",size(r.size)],["分辨率",resolution(r)],["比例",aspect(r)],["上传时间",date(r.createdAt)],["灵感集",r.projectName]].map(([n,v])=>'<div><dt>'+n+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl>'+(r.deletedAt?"":analysisModelSelect("detailAnalysisModel"))+'<h3>提示词</h3><p class="prompt">'+esc(r.generationPrompt||"未填写；分析图片后自动生成中文提示词")+'</p><div class="dialog-actions"><a href="'+esc(r.downloadUrl)+'" download>下载原图</a>'+(r.deletedAt?'':'<button id="editRole">编辑</button><button id="analyzeRole" '+(!canAnalyze()?"disabled":"")+'>分析标签</button>')+'</div><p class="muted small">模型仅添加固定类别下的子标签。子标签由模型根据图片生成；手动标签和已填写的提示词会保留。</p><p id="detailError" class="error"></p></div></div>');
 if(!r.deletedAt){$("#editRole").onclick=()=>editRole(r);$("#analyzeRole").onclick=async()=>{const b=$("#analyzeRole");b.disabled=true;b.textContent="正在分析…";try{const result=await analyzeAsset(r,$("#detailAnalysisModel")?.value);await refresh(true);details(result.role);toast("分析完成，已添加 "+result.acceptedCount+" 个标签")}catch(e){$("#detailError").textContent=e.message;b.disabled=false;b.textContent="重试分析"}}}
}
function projectList(){return '<datalist id="projectNames">'+allProjects().map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>'}
function tagAdder(dim="style"){return '<div class="tag-add-row"><select id="tagDimension">'+ATLAS.taxonomy.map(d=>'<option value="'+d.id+'" '+(d.id===dim?"selected":"")+'>'+esc(d.name)+'</option>').join("")+'</select><input id="tagName" placeholder="输入或选择子标签" list="tagNames" maxlength="40"><button type="button" id="addTag">添加</button></div><datalist id="tagNames"></datalist><div id="tagSuggestions" class="tag-suggestions"></div>'}
function wireTagOptions(){const update=()=>{
 const dim=$("#tagDimension").value,d=ATLAS.taxonomy.find(t=>t.id===dim);$("#tagNames").innerHTML=state.labels.filter(t=>t.dimension===dim).map(t=>'<option value="'+esc(t.name)+'" label="'+esc(t.groupName||"自定义")+'">').join("");
 const context=state.editTags.filter(t=>t.dimension===dim).flatMap(t=>d.refinements?.[t.name]||[]),fallback=dim==="theme"?["仙子","魔女","剑仙","女巫","法师","太空舰长","森林","城堡"]:d.groups.flatMap(g=>g.values).slice(0,8),suggestions=[...new Set(context.length?context:fallback)].filter(n=>!state.editTags.some(t=>t.dimension===dim&&t.name===n));
 $("#tagSuggestions").innerHTML=suggestions.length?'<span class="small muted">细分参考（按画面选择）</span><div class="chips">'+suggestions.slice(0,12).map(n=>'<button type="button" data-suggest-tag="'+esc(n)+'">'+esc(n)+'</button>').join("")+"</div>":"";
 };$("#tagDimension").onchange=update;update();$("#tagSuggestions").onclick=e=>{const b=e.target.closest("[data-suggest-tag]");if(b){$("#tagName").value=b.dataset.suggestTag;$("#addTag").click();update()}}}
function wireManualTags(errorSelector){
 const draw=()=>{$("#editTags").innerHTML=state.editTags.map((t,i)=>'<button type="button" data-remove-tag="'+i+'">'+esc(t.name)+' ×</button>').join("");$("#editTags").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.editTags.splice(Number(b.dataset.removeTag),1);draw()})};draw();
 const commitPendingTag=()=>{const t={dimension:$("#tagDimension").value,name:$("#tagName").value.normalize("NFKC").trim()};if(t.name&&!state.editTags.some(x=>x.dimension===t.dimension&&x.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g,"")===t.name.toLocaleLowerCase().replace(/\s+/g,""))){if(t.name.length>40||/[<>\x00-\x1f]/.test(t.name)){$(errorSelector).textContent="子标签为1至40个有效字符";return false}state.editTags.push(t);draw()}$("#tagName").value="";return true};
 $("#addTag").onclick=commitPendingTag;$("#tagName").onkeydown=e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();commitPendingTag()}};
 return commitPendingTag;
}
function editRole(r){
 state.editTags=r.tags.map(t=>({...t}));
 modal("编辑素材",'<form id="editForm"><div class="row"><label>素材名<input name="name" value="'+esc(r.name)+'" required maxlength="180"></label><label>灵感集<input name="projectName" list="projectNames" value="'+esc(r.projectName)+'" maxlength="40" required></label><label>分组方式<select name="groupingMode"><option value="manual">保留手动分组</option><option value="ai" '+(r.groupingMode==="ai"?"selected":"")+'>模型自动分组</option></select></label></div>'+projectList()+'<label>描述<textarea name="description" maxlength="1200">'+esc(r.description)+'</textarea></label><label>提示词<textarea name="generationPrompt" maxlength="12000">'+esc(r.generationPrompt)+'</textarea></label><h3>标签</h3><div id="editTags" class="editor-tags"></div>'+tagAdder()+'<p class="form-note">输入或选择子标签，按 Enter 或点击添加。直接保存也会收录输入的新标签。点击已有标签可移除。</p><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary" id="saveRole">保存</button></div></form>');wireTagOptions();
 const commitPendingTag=wireManualTags("#formError");
 $("#editForm").onsubmit=async e=>{e.preventDefault();if(!commitPendingTag())return;$("#saveRole").disabled=true;try{const b=Object.fromEntries(new FormData(e.currentTarget));const result=await api(assetPath(r),{method:"PATCH",body:JSON.stringify({...b,identity:r.identity,revision:r.revision,tags:state.editTags})});await refresh(true);details(result.role);toast("素材已保存")}catch(e){$("#formError").textContent=e.message;$("#saveRole").disabled=false}};
}
function tagDialog(dimension){modal("添加子标签",'<form id="tagForm"><label>输入或选择子标签<input id="tagName" name="name" list="tagNames" maxlength="40" required></label><datalist id="tagNames">'+labelOptions(dimension).map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#tagForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/tags",{dimension,name:$("#tagName").value});await refresh(true);$("#modal").close();toast("子标签已保存")}catch(error){$("#formError").textContent=error.message}}}
function newProject(){modal("新建灵感集",'<form id="projectForm"><label>灵感集<input name="name" maxlength="40" required></label><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#projectForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/projects",{name:e.currentTarget.elements.name.value});await refresh(true);$("#modal").close();toast("灵感集已创建")}catch(error){$("#formError").textContent=error.message}}}
$("#content").onclick=async e=>{
 const el=e.target.closest("[data-detail],[data-select],[data-recycle-select],[data-purge],[data-page],[data-restore],[data-add-tag],[data-project]");if(!el)return;
 if(el.dataset.recycleSelect){el.checked?state.recycleSelected.add(el.dataset.recycleSelect):state.recycleSelected.delete(el.dataset.recycleSelect);el.closest(".card").classList.toggle("selected",el.checked);recycleSelection()}
 if(el.dataset.purge)purgeDialog([roleByIdentity(el.dataset.purge)]);
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
 state.editTags=[];
 state.files=[];
 modal("上传素材",'<form id="uploadForm"><div class="dropzone"><p>选择图片，或选择整个文件夹。原文件保存到云端，登录其他设备后可下载。</p><div class="upload-options"><button type="button" id="chooseFiles">选择图片</button><button type="button" id="chooseFolder">上传文件夹</button></div><input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><input id="folderInput" type="file" webkitdirectory directory multiple hidden><p class="muted small">PNG / JPEG / WebP · 单张不超过20MB · 文件夹中其他格式会跳过</p><div id="fileList" class="file-list"></div></div><div class="row"><label>分组方式<select name="groupingMode" id="groupingMode"><option value="ai" selected>模型自动分组</option><option value="manual">手动指定灵感集</option></select></label><label>灵感集<input name="projectName" id="uploadProjectName" value="未分组" list="projectNames" maxlength="40" disabled></label><label>命名方式<select name="namingMode" id="namingMode"><option value="original">保留原文件名称</option><option value="custom">手动自定义命名</option><option value="ai" selected>模型自动命名</option></select></label></div>'+projectList()+'<div id="customNames" class="file-list" hidden></div><label>提示词（本次素材共用，可分别编辑）<textarea name="generationPrompt" maxlength="12000"></textarea></label>'+'<h3>手动标签</h3><div id="editTags" class="editor-tags"></div>'+tagAdder()+'<p class="form-note">选择父标签后输入子标签，按 Enter 或点击添加。本次上传共用，可在详情逐张修改；分析会保留手动标签。</p>'+analysisModelSelect("uploadAnalysisModel")+'<label class="check"><input type="checkbox" name="autoAnalyze" id="autoAnalyze" '+(!canAnalyze()?"disabled":"")+'>上传后自动分析并添加子标签</label><p class="form-note">自动命名和自动分组需要连接本机 Codex / 本机 Gemini 或配置视觉模型。分析失败时原图保留，可在详情中重试。原始文件名始终保留。</p><p id="uploadError" class="error"></p><div id="uploadProgress" class="progress" hidden></div><div class="dialog-actions"><button id="startUpload" class="primary" disabled>上传到云端</button></div></form>');
 wireTagOptions();const commitUploadTag=wireManualTags("#uploadError");
 const choose=(files)=>{
  const supported=[...files].filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name));state.files=supported.map(file=>({file,name:file.name.replace(/\.[^.]+$/,"")}));
  $("#fileList").textContent=state.files.length+" 张图片 · "+size(supported.reduce((n,f)=>n+f.size,0))+(files.length>supported.length?" · 已跳过 "+(files.length-supported.length)+" 个其他文件":"");
  $("#startUpload").disabled=!supported.length;
  $("#customNames").innerHTML=state.files.map((entry,i)=>'<label class="file-row">'+esc(entry.file.name)+'<input data-custom-name="'+i+'" value="'+esc(entry.name)+'" maxlength="80"></label>').join("");
 };
 $("#chooseFiles").onclick=()=>$("#fileInput").click();$("#chooseFolder").onclick=()=>$("#folderInput").click();
 $("#fileInput").onchange=e=>choose(e.target.files);$("#folderInput").onchange=e=>choose(e.target.files);
 $("#groupingMode").onchange=e=>{$("#uploadProjectName").disabled=e.target.value==="ai";$("#autoAnalyze").checked=$("#namingMode").value==="ai"||e.target.value==="ai";$("#autoAnalyze").disabled=$("#autoAnalyze").checked||!canAnalyze()};
 $("#namingMode").onchange=e=>{$("#customNames").hidden=e.target.value!=="custom";$("#autoAnalyze").checked=e.target.value==="ai"||$("#groupingMode").value==="ai";$("#autoAnalyze").disabled=$("#autoAnalyze").checked||!canAnalyze()};
 $("#namingMode").dispatchEvent(new Event("change"));
 $("#uploadForm").onsubmit=async e=>{
  e.preventDefault();if(!commitUploadTag())return;const uploadTags=state.editTags.map(t=>({...t}));const form=e.currentTarget,fields=Object.fromEntries(new FormData(form)),mode=fields.namingMode,auto=mode==="ai"||fields.groupingMode==="ai"||$("#autoAnalyze").checked,analysisChoice=$("#uploadAnalysisModel")?.value;
  if((mode==="ai"||fields.groupingMode==="ai")&&!canAnalyze()){$("#uploadError").textContent="请先在模型设置中连接本机 Codex 或配置视觉模型，或选择其他命名方式。";return}
  const entries=state.files.map((entry,i)=>({...entry,name:$("#customNames").querySelector('[data-custom-name="'+i+'"]')?.value||entry.name}));
  if(mode==="custom"&&entries.some(entry=>!entry.name.trim())){$("#uploadError").textContent="请为每个素材输入名称";return}
  for(const control of form.querySelectorAll("input,select,textarea,button"))control.disabled=true;$("#closeModal").disabled=true;
  $("#uploadProgress").hidden=false;let ok=0,failed=0,aiFailed=0;
  for(let i=0;i<entries.length;i++){
   const entry=entries[i];$("#uploadProgress").textContent="正在上传 "+(i+1)+" / "+entries.length+"： "+entry.file.name+"\n成功 "+ok+"，上传失败 "+failed+"，分析失败 "+aiFailed;
   try{
    if(entry.file.size>20*1048576)throw new Error("超过20MB");
    const f=new FormData();f.append("file",entry.file);f.append("preview",await preview(entry.file));f.append("projectName",fields.projectName||"未分组");f.append("groupingMode",fields.groupingMode);f.append("namingMode",mode);f.append("name",entry.name);f.append("generationPrompt",fields.generationPrompt||"");f.append("tags",JSON.stringify(uploadTags));
    const result=await api("/api/assets",{method:"POST",body:f});ok++;
    if(auto){try{await analyzeAsset(result.role,analysisChoice)}catch(error){aiFailed++;console.warn("analysis failed for upload");$("#uploadError").textContent="最近一次分析错误："+error.message}}
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
  modal("模型设置",codexControls()+skillControls()+'<details id="apiModelSettings"><summary>API 模型配置（可选）</summary><p class="note">配置保存在你自己的账号中，跨设备同步。密钥在服务端加密保存，不会返回页面。请选择支持图片输入的视觉模型，费用由所选服务商收取。</p><form id="modelForm"><div class="row"><label>服务商<select name="provider" id="provider">'+Object.entries(presets).map(([id,p])=>'<option value="'+id+'" '+(id===(c.provider||"gemini")?"selected":"")+'>'+p.name+'</option>').join("")+'</select></label><label>接口格式<select name="protocol" id="protocol">'+[["openai","OpenAI Chat Completions"],["responses","OpenAI Responses"],["anthropic","Anthropic Messages"],["gemini","Gemini 原生"]].map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join("")+'</select></label></div><label>服务地址<input type="url" name="baseUrl" id="baseUrl" value="'+esc(c.baseUrl||presets.gemini.base)+'"></label><label>视觉模型 ID<input name="model" value="'+esc(c.model||"")+'" placeholder="服务商实际支持的视觉模型名称" maxlength="160"></label><label>API 密钥<input name="apiKey" type="password" autocomplete="off" placeholder="'+(c.hasKey?"已保存；留空保留":"请输入你的密钥")+'"></label><p id="modelError" class="error"></p><div class="dialog-actions"><button type="button" id="removeConfig" class="danger">删除配置</button><button class="primary" '+(!available?"disabled":"")+'>保存 API 配置</button></div></form></details>');
  $("#apiModelSettings").open=!codexLocal.connected&&!!c.model;
  bindCodexControls();await bindSkillControls();
  $("#protocol").value=c.protocol||presets.gemini.protocol;$("#provider").onchange=e=>{const p=presets[e.target.value];$("#protocol").value=p.protocol;$("#baseUrl").value=p.base};
  $("#modelForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));if(!b.model?.trim()&&!b.apiKey?.trim()&&codexLocal.connected){saveCodexPreference();$("#modal").close();toast("本机 Codex 选择已保存，无需 API 配置");return}if(!b.model?.trim()||!b.baseUrl?.trim()){$("#modelError").textContent="仅配置 API 模型时需要填写服务地址和模型 ID；本机 Codex 无需填写。";return}try{await api("/api/model-config",{method:"PUT",body:JSON.stringify(b)});e.target.elements.apiKey.value="";await refresh(true);$("#modal").close();$("#modalContent").innerHTML="";toast("模型配置已保存")}catch(e){$("#modelError").textContent=e.message}};
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
setInterval(()=>{if(state.user&&!document.hidden&&!$("#modal").open&&!$("#filterPopover"))refresh(true)},30000);
(async()=>{try{const r=await api("/api/auth/me");state.ownerSetup=r.ownerSetup;authMode(r.ownerSetup?"register":"login");if(r.user)await loginReady(r.user)}catch(e){$("#authError").textContent=e.message}})();
