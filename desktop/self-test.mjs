import path from 'node:path';import fs from 'node:fs';
export async function desktopSelfTest(window,runtime,dataDirectory){
 const phase=process.env.ATLAS_DESKTOP_TEST_PHASE||'basic';
 const result=await window.webContents.executeJavaScript(`(async()=>{
 const json=async(url,body)=>{const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw Error(url+': '+response.status+' '+data.error);return data};
 const phase=${JSON.stringify(phase)},credentials={email:'desktop-test@example.com',name:'桌面测试',password:'desktop-isolated-test-password'};
 if(phase==='write'){await json('/api/auth/register',credentials);const me=await json('/api/auth/me');if(!me.user)throw Error('登录 Cookie 未生效');const form=new FormData();form.append('file',new File([await (await fetch('/icon-192.png')).arrayBuffer()],'桌面持久素材.png',{type:'image/png'}));form.append('preview',new File([new Uint8Array([255,216,255,224,0,0])],'preview.jpg',{type:'image/jpeg'}));form.append('name','桌面持久素材');form.append('namingMode','custom');const response=await fetch('/api/assets',{method:'POST',body:form});if(response.status!==201)throw Error('上传失败 '+await response.text());}
 if(phase==='read')await json('/api/auth/login',credentials);
 const me=await json('/api/auth/me');let count=0,bytes=0;
 if(phase!=='basic'){const library=await json('/api/library?view=library');count=library.roles.length;if(count!==1)throw Error('重启后素材数量不符');const download=await fetch(library.roles[0].downloadUrl);bytes=(await download.arrayBuffer()).byteLength;if(bytes<100)throw Error('原图未持久保存');const connection=await window.atlasDesktop.connection();const health=await fetch(connection.baseURL+'/health',{headers:{'X-Atlas-Token':connection.token}});if(!health.ok)throw Error('桌面模型服务不可用');}
 return {phase,user:!!me.user,count,bytes,title:document.title,bridge:typeof window.atlasDesktop.connection,node:typeof require};})()`);
 if(result.node!=='undefined'||result.bridge!=='function')throw Error('渲染进程隔离验证失败');
 if(phase==='write'){await runtime.backup(path.join(dataDirectory,'..','backup-test'));if(!fs.existsSync(path.join(dataDirectory,'..','backup-test','atlas.sqlite')))throw Error('备份失败')}
 console.log('DESKTOP_SELF_TEST '+JSON.stringify(result));
}
