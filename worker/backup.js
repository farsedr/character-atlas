const BACKUP_FIELDS=['name','description','tags','projectNames','projectName','generationPrompt','namingMode','groupingMode','width','height','analysisStatus','analysisResult','analysisLocks','visualHash','contentHash','relatedAssetIdentity','deletedWithMain','previewSize','hasThumbnail','thumbnailSize'];
async function restoreBackupTags(env, tags, owner){
 const canonical = await canonicalTags(env, tags, 'manual', owner);
 const originals = new Map();
 const key = tag => tag.dimension + ':' + normalize(tag.name);
 for(const tag of tags){
  if(!originals.has(key(tag)))originals.set(key(tag), tag);
 }
 return canonical.map(tag => {
  const original = originals.get(key(tag));
  if(original.source === 'ai')tag.source = 'ai';
  if(original.confidence !== undefined){
   if(!Number.isFinite(original.confidence) || original.confidence < 0 || original.confidence > 1)throw new HttpError(400,'备份标签置信度无效');
   tag.confidence = original.confidence;
  }
  if(original.evidence !== undefined){
   if(!Array.isArray(original.evidence) || original.evidence.length > 12 || original.evidence.some(value => typeof value !== 'string' || value.length > 240))throw new HttpError(400,'备份标签依据无效');
   tag.evidence = original.evidence;
  }
  if(original.status !== undefined){
   if(!['confirmed','candidate'].includes(original.status))throw new HttpError(400,'备份标签状态无效');
   tag.status = original.status;
  }
  if(original.primary !== undefined){
   if(typeof original.primary !== 'boolean')throw new HttpError(400,'备份主标签标记无效');
   tag.primary = original.primary;
  }
  return tag;
 });
}
const backupEncoder=new TextEncoder();
const backupChunk=64*1024;

function backupHasher(){
 if(typeof crypto.DigestStream==='function'){
  const stream=new crypto.DigestStream('SHA-256'),writer=stream.getWriter();
  // An export may be cancelled by the reader before its final checksum is written.
  stream.digest.catch(()=>{});
  return {
   write:bytes=>writer.write(bytes),
   async finish(){await writer.close();return encode64(new Uint8Array(await stream.digest))},
   abort:()=>writer.abort().catch(()=>{})
  };
 }
 // Desktop WebCrypto has a one-shot digest. Keep only one record and drop its chunks after assembly.
 const chunks=[];
 let size=0;
 return {
  write(bytes){chunks.push(bytes);size+=bytes.length},
  async finish(){
   const input=new Uint8Array(size);
   let offset=0;
   for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length}
   chunks.length=0;
   return encode64(new Uint8Array(await crypto.subtle.digest('SHA-256',input)));
  },
  abort(){chunks.length=0}
 };
}

// Match v1's UTF-8 JSON.stringify(data) exactly, including escaping untrusted file strings.
function* backupFileString(value){
 if(typeof value!=='string'){yield JSON.stringify(value);return}
 yield '"';
 for(let start=0;start<value.length;){
  let end=Math.min(start+backupChunk,value.length);
  if(end<value.length&&value.charCodeAt(end-1)>=0xd800&&value.charCodeAt(end-1)<=0xdbff)end--;
  yield JSON.stringify(value.slice(start,end)).slice(1,-1);
  start=end;
 }
 yield '"';
}

async function* backupDataParts(data,fileParts){
 if(!data||typeof data!=='object'||Array.isArray(data)){yield JSON.stringify(data);return}
 yield '{';
 let separator='';
 for(const [key,value] of Object.entries(data)){
  if(value===undefined)continue;
  yield separator+JSON.stringify(key)+':';
  separator=',';
  if(key!=='files'||!Array.isArray(value)){yield JSON.stringify(value);continue}
  yield '[';
  for(let i=0;i<value.length;i++){if(i)yield ',';yield* fileParts(value[i])}
  yield ']';
 }
 yield '}';
}

async function backupDigest(data){
 const hasher=backupHasher();
 try{
  for await(const text of backupDataParts(data,backupFileString))await hasher.write(backupEncoder.encode(text));
  return await hasher.finish();
 }catch(error){await hasher.abort();throw error}
}

