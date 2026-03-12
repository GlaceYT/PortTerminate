const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getPorts: () => ipcRenderer.invoke('get-ports'),
    killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
    on: (channel, callback) => ipcRenderer.on(channel, callback)
});
