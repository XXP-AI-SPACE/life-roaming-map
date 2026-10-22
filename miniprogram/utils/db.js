// utils/db.js —— 记忆数据的读写封装（云开发数据库 + 云存储）
const app = getApp();

function cfg() {
  const g = (app && app.globalData) || {};
  return {
    collection: g.collection || 'memories',
    photoDir: g.photoDir || 'memories',
  };
}

function coll() {
  return wx.cloud.database().collection(cfg().collection);
}

// 把云开发/网络错误翻译成用户能看懂的话
function friendly(err) {
  const code = err && (err.errCode || (err.result && err.result.errCode));
  if (code === -502005) {
    return new Error('数据表还没有创建：请在云开发控制台新建集合 ' + cfg().collection + '，权限选「仅创建者可读写」');
  }
  if (code === -502003 || code === -501001) {
    return new Error('云数据库权限不足或环境异常，请检查环境 ID 与集合权限');
  }
  if (err && /timeout|network|fail/i.test(err.errMsg || '')) {
    return new Error('网络不太顺畅，请稍后重试');
  }
  return err instanceof Error ? err : new Error((err && err.errMsg) || '出了点问题，请重试');
}

// 列表：按日期倒序（最多 100 条，MVP 够用）
function listMemories(limit) {
  return coll()
    .orderBy('date', 'desc')
    .orderBy('createdAt', 'desc')
    .limit(limit || 100)
    .get()
    .then((res) => res.data)
    .catch((err) => { throw friendly(err); });
}

function getMemory(id) {
  return coll().doc(id).get()
    .then((res) => res.data)
    .catch((err) => { throw friendly(err); });
}

function addMemory(data) {
  return coll().add({ data })
    .then((res) => res._id)
    .catch((err) => { throw friendly(err); });
}

function removeMemory(id) {
  return coll().doc(id).remove()
    .catch((err) => { throw friendly(err); });
}

// 上传一张照片，返回 fileID
function uploadPhoto(filePath) {
  const ext = (/\.(\w+)$/.exec(filePath) || [null, 'jpg'])[1];
  const cloudPath = cfg().photoDir + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  return wx.cloud.uploadFile({ cloudPath, filePath })
    .then((res) => res.fileID)
    .catch(() => { throw new Error('照片上传失败，请检查网络后重试'); });
}

function removePhoto(fileID) {
  if (!fileID) return Promise.resolve();
  return wx.cloud.deleteFile({ fileList: [fileID] }).catch(() => {});
}

module.exports = {
  listMemories, getMemory, addMemory, removeMemory, uploadPhoto, removePhoto,
};