async function* backupObjectBytes(object){
 const reader=object.body?.getReader?.();
 if(!reader){yield object.body instanceof Uint8Array?object.body:new Uint8Array(await object.arrayBuffer());return}
 let done=false;
 try{
  while(!done){const part=await reader.read();done=part.done;if(!done)yield part.value}
 }finally{if(!done)await reader.cancel().catch(()=>{});reader.releaseLock()}
}

async function* backupObjectString(env,key){
 const object=await bucket(env).get(key);
 if(!object)throw new Error('备份源文件缺失');
 yield '"';
 let carry=new Uint8Array(0);
 for await(const bytes of backupObjectBytes(object)){
  for(let start=0;start<bytes.length;start+=backupChunk){
   let part=bytes.subarray(start,start+backupChunk);
   if(carry.length){
    const joined=new Uint8Array(carry.length+part.length);
    joined.set(carry);joined.set(part,carry.length);part=joined;
   }
   const end=part.length-part.length%3;
   if(end)yield encode64(part.subarray(0,end));
   carry=part.slice(end);
  }
 }
 if(carry.length)yield encode64(carry);
 yield '"';
}

async function exportLibraryBackup(env,owner){
 async function* records(){
  const projects=(await query(env,'SELECT name FROM atlas_projects WHERE owner_id=?',owner).all()).results.map(p=>p.name);
  const labels=(await query(env,'SELECT dimension,name,group_name AS groupName FROM atlas_labels WHERE owner_id=?',owner).all()).results;
  yield backupEncoder.encode(JSON.stringify({format:'atlas-library-backup',version:1,projects,labels})+'\n');
  let cursor='',count=0;
  while(true){
   const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND COALESCE(json_extract(body,'$.backupPending'),'')='' AND id>? ORDER BY id LIMIT 20",owner,cursor).all()).results;
   if(!rows.length)break;
   for(const row of rows){
    const body=JSON.parse(row.body);
    const data={identity:row.id,body:Object.fromEntries(BACKUP_FIELDS.filter(k=>body[k]!==undefined).map(k=>[k,body[k]])),filename:row.filename,mime:row.mime,size:row.size,createdAt:row.created_at,deletedAt:row.deleted_at,files:assetObjectKeys(row)};
    yield backupEncoder.encode('{"data":');
    const hasher=backupHasher();
    let checksum;
    try{
     for await(const text of backupDataParts(data,key=>backupObjectString(env,key))){
      const bytes=backupEncoder.encode(text);
      await hasher.write(bytes);
      yield bytes;
     }
     checksum=await hasher.finish();
    }finally{if(checksum===undefined)await hasher.abort()}
    yield backupEncoder.encode(',"checksum":'+JSON.stringify(checksum)+'}\n');
    cursor=row.id;count++;
   }
  }
  yield backupEncoder.encode(JSON.stringify({end:true,count})+'\n');
 }
 const iterator=records();
 return new Response(new ReadableStream({
  async pull(controller){try{const part=await iterator.next();if(part.done)controller.close();else controller.enqueue(part.value)}catch(error){controller.error(error)}},
  async cancel(){await iterator.return()}
 }),{headers:{'Content-Type':'application/x-ndjson','Content-Disposition':'attachment; filename=atlas-library.atlas','Cache-Control':'no-store'}});
}
const backupStageWhere = "owner_id=? AND deleted_at='backup-pending' AND json_extract(body,'$.backupPending')=?";
const backupIdleMs = 15 * 60 * 1000;
const backupSchemas = new WeakMap();

async function ensureBackupSchema(env) {
 const db = getDb(env);
 if (!backupSchemas.has(db)) {
  const ready = (async () => {
   const installed=await query(env,"SELECT name FROM sqlite_master WHERE type='index' AND name='atlas_owner_backup_stage'").first();
   if(installed) return;
   // Native SQLite resolves table names while preparing statements, before batch execution.
   await db.prepare(BACKUP_MIGRATION[0]).run();
   await db.batch(BACKUP_MIGRATION.slice(1).map(statement=>db.prepare(statement)));
  })();
  backupSchemas.set(db, ready);
 }
 try { await backupSchemas.get(db); } catch (error) { backupSchemas.delete(db); throw error; }
}

async function pendingBackupImports(env, owner) {
 await ensureBackupSchema(env);
 const rows = await query(env, "SELECT batch FROM atlas_backup_imports WHERE owner_id=? AND (state='cancelling' OR (state='receiving' AND updated_at<=?))",
  owner, Date.now()-backupIdleMs).all();
 return json({pending:rows.results});
}

