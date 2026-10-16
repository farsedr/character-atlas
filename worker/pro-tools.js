const ANALYSIS_FIELDS=['name','projects','tags','description','generationPrompt'];
function fieldLocks(value){if(!Array.isArray(value)||value.some(f=>!ANALYSIS_FIELDS.includes(f)))throw new HttpError(400,'锁定字段无效');return [...new Set(value)]}
async function ownedAsset(env,owner,identity,revision){
 if(typeof identity!=='string'||identity.length>100)throw new HttpError(400,'素材标识无效');
 const row=await query(env,'SELECT * FROM atlas_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL',identity,owner).first();
 if(!row)throw new HttpError(404,'素材不存在');
 if(revision!==undefined&&(!Number.isInteger(revision)||row.revision!==revision))throw new HttpError(409,'素材已变化，请刷新后重试');
 if(JSON.parse(row.body).cancelPending)throw new HttpError(409,'素材正在取消');return row;
}
async function batchEdit(request,env,owner){
 const b=await request.json();if(!Array.isArray(b.items)||!b.items.length||b.items.length>50||new Set(b.items.map(i=>i?.identity)).size!==b.items.length)throw new HttpError(400,'每次选择1至50张不同素材');
 if(!['addTags','removeTags','addProjects','replaceProjects'].includes(b.action))throw new HttpError(400,'批量操作无效');
 const rows=[];for(const item of b.items){if(!Number.isInteger(item?.revision))throw new HttpError(400,'缺少素材版本');const row=await ownedAsset(env,owner,item.identity,item.revision),role=JSON.parse(row.body);if(role.uploadDraft||role.relatedAssetIdentity)throw new HttpError(400,'批量编辑请选择已保存的主素材');rows.push(row)}
 const tags=b.action.endsWith('Tags')?await canonicalTags(env,b.tags,'manual',owner):null;
 if(tags&&!tags.length)throw new HttpError(400,'请添加要修改的标签');
 if(!tags&&(!Array.isArray(b.projectNames)||!b.projectNames.length))throw new HttpError(400,'请选择灵感集');
 const changes=[];for(const row of rows){const role=JSON.parse(row.body);if(tags){const keys=new Set(tags.map(t=>t.dimension+':'+normalize(t.name)));role.tags=b.action==='addTags'?[...(role.tags||[]).filter(t=>!keys.has(t.dimension+':'+normalize(t.name))),...tags]:(role.tags||[]).filter(t=>!keys.has(t.dimension+':'+normalize(t.name)));if(role.tags.length>120)throw new HttpError(400,'合并后标签超过120个');}else{Object.assign(role,await memberships(env,owner,b.action==='addProjects'?[...new Set([...(role.projectNames||[role.projectName||'未分组']),...b.projectNames])]:b.projectNames));role.groupingMode='manual'}changes.push({row,role})}
 const statements=changes.map(({row})=>query(env,"SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND COALESCE(json_extract(body,'$.relatedAssetIdentity'),'')='') THEN 1 ELSE json('invalid') END",row.id,owner,row.revision));
 for(const {row,role}of changes){statements.push(query(env,'UPDATE atlas_assets SET body=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?',JSON.stringify(role),row.id,owner,row.revision));if(!tags)statements.push(query(env,"UPDATE atlas_assets SET body=json_set(body,'$.projectNames',json(?),'$.projectIds',json(?),'$.projectName',?,'$.projectId',?,'$.groupingMode','manual'),revision=revision+1 WHERE owner_id=? AND json_extract(body,'$.relatedAssetIdentity')=?",JSON.stringify(role.projectNames),JSON.stringify(role.projectIds),role.projectName,role.projectId,owner,row.id))}
 try{await getDb(env).batch(statements)}catch{throw new HttpError(409,'所选素材已变化，本批未修改，请刷新重试')}
 if(tags&&b.action==='addTags')await persistLabels(env,tags,owner);return json({updated:rows.length});
}
async function libraryHealth(env,owner,url){
 const cursor=url.searchParams.get('cursor')||'';if(cursor.length>100)throw new HttpError(400,'检查游标无效');
 const summary=(await query(env,"SELECT CASE WHEN deleted_at IS NOT NULL THEN 'recycle' WHEN json_extract(body,'$.uploadDraft')=1 THEN 'drafts' WHEN COALESCE(json_extract(body,'$.relatedAssetIdentity'),'')<>'' THEN 'collections' ELSE 'main' END category,COUNT(*) count,COALESCE(SUM(size),0) originalBytes,COALESCE(SUM(CAST(json_extract(body,'$.previewSize') AS INTEGER)),0) previewBytes,SUM(CASE WHEN json_extract(body,'$.previewSize') IS NULL THEN 1 ELSE 0 END) unknownPreviews FROM atlas_assets WHERE owner_id=? GROUP BY category",owner).all()).results;
 if(!url.searchParams.has('scan'))return json({summary});
 const rows=(await query(env,'SELECT * FROM atlas_assets WHERE owner_id=? AND id>? ORDER BY id LIMIT 25',owner,cursor).all()).results,issues=[];let originalBytes=0,previewBytes=0;
 for(const row of rows){const role=JSON.parse(row.body),problems=[];for(const [key,type]of [[row.original_key,'原图丢失'],[row.preview_key,'预览丢失']]){const object=await (bucket(env).head?bucket(env).head(key):bucket(env).get(key));if(!object)problems.push(type);else {const bytes=object.size??(await object.arrayBuffer()).byteLength;if(type==='原图丢失')originalBytes+=bytes;else previewBytes+=bytes}}
  if(role.relatedAssetIdentity){const parent=await query(env,'SELECT body,deleted_at FROM atlas_assets WHERE id=? AND owner_id=?',role.relatedAssetIdentity,owner).first();if(!parent||JSON.parse(parent.body).relatedAssetIdentity||!row.deleted_at&&parent.deleted_at)problems.push('集合关联异常')}
  if(role.uploadDraft&&Date.now()-Date.parse(row.created_at)>7*86400000)problems.push('草稿已保留超过7天');
  if(role.analysisStatus==='analyzing'&&Date.now()-(role.analysisStarted||0)>90000)problems.push('分析已中断，可重试');
  if(problems.length)issues.push({role:briefRole(row),problems});
 }return json({summary,checked:rows.length,originalBytes,previewBytes,issues,nextCursor:rows.length===25?rows.at(-1).id:null,at:new Date().toISOString()});
}
async function visualIndex(request,env,owner){
 const b=await request.json();if(!Array.isArray(b.items)||!b.items.length||b.items.length>25)throw new HttpError(400,'每次索引1至25张');let indexed=0;
 for(const item of b.items){if(!Number.isInteger(item?.revision)||!/^[a-f0-9]{16}$/.test(item.hash||''))throw new HttpError(400,'图像特征或版本无效');const row=await ownedAsset(env,owner,item.identity,item.revision);const r=await query(env,"UPDATE atlas_assets SET body=json_set(body,'$.visualHash',?,'$.visualHashVersion',1) WHERE id=? AND owner_id=? AND revision=?",item.hash,row.id,owner,row.revision).run();indexed+=r.meta?.changes||0}return json({indexed});
}
function visualDistance(a,b){if(!/^[a-f0-9]{16}$/.test(a||'')||!/^[a-f0-9]{16}$/.test(b||''))return null;let n=0;for(let i=0;i<16;i++){let x=parseInt(a[i],16)^parseInt(b[i],16);while(x){n+=x&1;x>>=1}}return n}
async function repairPreview(request,env,owner){
 const form=await request.formData(),revision=Number(form.get('revision'));if(!Number.isInteger(revision))throw new HttpError(400,'缺少素材版本');
 const row=await ownedAsset(env,owner,form.get('identity'),revision),file=form.get('preview');if(!(file instanceof File)||!file.size||file.size>2*1024*1024)throw new HttpError(400,'预览图无效');
 if(await bucket(env).get(row.preview_key))throw new HttpError(409,'预览图已存在，请重新检查');if(!await bucket(env).get(row.original_key))throw new HttpError(409,'原图丢失，无法重建预览');
 const bytes=await file.arrayBuffer();if(signature(new Uint8Array(bytes))!=='image/jpeg')throw new HttpError(400,'预览必须为JPEG');const key='previews/'+row.id+'-'+crypto.randomUUID();
 try{await bucket(env).put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});const updated=await query(env,"UPDATE atlas_assets SET preview_key=?,body=json_set(body,'$.previewSize',?),revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL RETURNING *",key,bytes.byteLength,row.id,owner,row.revision).first();if(!updated)throw new HttpError(409,'素材已变化，请重新检查');return json({role:bodyRole(updated)})}catch(e){await bucket(env).delete(key);throw e}
}
async function similarAssets(env,owner,url){
 const source=await ownedAsset(env,owner,url.searchParams.get('identity')),base=JSON.parse(source.body),keys=new Set((base.tags||[]).map(t=>t.dimension+':'+normalize(t.name)));
 const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND id<>? ORDER BY created_at DESC,id LIMIT 5000",owner,source.id).all()).results;
 const total=(await query(env,"SELECT COUNT(*) n FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND id<>?",owner,source.id).first()).n;
 const matches=[];for(const row of rows){const role=JSON.parse(row.body),other=new Set((role.tags||[]).map(t=>t.dimension+':'+normalize(t.name))),common=[...keys].filter(k=>other.has(k)).length,jaccard=common/Math.max(1,new Set([...keys,...other]).size),distance=visualDistance(base.visualHash,role.visualHash),exact=!!base.contentHash&&base.contentHash===role.contentHash;
  if(exact||distance!==null&&distance<=12||common>=2&&jaccard>=.2)matches.push({role:briefRole(row),distance,common,exact,score:exact?2:Math.max(distance!==null?1-distance/64:0,jaccard),reason:exact?'相同原图':distance!==null&&distance<=12?'图像特征接近':'共有 '+common+' 个标签'});
 }matches.sort((a,b)=>b.score-a.score||b.common-a.common);return json({matches:matches.slice(0,30),scanned:rows.length,total,indexed:rows.filter(r=>JSON.parse(r.body).visualHash).length,sourceIndexed:!!base.visualHash});
}
async function featureCandidates(env,owner,url){const cursor=url.searchParams.get('cursor')||'';if(cursor.length>100)throw new HttpError(400,'游标无效');const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND json_extract(body,'$.visualHash') IS NULL AND id>? ORDER BY id LIMIT 25",owner,cursor).all()).results;return json({roles:rows.map(briefRole),nextCursor:rows.length===25?rows.at(-1).id:null})}
async function copyToCollection(request,env,owner){
 const b=await request.json();if(!Number.isInteger(b.mainRevision)||!Number.isInteger(b.revision))throw new HttpError(400,'缺少素材版本');const mainRow=await ownedAsset(env,owner,b.mainIdentity,b.mainRevision),source=await ownedAsset(env,owner,b.identity,b.revision),main=JSON.parse(mainRow.body),role=JSON.parse(source.body);
 if(main.relatedAssetIdentity||main.uploadDraft||role.uploadDraft||mainRow.id===source.id||role.relatedAssetIdentity===mainRow.id)throw new HttpError(400,'请选择其他已保存的素材');
 const id=crypto.randomUUID(),originalKey='originals/'+id,previewKey='previews/'+id;const objects=await Promise.all([bucket(env).get(source.original_key),bucket(env).get(source.preview_key)]);if(objects.some(o=>!o))throw new HttpError(409,'源图片缺失，无法加入集合');
 const copied={...role,relatedAssetIdentity:mainRow.id,name:main.name,projectName:main.projectName,projectId:main.projectId,projectNames:main.projectNames,projectIds:main.projectIds,namingMode:'custom',groupingMode:'manual'};delete copied.uploadBatch;delete copied.deletedWithMain;
 try{await bucket(env).put(originalKey,await objects[0].arrayBuffer(),{httpMetadata:{contentType:source.mime}});await bucket(env).put(previewKey,await objects[1].arrayBuffer(),{httpMetadata:{contentType:'image/jpeg'}});const row=await query(env,"INSERT INTO atlas_assets (id,body,original_key,preview_key,mime,filename,size,revision,created_at,owner_id,display_number) SELECT ?,?,?,?,?,?,?,1,?,?,NULL WHERE EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL) AND EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL) RETURNING *",id,JSON.stringify(copied),originalKey,previewKey,source.mime,source.filename,source.size,new Date().toISOString(),owner,mainRow.id,owner,mainRow.revision,source.id,owner,source.revision).first();if(!row)throw new HttpError(409,'素材已变化，请刷新重试');return json({role:bodyRole(row)},201)}catch(e){await Promise.allSettled([bucket(env).delete(originalKey),bucket(env).delete(previewKey)]);throw e}
}
