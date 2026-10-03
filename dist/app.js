"use strict";
const {roles,taxonomy,projects}=ATLAS;
const $=s=>document.querySelector(s);
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={view:"library",query:"",sort:"id",filters:{},group:""};
const names={library:"角色库",taxonomy:"分类字典",projects:"项目分组"};
const labels=Object.fromEntries(taxonomy.map(x=>[x.id,x.name]));labels.project="项目";
const byProject=id=>projects.find(x=>x.id===id);
const terms=d=>d.groups.flatMap(g=>g.values);
const matchRoles=()=>roles.filter(r=>{
if(state.group&&!taxonomy[0].groups.find(g=>g.name===state.group)?.values.includes(r.classification.style))return false;
if(!Object.entries(state.filters).every(([key,value])=>!value||(key==="project"?r.projectId:r.classification[key])===value))return false;
const haystack=[r.id,r.name,r.en,r.description,...Object.values(r.classification),...r.invariants,byProject(r.projectId).name].join(" ").toLocaleLowerCase();
return state.query.trim().toLocaleLowerCase().split(/\s+/).every(q=>haystack.includes(q));
}).sort((a,b)=>state.sort==="name"?a.name.localeCompare(b.name,"zh-CN"):a.id.localeCompare(b.id));

function showView(view){
if(!Object.hasOwn(names,view))return;
state.view=view;
Object.keys(names).forEach(x=>{$("#"+x+"-view").hidden=x!==view;document.querySelector('[data-view="'+x+'"]').classList.toggle("active",x===view);document.querySelector('[data-view="'+x+'"]').setAttribute("aria-current",x===view?"page":"false")});
$("#breadcrumb").textContent=names[view];
$("#page-title").innerHTML=names[view]+({library:"<span> / 06</span>",taxonomy:"<span> / 104</span>",projects:"<span> / 03</span>"})[view];
$("#page-description").textContent={library:"让每一个角色，都有清晰的位置。",taxonomy:"把视觉语言拆成可以检索的维度。",projects:"用项目连接角色、方向与创作目标。"}[view];
$(".edition strong").textContent={library:"001—006",taxonomy:"7 DIMENSIONS",projects:"001—003"}[view];
}
function update(){
const found=matchRoles();
$("#result-count").innerHTML="显示 <strong>"+found.length+"</strong> / "+roles.length+" 个角色";
$("#cards").innerHTML=found.map(r=>'<button class="card" data-role="'+r.id+'" aria-label="查看'+escapeHtml(r.name)+'的角色档案"><div class="portrait tile-'+r.tile+'" role="img" aria-label="'+escapeHtml(r.name)+'的AI概念示意图"></div><span class="card-id">'+r.id.replace("AST-","")+'</span><div class="card-body"><div class="card-title"><h2>'+escapeHtml(r.name)+'</h2><small>'+r.en+'</small></div><p>'+escapeHtml(r.description)+'</p><div class="tags">'+[r.classification.style,r.classification.theme].map(t=>'<span class="tag">'+escapeHtml(t)+'</span>').join("")+'</div><div class="card-foot"><span>'+escapeHtml(byProject(r.projectId).name)+'</span><span>示例 · 概念草案</span></div></div></button>').join("");
$("#empty").hidden=found.length!==0;
$("#active-filters").innerHTML=Object.entries(state.filters).filter(([,v])=>v).map(([k,v])=>'<button class="filter-chip" data-remove="'+k+'">'+labels[k]+'：'+escapeHtml(k==="project"?byProject(v).name:v)+' ×</button>').join("")+(state.group?'<button class="filter-chip" data-remove="group">画风分组：'+escapeHtml(state.group)+' ×</button>':"");
document.querySelectorAll("[data-filter]").forEach(s=>{s.value=state.filters[s.dataset.filter]||""});
document.querySelectorAll("[data-group]").forEach(b=>b.classList.toggle("selected",state.group===b.dataset.group));
}
function reset(){state.filters={};state.group="";state.query="";$("#search").value="";update()}
function selectTerm(key,value){reset();state.filters[key]=value;showView("library");update();$("#search").focus()}
function detail(id){
const r=roles.find(x=>x.id===id);if(!r)throw new Error("角色不存在");
const art=$("#detail-art");art.className="detail-art tile-"+r.tile;art.setAttribute("aria-label",r.name+"的AI概念示意图");
$("#detail-content").innerHTML='<div class="detail-code">'+r.id+' · '+r.version+'</div><h2 id="detail-name">'+r.name+' <small style="font-size:13px;color:#929fb3">'+r.en+'</small></h2><div class="tags"><span class="tag">示例档案</span><span class="tag">'+r.status+'</span></div><p>'+escapeHtml(r.description)+'</p><h3>分类属性</h3><dl class="properties">'+Object.entries(r.classification).map(([k,v])=>'<div><dt>'+labels[k]+'</dt><dd>'+escapeHtml(v)+'</dd></div>').join("")+'<div><dt>所属项目</dt><dd>'+escapeHtml(byProject(r.projectId).name)+'</dd></div></dl><h3>固定识别特征</h3><ul>'+r.invariants.map(t=>'<li>'+escapeHtml(t)+'</li>').join("")+'</ul><h3>设计备注</h3><p>'+escapeHtml(r.notes)+'</p><h3>待补充的角色视图</h3><div class="missing">'+r.missingViews.map(t=>'<span>'+escapeHtml(t)+'</span>').join("")+'</div><h3>素材与生成记录</h3><p>当前仅有 AI 生成的概念示意图，尚未形成定稿角色、多视图或正式生产记录。</p><p class="detail-note">示意图用于演示分类与浏览方式，不作为已审核的正式资产。档案更新：'+r.updated+'。</p>';
$("#detail").showModal();
}
$("#filters").innerHTML=taxonomy.map(d=>'<label>'+d.name+'<select data-filter="'+d.id+'" aria-label="按'+d.name+'筛选"><option value="">全部'+d.name+'</option>'+d.groups.map(g=>'<optgroup label="'+g.name+'">'+g.values.map(v=>'<option>'+v+'</option>').join("")+'</optgroup>').join("")+'</select></label>').join("")+'<label>项目<select data-filter="project" aria-label="按项目筛选"><option value="">全部项目</option>'+projects.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join("")+'</select></label>';
$("#style-nav").innerHTML=taxonomy[0].groups.map(g=>'<button class="style-link" data-group="'+g.name+'">'+g.name+'<b>'+roles.filter(r=>g.values.includes(r.classification.style)).length+'</b></button>').join("");
$("#taxonomy").innerHTML=taxonomy.map((d,i)=>'<article class="dimension"><h2><span style="color:#6f7d91;font-size:15px;margin-right:12px">0'+(i+1)+'</span>'+d.name+'<small>'+terms(d).length+' 个词条</small></h2><p>'+d.description+'</p>'+d.groups.map(g=>'<div class="term-group"><span>'+g.name+'</span><div class="terms">'+g.values.map(t=>'<button class="term" data-dimension="'+d.id+'" data-term="'+t+'">'+t+'<small>'+roles.filter(r=>r.classification[d.id]===t).length+'</small></button>').join("")+'</div></div>').join("")+'</article>').join("");
$("#projects").innerHTML=projects.map(p=>'<article class="project-card" style="--project-color:'+p.color+'"><small>'+p.id+' · 示例项目</small><h2>'+p.name+'</h2><p>'+p.description+'</p><div class="meta">'+p.deliverables+'<br>'+roles.filter(r=>r.projectId===p.id).length+' 个角色 · 概念阶段</div><button class="secondary" data-project="'+p.id+'">浏览项目角色</button></article>').join("");
document.addEventListener("click",e=>{
const nav=e.target.closest("[data-view]");if(nav){showView(nav.dataset.view);return}
const card=e.target.closest("[data-role]");if(card){detail(card.dataset.role);return}
const group=e.target.closest("[data-group]");if(group){reset();state.group=group.dataset.group;showView("library");update();return}
const term=e.target.closest("[data-term]");if(term){selectTerm(term.dataset.dimension,term.dataset.term);return}
const project=e.target.closest("[data-project]");if(project){selectTerm("project",project.dataset.project);return}
const remove=e.target.closest("[data-remove]");if(remove){if(remove.dataset.remove==="group")state.group="";else delete state.filters[remove.dataset.remove];update()}
});
$("#search").addEventListener("input",e=>{state.query=e.target.value;update()});
$("#sort").addEventListener("change",e=>{state.sort=e.target.value;update()});
$("#filters").addEventListener("change",e=>{if(e.target.dataset.filter){state.filters[e.target.dataset.filter]=e.target.value;state.group="";update()}});
$("#reset").addEventListener("click",reset);$("#empty-reset").addEventListener("click",reset);
$("#close-detail").addEventListener("click",()=>$("#detail").close());
$("#detail").addEventListener("click",e=>{if(e.target===$("#detail")){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$(".brand").addEventListener("click",e=>{e.preventDefault();reset();showView("library")});
document.addEventListener("keydown",e=>{if(e.key==="/"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)&&!$("#detail").open){e.preventDefault();showView("library");$("#search").focus()}});
showView("library");update();
if(document.modelContext?.registerTool){
const lifecycle=new AbortController();
const tools=[{name:"filter_character_library",title:"筛选角色库",description:"设置关键词与单个分类维度，更新网页中的角色结果。",inputSchema:{type:"object",properties:{query:{type:"string"},dimension:{type:"string",enum:taxonomy.map(d=>d.id)},value:{type:"string"}},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){
if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!["query","dimension","value"].includes(k)))throw new Error("筛选参数无效");
if(input.query!==undefined&&typeof input.query!=="string")throw new Error("关键词必须是文本");
if((input.dimension===undefined)!==(input.value===undefined))throw new Error("分类维度和词条需要同时提供");
if(input.dimension!==undefined){const d=taxonomy.find(d=>d.id===input.dimension);if(!d||!terms(d).includes(input.value))throw new Error("分类词条不存在")}
reset();state.query=input.query||"";$("#search").value=state.query;if(input.dimension)state.filters[input.dimension]=input.value;showView("library");update();return {count:matchRoles().length,characters:matchRoles().map(r=>({id:r.id,name:r.name}))}
}}];
for(const t of tools){try{Promise.resolve(document.modelContext.registerTool(t,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
window.addEventListener("pagehide",()=>lifecycle.abort(),{once:true});
}