function backupState(env, owner, batch) {
 return query(env, 'SELECT state,imported FROM atlas_backup_imports WHERE owner_id=? AND batch=?', owner, batch).first();
}

async function cancelBackupImport(env, owner, b) {
 const cutoff = b.onlyInactive ? Date.now()-backupIdleMs : Date.now();
 await query(env, "UPDATE atlas_backup_imports SET state='cancelling' WHERE owner_id=? AND batch=? AND state='receiving' AND updated_at<=?",owner,b.batch,cutoff).run();
 const batch = await backupState(env,owner,b.batch);
 if (!batch || batch.state==='cancelled') return json({ok:true});
 if (batch.state==='completed') return json({state:'completed',imported:batch.imported});
 if (batch.state!=='cancelling') throw new HttpError(409,'这批素材仍在导入');
 // Once cancellation wins, no request can commit this batch or stage another row.
 do {
  const {results:rows} = await query(env,'SELECT id,original_key,preview_key,body FROM atlas_assets WHERE '+backupStageWhere+' ORDER BY id LIMIT 20',owner,b.batch).all();
  for (const row of rows) {
   for (const key of assetObjectKeys(row)) await bucket(env).delete(key);
   await query(env,'DELETE FROM atlas_assets WHERE id=? AND '+backupStageWhere,row.id,owner,b.batch).run();
  }
  if (rows.length<20) break;
  if (b.paged) return json({ok:true,more:true});
 } while (true);
 await query(env,"UPDATE atlas_backup_imports SET state='cancelled',updated_at=? WHERE owner_id=? AND batch=? AND state='cancelling'",Date.now(),owner,b.batch).run();
 return json({ok:true});
}

