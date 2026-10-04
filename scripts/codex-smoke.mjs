import assert from "node:assert/strict";
import {createConnector,argumentsFor,outputSchema,MODEL,ORIGIN} from "./codex-connector.mjs";
import fs from "node:fs";
const token="a".repeat(48),port=14379;let release,calls=0;
const server=createConnector({token,port,analyze:async()=>{calls++;return await new Promise(resolve=>release=resolve)}});
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
 const request=fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg"},body:Buffer.from([255,216,255,217])});
 while(!release)await new Promise(resolve=>setTimeout(resolve,10));
 const busy=await fetch(url+"/analyze",{method:"POST",headers:{...headers,"Content-Type":"image/jpeg"},body:Buffer.from([255,216,255])});assert.equal(busy.status,429);
 release({shortName:"测试"});assert.equal((await request).status,200);assert.equal(calls,1);
 const args=argumentsFor("image","schema","output");assert.equal(args[args.indexOf("--model")+1],"gpt-6-luna");assert(args.includes('model_reasoning_effort="low"'));assert(args.includes('service_tier="default"'));assert(args.includes("--ignore-user-config"));assert(args.includes("shell_tool"));assert(!args.includes("--yolo"));assert.equal(args.at(-1),"-");
 const schema=outputSchema(JSON.parse(fs.readFileSync("skills/image-analysis-taxonomy/taxonomy.json")));assert.equal(Object.keys(schema.properties.dimensions.properties).length,24);
 console.log("PASS: Codex exact origin/pair authentication, JPEG-only fixed endpoint, single concurrency, no arbitrary execution, cheapest pinned model/low effort, 24-dimension schema.");
}finally{await new Promise(resolve=>server.close(resolve))}
