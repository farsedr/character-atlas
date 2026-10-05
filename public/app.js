"use strict";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={user:null,roles:[],labels:[],projects:[],recycle:[],view:"library",filters:{},filtersExpanded:false,selected:new Set(),recycleSelected:new Set(),page:1,analysisEnabled:false,authMode:"login",files:[],editTags:[]};
async function api(path,options={}){
 const r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...options.headers}});
 let b;try{b=await r.json()}catch{throw new Error("服务暂不可用，请稍后重试")}
 if(!r.ok){if(r.status===401&&!path.startsWith("/api/auth/")&&!$("#closeModal")?.disabled)showAuth();throw Object.assign(new Error(b.error||"操作失败"),{status:r.status})}return b;
}
const post=(path,b)=>api(path,{method:"POST",body:JSON.stringify(b)});


const codexLocal={token:"",connected:false,model:"gpt-6-luna",reasoning:"low",provider:"codex",providers:{},models:[],maxConcurrent:1};
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
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||"本机模型请求失败"),{status:response.status});return data;
}
async function analyzeAsset(role,choice=codexLocal.connected?codexLocal.provider+":"+codexLocal.model:"api"){
 if(choice==="api"){if(!state.analysisEnabled)throw new Error("请先配置 API 模型");return post(assetPath(role,"analyze"),{})}
 if(!codexLocal.connected)throw new Error("请先连接本机模型");
 const model=choice.slice(choice.indexOf(":")+1),supported=codexLocal.models.find(m=>m.id===model);if(!supported)throw new Error("请选择可用的本机模型");
 const options={model,reasoning:supported.efforts.includes(codexLocal.reasoning)?codexLocal.reasoning:(supported.efforts.includes("low")?"low":supported.efforts[0])};
 const response=await fetch(role.imageUrl,{credentials:"same-origin"});
 if(!response.ok)throw new Error("无法读取预览图");
 const bytes=new Uint8Array(await response.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const installed=await api("/api/analysis-skill");const result=await codexRequest("analyze",{method:"POST",headers:{"Content-Type":"application/json","X-Atlas-Model":options.model,"X-Atlas-Reasoning":options.reasoning},body:JSON.stringify({image:btoa(binary),skill:installed.skill?.content||installed.defaultSkill||"",collections:allProjects().slice(0,200)})});
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
 return '<section class="codex-settings"><p class="note">让模型帮你分析图片、命名和整理标签。连接本机 Codex / Gemini 时，用自己的账号登录，无需填写 API 密钥。</p><p id="codexStatus" class="setup-status" role="status"></p><section class="setup-step"><h3>1. 选择你要使用的模型工具</h3><label>连接方式<select id="localProvider"><option value="codex">本机 Codex（ChatGPT 账号）</option><option value="gemini">本机 Gemini（Google 账号）</option></select></label></section><details class="setup-step"><summary>2. 首次使用：安装并登录（已安装可跳过）</summary><p>Windows：右键开始菜单，打开“终端”；Mac：打开“终端”。如果提示找不到 npm，请先安装 Node.js 22 或更新版本，再重新打开终端。</p><a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">下载 Node.js</a><p>依次复制下面两条命令到终端，每次粘贴后按 Enter。第二条命令会让你登录账号。</p><div class="setup-command"><code id="installModelCommand"></code><button type="button" data-copy-setup="installModelCommand">复制安装命令</button></div><div class="setup-command"><code id="loginModelCommand"></code><button type="button" data-copy-setup="loginModelCommand">复制登录命令</button></div><p id="localLoginHint" class="form-note"></p></details><section class="setup-step"><h3>3. 下载连接包并启动</h3><p>下载后先解压整个压缩包。Windows 双击 start-local-models.cmd；Mac / Linux 在解压目录打开终端，运行 sh start.sh。保持运行窗口打开。</p><div class="dialog-actions"><a href="/share/local-connector.zip" download>下载通用连接包</a><a href="/connection-guide.html" target="_blank" rel="noreferrer">查看图文步骤与常见问题</a><a href="http://127.0.0.1:4379/" target="_blank" rel="noreferrer">打开连接码页面</a></div></section><section class="setup-step"><h3>4. 粘贴连接码，完成连接</h3><p>在刚打开的本机页面复制连接码，粘贴到下面。如浏览器询问是否允许访问本地网络，请允许。</p><label>连接码<input id="codexPairCode" type="password" autocomplete="off" placeholder="粘贴本机页面显示的连接码"></label><div class="dialog-actions"><button type="button" id="connectCodex" class="primary">连接并检测</button></div><p id="codexError" class="error" role="alert"></p><p id="localNextStep" class="form-note"></p></section><details class="setup-step"><summary>调整模型与推理强度（可选）</summary><div class="row"><label>模型<select id="codexModel"></select></label><label>推理强度<select id="codexReasoning"></select></label></div><p class="form-note">默认使用轻量模型。你也可以在分析图片时临时选择；实际可用模型和额度以账号为准。选择保存在当前设备，不会自动升级模型。</p><div class="dialog-actions"><button type="button" id="resetCodexOptions">重置默认</button><button type="button" id="disconnectCodex">断开本机连接</button></div></details></section>';
}
function chooseLocalDefault(){const candidates=codexLocal.models.filter(m=>(m.provider||"codex")===codexLocal.provider);const preferred=codexLocal.provider==="gemini"?"gemini-2.5-flash-lite":"gpt-6-luna";const found=candidates.find(m=>m.id===preferred)||candidates[0];if(found){codexLocal.model=found.id;codexLocal.reasoning=found.efforts.includes("low")?"low":found.efforts[0]}}
function renderCodexChoices(){
 const model=$("#codexModel"),effort=$("#codexReasoning");if(!model)return;
 $("#localProvider").value=codexLocal.provider;
 const gemini=codexLocal.provider==="gemini";$("#installModelCommand").textContent=gemini?"npm install -g @google/gemini-cli":"npm install -g @openai/codex";$("#loginModelCommand").textContent=gemini?"gemini":"codex login";$("#localLoginHint").textContent=gemini?"出现登录方式时选择 Login with Google，完成后退出 Gemini，再启动连接包。":"按终端提示用自己的 ChatGPT 账号登录，完成后启动连接包。";
 const readiness=codexLocal.providers[codexLocal.provider];$("#localNextStep").textContent=!codexLocal.connected?"连接成功后，这里会提示下一步。":readiness?.loggedIn?"已连接并检测到登录。现在可以关闭设置窗口，在上传素材时勾选自动分析。":"连接包已配对，但所选工具尚未完成登录或安装。请展开第 2 步完成，然后重新连接。";const candidates=codexLocal.models.filter(m=>(m.provider||"codex")===codexLocal.provider);model.disabled=effort.disabled=!codexLocal.connected||!candidates.length;
 model.innerHTML=candidates.length?candidates.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join(""):'<option>请安装并登录所选 CLI 后连接</option>';model.value=codexLocal.model;
 const selected=candidates.find(m=>m.id===codexLocal.model);effort.innerHTML=(selected?.efforts||["default"]).map(e=>'<option value="'+esc(e)+'">'+esc(effortNames[e]||e)+'</option>').join("");effort.value=codexLocal.reasoning;
 const status=codexLocal.providers[codexLocal.provider];$("#codexStatus").textContent=(codexLocal.connected?"连接程序已配对":"尚未连接")+(status?" · "+status.status:"")+(selected?" · "+selected.id:"");
}
function bindCodexControls(){
 renderCodexChoices();document.querySelectorAll("[data-copy-setup]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText($("#"+b.dataset.copySetup).textContent);toast("命令已复制，粘贴到终端后按 Enter")}catch{toast("无法自动复制，请选中命令手动复制")}});$("#localProvider").onchange=e=>{codexLocal.provider=e.target.value;chooseLocalDefault();saveCodexPreference();renderCodexChoices()};
 $("#codexModel").onchange=e=>{codexLocal.model=e.target.value;const levels=codexLocal.models.find(m=>m.id===codexLocal.model)?.efforts||[];if(!levels.includes(codexLocal.reasoning))codexLocal.reasoning=levels.includes("low")?"low":levels[0];saveCodexPreference();renderCodexChoices()};
 $("#codexReasoning").onchange=e=>{codexLocal.reasoning=e.target.value;saveCodexPreference()};
 $("#connectCodex").onclick=async()=>{const token=$("#codexPairCode").value.trim();if(!/^[a-f0-9]{48}$/.test(token)){$("#codexError").textContent="请输入本机连接页面显示的完整连接码";return}const button=$("#connectCodex");button.disabled=true;codexLocal.token=token;try{const info=await codexRequest("health");if(info.version!==3)throw Error("请下载新版通用连接包，并重新启动");codexLocal.models=(info.models||[]).filter(m=>typeof m.id==="string"&&Array.isArray(m.efforts)&&m.efforts.length);codexLocal.providers=info.providers||{};codexLocal.maxConcurrent=Math.max(1,Math.min(5,Number(info.maxConcurrent)||1));if(!codexLocal.models.some(m=>m.id===codexLocal.model&&(m.provider||"codex")===codexLocal.provider))chooseLocalDefault();codexLocal.connected=true;$("#codexPairCode").value="";$("#codexError").textContent="";renderCodexChoices();toast("本机连接已配对，请检查所选 CLI 的登录状态")}catch(e){codexLocal.token="";codexLocal.connected=false;renderCodexChoices();$("#codexError").textContent=e.message}finally{button.disabled=false}};
 $("#disconnectCodex").onclick=()=>{codexLocal.token="";codexLocal.connected=false;codexLocal.models=[];codexLocal.providers={};renderCodexChoices();toast("已断开本机连接")};
 $("#resetCodexOptions").onclick=()=>{chooseLocalDefault();saveCodexPreference();renderCodexChoices()};
}
function skillControls(){return '<details class="setup-step"><summary>自定义分析规则 Skill（可选）</summary><p id="skillStatus">正在读取…</p><p class="form-note">安装自己的 SKILL.md，补充分析细节和标签规则。固定父标签、输出格式和视觉证据约束始终保留；适用于本机模型与 API 模型。</p><input id="skillFile" type="file" accept=".md,text/markdown"><div class="dialog-actions"><a href="/share/analysis-SKILL.md" download>下载 Skill 模板</a><button type="button" id="installSkill">安装 Skill</button><button type="button" id="resetSkill">恢复内置 Skill</button></div><p id="skillError" class="error"></p></details>'}
async function bindSkillControls(){const render=async()=>{const result=await api("/api/analysis-skill");$("#skillStatus").textContent=result.skill?"已安装："+result.skill.name:"使用内置 24 维分析 + 角色提示词 Skill"};try{await render()}catch(e){$("#skillError").textContent=e.message}$("#installSkill").onclick=async()=>{try{const file=$("#skillFile").files[0];if(!file)throw Error("请选择 SKILL.md 文件");if(file.size>96000)throw Error("Skill 文件过大");await api("/api/analysis-skill",{method:"PUT",body:JSON.stringify({content:await file.text()})});await render();toast("分析 Skill 已安装")}catch(e){$("#skillError").textContent=e.message}};$("#resetSkill").onclick=async()=>{try{await api("/api/analysis-skill",{method:"DELETE"});await render();toast("已恢复内置 Skill")}catch(e){$("#skillError").textContent=e.message}}}
function toast(s){const message=$("#toast");message.textContent=s;message.style.display="block";if(message.showPopover){message.setAttribute("popover","manual");if(message.matches(":popover-open"))message.hidePopover();message.showPopover()}clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{if(message.hidePopover&&message.matches(":popover-open"))message.hidePopover();message.style.display="none"},5000)}
function modal(title,body){$("#modal").dataset.kind="";$("#modalContent").innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button id="closeModal" aria-label="关闭">×</button></div><div class="dialog-body">'+body+'</div>';$("#closeModal").onclick=()=>$("#modal").close();if(!$("#modal").open)$("#modal").showModal()}
function showAuth(){codexLocal.token="";codexLocal.connected=false;codexLocal.models=[];codexLocal.providers={};closeFilterPopover();state.user=null;state.roles=[];state.labels=[];state.projects=[];state.recycle=[];state.selected.clear();state.recycleSelected.clear();$("#app").hidden=true;$("#authScreen").hidden=false;$("#modal").close();$("#userName").textContent="";$("#content").innerHTML=""}
// Scene styles load with the document to avoid the old login theme flashing.
const scene=document.querySelector(".character-scene");
const scenePictures=["/scene-palace.png","/scene-blue.png","/scene-gold.png","/scene-silver.png","/scene-qingxiao-portrait.png","/scene-qingxiao-full.png"];
const sceneLayers=scene.querySelectorAll(".scene-image");let sceneIndex=0,sceneChanging=false;sceneLayers[0].style.backgroundImage='url("'+scenePictures[0]+'")';
scenePictures.slice(1).forEach(src=>{const preload=new Image();preload.src=src});
sceneLayers[1].addEventListener("transitionend",e=>{if(e.propertyName!=="opacity"||!sceneChanging)return;sceneLayers[0].style.backgroundImage=sceneLayers[1].style.backgroundImage;sceneLayers[0].style.backgroundPosition=sceneLayers[1].style.backgroundPosition;sceneLayers[1].style.transition="none";sceneLayers[1].classList.remove("is-active");void sceneLayers[1].offsetWidth;requestAnimationFrame(()=>{sceneLayers[1].style.transition="";sceneChanging=false})});
setInterval(()=>{if(sceneChanging||document.hidden||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;sceneChanging=true;const nextIndex=(sceneIndex+1)%scenePictures.length,img=new Image();img.onerror=()=>{sceneChanging=false};img.onload=()=>{sceneLayers[1].style.backgroundImage='url("'+scenePictures[nextIndex]+'")';sceneLayers[1].style.backgroundPosition=nextIndex>=4?"center 28%":"center";requestAnimationFrame(()=>requestAnimationFrame(()=>{sceneLayers[1].classList.add("is-active");sceneIndex=nextIndex}))};img.src=scenePictures[nextIndex]},20000);
const remember=document.createElement("div");remember.id="rememberRow";remember.innerHTML='<button id="rememberPassword" type="button" aria-pressed="false">记住密码</button>';$("#authSubmit").before(remember);
let rememberedLogin=null;
function loginVault(action,value){return new Promise((resolve,reject)=>{const open=indexedDB.open("atlas-login-vault",1);open.onupgradeneeded=()=>open.result.createObjectStore("credentials");open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction("credentials",action==="read"?"readonly":"readwrite"),store=tx.objectStore("credentials");const request=action==="read"?store.get("login"):action==="save"?store.put(value,"login"):store.delete("login");let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)}}})}
async function saveRememberedLogin(email,password){rememberedLogin={email,password};localStorage.setItem("atlas-login-preference",JSON.stringify({email}));if(!globalThis.indexedDB||!crypto.subtle)return;const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]),iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(password));await loginVault("save",{email,key,iv,encrypted})}
async function restoreRememberedLogin(){try{let saved=rememberedLogin;if(!saved&&globalThis.indexedDB&&crypto.subtle){const record=await loginVault("read");if(record)saved={email:record.email,password:new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:record.iv},record.key,record.encrypted))}}if(!saved&&localStorage.getItem("atlas-login-preference")&&window.PasswordCredential&&navigator.credentials?.get){const credential=await navigator.credentials.get({password:true,mediation:"silent"});if(credential)saved={email:credential.id,password:credential.password}}const fields=$("#authForm").elements;if(saved&&state.authMode==="login"&&!state.user&&$("#rememberPassword").getAttribute("aria-pressed")==="true"&&(!fields.email.value||fields.email.value===saved.email)&&!fields.password.value){rememberedLogin=saved;fields.email.value=saved.email;fields.password.value=saved.password}}catch{}}
$("#rememberPassword").onclick=()=>{const enabled=$("#rememberPassword").getAttribute("aria-pressed")!=="true";$("#rememberPassword").setAttribute("aria-pressed",String(enabled));if(!enabled){rememberedLogin=null;localStorage.removeItem("atlas-login-preference");if(globalThis.indexedDB)loginVault("delete").catch(()=>{})}else restoreRememberedLogin()};
document.addEventListener("visibilitychange",()=>document.body.classList.toggle("scene-paused",document.hidden));
function authMode(mode){
 state.authMode=mode;$("#authError").textContent="";$("#authForm").reset();
 $("#nameLabel").hidden=mode!=="register";$("#confirmLabel").hidden=mode==="login";$("#recoveryLabel").hidden=mode!=="recover";
 $("#authTitle").textContent={login:"登录你的素材库",register:"注册账号",recover:"找回密码"}[mode];
 $("#authHint").textContent=mode==="register"?(state.ownerSetup?"注册后，你现有的素材将归属到这个账号。":"每个用户独立注册，素材库与其他账号完全隔离。"):"使用同一个账号，在不同设备继续整理。";
 $("#passwordLabel").textContent=mode==="recover"?"新密码":"密码";$("#authSubmit").textContent={login:"登录",register:"注册",recover:"重设密码"}[mode];
 $("#authForm").elements.password.autocomplete=mode==="login"?"current-password":"new-password";
 $("#rememberRow").hidden=mode!=="login";
 let remembered;try{remembered=JSON.parse(localStorage.getItem("atlas-login-preference")||"null")}catch{}
 $("#rememberPassword").setAttribute("aria-pressed",String(!!remembered));
 if(mode==="login"&&remembered)$("#authForm").elements.email.value=remembered.email||"";
 if(mode==="login"&&remembered)restoreRememberedLogin();
}
async function loginReady(user){state.user=user;globalThis.resumeBaiduBackup?.();loadCodexPreference();state.filters={};state.selected.clear();state.view="library";$("#authScreen").hidden=true;$("#app").hidden=false;$("#userName").textContent=user.name+" · "+user.email;await refresh()}
function recoveryDialog(code){
 modal("请保存账号恢复代码",'<p class="note">这是你的独立账号恢复凭据，仅本次显示。请保存到密码管理器。忘记密码后可用邮箱和此代码恢复账号。它不会发送到邮箱，也不要分享给其他人。</p><p class="code">'+esc(code)+'</p><div class="dialog-actions"><button id="copyRecovery">复制代码</button><button id="savedRecovery" class="primary">我已保存</button></div>');
 $("#copyRecovery").onclick=async()=>{try{await navigator.clipboard.writeText(code);toast("已复制")}catch{toast("请选择代码并手动复制")}};
 $("#savedRecovery").onclick=()=>$("#modal").close();
}
$("#authForm").onsubmit=async e=>{
 e.preventDefault();const form=e.currentTarget,b=Object.fromEntries(new FormData(form));
 if(state.authMode!=="login"&&b.password!==b.confirmPassword){$("#authError").textContent="两次输入的密码不一致";return}
 $("#authSubmit").disabled=true;$("#authError").textContent="";
 try{const r=await post("/api/auth/"+state.authMode,b);if(state.authMode==="login"){if($("#rememberPassword").getAttribute("aria-pressed")==="true"){try{await saveRememberedLogin(b.email,b.password)}catch{toast("密码仅在本次页面保留；请允许浏览器保存本站数据")}if(window.PasswordCredential&&navigator.credentials?.store)try{await navigator.credentials.store(new PasswordCredential({id:b.email,password:b.password,name:r.user.name}))}catch{}}else{rememberedLogin=null;localStorage.removeItem("atlas-login-preference");if(globalThis.indexedDB)await loginVault("delete").catch(()=>{})}}form.reset();await loginReady(r.user);if(r.recoveryCode)recoveryDialog(r.recoveryCode)}catch(e){$("#authError").textContent=e.message}finally{$("#authSubmit").disabled=false}
};
document.querySelectorAll("[data-auth]").forEach(b=>b.onclick=()=>authMode(b.dataset.auth));
async function refresh(silent=false){
 if(!state.user)return;try{
 const r=await api("/api/library");Object.assign(state,{roles:r.roles,labels:r.labels.map(t=>({...t,groupName:tagGroup(ATLAS.taxonomy,t)})),projects:r.projects,recycle:r.recycle||[],analysisEnabled:r.analysisEnabled,modelConfig:r.modelConfig});restoreUploadJobs(r.drafts||[]);
 const valid=new Set(state.roles.map(r=>r.identity));for(const id of state.selected)if(!valid.has(id))state.selected.delete(id);
 const recycled=new Set(state.recycle.map(r=>r.identity));for(const id of state.recycleSelected)if(!recycled.has(id))state.recycleSelected.delete(id);
 render();if(r.migrationPending)setTimeout(()=>refresh(true),1000);if(!silent)toast(r.migrationPending?"正在同步现有素材，请稍候…":"已同步云端数据");
 }catch(e){if(!silent)toast(e.message)}
}
function roleProjects(r){return r.projectNames||[r.projectName||"未分组"]}
function allProjects(){return [...new Set([...state.projects.map(p=>p.name),...state.roles.flatMap(roleProjects)])].sort((a,b)=>a.localeCompare(b,"zh-CN"))}
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
document.addEventListener("pointerdown",e=>{document.querySelectorAll(".project-picker").forEach(root=>{if(!root.contains(e.target)){root.querySelector(".project-popup").hidden=true;root.querySelector(".project-trigger").setAttribute("aria-expanded","false")}});if(!e.target.closest("#filterPopover")&&!e.target.closest("[data-filter-trigger]"))closeFilterPopover()});window.addEventListener("resize",()=>closeFilterPopover());window.addEventListener("scroll",e=>{if(!e.target.closest?.("#filterPopover"))closeFilterPopover()},true);
function filtered(){
 const q=$("#search").value.trim().toLowerCase(),p=$("#projectFilter").value;
 let list=state.roles.filter(r=>(!p||roleProjects(r).includes(p))&&Object.entries(state.filters).every(([dim,n])=>!n||r.tags.some(t=>t.dimension===dim&&t.name===n))&&(!q||[r.id,r.name,r.filename,...roleProjects(r),r.generationPrompt,r.description,...r.tags.map(t=>t.name)].join(" ").toLowerCase().includes(q)));
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
function galleryPageSize(){const columns=Number(getComputedStyle(document.documentElement).getPropertyValue("--gallery-columns"))||(window.innerWidth>=1500?4:window.innerWidth<=1100?2:3);return columns*4}
function visibleGalleryRoles(){const pageSize=galleryPageSize();return filtered().slice((state.page-1)*pageSize,state.page*pageSize)}
let previousGalleryPageSize=galleryPageSize();
window.addEventListener("resize",()=>{const next=galleryPageSize();if(next===previousGalleryPageSize)return;const first=(state.page-1)*previousGalleryPageSize;previousGalleryPageSize=next;state.page=Math.floor(first/next)+1;if(state.user&&state.view==="library")render()});
function selection(){const list=visibleGalleryRoles();$("#selectedCount").textContent="已选 "+state.selected.size+" 项";$("#deleteButton").disabled=!state.selected.size;$("#downloadButton").disabled=!state.selected.size||!!state.downloadBusy;$("#selectAll").checked=!!list.length&&list.every(r=>state.selected.has(r.identity))}
function card(r,recycle=false){
 const html='<article class="card '+(state.selected.has(r.identity)?"selected":"")+'"><input type="checkbox" class="select-card" data-select="'+r.identity+'" '+(state.selected.has(r.identity)?"checked":"")+' aria-label="选择'+esc(r.name)+'"><img class="cover" src="'+esc(r.imageUrl)+'" loading="lazy" decoding="async" alt="'+esc(r.name)+'" data-detail="'+r.identity+'"><div class="card-body"><span class="card-id">'+r.id+'</span><h3 title="'+esc(r.name)+'" data-detail="'+r.identity+'">'+esc(r.name)+'</h3><p class="card-description">'+esc(r.description||"等待一份关于它的描述。")+'</p><div class="chips">'+r.tags.slice(0,8).map(t=>'<span class="chip" title="'+esc(ATLAS.taxonomy.find(d=>d.id===t.dimension)?.name||"")+'">'+esc(t.name)+'</span>').join("")+'</div><div class="card-meta"><span>'+esc(roleProjects(r).join("、"))+'</span><span>'+size(r.size)+'</span></div>'+(recycle?'':'<div class="card-actions"><a href="'+esc(r.downloadUrl)+'" download>下载</a><button type="button" data-edit="'+esc(r.identity)+'">编辑</button><button type="button" class="danger" data-delete="'+esc(r.identity)+'">删除</button></div>')+'</div></article>';return recycle?html.replace('data-select="'+r.identity+'"','data-recycle-select="'+r.identity+'"').replace('class="card '+(state.selected.has(r.identity)?"selected":"")+'"','class="card '+(state.recycleSelected.has(r.identity)?"selected":"")+'"').replace(' '+(state.selected.has(r.identity)?"checked":"")+' aria-label',' '+(state.recycleSelected.has(r.identity)?"checked":"")+' aria-label').replace('</div></article>',(r.purgeError?'<p class="error">'+esc(r.purgeError)+'</p>':'')+'<button data-restore="'+esc(r.identity)+'" '+(r.purgePending?'disabled':'')+'>恢复素材</button><button class="danger" data-purge="'+esc(r.identity)+'">删除素材</button></div></article>'):html;
}
function render(){
 renderFilters();$(".header-actions").hidden=state.view==="recycle";
 $("#viewTitle").textContent="灵感总览";$("#viewSubtitle").textContent="THE INSPIRATION ATLAS";$("#viewDescription").textContent="把片刻灵感，收藏成自己的图鉴。";
 const titles={library:["灵感总览","THE INSPIRATION ATLAS"],taxonomy:["标签库","CLASSIFY YOUR INSPIRATION"],projects:["灵感集","ORGANIZE YOUR COLLECTION"],recycle:["回收站","RESTORE YOUR ASSETS"]};$("#viewTitle").textContent=titles[state.view][0];$("#viewSubtitle").textContent=titles[state.view][1];$("#libraryTools").hidden=state.view!=="library";document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));if(state.view!=="library"){$("#viewDescription").textContent=state.view==="taxonomy"?"父类别固定，在输入或选择子标签中扩展词库。":state.view==="recycle"?"恢复素材，原文件保持完整。":"按灵感集整理你的素材。";renderAuxiliary();return}
 const list=filtered(),pageSize=galleryPageSize(),max=Math.max(1,Math.ceil(list.length/pageSize));state.page=Math.min(state.page,max);
 $("#content").innerHTML=list.length?'<div class="results-bar"><span>发现灵感</span><button id="clearFilters" class="text-button">重置筛选</button></div><div class="grid">'+list.slice((state.page-1)*pageSize,state.page*pageSize).map(r=>card(r)).join("")+'</div><nav class="gallery-pagination" aria-label="素材分页"><span class="muted">共 '+list.length+' 项 · '+state.page+' / '+max+'</span><button data-page="-1" '+(state.page===1?"disabled":"")+'>上一页</button><button data-page="1" '+(state.page===max?"disabled":"")+'>下一页</button><form class="page-jump" id="pageJumpForm"><label for="pageJumpInput">页码</label><input id="pageJumpInput" type="number" inputmode="numeric" min="1" max="'+max+'" step="1" value="'+state.page+'" aria-label="跳转页码" required><button type="submit">跳转</button></form></nav>':'<div class="empty">尚未发现匹配的灵感。上传图片或文件夹，开始收藏你的图鉴。<p><button id="clearFilters">重置筛选</button></p></div>';selection();
 $("#clearFilters").onclick=()=>{state.filters={};$("#search").value="";$("#projectFilter").value="";state.page=1;render()};
}
function renderAuxiliary(){
 if(state.view==="recycle"){
  $("#content").innerHTML='<div class="selection-bar"><label class="check"><input id="recycleAll" type="checkbox">全选</label><span id="recycleCount"></span><button id="purgeSelected" class="danger">删除选中</button><button id="clearRecycle" class="danger">清空</button></div>'+(state.recycle.length?'<div class="grid">'+state.recycle.map(r=>card(r,true)).join("")+'</div>':'<div class="empty">回收站为空</div>');recycleSelection();$("#recycleAll").onchange=e=>{for(const r of state.recycle)e.target.checked?state.recycleSelected.add(r.identity):state.recycleSelected.delete(r.identity);renderAuxiliary()};$("#purgeSelected").onclick=()=>purgeDialog(state.recycle.filter(r=>state.recycleSelected.has(r.identity)));$("#clearRecycle").onclick=()=>purgeDialog([...state.recycle],true);
 }else if(state.view==="taxonomy"){
  $("#content").innerHTML=ATLAS.taxonomy.map(d=>{
   const tags=state.labels.filter(t=>t.dimension===d.id),groups=[...new Set(tags.map(t=>tagGroup(ATLAS.taxonomy,t)))];
   return '<section class="panel"><div class="category-head"><div><h3>'+esc(d.name)+'</h3><span class="muted small">'+esc(d.description||"固定父类别")+' · '+tags.length+' 个子标签</span></div><button data-add-tag="'+d.id+'">＋ 添加子标签</button></div>'+groups.map(g=>'<div class="tag-group"><h4>'+esc(g)+'</h4>'+tags.filter(t=>(tagGroup(ATLAS.taxonomy,t))===g).map(t=>'<span class="chip">'+esc(t.name)+'</span>').join("")+'</div>').join("")+'</section>';
  }).join("");
 }else{
  $("#content").innerHTML='<div class="dialog-actions"><button id="newProject">新建灵感集</button></div><div class="project-grid">'+allProjects().filter(p=>state.projects.some(x=>x.name===p&&x.isSystem)||state.roles.some(r=>roleProjects(r).includes(p))).map(p=>'<section class="panel project-card"><h3>'+esc(p)+'</h3><span class="muted small">'+(state.projects.some(x=>x.name===p&&x.isSystem)?'系统内置 · 长期保留':'灵感集')+'</span><strong>'+state.roles.filter(r=>roleProjects(r).includes(p)).length+'</strong><button data-project="'+esc(p)+'">浏览素材</button></section>').join("")+'</div>';$("#newProject").onclick=()=>newProject();
 }
}
function recycleSelection(){const count=state.recycleSelected.size;$("#recycleCount").textContent="已选 "+count+" 项";$("#purgeSelected").disabled=!count;$("#clearRecycle").disabled=!state.recycle.length;$("#recycleAll").checked=!!state.recycle.length&&state.recycle.every(r=>state.recycleSelected.has(r.identity));$("#recycleAll").indeterminate=count>0&&count<state.recycle.length}
function purgeDialog(roles,clear=false){if(!roles.length)return;const items=roles.map(r=>({identity:r.identity,revision:r.revision}));modal(clear?"清空回收站":"永久删除素材",'<p>将永久删除这 '+items.length+' 份素材及其原文件，删除后无法恢复。</p><label class="check"><input type="checkbox" id="deleteBaiduBackup">同时删除百度网盘备份</label><p class="form-note">勾选后只删除这些素材对应的应用备份。网盘删除失败时保留网站素材和备份记录，可重新选择重试；不勾选则保留网盘文件。</p><p id="purgeError" class="error"></p><div class="dialog-actions"><button id="cancelPurge">取消</button><button id="confirmPurge" class="danger">确认永久删除</button></div>');$("#cancelPurge").onclick=()=>$("#modal").close();$("#confirmPurge").onclick=async()=>{const button=$("#confirmPurge");button.disabled=true;$("#closeModal").disabled=true;try{let deleted=0,failed=0;const deleteBaiduBackup=$("#deleteBaiduBackup").checked;for(let i=0;i<items.length;i+=25){const r=await post("/api/assets/purge",{items:items.slice(i,i+25),deleteBaiduBackup});deleted+=r.deleted;failed+=r.failed||0}await refresh(true);$("#modal").close();toast("已永久删除 "+deleted+" 项"+(failed?"；部分文件删除失败，可重新选择重试":deleted<items.length?"；部分素材已变化，请重新选择":""))}catch(e){await refresh(true);$("#purgeError").textContent=e.message;button.disabled=false}finally{if($("#closeModal"))$("#closeModal").disabled=false}}}
function roleByIdentity(id){return [...state.roles,...state.recycle].find(r=>r.identity===id)}
function assetPath(r,action=""){return"/api/assets/"+r.id+(action?"/"+action:"")+"?v="+encodeURIComponent(r.identity)}
function groupedTags(tags){return '<dl class="analysis-tags">'+ATLAS.taxonomy.map(d=>{const names=[...new Set(tags.filter(t=>t.dimension===d.id).map(t=>t.name))];return names.length?'<div><dt>'+esc(d.name)+'</dt><dd>'+names.map(n=>'<span class="chip">'+esc(n)+'</span>').join("")+'</dd></div>':""}).join("")+'</dl>'}
function details(r,uploadContext=null){
 modal(r.name,'<div class="detail-grid"><div class="detail-media"><button type="button" class="detail-image-trigger" id="enlargeImage" aria-label="放大素材图片"><img class="detail-image" src="'+esc(r.imageUrl)+'" alt="'+esc(r.name)+'"></button></div><div class="detail-copy" tabindex="0" aria-label="素材详情文字"><p class="eyebrow">'+r.id+'</p><p>'+esc(r.description||"尚未添加描述")+'</p>'+groupedTags(r.tags)+'<dl class="info-grid">'+[["灵感集",roleProjects(r).join("、")],["分辨率",resolution(r)],["大小",size(r.size)],["时间",date(r.createdAt)]].map(([n,v])=>'<div><dt>'+n+'</dt><dd>'+esc(v)+'</dd></div>').join("")+'</dl>'+(r.deletedAt?"":analysisModelSelect("detailAnalysisModel"))+'<div class="prompt-heading"><h3>提示词</h3><button type="button" id="copyPrompt" '+(!r.generationPrompt?.trim()?'disabled':'')+'>复制</button></div><p class="prompt">'+esc(r.generationPrompt||"未填写；分析图片后自动生成中文提示词")+'</p><div class="dialog-actions"><a href="'+esc(r.downloadUrl)+'" download>下载原图</a>'+(r.deletedAt?'':'<button id="editRole">编辑</button><button id="analyzeRole" '+(!canAnalyze()?"disabled":"")+'>分析标签</button>')+'</div><p class="muted small">模型仅添加固定类别下的子标签。子标签由模型根据图片生成；手动标签和已填写的提示词会保留。</p><p id="detailError" class="error"></p></div></div>');
 $("#modal").dataset.kind="asset-detail";
 $("#enlargeImage").onclick=()=>enlargeImage(r);
 if(uploadContext){const back=document.createElement("button");back.type="button";back.id="returnUploadTask";back.textContent="返回任务";back.onclick=()=>openUploadTask(uploadContext.job);$("#modal .detail-copy .dialog-actions").prepend(back)}
 $("#copyPrompt").onclick=async()=>{try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(r.generationPrompt)}else{const input=document.createElement("textarea");input.value=r.generationPrompt;input.style.position="fixed";input.style.opacity="0";document.body.append(input);input.select();try{if(!document.execCommand("copy"))throw new Error("copy failed")}finally{input.remove()}}toast("提示词已复制")}catch{toast("复制失败，请手动选择提示词复制")}};
 if(!r.deletedAt){$("#editRole").onclick=()=>editRole(r,uploadContext&&!uploadContext.item.saved?uploadContext:null);$("#analyzeRole").onclick=async()=>{if(uploadContext&&!uploadContext.item.saved){const {job,item}=uploadContext;openUploadTask(job);if(job.begin)job.begin(false,item,true,true);else runUploadTask(job,true,item,true);return}const b=$("#analyzeRole");b.disabled=true;b.textContent="正在分析…";try{const result=await analyzeAsset(r,$("#detailAnalysisModel")?.value);await refresh(true);details(result.role);toast("分析完成，已添加 "+result.acceptedCount+" 个标签")}catch(e){$("#detailError").textContent=e.message;b.disabled=false;b.textContent="重试"}}}
}
let imageViewerRequest=0;
async function enlargeImage(r){
 const request=++imageViewerRequest;
 let viewer=$("#imageViewer");if(!viewer){viewer=document.createElement("dialog");viewer.id="imageViewer";viewer.setAttribute("aria-label","放大素材图片");document.body.append(viewer)}
 viewer.innerHTML='<div class="image-viewer-heading"><h2>素材预览</h2></div><div class="image-viewer-stage"><img id="enlargedImage" src="'+esc(r.downloadUrl||r.imageUrl)+'" alt="'+esc(r.name)+'"></div><div class="image-viewer-actions"><a id="downloadEnlargedImage" href="'+esc(r.downloadUrl||r.imageUrl)+'" download="'+esc(r.filename||r.name)+'">下载原图</a><button type="button" id="closeImageViewer">返回详情</button></div>';
 const image=$("#enlargedImage"),trigger=$("#enlargeImage");if(trigger)trigger.disabled=true;
 try{await new Promise((resolve,reject)=>{let fallback=false;image.onload=resolve;image.onerror=()=>{if(!fallback&&r.imageUrl&&image.getAttribute("src")!==r.imageUrl){fallback=true;image.src=r.imageUrl}else reject(new Error("图片加载失败，请稍后重试"))};if(image.complete&&image.naturalWidth)resolve()});if(image.decode)await image.decode();if(request!==imageViewerRequest||!$("#modal").open)return;image.onload=image.onerror=null;$("#closeImageViewer").onclick=()=>viewer.close();viewer.querySelector(".image-viewer-stage").onclick=e=>{if(e.target===e.currentTarget)viewer.close()};viewer.onclose=()=>{viewer.innerHTML=""};viewer.showModal()}catch(error){if(request===imageViewerRequest)toast("图片加载失败，请稍后重试")}finally{if(trigger)trigger.disabled=false}
}
function pendingUploadRole(item,job){return {id:"待保存",name:item.name,filename:item.file?.name||item.name,description:item.description||"",generationPrompt:item.generationPrompt||"",tags:item.tags||[],projectNames:item.projectNames||job.projects||[],size:item.file?.size||0,createdAt:new Date(job.createdAt).toISOString(),imageUrl:item.previewUrl||"",downloadUrl:item.previewUrl||""}}
function projectList(){return ""}
function projectPicker(id,names=["未分组"]){return '<div class="project-picker" id="'+id+'"><button type="button" class="project-trigger" aria-expanded="false" aria-haspopup="dialog"><span>'+esc(names.join("、")||"选择灵感集")+'</span><span aria-hidden="true">⌄</span></button><div class="project-popup" hidden><input class="project-search" aria-label="搜索灵感集" placeholder="搜索灵感集"><div class="project-options">'+allProjects().map(n=>'<label class="project-option"><input type="checkbox" value="'+esc(n)+'" '+(names.includes(n)?'checked':'')+'>'+esc(n)+'</label>').join("")+'</div><div class="project-add"><input placeholder="新灵感集名称" maxlength="40"><button type="button">添加</button></div></div></div>'}
function selectedProjects(id){return [...document.querySelectorAll("#"+id+" .project-option input:checked")].map(i=>i.value)}
function wireProjects(id){const root=$("#"+id),trigger=root.querySelector(".project-trigger"),popup=root.querySelector(".project-popup"),search=root.querySelector(".project-search");const summary=()=>{trigger.querySelector("span").textContent=selectedProjects(id).join("、")||"选择灵感集"};const close=()=>{popup.hidden=true;trigger.setAttribute("aria-expanded","false")};trigger.onclick=()=>{popup.hidden=!popup.hidden;trigger.setAttribute("aria-expanded",String(!popup.hidden));if(!popup.hidden)search.focus()};root.onchange=summary;search.oninput=()=>{const q=search.value.normalize("NFKC").trim().toLowerCase();root.querySelectorAll(".project-option").forEach(label=>label.hidden=!label.textContent.toLowerCase().includes(q))};root.onkeydown=e=>{if(e.key==="Escape"&&!popup.hidden){e.preventDefault();e.stopPropagation();close();trigger.focus()}};summary();root.querySelector(".project-add button").onclick=()=>{const input=root.querySelector(".project-add input"),name=input.value.normalize("NFKC").trim();if(!name)return;if(name.length>40||/[<>\x00-\x1f]/.test(name)){toast("灵感集名称无效");return}const existing=[...root.querySelectorAll(".project-option input")].find(i=>i.value===name);if(existing)existing.checked=true;else{const label=document.createElement("label");label.className="project-option";const box=document.createElement("input");box.type="checkbox";box.value=name;box.checked=true;label.append(box,document.createTextNode(name));root.querySelector(".project-options").append(label)}input.value="";search.value="";search.oninput();summary()};root.querySelector(".project-add input").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();root.querySelector(".project-add button").click()}}}
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
function editRole(r,uploadContext=null){
 state.editTags=r.tags.map(t=>({...t}));
 modal("编辑素材",'<form id="editForm"><div class="row"><label>素材名<input name="name" value="'+esc(r.name)+'" required maxlength="180"></label><div><label>灵感集</label>'+projectPicker("editProjects",roleProjects(r))+'</div></div>'+projectList()+'<label>描述<textarea name="description" maxlength="1200">'+esc(r.description)+'</textarea></label><label>提示词<textarea name="generationPrompt" maxlength="12000">'+esc(r.generationPrompt)+'</textarea></label><h3>标签</h3><div id="editTags" class="editor-tags"></div>'+tagAdder()+'<p class="form-note">输入或选择子标签，按 Enter 或点击添加。直接保存也会收录输入的新标签。点击已有标签可移除。</p><p id="formError" class="error"></p><div class="dialog-actions">'+analysisModelSelect("editAnalysisModel")+'<button type="button" id="editAnalyze" '+(!canAnalyze()?"disabled":"")+'>模型分析</button><button class="primary" id="saveRole">保存</button></div></form>');wireTagOptions();
 if(uploadContext){$("#editAnalyze").hidden=true;const modelField=$("#editAnalysisModel")?.closest("label");if(modelField)modelField.hidden=true;$("#saveRole").textContent="应用编辑";const note=document.createElement("p");note.className="form-note";note.textContent="编辑只更新这张素材的草稿，返回任务后点击保存才进入素材库。";$("#editForm").prepend(note);const back=document.createElement("button");back.type="button";back.textContent="返回任务";back.onclick=()=>openUploadTask(uploadContext.job);$("#saveRole").before(back)}
 wireProjects("editProjects");
 const commitPendingTag=wireManualTags("#formError");
 $("#editForm").onsubmit=async e=>{e.preventDefault();if(!commitPendingTag())return;$("#saveRole").disabled=true;try{const b=Object.fromEntries(new FormData(e.currentTarget));if(uploadContext&&!uploadContext.item.role){Object.assign(uploadContext.item,b,{tags:state.editTags.map(t=>({...t})),projectNames:selectedProjects("editProjects"),edited:true});openUploadTask(uploadContext.job);toast("草稿已更新");return}const result=await api(assetPath(r),{method:"PATCH",body:JSON.stringify({...b,projectNames:selectedProjects("editProjects"),groupingMode:"manual",identity:r.identity,revision:r.revision,tags:state.editTags})});if(uploadContext){uploadContext.item.role=result.role;await refresh(true);openUploadTask(uploadContext.job);toast("草稿已更新")}else{await refresh(true);details(result.role);toast("素材已保存")}}catch(e){$("#formError").textContent=e.message;$("#saveRole").disabled=false}};
 $("#editAnalyze").onclick=async()=>{if(!commitPendingTag())return;const button=$("#editAnalyze");button.disabled=true;button.textContent="正在分析…";$("#saveRole").disabled=true;try{const fields=Object.fromEntries(new FormData($("#editForm")));const saved=await api(assetPath(r),{method:"PATCH",body:JSON.stringify({...fields,projectNames:selectedProjects("editProjects"),groupingMode:"manual",identity:r.identity,revision:r.revision,tags:state.editTags})});r=saved.role;const result=await analyzeAsset(r,$("#editAnalysisModel")?.value);await refresh(true);editRole(result.role);toast("模型分析完成")}catch(e){$("#formError").textContent=e.message;button.disabled=false;button.textContent="模型分析";$("#saveRole").disabled=false}};
}
function tagDialog(dimension){modal("添加子标签",'<form id="tagForm"><label>输入或选择子标签<input id="tagName" name="name" list="tagNames" maxlength="40" required></label><datalist id="tagNames">'+labelOptions(dimension).map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#tagForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/tags",{dimension,name:$("#tagName").value});await refresh(true);$("#modal").close();toast("子标签已保存")}catch(error){$("#formError").textContent=error.message}}}
function newProject(){modal("新建灵感集",'<form id="projectForm"><label>灵感集<input name="name" maxlength="40" required></label><p id="formError" class="error"></p><div class="dialog-actions"><button class="primary">保存</button></div></form>');$("#projectForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/projects",{name:e.currentTarget.elements.name.value});await refresh(true);$("#modal").close();toast("灵感集已创建")}catch(error){$("#formError").textContent=error.message}}}
$("#content").addEventListener("submit",e=>{if(e.target.id!=="pageJumpForm")return;e.preventDefault();const input=$("#pageJumpInput"),page=Number(input.value),max=Math.max(1,Math.ceil(filtered().length/galleryPageSize()));if(!Number.isInteger(page)||page<1||page>max){input.setCustomValidity("请输入 1 至 "+max+" 的整数页码");input.reportValidity();return}state.page=page;render();window.scrollTo({top:0,behavior:"smooth"})});
$("#content").addEventListener("input",e=>{if(e.target.id==="pageJumpInput")e.target.setCustomValidity("")});
$("#content").onclick=async e=>{
 const el=e.target.closest("[data-delete],[data-edit],[data-detail],[data-select],[data-recycle-select],[data-purge],[data-page],[data-restore],[data-add-tag],[data-project]");if(!el)return;
 if(el.dataset.recycleSelect){el.checked?state.recycleSelected.add(el.dataset.recycleSelect):state.recycleSelected.delete(el.dataset.recycleSelect);el.closest(".card").classList.toggle("selected",el.checked);recycleSelection()}
 if(el.dataset.purge)purgeDialog([roleByIdentity(el.dataset.purge)]);
 if(el.dataset.restore){const r=roleByIdentity(el.dataset.restore);el.disabled=true;try{await post("/api/assets/restore",{identity:r.identity,revision:r.revision});await refresh(true);toast("素材已恢复")}catch(error){toast(error.message);el.disabled=false}}
 if(el.dataset.addTag)tagDialog(el.dataset.addTag);
 if(el.dataset.project){state.view="library";$("#projectFilter").value=el.dataset.project;state.page=1;render()}
 if(el.dataset.delete){const r=roleByIdentity(el.dataset.delete);if(r)deleteDialog([r])}
 if(el.dataset.edit){const r=roleByIdentity(el.dataset.edit);if(r)editRole(r)}
 if(el.dataset.detail){const r=roleByIdentity(el.dataset.detail);if(r)details(r)}
 if(el.dataset.select){el.checked?state.selected.add(el.dataset.select):state.selected.delete(el.dataset.select);el.closest(".card").classList.toggle("selected",el.checked);selection()}
 if(el.dataset.page){state.page+=Number(el.dataset.page);render();window.scrollTo({top:0,behavior:"smooth"})}
};
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;render()});
$("#filters").onchange=e=>{state.filters[e.target.dataset.filter]=e.target.value;state.page=1;render()};
["search","projectFilter","sort"].forEach(id=>$("#"+id).addEventListener(id==="search"?"input":"change",()=>{state.page=1;render()}));
$("#selectAll").onchange=e=>{for(const r of visibleGalleryRoles())e.target.checked?state.selected.add(r.identity):state.selected.delete(r.identity);render()};
$("#downloadButton").onclick=async()=>{const items=state.roles.filter(r=>state.selected.has(r.identity)).map(r=>({identity:r.identity,revision:r.revision}));if(!items.length||state.downloadBusy)return;state.downloadBusy=true;selection();const button=$("#downloadButton");button.textContent="正在打包…";let completed=0;try{for(let i=0;i<items.length;i+=200){const r=await fetch("/api/assets/batch-download",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:items.slice(i,i+200)})});if(!r.ok){const b=await r.json();throw new Error(b.error||"下载失败")}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="拾光图鉴素材"+(items.length>200?"-"+(i/200+1):"")+".zip";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);completed+=Math.min(200,items.length-i)}toast("已下载 "+completed+" 张素材")}catch(error){toast(error.message)}finally{state.downloadBusy=false;button.textContent="批量下载";selection()}};
$("#deleteButton").onclick=()=>deleteDialog(state.roles.filter(r=>state.selected.has(r.identity)));
function deleteDialog(roles){
 const items=roles.map(r=>({identity:r.identity,revision:r.revision}));if(!items.length)return;
 modal("删除 "+items.length+" 个素材",'<p>素材将移入回收站，可恢复。编号立即释放。</p><p id="formError" class="error"></p><div class="dialog-actions"><button id="cancelDelete">取消</button><button id="confirmDelete" class="danger">确认删除</button></div>');
 $("#cancelDelete").onclick=()=>$("#modal").close();$("#confirmDelete").onclick=async()=>{const btn=$("#confirmDelete");btn.disabled=true;try{let deleted=0;for(let i=0;i<items.length;i+=25){const r=await post("/api/assets/delete",{items:items.slice(i,i+25)});deleted+=r.deleted}state.selected.clear();await refresh(true);$("#modal").close();toast("已删除 "+deleted+" 项"+(deleted<items.length?"；部分素材已变化，请重新选择":""))}catch(e){$("#formError").textContent=e.message;btn.disabled=false}};
};
$("#refreshButton").onclick=()=>refresh();

