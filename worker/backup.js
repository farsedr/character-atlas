const BACKUP_FIELDS=['name','description','tags','projectNames','projectName','generationPrompt','namingMode','groupingMode','width','height','analysisStatus','analysisResult','analysisLocks','visualHash','contentHash','relatedAssetIdentity','previewSize','hasThumbnail','thumbnailSize'];
const backupDigest=async value=>encode64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))));
async function exportLibraryBackup(env,owner){
 async function* records(){
  yield {format:'atlas-library-backup',version:1,projects:(await query(env,'SELECT name FROM atlas_projects WHERE owner_id=?',owner).all()).results.map(p=>p.name),labels:(await query(env,'SELECT dimension,name,group_name AS groupName FROM atlas_labels WHERE owner_id=?',owner).all()).results};let cursor='',count=0;
  while(true){const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND COALESCE(json_extract(body,'$.backupPending'),'')='' AND id>? ORDER BY id LIMIT 20",owner,cursor).all()).results;if(!rows.length)break;
   for(const row of rows){const body=JSON.parse(row.body),files=[];for(const key of assetObjectKeys(row)){const object=await bucket(env).get(key);if(!object)throw new Error('备份源文件缺失');files.push(encode64(new Uint8Array(await object.arrayBuffer())))}
    const data={identity:row.id,body:Object.fromEntries(BACKUP_FIELDS.filter(k=>body[k]!==undefined).map(k=>[k,body[k]])),filename:row.filename,mime:row.mime,size:row.size,createdAt:row.created_at,deletedAt:row.deleted_at,files};yield {data,checksum:await backupDigest(data)};count++;cursor=row.id;
   }
  }yield {end:true,count};
 }
 const iterator=records(),encoder=new TextEncoder();return new Response(new ReadableStream({async pull(controller){try{const r=await iterator.next();if(r.done)controller.close();else controller.enqueue(encoder.encode(JSON.stringify(r.value)+'\n'))}catch(e){controller.error(e)}},async cancel(){await iterator.return()}}),{headers:{'Content-Type':'application/x-ndjson','Content-Disposition':'attachment; filename=atlas-library.atlas','Cache-Control':'no-store'}});
}
async function importLibraryBackup(request,env,owner){
 const b=await request.json();if(!/^[a-zA-Z0-9-]{8,100}$/.test(b.batch||''))throw new HttpError(400,'备份批次无效');
 const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND json_extract(body,'$.backupPending')=?",owner,b.batch).all()).results;
 if(b.action==='cancel'){for(const row of rows){for(const key of assetObjectKeys(row))await bucket(env).delete(key);await query(env,'DELETE FROM atlas_assets WHERE id=? AND owner_id=?',row.id,owner).run()}return json({ok:true})}
 if(b.action==='finish'){
  if(!Number.isInteger(b.count)||b.count!==rows.length)throw new HttpError(400,'备份数量不完整，未入库');const ids=new Set(rows.map(r=>r.id));
  for(const row of rows){const body=JSON.parse(row.body);if(body.relatedAssetIdentity){const parent=rows.find(r=>r.id===body.relatedAssetIdentity);if(!parent||JSON.parse(parent.body).relatedAssetIdentity)throw new HttpError(400,'集合关系不完整，未入库')}}
  if(b.metadata){if(!Array.isArray(b.metadata.projects)||b.metadata.projects.length>10000||!Array.isArray(b.metadata.labels)||b.metadata.labels.length>50000)throw new HttpError(400,'备份词库无效');for(const name of b.metadata.projects)await memberships(env,owner,[clean(name)]);for(let i=0;i<b.metadata.labels.length;i+=100)await persistLabels(env,await canonicalTags(env,b.metadata.labels.slice(i,i+100),'manual',owner),owner)}
  const statements=[];for(const row of rows){const body=JSON.parse(row.body);const groups=await memberships(env,owner,body.projectNames||[body.projectName||'未分组']);Object.assign(body,groups);delete body.backupPending;body.uploadDraft=false;const number=!body.relatedAssetIdentity&&!body.backupDeletedAt;const deleted=body.backupDeletedAt||null;delete body.backupDeletedAt;
   statements.push(query(env,'UPDATE atlas_assets SET body=?,deleted_at=?,display_number='+ (number?'('+gapSQL+')':'NULL')+' WHERE id=? AND owner_id=?',JSON.stringify(body),deleted,...(number?[owner,owner]:[]),row.id,owner));
   if(number)statements.push(query(env,"SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND display_number IS NOT NULL) THEN 1 ELSE json('invalid') END",row.id,owner));
  }if(statements.length)await getDb(env).batch(statements);return json({imported:rows.length});
 }
 if(b.action!=='record'||!b.record?.data||await backupDigest(b.record.data)!==b.record.checksum)throw new HttpError(400,'备份校验失败');
 const d=b.record.data;if(typeof d.identity!=='string'||!d.identity||!['image/png','image/jpeg','image/webp'].includes(d.mime)||!Array.isArray(d.files)||d.files.length<2||d.files.length>3)throw new HttpError(400,'备份格式无效');
 const remap=async id=>'restore-'+(await hash(owner+'|'+b.batch+'|'+id)).replace(/[^a-zA-Z0-9]/g,'');const id=await remap(d.identity);
 if(await query(env,'SELECT id FROM atlas_assets WHERE id=? AND owner_id=?',id,owner).first())return json({ok:true});
 const body=Object.fromEntries(BACKUP_FIELDS.filter(k=>d.body?.[k]!==undefined).map(k=>[k,d.body[k]]));body.name=textValue(body.name,180);body.tags=await canonicalTags(env,body.tags||[],'manual',owner);body.backupPending=b.batch;body.uploadDraft=true;body.backupDeletedAt=d.deletedAt||null;if(body.relatedAssetIdentity)body.relatedAssetIdentity=await remap(body.relatedAssetIdentity);
 const files=d.files.map(decode64);if(files[0].length!==d.size||files[0].length>MAX_FILE||signature(files[0])!==d.mime||files[1].length>2*1024*1024||signature(files[1])!=='image/jpeg'||files[2]&&(files[2].length>512*1024||signature(files[2])!=='image/jpeg'))throw new HttpError(400,'备份图片无效');body.hasThumbnail=files.length===3;body.previewSize=files[1].length;body.thumbnailSize=files[2]?.length||0;
 const original='originals/'+id,preview='previews/'+id,keys=[original,preview,preview+'.thumb'];try{for(let i=0;i<files.length;i++)await bucket(env).put(keys[i],files[i]);await query(env,'INSERT INTO atlas_assets(id,body,original_key,preview_key,mime,filename,size,revision,created_at,owner_id,display_number,deleted_at) VALUES(?,?,?,?,?,?,?,1,?,?,NULL,?)',id,JSON.stringify(body),original,preview,d.mime,String(d.filename||'image'),d.size,String(d.createdAt||new Date().toISOString()),owner,'backup-pending').run()}catch(e){for(const key of keys)await bucket(env).delete(key);throw e}return json({ok:true});
}
