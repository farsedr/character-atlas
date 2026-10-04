
const LEGACY_OWNER="d1bb8e6c-e86f-403b-8267-53bd994c2aba";
const enc=new TextEncoder(), now=()=>Date.now();
const token=()=>encode64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const hash=async s=>encode64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))));
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function password(p){if(typeof p!=="string"||p.length<12||p.length>128)throw new HttpError(400,"密码须为12至128个字符");return p}
function emailAddress(e){if(typeof e!=="string"||e.length>200||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new HttpError(400,"请输入有效邮箱");return e.trim().toLowerCase()}
async function passwordHash(env,p,salt){
 if(!env.AI_CONFIG_KEY)throw new HttpError(503,"账号安全服务尚未配置");
 const pepper=await crypto.subtle.importKey("raw",decode64(env.AI_CONFIG_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const secret=await crypto.subtle.sign("HMAC",pepper,enc.encode("atlas-password-v1:"+p));
 const key=await crypto.subtle.importKey("raw",secret,"PBKDF2",false,["deriveBits"]);
 return encode64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},key,256)));
}
const publicUser=u=>({id:u.id,email:u.email,name:u.name,});
const cookieValue=r=>r.headers.get("cookie")?.match(/(?:^|;\s*)__Host-atlas=([A-Za-z0-9_-]+)/)?.[1];
async function sessionUser(request,env){
 const t=cookieValue(request);if(!t)return null;
 return query(env,"SELECT u.*,s.hash AS session_hash FROM atlas_sessions s JOIN atlas_users u ON s.user_id=u.id WHERE s.hash=? AND s.expires_at>? AND u.disabled=0",await hash(t),now()).first();
}
async function sessionResponse(request,env,u,extra={}){
 const t=token(),h=await hash(t),date=new Date().toISOString();
 await query(env,"INSERT INTO atlas_sessions (hash,user_id,created_at,expires_at,agent) VALUES (?,?,?,?,?)",h,u.id,date,now()+14*86400000,(request.headers.get("user-agent")||"浏览器").slice(0,300)).run();
 const res=json({user:publicUser(u),...extra});res.headers.set("Set-Cookie","__Host-atlas="+t+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1209600");return res;
}
async function throttle(request,env,email){
 for(const part of ["ip:"+(request.headers.get("cf-connecting-ip")||"unknown"),"account:"+email]){
  const k="auth:"+await hash(part);
  const r=await query(env,"INSERT INTO atlas_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count",k,now()+15*60000,now(),now()).first();
  if(r.count>20)throw new HttpError(429,"尝试次数过多，请15分钟后再试");
 }
}
async function authApi(request,env,url){
 const u=await sessionUser(request,env),path=url.pathname,m=request.method;
 if(path==="/api/auth/me"&&m==="GET"){
  const legacy=await query(env,"SELECT id FROM atlas_users WHERE id=?",LEGACY_OWNER).first();
  return json({user:u?publicUser(u):null,ownerSetup:!legacy&&request.headers.get("oai-authenticated-user-id")===LEGACY_OWNER});
 }
 if(["/api/auth/login","/api/auth/register","/api/auth/recover"].includes(path)&&m==="POST"){
  const b=await request.json(),email=emailAddress(b.email);await throttle(request,env,email);
  if(path.endsWith("/login")){
   const row=await query(env,"SELECT * FROM atlas_users WHERE email=?",email).first();
   const v=await passwordHash(env,typeof b.password==="string"?b.password:"",row?.salt||"invalid-account-dummy");
   if(!row||row.disabled||!equal(v,row.password_hash))throw new HttpError(401,"邮箱或密码不正确");
   return sessionResponse(request,env,row);
  }
  if(path.endsWith("/recover")){
   const row=await query(env,"SELECT * FROM atlas_users WHERE email=?",email).first();
   if(!row||row.disabled||!equal(await hash(String(b.recoveryCode||"")),row.recovery_hash))throw new HttpError(401,"恢复信息不正确");
   const salt=token(),recovery=token();
   const changed=await query(env,"UPDATE atlas_users SET password_hash=?,salt=?,recovery_hash=? WHERE id=? AND recovery_hash=? RETURNING id",await passwordHash(env,password(b.password),salt),salt,await hash(recovery),row.id,row.recovery_hash).first();if(!changed)throw new HttpError(401,"恢复代码已失效");await query(env,"DELETE FROM atlas_sessions WHERE user_id=?",row.id).run();
   return sessionResponse(request,env,row,{recoveryCode:recovery});
  }
  const legacy=await query(env,"SELECT id FROM atlas_users WHERE id=?",LEGACY_OWNER).first();
  const setup=!legacy&&request.headers.get("oai-authenticated-user-id")===LEGACY_OWNER;
  const salt=token(),recovery=token(),id=setup?LEGACY_OWNER:crypto.randomUUID(),name=clean(b.name||email.split("@")[0]);
  try{await query(env,"INSERT INTO atlas_users (id,email,name,password_hash,salt,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)",id,email,name,await passwordHash(env,password(b.password),salt),salt,await hash(recovery),new Date().toISOString()).run()}catch{throw new HttpError(409,"此邮箱已注册")}
  const row=await query(env,"SELECT * FROM atlas_users WHERE id=?",id).first();
  return sessionResponse(request,env,row,{recoveryCode:recovery});
 }
 if(!u)throw new HttpError(401,"请登录拾光图鉴");
 if(path==="/api/auth/logout"&&m==="POST"){
  await query(env,"DELETE FROM atlas_sessions WHERE hash=?",u.session_hash).run();const r=json({ok:true});r.headers.set("Set-Cookie","__Host-atlas=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0");return r;
 }
 if(path==="/api/auth/sessions"&&m==="GET"){
  const rows=await query(env,"SELECT hash,created_at,expires_at,agent FROM atlas_sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC",u.id,now()).all();
  return json({sessions:rows.results.map(r=>({...r,current:r.hash===u.session_hash}))});
 }
 if(path==="/api/auth/sessions"&&m==="DELETE"){
  const b=await request.json();await query(env,"DELETE FROM atlas_sessions WHERE user_id=? AND hash<>? AND (?='all' OR hash=?)",u.id,u.session_hash,b.hash,b.hash).run();return json({ok:true});
 }
 if(path==="/api/auth/password"&&m==="PUT"){
  const b=await request.json();await throttle(request,env,u.email);
  if(!equal(await passwordHash(env,String(b.oldPassword||""),u.salt),u.password_hash))throw new HttpError(401,"当前密码不正确");
  const salt=token();
  const changed=await query(env,"UPDATE atlas_users SET password_hash=?,salt=? WHERE id=? AND password_hash=? RETURNING id",await passwordHash(env,password(b.password),salt),salt,u.id,u.password_hash).first();if(!changed)throw new HttpError(409,"密码已变化，请重新登录");await query(env,"DELETE FROM atlas_sessions WHERE user_id=?",u.id).run();
  return sessionResponse(request,env,u);
 }
 throw new HttpError(404,"账号接口不存在");
}
