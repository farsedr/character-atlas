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
