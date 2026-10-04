const ZIP_CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function zipRecord(size,fields){const a=new Uint8Array(size),v=new DataView(a.buffer);for(const [offset,width,value] of fields)width===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true);return a}
async function* archiveOriginals(env,rows){
 const central=[],usedNames=new Set();let offset=0;
 for(const row of rows){
  const base=downloadName(row),dot=base.lastIndexOf(".");let filename=base,index=2;while(usedNames.has(filename.normalize("NFKC").toLowerCase()))filename=base.slice(0,dot)+" ("+(index++)+ ")"+base.slice(dot);usedNames.add(filename.normalize("NFKC").toLowerCase());
  const name=new TextEncoder().encode(filename),d=new Date(row.created_at),year=Math.max(1980,Math.min(2107,d.getUTCFullYear())),time=(d.getUTCHours()<<11)|(d.getUTCMinutes()<<5)|(d.getUTCSeconds()>>1),date=((year-1980)<<9)|((d.getUTCMonth()+1)<<5)|d.getUTCDate(),start=offset;
  const object=await bucket(env).get(row.original_key);if(!object)throw new Error("Source image missing");
  const header=zipRecord(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x808],[10,2,time],[12,2,date],[26,2,name.length]]);yield header;yield name;offset+=header.length+name.length;
  let crc=0xffffffff,length=0;
  const reader=object.body?.getReader?.();
  try{
   if(reader){while(true){const {value,done}=await reader.read();if(done)break;for(const b of value)crc=ZIP_CRC_TABLE[(crc^b)&255]^(crc>>>8);length+=value.length;offset+=value.length;yield value}}
   else{const bytes=new Uint8Array(await object.arrayBuffer());for(const b of bytes)crc=ZIP_CRC_TABLE[(crc^b)&255]^(crc>>>8);length=bytes.length;offset+=length;yield bytes}
  }finally{if(reader){await reader.cancel().catch(()=>{});reader.releaseLock()}}
  if(length!==row.size)throw new Error("Source image size changed");crc=(crc^0xffffffff)>>>0;
  yield zipRecord(16,[[0,4,0x08074b50],[4,4,crc],[8,4,length],[12,4,length]]);offset+=16;
  central.push({name,time,date,crc,length,start});
 }
 const centralStart=offset;
 for(const e of central){const h=zipRecord(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x808],[12,2,e.time],[14,2,e.date],[16,4,e.crc],[20,4,e.length],[24,4,e.length],[28,2,e.name.length],[42,4,e.start]]);yield h;yield e.name;offset+=h.length+e.name.length}
 yield zipRecord(22,[[0,4,0x06054b50],[8,2,central.length],[10,2,central.length],[12,4,offset-centralStart],[16,4,centralStart]]);
}
async function batchDownload(request,env,owner){
 const b=await request.json();if(!Array.isArray(b.items)||!b.items.length||b.items.length>200)throw new HttpError(400,"每个下载包需包含1至200张素材");
 const ids=new Set();for(const i of b.items){if(typeof i.identity!=="string"||!Number.isInteger(i.revision)||ids.has(i.identity))throw new HttpError(400,"下载参数无效");ids.add(i.identity)}
 const all=await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND id IN ("+b.items.map(()=>"?").join(",")+")",owner,...b.items.map(i=>i.identity)).all(),byId=new Map(all.results.map(r=>[r.id,r]));
 if(all.results.length!==b.items.length)throw new HttpError(404,"部分素材不存在或不可下载，请刷新");
 const rows=b.items.map(i=>byId.get(i.identity));if(rows.some((r,index)=>r.revision!==b.items[index].revision))throw new HttpError(409,"素材已变化，请刷新后重新选择");
 if(rows.reduce((n,r)=>n+r.size+2000,22)>0xffffffff)throw new HttpError(413,"下载包超过4GB，请分批选择");
 const iterator=archiveOriginals(env,rows),stream=new ReadableStream({async pull(controller){try{const r=await iterator.next();r.done?controller.close():controller.enqueue(r.value)}catch(e){controller.error(e)}},async cancel(){await iterator.return()}});
 return new Response(stream,{headers:{"Content-Type":"application/zip","Content-Disposition":"attachment; filename=materials.zip","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
