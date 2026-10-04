import fs from "node:fs";import path from "node:path";import {transform} from "esbuild";
await import("./package-connector.mjs");
const root=process.cwd(),output=path.resolve(root,"dist/server");
fs.mkdirSync(output,{recursive:true});
const data=fs.readFileSync("public/data.js","utf8").replace(/^const ATLAS = /,"").trim().replace(/;$/,"");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".zip":"application/zip",".md":"text/markdown; charset=utf-8"};
const assets={};
async function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else{const url="/"+path.relative("public",full).split(path.sep).join("/");let bytes=fs.readFileSync(full);if([".js",".css"].includes(path.extname(full))){const r=await transform(bytes.toString(),{loader:path.extname(full)===".js"?"js":"css",minify:true,legalComments:"none",target:"es2020"});bytes=Buffer.from(r.code)}assets[url]={type:types[path.extname(full)]||"application/octet-stream",base64:bytes.toString("base64")}}}}
await walk("public");
fs.writeFileSync(path.join(output,"index.js"),"const ANALYSIS_SKILL="+JSON.stringify(fs.readFileSync("skills/image-analysis-taxonomy/SKILL.md","utf8")+"\n"+fs.readFileSync("skills/image-analysis-taxonomy/references/visual-standard.md","utf8")+"\n"+fs.readFileSync("skills/image-analysis-taxonomy/references/output-contract.md","utf8"))+";\nconst ANALYSIS_TAXONOMY="+fs.readFileSync("skills/image-analysis-taxonomy/taxonomy.json","utf8")+";\nconst SEED="+data+";\nconst STATIC="+JSON.stringify(assets)+";\n"+fs.readFileSync("worker/auth.js","utf8")+"\n"+fs.readFileSync("worker/zip.js","utf8")+"\n"+fs.readFileSync("worker/index.js","utf8"));
fs.mkdirSync("dist/.openai",{recursive:true});fs.copyFileSync(".openai/hosting.json","dist/.openai/hosting.json");
console.log("拾光图鉴 Worker + minified PWA build complete.");
