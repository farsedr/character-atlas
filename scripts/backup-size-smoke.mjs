import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {crc32} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createLocalRuntime} from '../desktop/local-runtime.mjs';

const MiB=1024*1024;
const origin='https://atlas.local';
const backup='/api/library/backup';
const tempRoot=await fs.realpath(os.tmpdir());
const directory=await fs.mkdtemp(path.join(tempRoot,'atlas-backup-size-'));
let runtime;
const nativeDigest=Object.getOwnPropertyDescriptor(globalThis.crypto,'DigestStream');
let digestWrites=0,maxDigestChunk=0;
class TestDigestStream extends WritableStream{
 constructor(algorithm){
  const hash=crypto.createHash(algorithm.toLowerCase().replace('-',''));
  let resolve,reject;
  const digest=new Promise((ok,fail)=>{resolve=ok;reject=fail});
  super({
   write(bytes){digestWrites++;maxDigestChunk=Math.max(maxDigestChunk,bytes.length);hash.update(bytes)},
   close(){resolve(Uint8Array.from(hash.digest()).buffer)},
   abort(reason){reject(reason)}
  });
  this.digest=digest;
 }
}
const setDigest=implementation=>Object.defineProperty(globalThis.crypto,'DigestStream',{configurable:true,value:implementation});
const referenceChecksum=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('base64');

async function request(route,body,cookie='',headers={}){
 const options={method:body===undefined?'GET':'POST',headers:{origin,cookie,...headers},body};
 if(body instanceof ReadableStream)options.duplex='half';
 return runtime.fetch(new Request(origin+route,options));
}

async function register(email){
 const response=await request('/api/auth/register',JSON.stringify({email,name:'Test',password:'backup-size-test-password'}));
 assert.equal(response.status,200);
 return response.headers.get('set-cookie').split(';')[0];
}

async function jsonPost(route,value,cookie){
 const text=JSON.stringify(value);
 const response=await request(route,text,cookie,{'content-type':'application/json','content-length':String(Buffer.byteLength(text))});
 assert.equal(response.ok,true,'POST '+route+' returned '+response.status);
 return response.json();
}

async function pngAtUploadLimit(){
 // Insert a legal ancillary text chunk before IEND. The resulting PNG is exactly 20 MiB.
 const base=await fs.readFile(new URL('../public/icon-192.png',import.meta.url));
 const length=20*MiB-base.length-12;
 const text=Buffer.alloc(length,0x78);
 text.write('Comment\0',0,'ascii');
 const header=Buffer.alloc(8),checksum=Buffer.alloc(4);
 header.writeUInt32BE(length);
 header.write('tEXt',4,'ascii');
 checksum.writeUInt32BE(crc32(text,crc32(header.subarray(4))));
 return Buffer.concat([base.subarray(0,-12),header,text,checksum,base.subarray(-12)]);
}

try{
 runtime=await createLocalRuntime({dataDirectory:directory,workerURL:new URL('../dist/server/index.js',import.meta.url),
  migrationsDirectory:fileURLToPath(new URL('../drizzle/',import.meta.url)),key:crypto.randomBytes(32).toString('base64')});
 const sourceCookie=await register('backup-source@example.com'),targetCookie=await register('backup-target@example.com');

 // Count bytes actually read, including when the sender did not specify Content-Length.
 let sent=0,cancelled=false;
 const chunk=new Uint8Array(MiB).fill(0x20);
 const oversized=new ReadableStream({
  pull(controller){if(sent++<34)controller.enqueue(chunk);else controller.close()},
  cancel(){cancelled=true}
 });
 assert.equal((await request(backup,oversized,targetCookie)).status,413);
 assert.equal(cancelled,true);
 const ordinary=' '.repeat(64000)+'{}';
 assert.equal((await request('/api/assets/batch-edit',ordinary,targetCookie,{'content-length':String(ordinary.length)})).status,413);

 const original=await pngAtUploadLimit();
 assert.equal(original.length,20*MiB);
 const form=new FormData();
 form.set('file',new File([original],'boundary.png',{type:'image/png'}));
 form.set('preview',new File([Buffer.from([255,216,255,224,0,0])],'preview.jpg',{type:'image/jpeg'}));
 const uploaded=await request('/api/assets',form,sourceCookie);
 assert.equal(uploaded.status,201);

 setDigest(TestDigestStream);
 const exported=await request(backup,undefined,sourceCookie);
 assert.equal(exported.status,200);
 const chunks=[];
 for await(const chunk of exported.body){
  assert(chunk.byteLength<128*1024,'image results should be streamed in bounded pieces');
  chunks.push(chunk);
 }
 const [metadata,record,trailer]=Buffer.concat(chunks).toString('utf8').trim().split('\n').map(JSON.parse);
 chunks.length=0;
 assert(digestWrites>100);
 assert(maxDigestChunk<128*1024);
 assert.equal(record.checksum,referenceChecksum(record.data));
 assert.equal(record.data.size,20*MiB);
 assert.equal(trailer.count,1);
 const batch='image-at-upload-limit';
 // The same v1 record and checksum must work in both server implementations.
 setDigest(undefined);
 await jsonPost(backup,{action:'record',batch,record},targetCookie);
 setDigest(TestDigestStream);
 await jsonPost(backup,{action:'record',batch,record},targetCookie);
 const invalid={...record.data,mime:'invalid',files:['A'.repeat(65535)+'😀"\\\n\ud800','']};
 const escaped=await request(backup,JSON.stringify({action:'record',batch,record:{data:invalid,checksum:referenceChecksum(invalid)}}),targetCookie);
 assert.equal(escaped.status,400);
 assert.equal((await escaped.json()).error,'备份格式无效','escaped file strings must pass the checksum before image validation');
 assert.equal((await jsonPost(backup,{action:'finish',batch,count:1,metadata},targetCookie)).imported,1);
 const library=await (await request('/api/library?view=library',undefined,targetCookie)).json();
 assert.equal(library.roles.length,1);
 const downloaded=await request(library.roles[0].downloadUrl,undefined,targetCookie);
 assert.equal(downloaded.status,200);
 assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),original);
 console.log('PASS: 20 MiB PNG export/import, both compatible checksum paths, bounded output, request limits, original bytes and JSON escaping.');
}finally{
 if(nativeDigest)Object.defineProperty(globalThis.crypto,'DigestStream',nativeDigest);else delete globalThis.crypto.DigestStream;
 try{await runtime?.close()}finally{
  assert.equal(path.dirname(directory),tempRoot);
  assert(path.basename(directory).startsWith('atlas-backup-size-'));
  await fs.rm(directory,{recursive:true});
 }
}
