import fs from "node:fs";import assert from "node:assert/strict";import {JSDOM} from "jsdom";
const workerSource=fs.readFileSync("dist/server/index.js","utf8"),staticStart=workerSource.indexOf("const STATIC=")+"const STATIC=".length,compiled=JSON.parse(workerSource.slice(staticStart,workerSource.indexOf(";\n",staticStart))),scriptText=name=>Buffer.from(compiled["/"+name].base64,"base64").toString();
const dom=new JSDOM(fs.readFileSync("public/index.html","utf8"),{url:"https://local.test",runScripts:"outside-only",pretendToBeVisual:true}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event("close"))};
const role={id:"CHAR-00001",identity:"one",revision:1,name:"童年角色",filename:"角色.png",description:"画面描述",projectName:"我自己的项目",tags:[{dimension:"age",name:"儿童"},{dimension:"gender",name:"女性"},{dimension:"era",name:"民国"},{dimension:"clothing",name:"旗袍"}],width:1440,height:2160,size:2400000,createdAt:"2026-10-04T00:00:00Z",generationPrompt:"用户的提示词",imageUrl:"/api/assets/CHAR-00001/preview?v=one",downloadUrl:"/api/assets/CHAR-00001/download?v=one"};
const calls=[];let roles=[role],user=null,labels=[],config=null;let result;
w.fetch=async(path,opts={})=>{
 calls.push({path,opts});let body=opts.body&&!(opts.body instanceof w.FormData)?JSON.parse(opts.body):{};
 if(path==="/api/auth/me")result={user:null,ownerSetup:false};
 else if(path==="/api/auth/register"){user={id:"independent",name:body.name,email:body.email};result={user,recoveryCode:"one-time-recovery-code"}}
 else if(path==="/api/library")result={roles,recycle:[],labels,projects:[{name:"我自己的项目"}],analysisEnabled:!!config,modelConfig:config};
 else if(path==="/api/tags"){labels.push(body);result={tag:body}}
 else if(path==="/api/model-config"){if(opts.method==="PUT")config={...body,hasKey:true};result={config,available:true}}
 else if(path.startsWith("/api/assets/CHAR-00001")&&opts.method==="PATCH"){roles=[{...role,...body}];result={role:roles[0]}}
 else if(path==="/api/assets/delete"){roles=[];result={deleted:1}}
 else if(path==="/api/auth/sessions")result={sessions:[]};
 else if(path==="/api/auth/logout")result={ok:true};
 else throw new Error("Unexpected UI API call "+path);
 return{ok:true,status:200,json:async()=>result};
};
w.setInterval=()=>0;w.eval(scriptText("data.js")+";globalThis.seed=ATLAS");labels=w.seed.taxonomy.flatMap(d=>d.groups.flatMap(g=>g.values.map(name=>({dimension:d.id,name,groupName:g.name}))));
w.ATLAS=w.seed;w.eval(scriptText("app.js"));
const wait=()=>new Promise(resolve=>setTimeout(resolve,0)),click=s=>d.querySelector(s).click(),change=s=>d.querySelector(s).dispatchEvent(new w.Event("change",{bubbles:true}));
await wait();assert.equal(d.querySelector("#authScreen").hidden,false);click('[data-auth="register"]');const f=d.querySelector("#authForm");f.elements.email.value="user@example.com";f.elements.name.value="独立用户";f.elements.password.value="long-enough-password";f.elements.confirmPassword.value="long-enough-password";f.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await wait();await wait();
assert.equal(d.querySelector("#app").hidden,false);assert.equal(d.querySelector("#authScreen").hidden,true);assert(d.querySelector("#modalContent").textContent.includes("恢复代码"));click("#savedRecovery");
assert.equal(d.querySelector("#viewTitle").textContent,"素材总览");assert.equal(d.querySelectorAll("[data-filter]").length,10);assert(d.querySelector('[data-filter="age"]').textContent.includes("全部年龄"));assert(!d.body.textContent.includes("年龄阶段"));assert(!d.body.textContent.includes("LIBRARY001"));
d.querySelector('[data-filter="age"]').value="儿童";change('[data-filter="age"]');assert.equal(d.querySelectorAll(".card").length,1);
d.querySelector('[data-filter="era"]').value="中世纪";change('[data-filter="era"]');assert.equal(d.querySelectorAll(".card").length,0);
d.querySelector('[data-filter="era"]').value="";change('[data-filter="era"]');click("[data-detail]");
assert(d.querySelector("#modalContent").textContent.includes("源文件大小"));assert(d.querySelector("#modalContent").textContent.includes("1440 × 2160"));assert(d.querySelector("#modalContent").textContent.includes("2:3"));assert(d.querySelector("#modalContent").textContent.includes("生图提示词"));
click("#editRole");const edit=d.querySelector("#editForm");edit.elements.projectName.value="自定义新项目";edit.elements.generationPrompt.value="新的提示词";d.querySelector("#tagDimension").value="clothing";change("#tagDimension");d.querySelector("#tagGroup").value="新增服饰大类";d.querySelector("#tagName").value="独立服饰";click("#addTag");edit.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await wait();await wait();
assert(calls.some(c=>c.opts.method==="PATCH"&&JSON.parse(c.opts.body).generationPrompt==="新的提示词"));click("#closeModal");
click('[data-view="taxonomy"]');assert(d.querySelector("#content").textContent.includes("传统与国风"));assert(d.querySelector("#content").textContent.includes("教师装"));assert(!d.querySelector("#content").textContent.includes("用途"));click('[data-add-tag="clothing"]');d.querySelector("#tagName").value="手动新服饰";d.querySelector("#tagGroup").value="自己扩展";click("#addTag");await wait();await wait();assert(calls.some(c=>c.path==="/api/tags"));
click("#uploadButton");assert(d.querySelector("#folderInput").hasAttribute("webkitdirectory"));assert.equal(d.querySelector("#namingMode").options.length,3);assert.equal(d.querySelector("#uploadForm").elements.projectName.tagName,"INPUT");d.querySelector("#namingMode").value="custom";change("#namingMode");assert.equal(d.querySelector("#customNames").hidden,false);click("#closeModal");
click("#modelButton");await wait();const mf=d.querySelector("#modelForm");mf.elements.model.value="vision-id";mf.elements.apiKey.value="test-not-real-key";mf.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await wait();await wait();assert(!d.querySelector("#modalContent").textContent.includes("test-not-real-key"));
click('[data-view="library"]');click("#selectAll");assert.equal(d.querySelector("#deleteButton").disabled,false);click("#deleteButton");click("#confirmDelete");await wait();await wait();assert(calls.some(c=>c.path==="/api/assets/delete"&&JSON.parse(c.opts.body).items[0].identity==="one"));
click("#accountButton");await wait();assert(d.querySelector("#modalContent").textContent.includes("独立账号"));assert(!d.querySelector("#modalContent").textContent.includes("邀请"));click("#closeModal");click("#logoutButton");await wait();assert.equal(d.querySelector("#app").hidden,true);assert.equal(d.querySelector("#content").innerHTML,"");
dom.window.close();console.log("PASS: actual UI scripts, independent signup, recovery reminder, ten filters, age/era combinations, metadata/aspect ratio, editable prompt, dynamic clothing groups, folder picker, naming modes, custom projects, secret cleanup, bulk selection/delete, independent account UI, logout clearing.");
