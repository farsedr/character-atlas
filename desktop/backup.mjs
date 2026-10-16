import fs from 'node:fs/promises';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
export async function validateBackup(directory,decrypt){
 const manifest=JSON.parse(await fs.readFile(path.join(directory,'backup.json'),'utf8'));if(manifest.format!=='atlas-desktop-backup'||manifest.version!==1)throw Error('请选择由拾光图鉴生成的备份目录');
 const key=decrypt(await fs.readFile(path.join(directory,'key.bin')));if(!/^[A-Za-z0-9+/]{43}=$/.test(key))throw Error('备份密钥无效');
 const db=new DatabaseSync(path.join(directory,'atlas.sqlite'),{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('备份数据库已损坏');const rows=db.prepare('SELECT original_key,preview_key FROM atlas_assets').all();const files=await fs.readdir(path.join(directory,'objects'),{withFileTypes:true});if(files.some(f=>!f.isFile()||!/^[a-f0-9]{64}$/.test(f.name)))throw Error('备份图片目录无效');return {key,count:rows.length}}finally{db.close()}
}
