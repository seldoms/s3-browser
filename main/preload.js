/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    s3Request: (data) => ipcRenderer.invoke('s3-request', data),
    onTransferProgress: (callback) => ipcRenderer.on('transfer-progress', (_event, value) => callback(value)),
    selectObsConfig: () => ipcRenderer.invoke('select-obs-config'),
    exportObsConfig: (data) => ipcRenderer.invoke('export-obs-config', data),
});
