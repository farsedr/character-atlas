import fs from "node:fs";import path from "node:path";import {transform} from "esbuild";
import {RULE_FILES,outputSchema,composeAnalysisPrompt} from './analysis-contract.mjs';
const taxonomy=JSON.parse(fs.readFileSync('skills/image-analysis-taxonomy/taxonomy.json','utf8'));
const rules={base:RULE_FILES.base.map(p=>fs.readFileSync(p,'utf8')).join('\n'),contract:fs.readFileSync(RULE_FILES.contract,'utf8')},schema=outputSchema(taxonomy);
fs.writeFileSync('skills/image-analysis-taxonomy/schema/output.schema.json',JSON.stringify(schema,null,2)+'\n');
fs.copyFileSync('docs/USER-GUIDE.md','public/share/使用说明.md');
await import("./package-connector.mjs");
const root=process.cwd(),output=path.resolve(root,"dist/server");
fs.mkdirSync(output,{recursive:true});
const data=fs.readFileSync("public/data.js","utf8").replace(/^const ATLAS = /,"").trim().replace(/;$/,"");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".zip":"application/zip",".md":"text/markdown; charset=utf-8"};
const assets={};
async function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else{const url="/"+path.relative("public",full).split(path.sep).join("/");let bytes=fs.readFileSync(full);if([".js",".css"].includes(path.extname(full))){const r=await transform(bytes.toString(),{loader:path.extname(full)===".js"?"js":"css",minify:true,legalComments:"none",target:"es2020"});bytes=Buffer.from(r.code)}assets[url]={type:types[path.extname(full)]||"application/octet-stream",base64:bytes.toString("base64")}}}}
await walk("public");
const toolsCode=await transform(fs.readFileSync("public/library-tools.js","utf8")+'\n'+fs.readFileSync("public/pro-tools.js","utf8"),{loader:"js",minify:true,target:"es2020"});assets["/app.js"].base64=Buffer.from(Buffer.from(assets["/app.js"].base64,"base64").toString()+"\n"+toolsCode.code).toString("base64");
fs.writeFileSync(path.join(output,"index.js"),"const BACKUP_MIGRATION="+JSON.stringify(fs.readFileSync("drizzle/0008_backup_imports.sql","utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))+";\nconst ANALYSIS_RULES="+JSON.stringify(rules)+";\nconst ANALYSIS_SCHEMA="+JSON.stringify(schema)+";\nconst composeAnalysisPrompt="+composeAnalysisPrompt.toString()+";\nconst LOCAL_DEFAULT_SKILL="+JSON.stringify(rules.base+"\n"+rules.contract)+";\nconst ANALYSIS_TAXONOMY="+JSON.stringify(taxonomy)+";\nconst SEED="+data+";\nconst STATIC="+JSON.stringify(assets)+";\n"+fs.readFileSync("public/tag-groups.js","utf8")+"\n"+fs.readFileSync("worker/auth.js","utf8")+"\n"+fs.readFileSync("worker/baidu-md5.js","utf8")+"\n"+fs.readFileSync("worker/baidu.js","utf8")+"\n"+fs.readFileSync("worker/zip.js","utf8")+"\n"+fs.readFileSync("worker/library.js","utf8")+"\n"+fs.readFileSync("worker/pro-tools.js","utf8")+"\n"+fs.readFileSync("worker/backup.js","utf8")+"\n"+fs.readFileSync("worker/index.js","utf8"));
fs.mkdirSync("dist/.openai",{recursive:true});fs.copyFileSync(".openai/hosting.json","dist/.openai/hosting.json");
console.log("拾光图鉴 Worker + minified PWA build complete.");
