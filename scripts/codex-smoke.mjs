import assert from "node:assert/strict";
import {createConnector,argumentsFor,outputSchema,MODEL,ORIGIN,modelCatalog,selectedOptions,run} from "./codex-connector.mjs";
import fs from "node:fs";import path from "node:path";import os from "node:os";import {geminiSettings,geminiPolicy,geminiArguments,discoverCli} from "./local-models.mjs";
const token="a".repeat(48),port=14379;let release,calls=0,used,receivedSkill,receivedCollections;
const models=[{id:MODEL,name:"GPT-6 Luna",efforts:["low","high"]},{id:"gpt-6-sol",name:"GPT-6 Sol",efforts:["low","medium","high"]},{id:"gemini-2.5-flash-lite",name:"Gemini Flash Lite",provider:"gemini",efforts:["default"]}];
const server=createConnector({token,port,getModels:async()=>models,analyze:async(image,options,skill,collections)=>{used=options;receivedSkill=skill;receivedCollections=collections;calls++;return await new Promise(resolve=>release=resolve)}});
await new Promise(resolve=>server.listen(port,"127.0.0.1",resolve));
const url="http://127.0.0.1:"+port,headers={Origin:ORIGIN,"X-Atlas-Token":token};
try{
 assert.equal((await fetch(url+"/health")).status,403);
 assert.equal((await fetch(url+"/health",{headers:{...headers,Origin:"https://evil.example"}})).status,403);
 assert.equal((await fetch(url+"/health",{headers:{...headers,"X-Atlas-Token":"wrong"}})).status,401);
 const health=await fetch(url+"/health",{headers});assert.equal(health.headers.get("access-control-allow-origin"),ORIGIN);assert.equal((await health.json()).model,MODEL);
 const pre=await fetch(url+"/analyze",{method:"OPTIONS",headers:{Origin:ORIGIN}});assert.equal(pre.status,204);assert.equal(pre.headers.get("access-control-allow-private-network"),"true");
 assert.equal((await fetch(url+"/execute",{method:"POST",headers,body:"arbitrary command"})).status,404);
 assert.equal((await fetch(url+"/analyze",{method:"POST",headers,body:"command"})).status,415);
 assert.equal((await fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg"},body:"command"})).status,502);assert.equal(calls,0);
 assert.equal((await fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg","X-Atlas-Model":"--yolo"},body:Buffer.from([255,216,255])})).status,400);
 assert.equal((await fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg","X-Atlas-Reasoning":"max"},body:Buffer.from([255,216,255])})).status,400);
 const request=fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg"},body:Buffer.from([255,216,255,217]),headers:{...headers,"Content-Type":"image/jpeg","X-Atlas-Model":"gpt-6-sol","X-Atlas-Reasoning":"medium"}});
 while(!release)await new Promise(resolve=>setTimeout(resolve,10));
 const busy=await fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg"},body:Buffer.from([255,216,255])});assert.equal(busy.status,429);
 release({shortName:"测试"});assert.equal((await request).status,200);assert.equal(calls,1);assert.deepEqual(used,{model:"gpt-6-sol",reasoning:"medium",provider:"codex"});
 release=null;const gemRequest=fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"application/json","X-Atlas-Model":"gemini-2.5-flash-lite","X-Atlas-Reasoning":"default"},body:JSON.stringify({image:Buffer.from([255,216,255,217]).toString("base64"),skill:"自定义 Skill",collections:["Fantasy"]})});
while(!release)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(receivedSkill,"自定义 Skill");assert.equal(used.provider,"gemini");assert.deepEqual(receivedCollections,["Fantasy"]);release({summary:"mock"});assert.equal((await gemRequest).status,200);
assert.throws(()=>selectedOptions(models,"gpt-other"),/模型/);assert.throws(()=>selectedOptions(models,MODEL,"max"),/推理/);
 const custom=argumentsFor("image","schema","output",{model:"gpt-6-sol",reasoning:"medium"});assert.equal(custom[custom.indexOf("--model")+1],"gpt-6-sol");assert(custom.includes('model_reasoning_effort="medium"'));
 assert.deepEqual(modelCatalog({models:[{slug:MODEL,visibility:"list",input_modalities:["image"],supported_reasoning_levels:[{effort:"low"},{effort:"ultra"}]},{slug:"gpt-secret",visibility:"hide",input_modalities:["image"]}]}).map(m=>m.efforts),[["low"]]);
 const args=argumentsFor("image","schema","output");assert.equal(args[args.indexOf("--model")+1],"gpt-6-luna");assert(args.includes('model_reasoning_effort="low"'));assert(args.includes('service_tier="default"'));assert(args.includes("--ignore-user-config"));assert(args.includes("shell_tool"));assert(!args.includes("--yolo"));assert.equal(args.at(-1),"-");
 const schema=outputSchema(JSON.parse(fs.readFileSync("skills/image-analysis-taxonomy/taxonomy.json")));assert.equal(Object.keys(schema.properties.dimensions.properties).length,24);assert(schema.required.includes("collectionName"));
const fixtureDir=fs.mkdtempSync(path.join(os.tmpdir(),"atlas-adapter-test-"));const fixture=path.join(fixtureDir,"cli.mjs");
try{
 fs.writeFileSync(fixture,'import fs from "node:fs";let input="";for await(const b of process.stdin)input+=b;if(!input.includes("imagePrompt")||!input.includes("custom-marker")||!input.includes("visual-standard")&&!input.includes("构图"))process.exit(8);const a=process.argv.slice(2);if(a.includes("--output-format")){const settings=JSON.parse(fs.readFileSync(process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH));if(settings.hooksConfig.enabled||settings.admin.mcp.enabled||settings.security.auth.selectedType!=="oauth-personal")process.exit(9);console.log(JSON.stringify({response:JSON.stringify({summary:"Gemini adapter",imagePrompt:"中文提示词"})}));}else{fs.writeFileSync(a[a.indexOf("--output-last-message")+1],JSON.stringify({summary:"Codex adapter",imagePrompt:"中文提示词"}))}');
 const cli={command:process.execPath,prefix:[fixture]};const gem=await run(Buffer.from([255,216,255,217]),cli,{model:"gemini-2.5-flash-lite",reasoning:"default",provider:"gemini"},"custom-marker");assert.equal(gem.summary,"Gemini adapter");const cod=await run(Buffer.from([255,216,255,217]),cli,{model:MODEL,reasoning:"low",provider:"codex"},"custom-marker");assert.equal(cod.summary,"Codex adapter");
 const settings=geminiSettings("/tmp/policy.toml","gemini-2.5-flash-lite");assert.deepEqual(settings.tools.core,["read_file"]);assert.equal(settings.model.maxSessionTurns,3);assert.equal(settings.admin.extensions.enabled,false);assert(Object.values(settings.modelConfigs.modelChains).every(c=>c.length===1&&c[0].model==="gemini-2.5-flash-lite"));assert(geminiArguments("gemini-2.5-flash-lite").includes("plan"));assert(!geminiArguments("gemini-2.5-flash-lite").includes("--yolo"));const policy=geminiPolicy("C:\\Temp\\image.jpg");const pattern=JSON.parse(policy.match(/argsPattern = (.*)/)[1]);assert(new RegExp(pattern).test(JSON.stringify({file_path:"C:\\Temp\\image.jpg"})));assert(!new RegExp(pattern).test(JSON.stringify({file_path:"C:\\Users\\any\\auth.json"})));
 const previousPath=process.env.PATH;process.env.PATH=path.resolve("test-output/gemini-cli/node_modules/.bin")+path.delimiter+previousPath;try{if(fs.existsSync("test-output/gemini-cli/node_modules/@google/gemini-cli/package.json")){const found=await discoverCli("gemini");assert(found?.prefix[0].endsWith("bundle"+path.sep+"gemini.js"))}}finally{process.env.PATH=previousPath}
}finally{const resolved=path.resolve(fixtureDir);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep))throw Error("Unsafe fixture path");fs.rmSync(resolved,{recursive:true,force:true})}
console.log("PASS: Gemini/Codex child-process adapters, imported Skill forwarding, dynamic install discovery, Google-only authentication, fixed model without fallback, image-only read policy.");
 console.log("PASS: Codex exact origin/pair authentication, JPEG-only fixed endpoint, single concurrency, no arbitrary execution, cheapest pinned model/low effort, 24-dimension schema.");
}finally{await new Promise(resolve=>server.close(resolve))}