async function finishBackupImport(env,owner,b,retries=2) {
 if (!Number.isSafeInteger(b.count)||b.count<0) throw new HttpError(400,'备份数量无效');
 const batch = await backupState(env,owner,b.batch);
 if (batch?.state==='completed' && batch.imported===b.count) return json({imported:batch.imported});
 if (batch?.state!=='receiving') throw new HttpError(409,'这批导入已结束或正在清理');
 const {n} = await query(env,'SELECT COUNT(*) AS n FROM atlas_assets WHERE '+backupStageWhere,owner,b.batch).first();
 if (n!==b.count) throw new HttpError(400,'备份数量不完整，未入库');
 const orphan = await query(env,
  "SELECT a.id FROM atlas_assets a LEFT JOIN atlas_assets p ON p.id=json_extract(a.body,'$.relatedAssetIdentity') AND p.owner_id=a.owner_id AND p.deleted_at='backup-pending' AND json_extract(p.body,'$.backupPending')=? AND COALESCE(json_extract(p.body,'$.relatedAssetIdentity'),'')='' WHERE a.owner_id=? AND a.deleted_at='backup-pending' AND json_extract(a.body,'$.backupPending')=? AND COALESCE(json_extract(a.body,'$.relatedAssetIdentity'),'')<>'' AND p.id IS NULL LIMIT 1",
  b.batch,owner,b.batch).first();
 if (orphan) throw new HttpError(400,'集合关系不完整，未入库');
 const metadata = b.metadata || {projects:[],labels:[]};
 if (!Array.isArray(metadata.projects)||metadata.projects.length>10000||!Array.isArray(metadata.labels)||metadata.labels.length>50000) throw new HttpError(400,'备份词库无效');

 const statements = [
  query(env,"SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_backup_imports WHERE owner_id=? AND batch=? AND state='receiving') AND (SELECT COUNT(*) FROM atlas_assets WHERE "+backupStageWhere+")=? THEN 1 ELSE json('invalid') END",
   owner,b.batch,owner,b.batch,b.count)
 ];
 const {results:projects} = await query(env,'SELECT id,name,name_key FROM atlas_projects WHERE owner_id=?',owner).all();
 const byName = new Map(projects.map(p=>[p.name_key,p]));
 function resolveProject(value) {
  const name = clean(value), key = owner+'|'+normalize(name);
  if (!byName.has(key)) {
   const id = crypto.randomUUID();
   byName.set(key,{id,name});
   statements.push(query(env,'INSERT INTO atlas_projects(id,owner_id,name,name_key,created_at) VALUES(?,?,?,?,?)',id,owner,name,key,new Date().toISOString()));
  }
  return byName.get(key);
 }
 for (const name of metadata.projects) resolveProject(name);
 for (let i=0;i<metadata.labels.length;i+=100) {
  const tags = await canonicalTags(env,metadata.labels.slice(i,i+100),'manual',owner);
  statements.push(...labelStatements(env,tags,owner));
 }
 const {results:numbers} = await query(env,'SELECT display_number FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND display_number IS NOT NULL',owner).all();
 const used = new Set(numbers.map(row=>row.display_number));
 let cursor='',nextNumber=1;
 while (true) {
  const {results:rows} = await query(env,
   "SELECT id,json_extract(body,'$.projectNames') names,json_extract(body,'$.projectName') name,json_extract(body,'$.relatedAssetIdentity') parent,json_extract(body,'$.backupDeletedAt') deleted FROM atlas_assets WHERE "+backupStageWhere+" AND id>? ORDER BY id LIMIT 100",owner,b.batch,cursor).all();
  if (!rows.length) break;
  const updates = rows.map(row=>{
   const names = row.names ? JSON.parse(row.names) : [row.name||'未分组'];
   if (!Array.isArray(names)||names.length>30) throw new HttpError(400,'备份中的灵感集无效');
   const groups = [...new Set(names.length?names:['未分组'])].map(resolveProject);
   let number=null;
   if (!row.parent&&!row.deleted) {
    while (used.has(nextNumber)) nextNumber++;
    if (nextNumber>99999) throw new HttpError(409,'可用主页编号不足，未导入');
    number=nextNumber++;
   }
   return {id:row.id,number,groups:{projectIds:groups.map(p=>p.id),projectNames:groups.map(p=>p.name),projectId:groups[0].id,projectName:groups[0].name}};
  });
  for(let i=0;i<updates.length;i+=12) {
   statements.push(query(env,"UPDATE atlas_assets AS a SET body=json_patch(json_remove(a.body,'$.backupPending','$.backupDeletedAt'),json_set(json_extract(item.value,'$.groups'),'$.uploadDraft',json('false'))),deleted_at=json_extract(a.body,'$.backupDeletedAt'),display_number=json_extract(item.value,'$.number') FROM json_each(?) AS item WHERE a.id=json_extract(item.value,'$.id') AND "+backupStageWhere,
    JSON.stringify(updates.slice(i,i+12)),owner,b.batch));
  }
  cursor=rows.at(-1).id;
 }
 statements.push(query(env,"UPDATE atlas_backup_imports SET state='completed',imported=?,updated_at=? WHERE owner_id=? AND batch=?",b.count,Date.now(),owner,b.batch));
 try { await getDb(env).batch(statements); }
 catch(error) {
  const current=await backupState(env,owner,b.batch);
  if(current?.state==='completed' && current.imported===b.count) return json({imported:current.imported});
  if(current?.state!=='receiving') throw new HttpError(409,'这批导入已结束或正在清理');
  // Another import can allocate the same gallery number or create the same project.
  // Rebuild this transaction against the new catalog after SQLite rolls it back.
  const cause=String(error.message)+' '+String(error.cause?.message||'');
  if(retries>0 && /UNIQUE constraint failed: atlas_(assets\.owner_id|projects\.name_key)/i.test(cause)) {
   return finishBackupImport(env,owner,b,retries-1);
  }
  throw error;
 }
 return json({imported:b.count});
}

