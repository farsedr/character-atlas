import http from "node:http";import fs from "node:fs";import {DatabaseSync} from "node:sqlite";import worker from "../dist/server/index.js";
const sql=new DatabaseSync(":memory:");for(const f of fs.readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())sql.exec(fs.readFileSync("drizzle/"+f,"utf8"));
const DB={prepare(q){const stmt=sql.prepare(q);let values=[];return{bind(...args){values=args;return this},async all(){return{results:stmt.all(...values)}},async first(){return stmt.get(...values)||null},async run(){const r=stmt.run(...values);return{success:true,meta:{changes:Number(r.changes)}}}}},async batch(items){sql.exec("BEGIN");try{const r=[];for(const s of items)r.push(await s.run());sql.exec("COMMIT");return r}catch(e){sql.exec("ROLLBACK");throw e}}};
const blobs=new Map(),BUCKET={async put(k,b){blobs.set(k,new Uint8Array(b))},async get(k){const b=blobs.get(k);return b?{body:b,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}:null},async delete(k){blobs.delete(k)}};
const env={DB,BUCKET,AI_CONFIG_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64")};
const server=http.createServer(async(req,res)=>{
 try{
  const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24*1048576){res.writeHead(413);res.end();return}parts.push(chunk)}
  const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(","):v);
  headers.set("oai-authenticated-user-id","d1bb8e6c-e86f-403b-8267-53bd994c2aba");
  const response=await worker.fetch(new Request("http://localhost:4173"+req.url,{method:req.method,headers,...(["GET","HEAD"].includes(req.method)?{}:{body:Buffer.concat(parts)})}),env,{});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end("Preview error")}
});server.listen(4173,"127.0.0.1",()=>console.log("Local preview: http://localhost:4173 (isolated temporary data, no cloud credentials)"));
