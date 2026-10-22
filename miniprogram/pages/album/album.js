// pages/album/album.js —— 足迹：按月份分组的时间线
const db = require('../../utils/db.js');

Page({
  data: {
    groups: [],
    total: 0,
    loaded: false,
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load();
  },

  load() {
    db.listMemories(100)
      .then((list) => {
        const groups = [];
        let cur = null;
        (list || []).forEach((m) => {
          const key = (m.date || '').slice(0, 7);
          const label = key ? key.replace('-', ' 年 ') + ' 月' : '未标注日期';
          if (!cur || cur.label !== label) {
            cur = { label, items: [] };
            groups.push(cur);
          }
          cur.items.push({
            _id: m._id,
            title: m.title,
            date: m.date,
            fileID: m.fileID,
            note: m.note || '',
            place: [m.city || m.province, m.district].filter(Boolean).join(' · ') || m.province,
          });
        });
        this.setData({ groups, total: (list || []).length, loaded: true });
      })
      .catch((err) => {
        this.setData({ groups: [], total: 0, loaded: true });
        wx.showToast({ title: err.message || '加载失败', icon: 'none', duration: 2800 });
      })
      .then(() => wx.stopPullDownRefresh());
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goMap() {
    wx.switchTab({ url: '/pages/map/map' });
  },
});
