const BAIDU_PART=4*1024*1024;
function baiduSettings(env){
 const origin=env.BAIDU_SITE_ORIGIN,folder=env.BAIDU_APP_FOLDER;
 if(!env.BAIDU_CLIENT_ID||!env.BAIDU_CLIENT_SECRET||!origin||!folder||!env.AI_CONFIG_KEY)return null;
 try{const u=new URL(origin);if(u.protocol!=="https:"||u.origin!==origin||!folder.startsWith("/apps/")||folder.endsWith("/")||folder.split("/").some(p=>p===".."||p===".")||/[\x00-\x1f]/.test(folder))return null;return {origin,folder,callback:origin+"/api/storage/baidu/callback"}}catch{return null}
}
const baiduConnection=(env,owner)=>query(env,"SELECT * FROM atlas_baidu_connections WHERE owner_id=?",owner).first();
const baiduContext=owner=>"baidu-v1:"+owner;
function baiduRedirect(origin,result){return new Response(null,{status:303,headers:{Location:origin+"/?baidu="+result,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}})}
async function baiduJSON(url,options={}){
 let r;try{r=await fetch(url,{...options,redirect:"manual",signal:AbortSignal.timeout(12000)})}catch{throw new HttpError(502,"百度网盘连接超时或网络不可用，请稍后重试")}
 if(!r.ok)throw new HttpError(r.status===429?429:502,"百度网盘暂时不可用（HTTP "+r.status+"）");
 let data;try{data=await r.json()}catch{throw new HttpError(502,"百度网盘返回格式异常")}
 if(data.error||data.errno&&Number(data.errno)!==0){const code=String(data.errno||data.error);const e=new HttpError(502,["110","111","-6","invalid_grant","expired_token","invalid_token"].includes(code)?"百度授权失效，请重新连接":code==="31066"?"百度网盘文件不存在":"百度网盘操作失败（代码 "+code.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,50)+"），请检查权限、容量或稍后重试");e.baiduCode=code;throw e}return data;
}
async function baiduExchange(env,params){return baiduJSON("https://openapi.baidu.com/oauth/2.0/token",{method:"POST",body:new URLSearchParams({...params,client_id:env.BAIDU_CLIENT_ID,client_secret:env.BAIDU_CLIENT_SECRET})})}
function baiduTokens(data,previous={}){if(typeof data.access_token!=="string"||!data.access_token||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=0)throw new HttpError(502,"百度授权凭证无效");const refresh=data.refresh_token||previous.refresh_token;if(typeof refresh!=="string"||!refresh)throw new HttpError(502,"百度未返回持续授权凭证，请检查应用授权权限");return {access_token:data.access_token,refresh_token:refresh}}
const baiduRefreshes=new Map();
async function baiduAccess(env,owner){
 if(!baiduSettings(env))throw new HttpError(503,"等待网站管理员配置百度网盘应用");
 let c=await baiduConnection(env,owner);if(!c||c.status!=="connected")throw new HttpError(409,"请先连接百度网盘");
 let secret=JSON.parse(await unseal(env,c.token_cipher,baiduContext(owner)));
 if(c.expires_at>Date.now()+120000)return {connection:c,access:secret.access_token};
 const k=owner+":"+c.id;
 if(!baiduRefreshes.has(k))baiduRefreshes.set(k,(async()=>{
  try{const data=await baiduExchange(env,{grant_type:"refresh_token",refresh_token:secret.refresh_token}),fresh=baiduTokens(data,secret),cipher=await seal(env,JSON.stringify(fresh),baiduContext(owner));
   await query(env,"UPDATE atlas_baidu_connections SET token_cipher=?,expires_at=?,updated_at=?,status='connected' WHERE owner_id=? AND id=? AND token_cipher=? AND status='connected'",cipher,Date.now()+Number(data.expires_in)*1000,new Date().toISOString(),owner,c.id,c.token_cipher).run();
  }catch(e){if(e.baiduCode==="invalid_grant"||e.baiduCode==="invalid_token")await query(env,"UPDATE atlas_baidu_connections SET status='reconnect' WHERE owner_id=? AND id=? AND token_cipher=?",owner,c.id,c.token_cipher).run();throw e}
 })().finally(()=>baiduRefreshes.delete(k)));
 await baiduRefreshes.get(k);const current=await baiduConnection(env,owner);if(!current||current.id!==c.id||current.status!=="connected")throw new HttpError(409,"连接已变化，请重新连接");secret=JSON.parse(await unseal(env,current.token_cipher,baiduContext(owner)));return {connection:current,access:secret.access_token};
}
async function baiduAPI(env,owner,path,params={},body){
 const {access,connection}=await baiduAccess(env,owner),u=new URL("https://pan.baidu.com/"+(path.startsWith("api/")?path:"rest/2.0/"+path));for(const [k,v]of Object.entries({...params,access_token:access}))u.searchParams.set(k,String(v));
 try{return await baiduJSON(u.href,body?{method:"POST",body:new URLSearchParams(body)}:{})}catch(e){if(["110","111","-6"].includes(e.baiduCode)){await query(env,"UPDATE atlas_baidu_connections SET status='reconnect' WHERE owner_id=? AND id=?",owner,connection.id).run()}throw e}
}
async function baiduCallback(request,env,url){
 const cfg=baiduSettings(env);if(!cfg)throw new HttpError(503,"等待网站管理员配置百度网盘应用");
 if(url.origin!==cfg.origin)throw new HttpError(400,"请在正式网站完成百度授权");
 const user=await sessionUser(request,env);if(!user)return baiduRedirect(cfg.origin,"login-required");
 const state=url.searchParams.get("state")||"";if(!/^[A-Za-z0-9_-]{40,100}$/.test(state))return baiduRedirect(cfg.origin,"failed");
 const pending=await query(env,"DELETE FROM atlas_baidu_oauth WHERE state_hash=? AND owner_id=? AND expires_at>? RETURNING *",await hash(state),user.id,Date.now()).first();if(!pending)return baiduRedirect(cfg.origin,"expired");
 if(url.searchParams.has("error"))return baiduRedirect(cfg.origin,"cancelled");
 const code=url.searchParams.get("code");if(!code||code.length>2048)return baiduRedirect(cfg.origin,"failed");
 try{
  const data=await baiduExchange(env,{grant_type:"authorization_code",code,redirect_uri:cfg.callback}),secret=baiduTokens(data),u=new URL("https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo");u.searchParams.set("access_token",secret.access_token);const info=await baiduJSON(u.href);if(!info.uk)throw new HttpError(502,"百度账户信息无效");
  const old=await baiduConnection(env,user.id);if(old&&old.baidu_uk!==String(info.uk))return baiduRedirect(cfg.origin,"different-account");
  const cipher=await seal(env,JSON.stringify(secret),baiduContext(user.id)),date=new Date().toISOString();
  await query(env,"INSERT INTO atlas_baidu_connections (owner_id,id,baidu_uk,display_name,token_cipher,expires_at,status,auto_backup,updated_at) VALUES (?,?,?,?,?,?,'connected',0,?) ON CONFLICT(owner_id) DO UPDATE SET token_cipher=excluded.token_cipher,expires_at=excluded.expires_at,status='connected',display_name=excluded.display_name,updated_at=excluded.updated_at",user.id,old?.id||crypto.randomUUID(),String(info.uk),String(info.netdisk_name||info.baidu_name||"百度网盘账户").slice(0,100),cipher,Date.now()+Number(data.expires_in)*1000,date).run();return baiduRedirect(cfg.origin,"connected");
 }catch{return baiduRedirect(cfg.origin,"failed")}
}
async function baiduStatus(env,owner){
 const c=await baiduConnection(env,owner),stats=await query(env,"SELECT status,COUNT(*) AS n FROM atlas_baidu_backups WHERE owner_id=? GROUP BY status",owner).all();
 const recent=await query(env,"SELECT b.asset_id,b.status,b.error,b.remote_path,b.next_part,b.block_list,b.updated_at,a.body FROM atlas_baidu_backups b JOIN atlas_assets a ON a.id=b.asset_id AND a.owner_id=b.owner_id WHERE b.owner_id=? ORDER BY b.updated_at DESC LIMIT 20",owner).all();
 return {configured:!!baiduSettings(env),callback:baiduSettings(env)?.callback||null,connection:c?{name:c.display_name,status:c.status,autoBackup:!!c.auto_backup,updatedAt:c.updated_at}:null,counts:Object.fromEntries(stats.results.map(r=>[r.status,r.n])),recent:recent.results.map(r=>({identity:r.asset_id,name:JSON.parse(r.body).name,status:r.status,error:r.error,path:r.remote_path,parts:JSON.parse(r.block_list||"[]").length,completedParts:r.next_part,updatedAt:r.updated_at}))};
}
async function enqueueBaidu(env,owner,identity){
 const c=await baiduConnection(env,owner);if(!c||c.status!=="connected"||!baiduSettings(env))return;
 const cfg=baiduSettings(env),date=new Date().toISOString();
 await query(env,"INSERT OR IGNORE INTO atlas_baidu_backups (asset_id,owner_id,connection_id,remote_path,status,updated_at) SELECT id,owner_id,?,?||'/'||id||CASE mime WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.webp' END,'pending',? FROM atlas_assets WHERE owner_id=? AND deleted_at IS NULL"+(identity?" AND id=?":""),c.id,cfg.folder,date,owner,...(identity?[identity]:[])).run();
}
// One resumable stage per request. A lease prevents two devices uploading the same part.
async function baiduStep(env,owner){
 const auth=await baiduAccess(env,owner),claim=crypto.randomUUID(),time=Date.now();
 const job=await query(env,"UPDATE atlas_baidu_backups SET lease_id=?,lease_until=?,updated_at=? WHERE asset_id=(SELECT b.asset_id FROM atlas_baidu_backups b JOIN atlas_assets a ON a.id=b.asset_id AND a.owner_id=b.owner_id WHERE b.owner_id=? AND b.connection_id=? AND b.status='pending' AND b.lease_until<? AND a.deleted_at IS NULL ORDER BY b.updated_at LIMIT 1) RETURNING *",claim,time+60000,new Date().toISOString(),owner,auth.connection.id,time).first();
 if(!job)return {worked:false};
 const write=async(fields)=>{const keys=Object.keys(fields);return query(env,"UPDATE atlas_baidu_backups SET "+keys.map(k=>k+"=?").join(",")+",lease_until=0,lease_id='',updated_at=? WHERE asset_id=? AND owner_id=? AND lease_id=? AND connection_id IN (SELECT id FROM atlas_baidu_connections WHERE owner_id=?)",...Object.values(fields),new Date().toISOString(),job.asset_id,owner,claim,owner).run()};
 try{
  const row=await query(env,"SELECT * FROM atlas_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL",job.asset_id,owner).first();if(!row)throw new HttpError(409,"素材已移入回收站");
  if(!job.upload_id){
   const object=await bucket(env).get(row.original_key);if(!object)throw new HttpError(404,"原图不存在");const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==row.size)throw new HttpError(409,"原图大小不一致");const blocks=[];for(let i=0;i<bytes.length;i+=BAIDU_PART)blocks.push(baiduMD5(bytes.subarray(i,i+BAIDU_PART)));
   const pre=await baiduAPI(env,owner,"xpan/file",{method:"precreate"},{path:job.remote_path,size:String(row.size),isdir:"0",autoinit:"1",rtype:"2",block_list:JSON.stringify(blocks)});
   if(pre.return_type===2){await write({upload_id:"rapid",block_list:JSON.stringify(blocks),next_part:blocks.length})}
   else{if(typeof pre.uploadid!=="string"||!pre.uploadid)throw new HttpError(502,"百度未返回上传任务");const needed=Array.isArray(pre.block_list)?pre.block_list:blocks.map((_,i)=>i);if(needed.some(i=>!Number.isInteger(i)||i<0||i>=blocks.length))throw new HttpError(502,"百度返回分片列表无效");await write({upload_id:pre.uploadid,block_list:JSON.stringify(blocks),needed_parts:JSON.stringify(needed),next_part:0})}
  }else if(job.next_part<JSON.parse(job.needed_parts||"[]").length&&job.upload_id!=="rapid"){
   const blocks=JSON.parse(job.block_list),needed=JSON.parse(job.needed_parts),part=needed[job.next_part],object=await bucket(env).get(row.original_key,{range:{offset:part*BAIDU_PART,length:Math.min(BAIDU_PART,row.size-part*BAIDU_PART)}});if(!object)throw new HttpError(404,"原图不存在");const bytes=new Uint8Array(await object.arrayBuffer());if(baiduMD5(bytes)!==blocks[part])throw new HttpError(409,"原图分片校验失败");
   const u=new URL("https://d.pcs.baidu.com/rest/2.0/pcs/superfile2");for(const[k,v]of Object.entries({method:"upload",type:"tmpfile",access_token:auth.access,path:job.remote_path,uploadid:job.upload_id,partseq:part}))u.searchParams.set(k,String(v));const form=new FormData();form.append("file",new Blob([bytes]),"part");const result=await baiduJSON(u.href,{method:"POST",body:form});if(result.md5!==blocks[part])throw new HttpError(502,"百度分片校验失败");await write({next_part:job.next_part+1});
  }else{
   let file;if(job.upload_id==="rapid"){const listing=await baiduAPI(env,owner,"xpan/file",{method:"search",dir:baiduSettings(env).folder,key:row.id,recursion:0,page:1,num:10});file=listing.list?.find(f=>f.path===job.remote_path)}else file=await baiduAPI(env,owner,"xpan/file",{method:"create"},{path:job.remote_path,size:String(row.size),isdir:"0",rtype:"2",uploadid:job.upload_id,block_list:job.block_list});
   if(!Number.isSafeInteger(Number(file?.fs_id))||Number(file.fs_id)<=0||Number(file.size)!==row.size||file.path!==job.remote_path)throw new HttpError(502,"百度原图校验失败，暂不标记备份完成");
   const meta=await baiduAPI(env,owner,"xpan/multimedia",{method:"filemetas",fsids:JSON.stringify([Number(file.fs_id)])}),verified=meta.list?.find(f=>Number(f.fs_id)===Number(file.fs_id));if(!verified||Number(verified.size)!==row.size||verified.path!==job.remote_path)throw new HttpError(502,"百度文件信息校验失败");
   await write({status:"done",fs_id:String(file.fs_id),error:""});
  }
  return {worked:true};
 }catch(e){await write({status:"failed",error:e instanceof HttpError?e.message:"备份失败，请重试"});return {worked:true,failed:true}}
}
async function baiduBackground(env,owner){const deadline=Date.now()+18000;try{while(Date.now()<deadline){const r=await baiduStep(env,owner);if(!r.worked||r.failed)break}}catch{/* State remains durable; next device can resume. */}}
async function baiduBackupDownload(env,owner,identity){
 const row=await query(env,"SELECT a.*,b.fs_id,b.remote_path,b.connection_id FROM atlas_assets a JOIN atlas_baidu_backups b ON b.asset_id=a.id AND b.owner_id=a.owner_id WHERE a.id=? AND a.owner_id=? AND b.status='done'",identity,owner).first();if(!row)throw new HttpError(404,"此素材尚未完成百度备份");
 const {connection,access}=await baiduAccess(env,owner);if(connection.id!==row.connection_id)throw new HttpError(409,"备份所属连接已变化");
 const meta=await baiduAPI(env,owner,"xpan/multimedia",{method:"filemetas",fsids:JSON.stringify([Number(row.fs_id)]),dlink:1}),file=meta.list?.find(f=>String(f.fs_id)===row.fs_id);if(!file||Number(file.size)!==row.size||file.path!==row.remote_path)throw new HttpError(502,"百度备份文件已变化或不存在");
 const safe=value=>{let u;try{u=new URL(value)}catch{throw new HttpError(502,"百度下载地址无效")}if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||!/(^|\.)(pcs\.baidu\.com|baidupcs\.com)$/.test(u.hostname))throw new HttpError(502,"百度下载地址不在允许范围");return u};
 let u=safe(file.dlink);u.searchParams.set("access_token",access);let response;
 for(let i=0;i<5;i++){try{response=await fetch(u.href,{headers:{"User-Agent":"pan.baidu.com"},redirect:"manual",signal:AbortSignal.timeout(15000)})}catch{throw new HttpError(502,"百度下载连接失败")}if(response.status>=300&&response.status<400){await response.body?.cancel();u=safe(new URL(response.headers.get("location")||"",u).href);continue}break}
 if(!response?.ok)throw new HttpError(502,"百度原图下载失败，请检查下载权限");return new Response(response.body,{headers:{"Content-Type":row.mime,"Content-Disposition":"attachment; filename=image; filename*=UTF-8''"+encodeURIComponent(downloadName(row)),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
async function baiduRoutes(request,env,url,owner){
 const action=url.pathname.slice("/api/storage/baidu".length);
 if(action===""&&request.method==="GET")return json(await baiduStatus(env,owner));
 if(action==="/connect"&&request.method==="POST"){
  const cfg=baiduSettings(env);if(!cfg)throw new HttpError(503,"等待网站管理员配置百度网盘应用，请查看申请教程");if(url.origin!==cfg.origin)throw new HttpError(400,"请从正式网站连接百度网盘");
  await query(env,"DELETE FROM atlas_baidu_oauth WHERE expires_at<? OR owner_id=?",Date.now(),owner).run();const state=token();await query(env,"INSERT INTO atlas_baidu_oauth (state_hash,owner_id,expires_at) VALUES (?,?,?)",await hash(state),owner,Date.now()+600000).run();const u=new URL("https://openapi.baidu.com/oauth/2.0/authorize");for(const[k,v]of Object.entries({response_type:"code",client_id:env.BAIDU_CLIENT_ID,redirect_uri:cfg.callback,scope:"basic,netdisk",state}))u.searchParams.set(k,v);return json({url:u.href});
 }
 if(action===""&&request.method==="DELETE"){
  await getDb(env).batch([query(env,"DELETE FROM atlas_baidu_oauth WHERE owner_id=?",owner),query(env,"DELETE FROM atlas_baidu_backups WHERE owner_id=?",owner),query(env,"DELETE FROM atlas_baidu_connections WHERE owner_id=?",owner)]);return json({ok:true});
 }
 if(action==="/preferences"&&request.method==="PUT"){
  const b=await request.json();if(typeof b.autoBackup!=="boolean")throw new HttpError(400,"请选择备份设置");await baiduAccess(env,owner);await query(env,"UPDATE atlas_baidu_connections SET auto_backup=? WHERE owner_id=?",b.autoBackup?1:0,owner).run();return json(await baiduStatus(env,owner));
 }
 if(action==="/check"&&request.method==="POST"){
  const info=await baiduAPI(env,owner,"xpan/nas",{method:"uinfo"}),quota=await baiduAPI(env,owner,"api/quota",{checkfree:1,checkexpire:1});return json({name:String(info.netdisk_name||info.baidu_name||"百度网盘账户"),quota:{total:quota.total,used:quota.used}});
 }
 if(action==="/enqueue"&&request.method==="POST"){await baiduAccess(env,owner);await enqueueBaidu(env,owner);return json(await baiduStatus(env,owner))}
 if(action==="/restart"&&request.method==="POST"){
  const b=await request.json();if(typeof b.identity!=="string"||b.identity.length>100)throw new HttpError(400,"素材标识无效");await baiduAccess(env,owner);await query(env,"UPDATE atlas_baidu_backups SET status='pending',error='',upload_id='',block_list='[]',needed_parts='[]',next_part=0,fs_id='',lease_until=0,lease_id='' WHERE owner_id=? AND asset_id=? AND status='failed'",owner,b.identity).run();return json(await baiduStatus(env,owner));
 }
 if(action==="/retry"&&request.method==="POST"){
  await baiduAccess(env,owner);await query(env,"UPDATE atlas_baidu_backups SET status='pending',error='',lease_until=0,lease_id='' WHERE owner_id=? AND status='failed'",owner).run();return json(await baiduStatus(env,owner));
 }
 if(action==="/step"&&request.method==="POST")return json(await baiduStep(env,owner));
 const match=action.match(/^\/files\/([a-zA-Z0-9-]{1,100})\/download$/);if(match&&request.method==="GET")return baiduBackupDownload(env,owner,match[1]);
 throw new HttpError(404,"百度网盘接口不存在");
}
