// pages/add/add.js —— 新增一段记忆
const db = require('../../utils/db.js');

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  data: {
    photo: '',
    region: [],
    regionText: '',
    preset: '',
    date: '',
    title: '',
    note: '',
    saving: false,
    canSave: false,
  },

  onLoad(options) {
    const preset = options.province ? decodeURIComponent(options.province) : '';
    this.setData({
      date: today(),
      preset,
      regionText: preset,
    });
  },

  refreshSaveState() {
    const d = this.data;
    const hasPlace = d.region.length > 0 || !!d.preset;
    this.setData({ canSave: !!(d.photo && hasPlace && d.title.trim()) });
  },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
    })
      .then((res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        this.setData({ photo: f.tempFilePath });
        this.refreshSaveState();
      })
      .catch(() => {});
  },

  onRegionChange(e) {
    const v = e.detail.value || [];
    this.setData({ region: v, regionText: v.join(' '), preset: '' });
    this.refreshSaveState();
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
    this.refreshSaveState();
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  submit() {
    const d = this.data;
    if (d.saving) return;
    if (!d.photo) return wx.showToast({ title: '先放一张照片吧', icon: 'none' });
    if (!d.region.length && !d.preset) return wx.showToast({ title: '选一下地点', icon: 'none' });
    if (!d.title.trim()) return wx.showToast({ title: '写一句标题', icon: 'none' });

    this.setData({ saving: true });
    const region = d.region.length ? d.region : [d.preset, '', ''];

    db.uploadPhoto(d.photo)
      .then((fileID) =>
        db.addMemory({
          title: d.title.trim(),
          province: region[0] || '',
          city: region[1] || '',
          district: region[2] || '',
          date: d.date,
          note: d.note.trim(),
          fileID,
          createdAt: Date.now(),
        })
      )
      .then(() => {
        wx.showToast({ title: '已记下', icon: 'success', duration: 900 });
        setTimeout(() => wx.navigateBack(), 700);
      })
      .catch((err) => {
        this.setData({ saving: false });
        wx.showModal({
          title: '没能保存',
          content: (err && err.message) || '请稍后重试',
          showCancel: false,
        });
      });
  },
});
