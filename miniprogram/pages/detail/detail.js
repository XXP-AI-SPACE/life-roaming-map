// pages/detail/detail.js —— 一段记忆的详情
const db = require('../../utils/db.js');

Page({
  data: {
    item: null,
    loading: true,
    failed: false,
  },

  onLoad(options) {
    this.id = options.id || '';
    this.load();
  },

  load() {
    if (!this.id) {
      this.setData({ loading: false, failed: true });
      return;
    }
    db.getMemory(this.id)
      .then((m) => {
        this.setData({
          loading: false,
          item: Object.assign({}, m, {
            place: [m.province, m.city, m.district].filter(Boolean).join(' · '),
          }),
        });
      })
      .catch((err) => {
        this.setData({ loading: false, failed: true });
        wx.showToast({ title: (err && err.message) || '没找到这段记忆', icon: 'none', duration: 2600 });
      });
  },

  preview() {
    const it = this.data.item;
    if (!it || !it.fileID) return;
    wx.previewImage({ urls: [it.fileID], current: it.fileID });
  },

  remove() {
    const it = this.data.item;
    if (!it) return;
    wx.showModal({
      title: '删除这段记忆？',
      content: '照片和文字会一起删掉，无法恢复。',
      confirmText: '删除',
      confirmColor: '#A8623A',
    }).then((res) => {
      if (!res.confirm) return;
      wx.showLoading({ title: '删除中…' });
      db.removeMemory(this.id)
        .then(() => db.removePhoto(it.fileID))
        .then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 });
          setTimeout(() => wx.navigateBack(), 600);
        })
        .catch((err) => {
          wx.hideLoading();
          wx.showModal({ title: '删除失败', content: (err && err.message) || '请稍后重试', showCancel: false });
        });
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
