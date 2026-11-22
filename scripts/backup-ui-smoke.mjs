import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<button id="storageButton"></button>',{url:'https://local.test',runScripts:'outside-only'}),w=dom.window;
let steps=[],statusCalls=0,stepCalls=0,pending=0,scheduled=[];
w.setTimeout=(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length};
w.clearTimeout=id=>{if(id)scheduled[id-1]=null};
w.api=async()=>{statusCalls++;return {configured:true,connection:{status:'connected'},counts:{pending}}};
w.post=async()=>{stepCalls++;const next=steps.shift();if(next instanceof Error)throw next;return next||{worked:false}};
w.eval(`const state={user:{id:'owner'}},$=s=>document.querySelector(s);`+fs.readFileSync('public/storage.js','utf8')+`;window.backupChecks={pause(){baiduStop=true},owner(id){state.user=id?{id}:null}};`);
try{
 steps=[{worked:true,failed:true},{worked:true},{worked:false}];await w.resumeBaiduBackup();assert.equal(stepCalls,3);assert(!scheduled.some(Boolean));
 pending=1;steps=[{worked:false}];await w.resumeBaiduBackup();assert.equal(scheduled.filter(Boolean).at(-1).delay,65000);
 const resume=scheduled.filter(Boolean).at(-1);pending=0;steps=[{worked:true},{worked:false}];await resume.fn();await w.resumeBaiduBackup();assert(!scheduled.some(Boolean));
 steps=[new Error('temporary disconnect')];await w.resumeBaiduBackup();assert.equal(scheduled.filter(Boolean).at(-1).delay,5000);
 const retry=scheduled.filter(Boolean).at(-1);w.backupChecks.pause();const before=stepCalls;await retry.fn();w.dispatchEvent(new w.Event('online'));assert.equal(stepCalls,before);
 // A timer belonging to a previous account cannot resume under another account.
 w.backupChecks.owner('other');await retry.fn();assert.equal(stepCalls,before);
 w.backupChecks.owner('owner');steps=[{worked:false}];await w.resumeBaiduBackup();assert(statusCalls>0);
 console.log('PASS: failed backup isolation, leased-job wakeup, network backoff, pause and account-bound recovery.');
}finally{dom.window.close()}

const libraryUiSource = fs.readFileSync('public/pro-tools.js', 'utf8');
const dialogStart = libraryUiSource.indexOf('async function clearBackupImport(');
const dialogEnd = libraryUiSource.indexOf('const backupMenuButton=', dialogStart);
assert.ok(dialogStart >= 0 && dialogEnd > dialogStart);
const libraryUi = new JSDOM('<main></main>', {url:'https://local.test', runScripts:'outside-only'});
const ui = libraryUi.window;
try {
 const select = selector => ui.document.querySelector(selector);
 ui.$ = select;
 ui.state = {user:{id:'owner'}};
 ui.modal = (_, content) => {select('main').innerHTML='<button id="closeModal"></button>'+content};
 ui.api = async () => ({pending:[]});
 ui.TextDecoder = TextDecoder;
 let refreshFails = false, refreshes = 0;
 ui.refresh = async () => {refreshes++;if(refreshFails)throw new Error('列表离线')};
 let requests = [], mode = 'lost-response', cancels = 0;
 ui.post = async (route, action) => {
  assert.equal(route, '/api/library/backup');
  requests.push(action);
  if(action.action === 'record')return {};
  if(action.action === 'finish'){
   if(mode === 'lost-response')throw new Error('提交回执丢失');
   return {imported:action.count};
  }
  if(action.action === 'status')return {state:'completed',imported:2};
  if(action.action === 'cancel')return {more:++cancels===1,state:'cancelled'};
  assert.fail('Unexpected backup action '+action.action);
 };
 ui.eval(libraryUiSource.slice(dialogStart,dialogEnd)+'\nwindow.openBackupForTest=libraryBackupDialog;');
 await ui.openBackupForTest();
 const input = select('#importLibraryBackup'), close = select('#closeModal');
 const progress = select('#backupProgress'), error = select('#backupError');
 const header = {format:'atlas-library-backup',version:1};
 const prefix = [header,{data:{identity:'a'}},{data:{identity:'b'}}].map(JSON.stringify).join('\n')+'\n';
 const complete = new Blob([prefix,JSON.stringify({end:true,count:2})]);
 let selected, failRead = false;
 const file = {name:'test.atlas',stream(){
  if(!failRead)return complete.stream();
  let sent = false;
  return new ReadableStream({pull(controller){
   if(sent)controller.error(new Error('读取文件中断'));
   else {sent=true;controller.enqueue(new TextEncoder().encode(prefix))}
  }});
 }};
 // Like a native file input, selecting the same file fires change only after the value was cleared.
 Object.defineProperties(input, {
  files:{get:()=>selected?[selected]:[]},
  value:{get:()=>selected?.name||'',set(value){assert.equal(value,'');selected=undefined}}
 });
 async function chooseFile(){
  assert.ok(!input.disabled && !close.disabled);
  assert.notEqual(selected,file,'the same file must be selectable again');
  selected=file;
  await input.onchange();
  assert.equal(input.value,'');
  assert.ok(!input.disabled && !close.disabled);
 }
 await chooseFile();
 assert.deepEqual(requests.map(item=>item.action),['record','record','finish','status']);
 assert.equal(progress.textContent,'已导入 2 张');
 assert.equal(error.textContent,'');
 assert.equal(refreshes,1);

 mode='direct';failRead=true;requests=[];
 await chooseFile();
 assert.deepEqual(requests.map(item=>item.action),['record','record','cancel','cancel']);
 assert.ok(requests.slice(2).every(item=>item.paged && item.batch===requests[0].batch));
 assert.equal(progress.textContent,'');
 assert.equal(error.textContent,'读取文件中断');
 assert.equal(refreshes,1);
 const failedBatch=requests[0].batch;

 failRead=false;refreshFails=true;requests=[];
 await chooseFile();
 assert.notEqual(requests[0].batch,failedBatch);
 assert.deepEqual(requests.map(item=>item.action),['record','record','finish']);
 assert.equal(refreshes,2);
 assert.equal(progress.textContent,'已导入 2 张');
 assert.match(error.textContent,/素材已保存，列表刷新失败.*列表离线/);
 console.log('PASS: library backup commit receipt recovery, paged cleanup, same-file retry and refresh failure.');
} finally {libraryUi.window.close()}