async function preview(file){
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>64e6){bitmap.close();throw new Error("图片超过6400万像素")}
 const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));if(!blob)throw new Error("无法生成预览");return new File([blob],"preview.jpg",{type:"image/jpeg"});
}
const uploadJobs=new Map();
let backgroundBaidu=null;
function ownedUploadJobs(){return [...uploadJobs.values()].filter(j=>j.owner===state.user?.id)}
function restoreUploadJobs(roles){
 for(const batch of new Set(roles.map(r=>r.uploadBatch).filter(Boolean))){
  const rows=roles.filter(r=>r.uploadBatch===batch),old=uploadJobs.get(batch);
  if(old?.active)continue;
  const items=rows.map(r=>({role:r,name:r.filename,file:null,status:r.analysisStatus==="done"?"分析完成":r.analysisStatus==="failed"?"分析失败":"等待分析",error:r.analysisError||""}));
  if(old){for(const item of items){const known=old.items.find(i=>i.role?.identity===item.role.identity);if(known){known.role=item.role;if(item.status==="分析完成"){known.status=item.status;known.error=""}}else old.items.push(item)}if(!old.saved)old.status="等待保存"}else uploadJobs.set(batch,{id:batch,owner:state.user.id,createdAt:Date.parse(rows[0].createdAt),items,fields:{},tags:[],projects:[],auto:rows.some(r=>r.uploadAutoAnalyze||r.analysisStatus),choice:codexLocal.connected?codexLocal.provider+":"+codexLocal.model:"api",concurrency:3,status:"等待保存",active:false,stopRequested:false,cancelRequested:false});
 }
 if($("#modal").dataset.kind==="background-tasks")paintBackgroundTasks();
}
function taskChanged(job){
 if($("#modal").dataset.kind==="upload-task"&&$("#modal").dataset.taskId===job.id)paintUploadTask(job);
 else if($("#modal").dataset.kind==="background-tasks")paintBackgroundTasks();
}
function openUploadTask(job){
 if(job.owner!==state.user?.id)return;
 if(job.formNode){$("#modalContent .dialog-head h2").textContent="上传素材";$("#modalContent .dialog-body").replaceChildren(job.formNode);$("#modal").dataset.kind="upload-task";$("#modal").dataset.taskId=job.id;$("#closeModal").onclick=()=>$("#modal").close();if(!$("#modal").open)$("#modal").showModal();paintUploadTask(job);return}
 modal("上传素材",'<div id="uploadTaskBody"></div>');$("#modal").dataset.kind="upload-task";$("#modal").dataset.taskId=job.id;paintUploadTask(job);
}
function uploadRows(job){return job.items.map((i,n)=>'<div class="task-item"><div class="task-material">'+(i.role?.imageUrl||i.previewUrl?'<img class="task-thumbnail" src="'+esc(i.role?.imageUrl||i.previewUrl)+'" alt="">':'')+'<strong>'+esc(i.role?.name||i.file?.name||i.name)+'</strong><p class="'+(i.error?'error':'form-note')+'">'+esc(i.error||i.status)+'</p></div>'+'<div class="task-item-actions">'+(i.role||i.file?'<button type="button" data-task-detail="'+n+'">查看</button>':'')+(i.saved||i.cancelled?'<span class="form-note">'+(i.saved?'已保存':'已取消')+'</span>':'<button type="button" data-task-retry="'+n+'" '+(job.active||job.saving||i.cancelRequested||i.status==="分析完成"||i.role&&!canAnalyze()?'disabled':'')+'>重试</button><button type="button" data-task-analyze="'+n+'" '+(job.active||job.saving||i.cancelRequested||!canAnalyze()?'disabled':'')+'>分析</button><button type="button" data-task-edit="'+n+'" '+(job.active||job.saving||i.cancelRequested?'disabled':'')+'>编辑</button><button type="button" data-task-save="'+n+'" '+(job.saving||i.cancelRequested?'disabled':'')+'>保存</button><button type="button" data-task-cancel="'+n+'" '+(job.saving||i.cancelRequested?'disabled':'')+'>取消</button>')+'</div>'+'</div>').join("")}
function paintInlineUpload(job){
 const form=job.formNode,body=form.querySelector("#uploadTaskBody"),list=form.querySelector("#fileList");body.dataset.running=String(job.active);
 const template=document.createElement("div");template.innerHTML=uploadRows(job);[...template.children].forEach((node,n)=>{let row=list.children[n];if(!row){row=document.createElement("div");row.className="task-item";list.append(row)}row.innerHTML=node.innerHTML});while(list.children.length>job.items.length)list.lastElementChild.remove();
 const ready=job.items.filter(i=>i.role).length,done=job.items.filter(i=>i.status==="分析完成").length,failed=job.items.filter(i=>i.error).length;
 $("#fileSummary").textContent="已选择 "+job.items.filter(i=>!i.cancelled).length+" 张图片 · "+size(job.items.reduce((n,i)=>n+(i.file?.size||i.role?.size||0),0));
 $("#uploadProgress").hidden=!job.started;$("#uploadProgress").textContent=job.status+" · 已准备 "+ready+" / "+job.items.length+" 张 · 分析完成 "+done+" 张 · 失败 "+failed+" 张";$("#uploadError").textContent=job.error||"";
 for(const el of form.querySelectorAll("#chooseFiles,#chooseFolder,#groupingMode,#namingMode,#autoAnalyze,#uploadProjects input,#uploadProjects button,[data-custom-name]"))el.disabled=job.active||job.saving;
 $("#startUpload").disabled=job.active||job.saving||!job.items.some(i=>!i.saved&&!i.cancelled);$("#directSaveUpload").disabled=job.saving||!job.items.some(i=>!i.saved&&!i.cancelled);$("#directSaveUpload").textContent=job.saved?"已保存":"保存";
 $("#stopAnalysis").hidden=!job.active||!job.auto;$("#stopAnalysis").disabled=!!job.stopRequested;$("#cancelUpload").disabled=job.saving||job.cancelRequested;$("#retryAnalysis").hidden=job.active||!job.items.some(i=>!i.saved&&!i.cancelled&&i.error);
 wireUploadActions(job,list);$("#stopAnalysis").onclick=()=>{job.stopRequested=true;job.status="已停止排队，等待当前分析完成";taskChanged(job)};$("#retryAnalysis").onclick=()=>job.begin(false,null,true);$("#cancelUpload").onclick=()=>job.started?cancelUploadTask(job):$("#modal").close();
 $("#refreshUploadTask").onclick=async()=>{try{await syncUploadRoles(job);job.error="";taskChanged(job);toast("素材状态已刷新")}catch(error){job.error=error.message;taskChanged(job)}};
 if($("#uploadAnalysisModel")){$("#uploadAnalysisModel").disabled=job.active;$("#uploadAnalysisModel").onchange=e=>job.choice=e.target.value}$("#analysisConcurrency").disabled=job.active;$("#analysisConcurrency").onchange=e=>job.concurrency=Number(e.target.value);
}
function wireUploadActions(job,body){
 body.querySelectorAll("[data-task-detail]").forEach(b=>b.onclick=async()=>{const item=job.items[Number(b.dataset.taskDetail)];try{if(item.role)await syncUploadRoles(job,item);details(item.role||pendingUploadRole(item,job),{job,item})}catch(error){toast(error.message)}});

 body.querySelectorAll("[data-task-retry]").forEach(b=>b.onclick=()=>job.formNode?job.begin(false,job.items[Number(b.dataset.taskRetry)],true):runUploadTask(job,true,job.items[Number(b.dataset.taskRetry)]));
 body.querySelectorAll("[data-task-analyze]").forEach(b=>b.onclick=()=>job.formNode?job.begin(false,job.items[Number(b.dataset.taskAnalyze)],true,true):runUploadTask(job,true,job.items[Number(b.dataset.taskAnalyze)],true));
 body.querySelectorAll("[data-task-edit]").forEach(b=>b.onclick=async()=>{const item=job.items[Number(b.dataset.taskEdit)];b.disabled=true;try{if(item.role)await syncUploadRoles(job,item);if(job.active||item.cancelled||item.saved)return;editRole(item.role||{name:item.name,description:item.description||"",generationPrompt:item.generationPrompt||"",tags:item.tags||[],projectNames:item.projectNames||selectedProjects("uploadProjects")},{job,item})}catch(error){job.error=error.message;taskChanged(job)}});
 body.querySelectorAll("[data-task-save]").forEach(b=>b.onclick=()=>{const item=job.items[Number(b.dataset.taskSave)];return item.role?saveUploadTask(job,item):job.begin(true,item)});
 body.querySelectorAll("[data-task-cancel]").forEach(b=>b.onclick=()=>cancelUploadItem(job,job.items[Number(b.dataset.taskCancel)]));
}
function paintUploadTask(job){
 if(job.formNode&&$("#uploadForm")===job.formNode)return paintInlineUpload(job);
 const body=$("#uploadTaskBody");if(!body)return;body.dataset.running=String(job.active);
 const ready=job.items.filter(i=>i.role).length,failed=job.items.filter(i=>i.error).length,done=job.items.filter(i=>i.status==="分析完成").length;
 body.innerHTML='<p class="form-note">右上角 × 只收起窗口，任务继续后台运行。未保存的临时素材不会同步百度网盘；取消只清理本次批次。</p><p id="uploadProgress" class="progress" role="status">'+esc(job.status)+' · 已准备 '+ready+' / '+job.items.length+' 张 · 分析完成 '+done+' 张 · 失败 '+failed+' 张</p><div class="file-list task-items">'+uploadRows(job)+'</div><p id="uploadError" class="error">'+esc(job.error||"")+'</p>'+
 (job.auto&&!job.saved?analysisModelSelect("uploadAnalysisModel")+'<label>分析并发<select id="analysisConcurrency">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(n===job.concurrency?'selected':'')+'>同时分析 '+n+' 张</option>').join("")+'</select></label>':'')+
 '<div class="dialog-actions"><button type="button" id="refreshUploadTask" '+(job.saving?'disabled':'')+'>刷新</button>'+ (job.saved?'': '<button type="button" id="stopAnalysis" '+(!job.active||!job.auto?'hidden':'')+(job.stopRequested?' disabled':'')+'>停止分析</button><button type="button" id="retryAnalysis" '+(job.active||!job.items.some(i=>!i.saved&&!i.cancelled&&(i.error||i.status==="等待分析"||i.status==="未分析"))?'hidden':'')+'>重试</button><button type="button" id="cancelUpload" '+(job.cancelRequested||job.saving?'disabled':'')+'>取消</button>')+'<button type="button" id="startUpload" class="primary" '+(job.saving||!ready&&!job.saved?'disabled':'')+'>'+ (job.saved?'已保存':'保存')+'</button></div>';
 if($("#uploadAnalysisModel")){$("#uploadAnalysisModel").value=job.choice;$("#uploadAnalysisModel").disabled=job.active;$("#uploadAnalysisModel").onchange=e=>job.choice=e.target.value}
 if($("#analysisConcurrency")){$("#analysisConcurrency").disabled=job.active;$("#analysisConcurrency").onchange=e=>job.concurrency=Number(e.target.value)}
 wireUploadActions(job,body);
 $("#refreshUploadTask").onclick=async()=>{const button=$("#refreshUploadTask");button.disabled=true;try{await syncUploadRoles(job);job.error="";taskChanged(job);toast("素材状态已刷新")}catch(error){job.error=error.message;taskChanged(job)}};
 if($("#stopAnalysis"))$("#stopAnalysis").onclick=()=>{job.stopRequested=true;job.status="已停止排队，等待当前分析完成";taskChanged(job)};
 if($("#retryAnalysis"))$("#retryAnalysis").onclick=()=>runUploadTask(job,true);
 if($("#cancelUpload"))$("#cancelUpload").onclick=()=>cancelUploadTask(job);
 $("#startUpload").onclick=()=>job.saved?$("#modal").close():saveUploadTask(job);
}
async function syncUploadRoles(job,onlyItem=null){
 const library=await api("/api/library");for(const item of onlyItem?[onlyItem]:job.items){if(!item.role||item.cancelled)continue;const current=[...(library.drafts||[]),...(library.roles||[])].find(r=>r.identity===item.role.identity);if(current){item.role=current;if(current.analysisStatus==="done"){item.status="分析完成";item.error=""}else if(current.analysisStatus==="failed"){item.status="分析失败";item.error=current.analysisError||item.error}}}
}
async function runUploadTask(job,retry=false,onlyItem=null,forceAnalysis=false){
 if(job.active||job.saved||job.owner!==state.user?.id)return;
 if(onlyItem&&(onlyItem.saved||onlyItem.cancelled||onlyItem.cancelRequested))return;
 if(forceAnalysis&&onlyItem)onlyItem.status="等待分析";
 if(onlyItem?.role)job.auto=true;
 const scope=(onlyItem?[onlyItem]:job.items).filter(i=>!i.saved&&!i.cancelled&&!i.cancelRequested);
 job.active=true;job.stopRequested=false;job.error="";job.status=retry?"正在重试":"正在准备";taskChanged(job);
 const allowed=()=>!job.cancelRequested&&job.owner===state.user?.id;
 try{
  if(retry){await syncUploadRoles(job,onlyItem);if(forceAnalysis&&onlyItem)onlyItem.status="等待分析"}
  let next=0;const uploads=scope.filter(i=>!i.role&&i.file);
  const uploadOne=async()=>{while(next<uploads.length&&allowed()){const item=uploads[next++];if(item.cancelRequested||item.cancelled||item.saved)continue;item.status="正在准备";item.error="";taskChanged(job);try{
   if(item.file.size>20*1048576)throw new Error("超过20MB");
   const f=new FormData();f.append("file",item.file);f.append("preview",await preview(item.file));f.append("uploadBatch",job.id);f.append("uploadAutoAnalyze",job.auto?"1":"0");f.append("projectNames",JSON.stringify(item.projectNames||job.projects));f.append("projectName",(item.projectNames||job.projects)[0]||"未分组");f.append("groupingMode",!job.auto&&job.fields.groupingMode==="ai"?"manual":job.fields.groupingMode);f.append("namingMode",item.edited?"custom":!job.auto&&job.fields.namingMode==="ai"?"custom":job.fields.namingMode);f.append("name",item.name);f.append("generationPrompt",item.generationPrompt||job.fields.generationPrompt||"");f.append("description",item.description||"");f.append("tags",JSON.stringify(item.tags||job.tags));
   item.role=(await api("/api/assets",{method:"POST",body:f})).role;if(item.description&&item.role.description!==item.description)item.role=(await api(assetPath(item.role),{method:"PATCH",body:JSON.stringify({...item.role,description:item.description,identity:item.role.identity,revision:item.role.revision})})).role;item.status=job.auto?"等待分析":"准备完成";
  }catch(error){item.status="准备失败";item.error=error.message}finally{taskChanged(job)}}};
  await Promise.all(Array.from({length:Math.min(3,uploads.length)},uploadOne));
  if(job.auto&&allowed()&&!job.stopRequested){
   job.status="模型分析";let cursor=0;const jobs=scope.filter(i=>i.role&&i.status!=="分析完成"&&!i.cancelRequested),limit=job.choice==="api"?job.concurrency:Math.min(job.concurrency,codexLocal.maxConcurrent||1);
   const analyzeOne=async()=>{while(cursor<jobs.length&&allowed()&&!job.stopRequested){const item=jobs[cursor++];if(item.cancelRequested)continue;item.status="正在分析";item.error="";taskChanged(job);try{item.role=(await analyzeAsset(item.role,job.choice)).role;item.status="分析完成"}catch(error){item.status="分析失败";item.error=error.message;try{await syncUploadRoles(job,item)}catch{}}finally{taskChanged(job)}}};
   await Promise.all(Array.from({length:Math.min(limit,jobs.length)},analyzeOne));
  }
  for(const item of job.items)if(item.role&&item.status==="等待分析"&&job.stopRequested)item.status="未分析";
  job.status=job.owner!==state.user?.id?"等待原账号继续处理":job.stopRequested?"分析已停止，等待保存":"等待保存";
 }catch(error){job.error=error.message;job.status="处理失败"}finally{
  job.active=false;if(job.cancelRequested)await discardUploadTask(job);else{for(const item of job.items.filter(i=>i.cancelRequested))await discardUploadItem(job,item);taskChanged(job);if(job.directSave)await saveUploadTask(job,job.directItem||null)}
 }
}
async function cancelUploadItem(job,item){
 if(job.saving||item.saved||item.cancelled||job.owner!==state.user?.id)return;
 const busy=item.status==="正在分析"||item.status==="正在准备";item.cancelRequested=true;item.error="";item.status="等待取消";taskChanged(job);
 if(!busy)await discardUploadItem(job,item);
}
async function discardUploadItem(job,item){
 try{if(item.role){const result=await post("/api/upload-batches",{batch:job.id,action:"cancel",identities:[item.role.identity]});if(result.failed)throw new Error("临时数据清理失败，请重试取消")}
 item.cancelled=true;item.cancelRequested=false;item.file=null;item.role=null;item.error="";item.status="已取消";await refresh(true);taskChanged(job);
 }catch(error){item.cancelRequested=false;item.error=error.message;item.status="取消失败";taskChanged(job)}
}
async function cancelUploadTask(job){
 if(job.saving||job.saved||job.owner!==state.user?.id)return;
 job.cancelRequested=true;job.stopRequested=true;job.status="正在取消，等待当前请求结束后清理";taskChanged(job);
 if(!job.active)await discardUploadTask(job);
}
async function discardUploadTask(job){
 try{
  const result=await post("/api/upload-batches",{batch:job.id,action:"cancel"});if(result.failed)throw new Error("部分临时数据清理失败，请再次点击取消");
  job.items=[];uploadJobs.delete(job.id);if($("#modal").dataset.kind==="upload-task"&&$("#modal").dataset.taskId===job.id)$("#modal").close();else if($("#modal").dataset.kind==="background-tasks")paintBackgroundTasks();await refresh(true);toast("本次上传已取消，临时数据已清理，不进入回收站");
 }catch(error){job.cancelRequested=false;job.error=error.message;job.status="取消未完成";taskChanged(job)}
}
async function saveUploadTask(job,onlyItem=null){
 if(job.owner!==state.user?.id)return;
 if(job.active){if($("#modal").dataset.taskId===job.id)$("#modal").close();toast("任务继续在后台运行，分析完成后可再保存");return}
 const selected=(onlyItem?[onlyItem]:job.items).filter(i=>i.role&&!i.saved&&!i.cancelled&&!i.cancelRequested);if(!selected.length)return;
 job.active=true;job.saving=true;job.status="正在保存";job.error="";taskChanged(job);
 try{
  const result=await post("/api/upload-batches",{batch:job.id,action:"save",identities:selected.map(i=>i.role.identity)});
  for(const item of selected){const saved=(result.roles||[]).find(r=>r.identity===item.role.identity);if(saved)item.role=saved;item.saved=true;item.file=null}
  job.saved=job.items.every(i=>i.saved||i.cancelled);job.status=job.saved?(result.backupQueued?"已保存，网盘备份在后台运行":"已保存"):"部分已保存，其他素材等待处理";job.error=result.backupError||"";await refresh(true);globalThis.resumeBaiduBackup?.();toast(result.backupQueued?"已保存，正在后台备份网盘":"素材已保存");
 }catch(error){job.error=error.message;job.status="保存失败"}finally{job.active=false;job.saving=false;job.directSave=false;taskChanged(job)}
}
function paintBackgroundTasks(){
 const body=$("#backgroundTasksBody");if(!body)return;
 const jobs=ownedUploadJobs().sort((a,b)=>Number(b.active)-Number(a.active)||b.createdAt-a.createdAt);
 body.innerHTML='<p class="form-note">收起任务窗口不影响处理。分析完成后仍需点击保存；取消只删除该批次临时数据。</p>'+jobs.map(j=>{const completed=j.items.filter(i=>i.status==="分析完成").length,failed=j.items.filter(i=>i.error).length,pending=j.auto?j.items.filter(i=>!i.cancelled&&i.status!=="分析完成"&&!i.error).length:0;return '<div class="task-item"><div><strong>'+esc(new Date(j.createdAt).toLocaleString("zh-CN"))+' · '+j.items.length+' 张素材</strong><p class="form-note">'+(j.auto?'模型分析 · 等待 '+pending+' · 完成 '+completed+' · 失败 '+failed:esc(j.status))+'</p></div><button type="button" data-open-upload="'+esc(j.id)+'">查看任务</button></div>'}).join("")+(jobs.length?'':'<p class="muted">暂无上传任务</p>')+(backgroundBaidu?.tasks||[]).map(t=>'<div class="task-item"><div><p class="form-note">网盘备份 · 等待 '+(t.counts.pending||0)+' · 完成 '+(t.counts.done||0)+' · 失败 '+(t.counts.failed||0)+'</p>'+(t.createdAt?'<p class="form-note">'+esc(new Date(t.createdAt).toLocaleString("zh-CN"))+'</p>':'')+'</div><button type="button" data-backup-task="'+esc(t.id)+'">查看备份</button></div>').join('')+'<div class="dialog-actions"><button type="button" id="refreshTasks">刷新任务</button></div>';
 body.querySelectorAll("[data-open-upload]").forEach(b=>b.onclick=()=>openUploadTask(uploadJobs.get(b.dataset.openUpload)));$("#refreshTasks").onclick=showBackgroundTasks;body.querySelectorAll("[data-backup-task]").forEach(b=>b.onclick=()=>baiduDialog(b.dataset.backupTask));
}
async function showBackgroundTasks(){
 modal("后台任务",'<div id="backgroundTasksBody"></div>');$("#modal").dataset.kind="background-tasks";paintBackgroundTasks();
 await refresh(true);try{backgroundBaidu=await api("/api/storage/baidu")}catch{backgroundBaidu=null}if($("#modal").dataset.kind==="background-tasks")paintBackgroundTasks();
}
$("#tasksButton").onclick=showBackgroundTasks;
let tasksPolling=false;
setInterval(async()=>{if(tasksPolling||!state.user||document.hidden||$("#modal").dataset.kind!=="background-tasks"||!$("#modal").open)return;tasksPolling=true;try{await refresh(true);backgroundBaidu=await api("/api/storage/baidu");if($("#modal").dataset.kind==="background-tasks")paintBackgroundTasks()}catch{}finally{tasksPolling=false}},5000);
function uploadDialog(){
 state.editTags=[];
 state.files=[];
 modal("上传素材",'<form id="uploadForm"><div class="dropzone"><p>可一次选择多张图片，也可继续添加图片或选择整个文件夹。每张图片独立准备和分析，默认同时分析3张。点击保存后才会进入素材库并同步百度网盘。</p><div class="upload-options"><button type="button" id="chooseFiles">选择图片</button><button type="button" id="chooseFolder">上传文件夹</button></div><input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><input id="folderInput" type="file" webkitdirectory directory multiple hidden><p class="muted small">PNG / JPEG / WebP · 单张不超过20MB · 文件夹中其他格式会跳过</p><p id="fileSummary" class="form-note"></p><div id="uploadTaskBody" data-running="false"><div id="fileList" class="file-list task-items"></div></div></div><div class="row"><label>分组方式<select name="groupingMode" id="groupingMode"><option value="ai" selected>模型分组</option><option value="manual">手动分组</option></select></label><div id="uploadProjectField" hidden><label>灵感集</label>'+projectPicker("uploadProjects")+'</div></div><div class="row"><label>命名方式<select name="namingMode" id="namingMode"><option value="original">原文件名</option><option value="custom">手动命名</option><option value="ai" selected>模型命名</option></select></label><div id="customNames" class="file-list upload-name-fields" hidden><label>文件名<input disabled placeholder="选择图片后填写"></label></div></div>'+projectList()+analysisModelSelect("uploadAnalysisModel")+'<label class="check"><input type="checkbox" name="autoAnalyze" id="autoAnalyze" checked>保存前分析并添加子标签</label><p class="form-note">取消勾选后只准备素材，不调用模型。提示词、描述和标签在每张素材的编辑中填写。自动命名和自动分组需要连接本机 Codex / 本机 Gemini 或配置视觉模型。点击保存可直接按填写信息入库，不调用模型。开始处理会按勾选项执行模型分析。分析失败时临时原图保留，可逐张重试或保存默认信息；取消只清理未保存素材。原始文件名始终保留。</p><p id="uploadError" class="error"></p><div id="uploadProgress" class="progress" hidden></div><div class="dialog-actions"><button id="startUpload" class="primary" disabled>开始处理</button></div></form>');
if(codexLocal.connected&&codexLocal.maxConcurrent<5){const hint=document.createElement("p");hint.className="form-note";hint.innerHTML='当前连接包最高支持同时分析'+codexLocal.maxConcurrent+'张。<a href="/share/local-connector.zip">下载新版连接包</a>，关闭旧程序并启动新版、重新配对后可选择同时分析1–5张。';$("#uploadProgress").before(hint)}
const concurrencyField=document.createElement("label");concurrencyField.innerHTML='分析并发<select id="analysisConcurrency" name="analysisConcurrency">'+[1,2,3,4,5].map(n=>'<option value="'+n+'">同时分析 '+n+' 张</option>').join('')+'</select><span class="form-note">默认3张；可选1–5张。失败立即显示原因，不会自动重试；限流时可降低并发后点击重试。旧连接包按实际支持数量执行，请更新连接包以使用5张。</span>';$("#uploadError").before(concurrencyField);$("#analysisConcurrency").value=localStorage.getItem("atlas-analysis-concurrency")||"3";
 const stop=document.createElement("button");stop.id="stopAnalysis";stop.type="button";stop.className="danger";stop.textContent="停止分析";stop.hidden=true;$("#startUpload").before(stop);
 const directSave=document.createElement("button");directSave.type="button";directSave.id="directSaveUpload";directSave.textContent="保存";directSave.disabled=true;$("#startUpload").after(directSave);
 const cancel=document.createElement("button");cancel.type="button";cancel.id="cancelUpload";cancel.textContent="取消";$("#startUpload").before(cancel);cancel.onclick=()=>{state.files=[];$("#modal").close()};

 const job={id:crypto.randomUUID(),owner:state.user.id,createdAt:Date.now(),items:state.files,fields:{},tags:[],projects:[],auto:false,choice:$("#uploadAnalysisModel")?.value,concurrency:Number($("#analysisConcurrency").value)||3,status:"等待处理",active:false,saving:false,started:false,formNode:$("#uploadForm")};$("#modal").dataset.kind="upload-task";$("#modal").dataset.taskId=job.id;
 const refreshButton=document.createElement("button");refreshButton.id="refreshUploadTask";refreshButton.type="button";refreshButton.textContent="刷新";$("#startUpload").before(refreshButton);const retryButton=document.createElement("button");retryButton.id="retryAnalysis";retryButton.type="button";retryButton.textContent="重试";retryButton.hidden=true;$("#startUpload").before(retryButton);
 const choose=(files)=>{
  for(const input of $("#customNames").querySelectorAll("[data-custom-name]")){const entry=state.files[Number(input.dataset.customName)];if(entry&&!entry.edited)entry.name=input.value}
  const supported=[...files].filter(f=>/\.(png|jpe?g|webp)$/i.test(f.name));
  const fileKey=f=>[f.webkitRelativePath||f.name,f.size,f.lastModified].join("\u0000"),seen=new Set(state.files.filter(e=>e.file).map(e=>fileKey(e.file)));let duplicates=0;
  for(const file of supported){const key=fileKey(file);if(seen.has(key)){duplicates++;continue}seen.add(key);state.files.push({file,previewUrl:globalThis.URL.createObjectURL?.(file),name:file.name.replace(/\.[^.]+$/,""),status:"等待处理",role:null,error:""})}
  $("#customNames").innerHTML=state.files.map((entry,i)=>'<label class="file-row">'+(state.files.length===1?'文件名':esc(entry.file.name))+'<input data-custom-name="'+i+'" value="'+esc(entry.name)+'" maxlength="80"></label>').join("");paintUploadTask(job);
 };
 $("#chooseFiles").onclick=()=>$("#fileInput").click();$("#chooseFolder").onclick=()=>$("#folderInput").click();
 $("#fileInput").onchange=e=>{choose(e.target.files);e.target.value=""};$("#folderInput").onchange=e=>{choose(e.target.files);e.target.value=""};
 wireProjects("uploadProjects");
 $("#groupingMode").onchange=e=>{$("#uploadProjectField").hidden=e.target.value!=="manual"&&$("#autoAnalyze").checked;$("#autoAnalyze").disabled=false};
 $("#namingMode").onchange=e=>{$("#customNames").hidden=e.target.value!=="custom"&&$("#autoAnalyze").checked;$("#autoAnalyze").disabled=false};
 $("#namingMode").dispatchEvent(new Event("change"));
 $("#autoAnalyze").onchange=()=>{$("#uploadProjectField").hidden=$("#groupingMode").value!=="manual"&&$("#autoAnalyze").checked;$("#customNames").hidden=$("#namingMode").value!=="custom"&&$("#autoAnalyze").checked};
 const beginUpload=(direct=false,onlyItem=null,retry=false,force=false)=>{
  if(job.active){if(direct)$("#modal").close();return}
  const fields=Object.fromEntries(new FormData(job.formNode)),auto=force||!direct&&$("#autoAnalyze").checked,choice=$("#uploadAnalysisModel")?.value;
  if(auto&&!canAnalyze()){$("#uploadError").textContent="请先连接本机模型或配置 API 模型，或取消自动分析。";return}
  for(const input of $("#customNames").querySelectorAll("[data-custom-name]")){const item=job.items[Number(input.dataset.customName)];if(item&&!item.edited)item.name=input.value}
  const remaining=job.items.filter(i=>!i.saved&&!i.cancelled);if(!remaining.length)return;
  if(direct&&(onlyItem?!!onlyItem.role:remaining.every(i=>i.role))){saveUploadTask(job,onlyItem);return}
  if(fields.namingMode==="custom"&&remaining.some(i=>!i.name.trim())){$("#uploadError").textContent="请为每个素材输入名称";return}
  Object.assign(job,{fields,projects:selectedProjects("uploadProjects"),auto,choice,concurrency:Number($("#analysisConcurrency").value)||3,started:true,directSave:direct,directItem:onlyItem,saved:false});uploadJobs.set(job.id,job);localStorage.setItem("atlas-analysis-concurrency",String(job.concurrency));runUploadTask(job,retry,onlyItem,force);
 };
 job.begin=beginUpload;$("#uploadForm").onsubmit=e=>{e.preventDefault();beginUpload(false)};$("#directSaveUpload").onclick=()=>beginUpload(true);paintUploadTask(job);
}
 $("#uploadButton").onclick=uploadDialog;
const presets={
 openai:{name:"OpenAI",protocol:"responses",base:"https://api.openai.com/v1"},claude:{name:"Anthropic Claude",protocol:"anthropic",base:"https://api.anthropic.com/v1"},gemini:{name:"Google Gemini",protocol:"gemini",base:"https://generativelanguage.googleapis.com/v1beta"},
 qwen:{name:"通义千问",protocol:"openai",base:"https://dashscope.aliyuncs.com/compatible-mode/v1"},glm:{name:"智谱 GLM",protocol:"openai",base:"https://open.bigmodel.cn/api/paas/v4"},doubao:{name:"豆包",protocol:"openai",base:"https://ark.cn-beijing.volces.com/api/v3"},siliconflow:{name:"硅基流动",protocol:"openai",base:"https://api.siliconflow.cn/v1"},openrouter:{name:"OpenRouter",protocol:"openai",base:"https://openrouter.ai/api/v1"},custom:{name:"自定义兼容接口",protocol:"openai",base:""}
};
async function modelDialog(){
 try{
  const {config,available}=await api("/api/model-config"),c=config||{};
  modal("模型设置",codexControls()+skillControls()+'<details id="apiModelSettings"><summary>使用 API 密钥连接（高级，可选）</summary><p class="note">只有使用服务商 API 时才需要填写。先选择服务商，再填写支持图片分析的模型名称和 API 密钥，点击保存。服务地址和接口格式通常保持默认。配置保存在你自己的账号中，跨设备同步。密钥在服务端加密保存，不会返回页面。请选择支持图片输入的视觉模型，费用由所选服务商收取。</p><form id="modelForm"><div class="row"><label>服务商<select name="provider" id="provider">'+Object.entries(presets).map(([id,p])=>'<option value="'+id+'" '+(id===(c.provider||"gemini")?"selected":"")+'>'+p.name+'</option>').join("")+'</select></label><label>接口格式（默认已选好）<select name="protocol" id="protocol">'+[["openai","OpenAI Chat Completions"],["responses","OpenAI Responses"],["anthropic","Anthropic Messages"],["gemini","Gemini 原生"]].map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join("")+'</select></label></div><label>服务地址（默认已填好）<input type="url" name="baseUrl" id="baseUrl" value="'+esc(c.baseUrl||presets.gemini.base)+'"></label><label>模型名称（从服务商控制台复制）<input name="model" value="'+esc(c.model||"")+'" placeholder="服务商实际支持的视觉模型名称" maxlength="160"></label><label>API 密钥<input name="apiKey" type="password" autocomplete="off" placeholder="'+(c.hasKey?"已保存；留空保留":"请输入你的密钥")+'"></label><p id="modelError" class="error"></p><div class="dialog-actions"><button type="button" id="removeConfig" class="danger">删除配置</button><button class="primary" '+(!available?"disabled":"")+'>保存 API 配置</button></div></form></details>');
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
(async()=>{try{const r=await api("/api/auth/me");state.ownerSetup=r.ownerSetup;authMode(r.ownerSetup?"register":"login");if(r.user&&!localStorage.getItem("atlas-login-preference"))$("#authForm").elements.email.value=r.user.email;await restoreRememberedLogin()}catch(e){$("#authError").textContent=e.message}})();