async function importLibraryBackup(b,env,owner) {
 if(!b || !/^[a-zA-Z0-9-]{8,100}$/.test(b.batch||'')) throw new HttpError(400,'备份批次无效');
 await ensureBackupSchema(env);
 if(b.action==='status') return json(await backupState(env,owner,b.batch)||{state:'unknown'});
 if(b.action==='cancel') {
  // A delayed first record must also observe a cancellation made before it arrived.
  if(!b.onlyInactive) await query(env,"INSERT OR IGNORE INTO atlas_backup_imports(owner_id,batch,state,updated_at) VALUES(?,?,'cancelled',?)",owner,b.batch,Date.now()).run();
  return cancelBackupImport(env,owner,b);
 }
 if(!['record','finish'].includes(b.action)) throw new HttpError(400,'备份操作无效');
 await query(env,"INSERT INTO atlas_backup_imports(owner_id,batch,updated_at) VALUES(?,?,?) ON CONFLICT(owner_id,batch) DO UPDATE SET updated_at=excluded.updated_at WHERE state='receiving'",owner,b.batch,Date.now()).run();
 if(b.action==='finish') return finishBackupImport(env,owner,b);
 if((await backupState(env,owner,b.batch)).state!=='receiving') throw new HttpError(409,'这批导入已结束或正在清理');
 if(b.action!=='record'||!b.record?.data||await backupDigest(b.record.data)!==b.record.checksum)throw new HttpError(400,'备份校验失败');
 const d=b.record.data;if(typeof d.identity!=='string'||!d.identity||!['image/png','image/jpeg','image/webp'].includes(d.mime)||!Array.isArray(d.files)||d.files.length<2||d.files.length>3)throw new HttpError(400,'备份格式无效');
 const remap=async id=>'restore-'+(await hash(owner+'|'+b.batch+'|'+id)).replace(/[^a-zA-Z0-9]/g,'');const id=await remap(d.identity);
 if(await query(env,'SELECT id FROM atlas_assets WHERE id=? AND owner_id=?',id,owner).first())return json({ok:true});
 const body=Object.fromEntries(BACKUP_FIELDS.filter(k=>d.body?.[k]!==undefined).map(k=>[k,d.body[k]]));body.name=textValue(body.name,180);body.tags=await restoreBackupTags(env,body.tags||[],owner);body.backupPending=b.batch;body.uploadDraft=true;body.backupDeletedAt=d.deletedAt||null;const deletedWithParent = body.backupDeletedAt && typeof body.relatedAssetIdentity === 'string' && body.relatedAssetIdentity === body.deletedWithMain;
 delete body.deletedWithMain;
 if(body.relatedAssetIdentity)body.relatedAssetIdentity=await remap(body.relatedAssetIdentity);
 if(deletedWithParent)body.deletedWithMain=body.relatedAssetIdentity;
 const files=d.files.map(decode64);if(files[0].length!==d.size||files[0].length>MAX_FILE||signature(files[0])!==d.mime||files[1].length>2*1024*1024||signature(files[1])!=='image/jpeg'||files[2]&&(files[2].length>512*1024||signature(files[2])!=='image/jpeg'))throw new HttpError(400,'备份图片无效');body.hasThumbnail=files.length===3;body.previewSize=files[1].length;body.thumbnailSize=files[2]?.length||0;
 // Each attempt owns its files. A concurrent retry losing the primary-key race
 // can release its own objects without touching the accepted copy.
 const uploadKey=crypto.randomUUID(),original='originals/'+uploadKey,preview='previews/'+uploadKey;
 const keys=[original,preview,preview+'.thumb'].slice(0,files.length);
 try {
  for(let i=0;i<files.length;i++) await bucket(env).put(keys[i],files[i]);
  const inserted=await query(env,
   "INSERT INTO atlas_assets(id,body,original_key,preview_key,mime,filename,size,revision,created_at,owner_id,display_number,deleted_at) SELECT ?,?,?,?,?,?,?,1,?,?,NULL,'backup-pending' WHERE EXISTS(SELECT 1 FROM atlas_backup_imports WHERE owner_id=? AND batch=? AND state='receiving') ON CONFLICT(id) DO NOTHING",
   id,JSON.stringify(body),original,preview,d.mime,String(d.filename||'image'),d.size,String(d.createdAt||new Date().toISOString()),owner,owner,b.batch).run();
  if(inserted.meta?.changes) return json({ok:true});
 } catch(error) {
  // If the DB committed but its acknowledgement was lost, its files are live.
  const persisted=await query(env,'SELECT original_key FROM atlas_assets WHERE id=? AND owner_id=?',id,owner).first();
  if(persisted?.original_key===original) return json({ok:true});
  for(const key of keys) await bucket(env).delete(key);
  throw error;
 }
 for(const key of keys) await bucket(env).delete(key);
 const duplicate=await query(env,'SELECT id FROM atlas_assets WHERE id=? AND '+backupStageWhere,id,owner,b.batch).first();
 if(duplicate) return json({ok:true});
 throw new HttpError(409,'这批导入已结束或正在清理');
}
