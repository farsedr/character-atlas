const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('atlasDesktop',Object.freeze({connection:()=>ipcRenderer.invoke('atlas:connection'),version:()=>ipcRenderer.invoke('atlas:version')}));
