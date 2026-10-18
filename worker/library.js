async function promoteCollectionMain(request,env,owner){
 const b=await request.json();if(typeof b.mainIdentity!=="string"||typeof b.identity!=="string"||!Number.isInteger(b.mainRevision)||!Number.isInteger(b.revision)||typeof b.deletePrevious!=="boolean")throw new HttpError(400,"主素材切换参数无效");
 const main=await query(env,"SELECT * FROM atlas_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL",b.mainIdentity,owner).first(),next=await query(env,"SELECT * FROM atlas_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL",b.identity,owner).first();
 if(!main||!next)throw new HttpError(404,"素材不存在");const previous=JSON.parse(main.body),chosen=JSON.parse(next.body);
 if(main.revision!==b.mainRevision||next.revision!==b.revision)throw new HttpError(409,"素材已变化，请刷新后重试");
 if(previous.relatedAssetIdentity||previous.uploadDraft||!main.display_number||chosen.relatedAssetIdentity!==main.id||chosen.uploadDraft||chosen.cancelPending)throw new HttpError(400,"请选择此集合中已保存的图片作为主素材");
 const newBody={...chosen,name:previous.name,projectName:previous.projectName,projectId:previous.projectId,projectNames:previous.projectNames,projectIds:previous.projectIds};delete newBody.relatedAssetIdentity;delete newBody.deletedWithMain;
 const oldBody={...previous,relatedAssetIdentity:next.id};delete oldBody.deletedWithMain;
 const guard="SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL AND display_number=? AND COALESCE(json_extract(body,'$.relatedAssetIdentity'),'')='') AND EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL AND json_extract(body,'$.relatedAssetIdentity')=? AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0) THEN 1 ELSE json('invalid') END";
 try{await getDb(env).batch([
  query(env,guard,main.id,owner,main.revision,main.display_number,next.id,owner,next.revision,main.id),
  query(env,"UPDATE atlas_assets SET body=?,display_number=NULL,deleted_at=?,revision=revision+1 WHERE id=? AND owner_id=?",JSON.stringify(oldBody),b.deletePrevious?new Date().toISOString():null,main.id,owner),
  query(env,"UPDATE atlas_assets SET body=json_set(body,'$.relatedAssetIdentity',?),revision=revision+1 WHERE owner_id=? AND json_extract(body,'$.relatedAssetIdentity')=? AND id<>?",next.id,owner,main.id,next.id),
  query(env,"UPDATE atlas_assets SET body=?,display_number=?,revision=revision+1 WHERE id=? AND owner_id=?",JSON.stringify(newBody),main.display_number,next.id,owner)
 ])}catch{throw new HttpError(409,"集合已变化，请刷新后重试")}
 return assetDetail(env,owner,next.id);
}
// Omit model evidence and prompts before sending rows from the database to the Worker.
const briefAssetColumns="id,owner_id,display_number,deleted_at,original_key,preview_key,mime,filename,size,revision,created_at,json_remove(body,'$.analysisResult','$.generationPrompt') AS body";
function briefRole(row){const role=bodyRole(row);delete role.analysisResult;delete role.generationPrompt;return role}
async function pagedLibrary(env,owner,url){
 const size=Number(url.searchParams.get("size")||100),requested=Number(url.searchParams.get("page")||1),view=url.searchParams.get("view")||"all";
 if(!Number.isInteger(size)||size<1||size>100||!Number.isInteger(requested)||requested<1)throw new HttpError(400,"页码或每页数量无效");
 const extras=url.searchParams.get("extras")!=="0";
 const where=["owner_id=?","deleted_at IS NULL","COALESCE(json_extract(body,'$.uploadDraft'),0)=0","COALESCE(json_extract(body,'$.relatedAssetIdentity'),'')=''"],args=[owner];
 const search=(url.searchParams.get("q")||"").slice(0,200),projectName=url.searchParams.get("project");
 if(search){where.push("(lower(json_extract(body,'$.name')||' '||filename||' '||COALESCE(json_extract(body,'$.description'),'')||' '||COALESCE(json_extract(body,'$.generationPrompt'),'')||' '||COALESCE(json_extract(body,'$.projectNames'),'')||' '||COALESCE(json_extract(body,'$.tags'),'')||' '||printf('CHAR-%05d',display_number)) LIKE ? ESCAPE '\\')");args.push("%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%")}
 if(projectName){where.push("(json_extract(body,'$.projectName')=? OR EXISTS(SELECT 1 FROM json_each(body,'$.projectNames') WHERE value=?))");args.push(projectName,projectName)}
 let filters;try{filters=JSON.parse(url.searchParams.get("filters")||"{}")}catch{throw new HttpError(400,"筛选条件无效")}
 if(!filters||Array.isArray(filters)||typeof filters!=="object"||Object.keys(filters).length>24)throw new HttpError(400,"筛选条件无效");
 for(const [dim,value] of Object.entries(filters)){if(!value)continue;if(!dimensions().includes(dim)||typeof value!=="string"||value.length>40)throw new HttpError(400,"筛选条件无效");where.push("EXISTS(SELECT 1 FROM json_each(body,'$.tags') WHERE json_extract(value,'$.dimension')=? AND json_extract(value,'$.name')=?)");args.push(dim,value)}
 const clause=where.join(" AND "),total=(await query(env,"SELECT COUNT(*) n FROM atlas_assets WHERE "+clause,...args).first()).n,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(requested,pages),sort={id:"display_number,id",name:"json_extract(body,'$.name') COLLATE NOCASE,id",new:"created_at DESC,id",recent:"created_at DESC,id"}[url.searchParams.get("sort")||"id"];
 if(!sort)throw new HttpError(400,"排序方式无效");
 const rows=view==="library"||view==="all"?(await query(env,"SELECT "+(view==="all"?"*":briefAssetColumns)+" FROM atlas_assets WHERE "+clause+" ORDER BY "+sort+" LIMIT ? OFFSET ?",...args,size,(page-1)*size).all()).results:[];
 const drafts=extras?(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND (deleted_at IS NULL OR json_extract(body,'$.cancelPending')=1) AND json_extract(body,'$.uploadDraft')=1 ORDER BY created_at DESC",owner).all()).results:[];
 const recycle=view==="recycle"||view==="all"?(await query(env,"SELECT "+briefAssetColumns+" FROM atlas_assets WHERE owner_id=? AND deleted_at IS NOT NULL AND COALESCE(json_extract(body,'$.cancelPending'),0)=0 ORDER BY created_at DESC",owner).all()).results:[];
 const collections=view==="all"?(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.uploadDraft'),0)=0 AND COALESCE(json_extract(body,'$.relatedAssetIdentity'),'')<>'' LIMIT 100",owner).all()).results:[];
 let supplemental={};if(extras){const ps=(await query(env,"SELECT p.*,(SELECT COUNT(*) FROM atlas_assets a WHERE a.owner_id=p.owner_id AND a.deleted_at IS NULL AND COALESCE(json_extract(a.body,'$.uploadDraft'),0)=0 AND COALESCE(json_extract(a.body,'$.relatedAssetIdentity'),'')='' AND (json_extract(a.body,'$.projectName')=p.name OR EXISTS(SELECT 1 FROM json_each(a.body,'$.projectNames') WHERE value=p.name))) assetCount FROM atlas_projects p WHERE p.owner_id=? ORDER BY p.created_at",owner).all()).results,cfg=await modelConfig(env,owner),pending=await query(env,"SELECT EXISTS(SELECT 1 FROM atlas_assets WHERE owner_id IS NULL) n").first();
 supplemental={drafts:drafts.map(bodyRole),labels:await registry(env,owner),projects:ps.map(p=>({...p,isSystem:SYSTEM_COLLECTIONS.includes(p.name)})),analysisEnabled:!!env.AI_CONFIG_KEY&&!!cfg,modelConfig:publicConfig(cfg),migrationPending:!!pending.n};}
 return json({roles:rows.map(view==="all"?bodyRole:briefRole),collections:collections.map(bodyRole),recycle:recycle.map(briefRole),pagination:{page,size,total,pages},...supplemental});
}
async function assetDetail(env,owner,identity){
 const row=await query(env,"SELECT * FROM atlas_assets WHERE id=? AND owner_id=? AND COALESCE(json_extract(body,'$.cancelPending'),0)=0",identity,owner).first();if(!row)throw new HttpError(404,"素材不存在");
 const role=bodyRole(row),anchor=role.relatedAssetIdentity||role.identity;
 const relatives=(await query(env,"SELECT "+briefAssetColumns+" FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND COALESCE(json_extract(body,'$.cancelPending'),0)=0 AND (id=? OR json_extract(body,'$.relatedAssetIdentity')=?) ORDER BY created_at,id",owner,anchor,anchor).all()).results.map(bodyRole),main=relatives.find(r=>r.identity===anchor);
 if(role.relatedAssetIdentity&&main)Object.assign(role,{name:main.name,projectNames:main.projectNames,projectIds:main.projectIds,projectName:main.projectName,projectId:main.projectId});
 return json({role,relatives});
}
async function uploadState(request,env,owner){const b=await request.json();if(!Array.isArray(b.identities)||b.identities.length>1000||b.identities.some(id=>typeof id!=="string"))throw new HttpError(400,"素材标识无效");const rows=[];for(let i=0;i<b.identities.length;i+=80){const ids=b.identities.slice(i,i+80);rows.push(...(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND (deleted_at IS NULL OR json_extract(body,'$.cancelPending')=1) AND id IN ("+ids.map(()=>"?").join(",")+")",owner,...ids).all()).results)}return json({taskAssets:rows.map(bodyRole)})}
async function manageProject(request,env,owner){
 const b=await request.json();if(typeof b.identity!=="string"||!["rename","merge","delete"].includes(b.action))throw new HttpError(400,"灵感集操作无效");
 const source=await query(env,"SELECT * FROM atlas_projects WHERE id=? AND owner_id=?",b.identity,owner).first();if(!source)throw new HttpError(404,"灵感集不存在");if(SYSTEM_COLLECTIONS.includes(source.name))throw new HttpError(400,"系统灵感集长期保留，不能改名、合并或删除");
 const rows=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND (json_extract(body,'$.projectName')=? OR EXISTS(SELECT 1 FROM json_each(body,'$.projectNames') WHERE value=?))",owner,source.name,source.name).all()).results;
 if(b.action==="delete"){if(rows.length)throw new HttpError(409,"灵感集仍有关联素材或草稿，请先移出或合并");await query(env,"DELETE FROM atlas_projects WHERE id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM atlas_assets WHERE owner_id=? AND (json_extract(body,'$.projectName')=? OR EXISTS(SELECT 1 FROM json_each(body,'$.projectNames') WHERE value=?)))",source.id,owner,owner,source.name,source.name).run();return json({ok:true})}
 let target;
 if(b.action==="merge"){target=await query(env,"SELECT * FROM atlas_projects WHERE id=? AND owner_id=?",b.target,owner).first();if(!target||target.id===source.id)throw new HttpError(400,"请选择另一个灵感集")}
 else{const name=clean(b.name);if(normalize(name)===normalize(source.name)&&name===source.name)return json({ok:true});if(await query(env,"SELECT id FROM atlas_projects WHERE owner_id=? AND name_key=? AND id<>?",owner,owner+"|"+normalize(name),source.id).first())throw new HttpError(409,"名称已存在，请使用合并");target={...source,name,name_key:owner+"|"+normalize(name)}}
 const projects=(await query(env,"SELECT * FROM atlas_projects WHERE owner_id=?",owner).all()).results.filter(p=>p.id!==source.id).concat(target),statements=[query(env,"SELECT CASE WHEN (SELECT COUNT(*) FROM atlas_assets WHERE owner_id=? AND (json_extract(body,'$.projectName')=? OR EXISTS(SELECT 1 FROM json_each(body,'$.projectNames') WHERE value=?)))=? AND EXISTS(SELECT 1 FROM atlas_projects WHERE id=? AND owner_id=? AND name=?) THEN 1 ELSE json('invalid') END",owner,source.name,source.name,rows.length,source.id,owner,source.name)];
 for(const row of rows)statements.push(query(env,"SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_assets WHERE id=? AND owner_id=? AND revision=?) THEN 1 ELSE json('invalid') END",row.id,owner,row.revision));
 if(b.action==="merge")statements.push(query(env,"SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_projects WHERE id=? AND owner_id=? AND name=?) THEN 1 ELSE json('invalid') END",target.id,owner,target.name));
 for(const row of rows){const role=JSON.parse(row.body),names=[...new Set((role.projectNames||[role.projectName]).map(n=>n===source.name?target.name:n))],ids=names.map(n=>projects.find(p=>p.name===n)?.id||"");statements.push(query(env,"UPDATE atlas_assets SET body=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?",JSON.stringify({...role,projectNames:names,projectIds:ids,projectName:names[0],projectId:ids[0]}),row.id,owner,row.revision))}
 if(b.action==="rename")statements.push(query(env,"UPDATE atlas_projects SET name=?,name_key=? WHERE id=? AND owner_id=?",target.name,target.name_key,source.id,owner));else statements.push(query(env,"DELETE FROM atlas_projects WHERE id=? AND owner_id=?",source.id,owner));
 // Abort the transaction if any asset changed, so project names and memberships stay together.
 try{await getDb(env).batch(statements)}catch{throw new HttpError(409,"素材或灵感集已变化，请刷新重试")}
 return json({ok:true});
}
async function contentDuplicates(env,owner,bytes,mime){
 const contentHash=encode64(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
 const legacy=(await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND size=? AND mime=? AND json_extract(body,'$.contentHash') IS NULL",owner,bytes.byteLength,mime).all()).results;
 for(const row of legacy){const object=await bucket(env).get(row.original_key);if(!object)continue;const value=encode64(new Uint8Array(await crypto.subtle.digest("SHA-256",await object.arrayBuffer())));await query(env,"UPDATE atlas_assets SET body=json_set(body,'$.contentHash',?) WHERE id=? AND owner_id=? AND json_extract(body,'$.contentHash') IS NULL",value,row.id,owner).run()}
 const duplicate=await query(env,"SELECT * FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL AND json_extract(body,'$.contentHash')=? AND COALESCE(json_extract(body,'$.cancelPending'),0)=0 ORDER BY created_at LIMIT 1",owner,contentHash).first();return {contentHash,duplicate:duplicate?bodyRole(duplicate):null};
}
