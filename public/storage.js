let baiduPump=null,baiduStop=false,baiduViewedTask="",baiduWake=null,baiduBackoff=5000;
function scheduleBaiduResume(owner,delay){clearTimeout(baiduWake);baiduWake=setTimeout(()=>{if(!baiduStop&&state.user?.id===owner)return globalThis.resumeBaiduBackup()},delay)}
window.addEventListener('online',()=>{if(!baiduStop&&state.user)globalThis.resumeBaiduBackup()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!baiduStop&&state.user)globalThis.resumeBaiduBackup()});
function baiduStateText(s){return {pending:'等待备份',done:'备份完成',failed:'备份失败'}[s]||s}
async function renderBaiduStatus(){
 const s=await api('/api/storage/baidu'+(baiduViewedTask?'?task='+encodeURIComponent(baiduViewedTask):'')),target=$('#baiduStatus');if(!target)return s;
 const c=s.connection,connected=c?.status==='connected';
 target.textContent=!s.configured?'等待平台配置：管理员申请并配置百度网盘应用后即可连接。':!c?'尚未连接百度网盘':c.status==='reconnect'?'百度授权失效，请重新连接':c.name+' · 已连接 · 随账号跨设备同步';
 $('#baiduConnect').disabled=!s.configured;$('#baiduDisconnect').disabled=!c;$('#baiduCheck').disabled=!connected;$('#baiduAuto').disabled=!connected;$('#baiduAuto').checked=!!c?.autoBackup;
 for(const id of ['baiduEnqueue','baiduResume','baiduRetry'])$('#'+id).disabled=!connected;
 $('#baiduCounts').textContent='已完成 '+(s.taskCounts?.done||0)+' · 等待 '+(s.taskCounts?.pending||0)+' · 失败 '+(s.taskCounts?.failed||0);
 $('#baiduRecent').innerHTML=s.recent.map(j=>'<div class="baidu-job"><div><strong>'+esc(j.name)+'</strong><p class="form-note">'+esc(baiduStateText(j.status))+(j.status==='pending'&&j.parts?' · 已传 '+j.completedParts+' 个分片':'')+(j.error?' · '+esc(j.error):'')+'</p><p class="form-note backup-path">网盘路径：'+esc(j.path||'正在准备')+'</p></div>'+(j.status==='done'?'<a href="/api/storage/baidu/files/'+encodeURIComponent(j.identity)+'/download" download>下载备份</a>':j.status==='failed'?'<button type="button" data-baidu-restart="'+esc(j.identity)+'">重新备份</button>':'')+'</div>').join('')||'<p class="muted">暂无备份记录</p>';
 for(const button of $('#baiduRecent').querySelectorAll('[data-baidu-restart]'))button.onclick=async()=>{button.disabled=true;try{await post('/api/storage/baidu/restart',{identity:button.dataset.baiduRestart});await renderBaiduStatus();globalThis.resumeBaiduBackup()}catch(e){if($('#baiduError'))$('#baiduError').textContent=e.message}};
 return s;
}
globalThis.resumeBaiduBackup=async function(){
 if(baiduPump||!state.user)return;const owner=state.user.id;baiduStop=false;clearTimeout(baiduWake);
 baiduPump=(async()=>{let wake=0;try{
 const s=await api('/api/storage/baidu');if(!s.configured||s.connection?.status!=='connected')return;
 while(!baiduStop&&state.user?.id===owner){
 const r=await post('/api/storage/baidu/step',{});baiduBackoff=5000;
 if(state.user?.id!==owner)break;
 if($('#baiduStatus'))await renderBaiduStatus();
 // A failed item is retained for manual retry; it must not block other pending items.
 if(!r.worked){const latest=await api('/api/storage/baidu');if(latest.connection?.status==='connected'&&latest.counts?.pending)wake=65000;break}
 }
 }catch(e){if(state.user?.id===owner&&$('#baiduError'))$('#baiduError').textContent=e.message;if(!e.status||e.status>=500||e.status===429){wake=baiduBackoff;baiduBackoff=Math.min(60000,baiduBackoff*2)}}finally{baiduPump=null;if(wake&&!baiduStop&&state.user?.id===owner)scheduleBaiduResume(owner,wake)}
 })();return baiduPump;
};
async function baiduDialog(taskId=''){
 baiduViewedTask=typeof taskId==='string'?taskId:'';
 modal('云盘连接','<section><h3>百度网盘</h3><p id="baiduStatus" class="setup-status" role="status">正在读取连接…</p><p class="note">只需用自己的百度账号授权一次，其他设备登录同一个拾光图鉴账号即可继续使用。普通用户无需申请应用，也不用填写 AppKey 或 SecretKey。</p><section class="setup-step"><h3>1. 登录百度账号并授权</h3><p>点击下面的按钮，在百度页面登录你要存放素材的账号，并允许应用访问。授权完成后会自动返回这里。</p><button type="button" id="baiduConnect" class="primary" disabled>连接百度网盘</button></section><section class="setup-step"><h3>2. 检查是否连接成功</h3><p>点击检测，显示“连接正常”和网盘容量即可开始备份。</p><button type="button" id="baiduCheck" disabled>检测连接</button><p id="baiduError" class="error" role="alert"></p></section><section class="setup-step"><h3>3. 选择要备份的素材</h3><label class="check"><input id="baiduAuto" type="checkbox" disabled>以后新上传的素材自动备份</label><p class="form-note">想把已上传的素材也备份？点击下面的按钮即可。网站原图继续保留，备份不调用分析模型。</p><button id="baiduEnqueue" disabled>备份现有素材</button><p id="baiduCounts" role="status"></p><div id="baiduRecent"></div></section><details class="setup-step"><summary>备份没完成、找不到文件怎么办？</summary><p>等待中的任务可以点击继续备份；失败的任务可以点击重试失败。关掉所有网页后，未完成任务保留，下次登录可继续。</p><div class="dialog-actions"><button id="baiduResume" disabled>继续备份</button><button id="baiduRetry" disabled>重试失败</button><button id="baiduPause" type="button">暂停本页备份</button></div><p>备份保存在普通网盘的 apps 应用目录，不在“同步空间”。下面每条记录会显示具体路径；网盘里的文件名是唯一编号，点击“下载备份”下载时会使用素材名。</p></details><details class="setup-step"><summary>更换百度账号或断开连接</summary><p>需要更换账号时先断开，再重新连接。断开后，所有设备停止使用这次连接，百度已有文件和网站原图保留。</p><button type="button" id="baiduDisconnect" disabled>断开连接</button></details><details class="setup-step"><summary>网站管理员：申请与配置教程</summary><p>仅自建网站的管理员需要申请百度应用并配置密钥。普通用户直接完成上面的授权即可。若显示等待平台配置，请联系网站管理员。</p><a href="/baidu-guide.html" target="_blank" rel="noreferrer">打开管理员申请与配置教程</a></details></section>');
 const run=fn=>async()=>{try{$('#baiduError').textContent='';await fn()}catch(e){if($('#baiduError'))$('#baiduError').textContent=e.message}};
 $('#baiduConnect').onclick=run(async()=>{const r=await post('/api/storage/baidu/connect',{});location.assign(r.url)});
 $('#baiduCheck').onclick=run(async()=>{const r=await post('/api/storage/baidu/check',{});await renderBaiduStatus();$('#baiduError').textContent='连接正常 · 已用 '+size(r.quota.used||0)+' / '+size(r.quota.total||0)});
 $('#baiduAuto').onchange=run(async()=>{await api('/api/storage/baidu/preferences',{method:'PUT',body:JSON.stringify({autoBackup:$('#baiduAuto').checked})});await renderBaiduStatus()});
 $('#baiduEnqueue').onclick=run(async()=>{await post('/api/storage/baidu/enqueue',{});baiduViewedTask='';await renderBaiduStatus();globalThis.resumeBaiduBackup()});
 $('#baiduResume').onclick=run(async()=>{globalThis.resumeBaiduBackup()});
 $('#baiduRetry').onclick=run(async()=>{await post('/api/storage/baidu/retry',{});await renderBaiduStatus();globalThis.resumeBaiduBackup()});
 $('#baiduPause').onclick=()=>{baiduStop=true;toast('本页将在当前分片完成后暂停；服务器中的任务保留')};
 $('#baiduDisconnect').onclick=()=>{baiduStop=true;modal('断开百度网盘','<p>断开后，所有设备将停止使用此连接，网站中的百度备份记录会清除。百度网盘中已有的备份文件保留；现有素材不受影响。</p><p>如需完全撤销授权，请同时在百度账号的授权管理中解除应用授权。</p><p id="baiduError" class="error"></p><div class="dialog-actions"><button id="cancelBaiduDisconnect">取消</button><button id="confirmBaiduDisconnect" class="danger">确认断开</button></div>');$('#cancelBaiduDisconnect').onclick=baiduDialog;$('#confirmBaiduDisconnect').onclick=run(async()=>{await api('/api/storage/baidu',{method:'DELETE'});await baiduDialog();toast('百度连接已断开')})};
 try{await renderBaiduStatus()}catch(e){$('#baiduError').textContent=e.message}
}
$('#storageButton').onclick=baiduDialog;
const baiduReturn=new URL(location.href).searchParams.get('baidu');
if(baiduReturn){const messages={connected:'百度网盘连接成功，其他设备登录同一账号即可使用',cancelled:'已取消百度授权',expired:'授权请求已过期，请重新连接','login-required':'请先登录原来的拾光图鉴账号再连接','different-account':'请先断开原有百度连接，再绑定其他百度账号',failed:'百度连接失败，请检查应用权限并重新连接'};toast(messages[baiduReturn]||'请查看云盘连接状态');const u=new URL(location.href);u.searchParams.delete('baidu');history.replaceState(null,'',u.pathname+u.search+u.hash)}
