// app.js
const config = require('./config');

App({
  globalData: {
    envId: config.envId,
    collection: config.collection,
    photoDir: config.photoDir,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: config.envId,
      traceUser: true,
    });
  },
});
