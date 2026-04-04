const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('engagexDesktop', {
  isDesktop: true,
  platform: process.platform,
});
