import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), output=path.resolve(root,"dist/server");
fs.mkdirSync(output,{recursive:true});
const data=fs.readFileSync("public/data.js","utf8").replace(/^const ATLAS = /,"").trim().replace(/;$/,"");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png"};
const assets={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else {const url="/"+path.relative("public",full).split(path.sep).join("/");assets[url]={type:types[path.extname(full)]||"application/octet-stream",base64:fs.readFileSync(full).toString("base64")}}}}
walk("public");
fs.writeFileSync(path.join(output,"index.js"),"const SEED="+data+";\nconst STATIC="+JSON.stringify(assets)+";\n"+fs.readFileSync("worker/index.js","utf8"));
fs.mkdirSync("dist/.openai",{recursive:true});
fs.copyFileSync(".openai/hosting.json","dist/.openai/hosting.json");
console.log("Worker build complete.");
