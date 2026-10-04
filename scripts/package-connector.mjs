import fs from "node:fs";import path from "node:path";import {writeZip} from "./zip-package.mjs";
const files=["start-codex.cmd","start-gemini.cmd","start-local-models.cmd","start.sh","scripts/start-codex.ps1","scripts/codex-connector.mjs","scripts/local-models.mjs","scripts/connector-README.md","docs/USER-GUIDE.md"];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);e.isDirectory()?walk(f):files.push(f.split(path.sep).join("/"))}}walk("skills/image-analysis-taxonomy");
console.log("Portable connector ZIP: "+writeZip(files,"public/share/local-connector.zip")+" files");
