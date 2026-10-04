let baiduPump=null,baiduStop=false;
function baiduStateText(s){return {pending:'等待备份',done:'备份完成',failed:'备份失败'}[s]||s}
async function renderBaiduStatus(){
 const s=await api('/api/storage/baidu'),target=$('#baiduStatus');if(!target)return s;
 const c=s.connection,connected=c?.status==='connected';
 target.textContent=!s.configured?'等待平台配置：管理员申请并配置百度网盘应用后即可连接。':!c?'尚未连接百度网盘':c.status==='reconnect'?'百度授权失效，请重新连接':c.name+' · 已连接 · 随账号跨设备同步';
 $('#baiduConnect').disabled=!s.configured;$('#baiduDisconnect').disabled=!c;$('#baiduCheck').disabled=!connected;$('#baiduAuto').disabled=!connected;$('#baiduAuto').checked=!!c?.autoBackup;
 for(const id of ['baiduEnqueue','baiduResume','baiduRetry'])$('#'+id).disabled=!connected;
 $('#baiduCounts').textContent='已完成 '+(s.counts.done||0)+' · 等待 '+(s.counts.pending||0)+' · 失败 '+(s.counts.failed||0);
 $('#baiduRecent').innerHTML=s.recent.map(j=>'<div class="baidu-job"><div><strong>'+esc(j.name)+'</strong><p class="form-note">'+esc(baiduStateText(j.status))+(j.status==='pending'&&j.parts?' · 已传 '+j.completedParts+' 个分片':'')+(j.error?' · '+esc(j.error):'')+'</p></div>'+(j.status==='done'?'<a href="/api/storage/baidu/files/'+encodeURIComponent(j.identity)+'/download" download>下载备份</a>':j.status==='failed'?'<button type="button" data-baidu-restart="'+esc(j.identity)+'">重新备份</button>':'')+'</div>').join('')||'<p class="muted">暂无备份记录</p>';
 for(const button of $('#baiduRecent').querySelectorAll('[data-baidu-restart]'))button.onclick=async()=>{button.disabled=true;try{await post('/api/storage/baidu/restart',{identity:button.dataset.baiduRestart});await renderBaiduStatus();globalThis.resumeBaiduBackup()}catch(e){if($('#baiduError'))$('#baiduError').textContent=e.message}};
 return s;
}
globalThis.resumeBaiduBackup=async function(){
 if(baiduPump||!state.user)return;const owner=state.user.id;baiduStop=false;
 baiduPump=(async()=>{try{const s=await api('/api/storage/baidu');if(!s.configured||s.connection?.status!=='connected')return;while(!baiduStop&&state.user?.id===owner){const r=await post('/api/storage/baidu/step',{});if($('#baiduStatus'))await renderBaiduStatus();if(!r.worked||r.failed)break}}catch(e){if($('#baiduError'))$('#baiduError').textContent=e.message}finally{baiduPump=null}})();return baiduPump;
};
async function baiduDialog(){
 modal('云盘连接','<section><h3>百度网盘</h3><p id="baiduStatus" role="status">正在读取连接…</p><p class="note">授权绑定到你的拾光图鉴账号。其他设备登录同一账号即可继续使用，无需安装本机连接程序。服务端自动刷新授权；百度撤销授权后需重新连接。</p><div class="dialog-actions"><a href="/baidu-guide.html" target="_blank" rel="noreferrer">申请与接入教程</a><button type="button" id="baiduConnect" disabled>连接百度网盘</button><button type="button" id="baiduCheck" disabled>检测连接</button><button type="button" id="baiduDisconnect" disabled>断开连接</button></div><label class="check"><input id="baiduAuto" type="checkbox" disabled>新上传素材自动备份到百度网盘</label><p class="form-note">原图备份到你自己的网盘，现有云端原图和缩略图继续保留。备份不调用分析模型，也不影响标签、提示词和灵感集。</p><p id="baiduCounts" role="status"></p><div class="dialog-actions"><button id="baiduEnqueue" disabled>备份现有素材</button><button id="baiduResume" disabled>继续备份</button><button id="baiduRetry" disabled>重试失败</button><button id="baiduPause" type="button">暂停本页备份</button></div><p class="form-note">任务进度保存在云端，换设备可继续。关闭网页后服务器会短暂继续；未完成任务在下次登录或点击继续备份时接着执行。页面展示最近20条记录，不限制备份总数。</p><p id="baiduError" class="error" role="alert"></p><div id="baiduRecent"></div></section>');
 const run=fn=>async()=>{try{$('#baiduError').textContent='';await fn()}catch(e){if($('#baiduError'))$('#baiduError').textContent=e.message}};
 $('#baiduConnect').onclick=run(async()=>{const r=await post('/api/storage/baidu/connect',{});location.assign(r.url)});
 $('#baiduCheck').onclick=run(async()=>{const r=await post('/api/storage/baidu/check',{});await renderBaiduStatus();$('#baiduError').textContent='连接正常 · 已用 '+size(r.quota.used||0)+' / '+size(r.quota.total||0)});
 $('#baiduAuto').onchange=run(async()=>{await api('/api/storage/baidu/preferences',{method:'PUT',body:JSON.stringify({autoBackup:$('#baiduAuto').checked})});await renderBaiduStatus()});
 $('#baiduEnqueue').onclick=run(async()=>{await post('/api/storage/baidu/enqueue',{});await renderBaiduStatus();globalThis.resumeBaiduBackup()});
 $('#baiduResume').onclick=run(async()=>{globalThis.resumeBaiduBackup()});
 $('#baiduRetry').onclick=run(async()=>{await post('/api/storage/baidu/retry',{});await renderBaiduStatus();globalThis.resumeBaiduBackup()});
 $('#baiduPause').onclick=()=>{baiduStop=true;toast('本页将在当前分片完成后暂停；服务器中的任务保留')};
 $('#baiduDisconnect').onclick=()=>{baiduStop=true;modal('断开百度网盘','<p>断开后，所有设备将停止使用此连接，网站中的百度备份记录会清除。百度网盘中已有的备份文件保留；现有素材不受影响。</p><p>如需完全撤销授权，请同时在百度账号的授权管理中解除应用授权。</p><p id="baiduError" class="error"></p><div class="dialog-actions"><button id="cancelBaiduDisconnect">取消</button><button id="confirmBaiduDisconnect" class="danger">确认断开</button></div>');$('#cancelBaiduDisconnect').onclick=baiduDialog;$('#confirmBaiduDisconnect').onclick=run(async()=>{await api('/api/storage/baidu',{method:'DELETE'});await baiduDialog();toast('百度连接已断开')})};
 try{await renderBaiduStatus()}catch(e){$('#baiduError').textContent=e.message}
}
$('#storageButton').onclick=baiduDialog;
const baiduReturn=new URL(location.href).searchParams.get('baidu');
if(baiduReturn){const messages={connected:'百度网盘连接成功，其他设备登录同一账号即可使用',cancelled:'已取消百度授权',expired:'授权请求已过期，请重新连接','login-required':'请先登录原来的拾光图鉴账号再连接','different-account':'请先断开原有百度连接，再绑定其他百度账号',failed:'百度连接失败，请检查应用权限并重新连接'};toast(messages[baiduReturn]||'请查看云盘连接状态');const u=new URL(location.href);u.searchParams.delete('baidu');history.replaceState(null,'',u.pathname+u.search+u.hash)}
