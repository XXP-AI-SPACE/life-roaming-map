// pages/map/map.js —— 首页：中国地图点亮
const core = require('../../utils/map-core.js');
const db = require('../../utils/db.js');

Page({
  data: {
    canvasW: 0,
    canvasH: 0,
    litCount: 0,
    total: 0,
    loaded: false,
    sheetOpen: false,
    active: null,
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const w = Math.max(280, win.windowWidth - 40);
    const h = Math.round((w * core.HEIGHT) / core.WIDTH);
    this.setData({ canvasW: w, canvasH: h }, () => this.initCanvas(w, h));
  },

  onShow() {
    this.loadMemories();
  },

  initCanvas(w, h) {
    const q = wx.createSelectorQuery();
    q.select('#chinaMap').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        // 低版本基础库兜底：有限次重试，避免死循环
        this._retry = (this._retry || 0) + 1;
        if (this._retry <= 5) {
          setTimeout(() => this.initCanvas(w, h), 200);
        } else {
          wx.showToast({ title: '地图加载失败，请重启小程序', icon: 'none' });
        }
        return;
      }
      const canvas = res[0].node;
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = info.pixelRatio || 2;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this._ctx = ctx;
      this.draw();
    });
  },

  draw() {
    if (!this._ctx) return;
    core.draw(this._ctx, {
      width: this.data.canvasW,
      height: this.data.canvasH,
      lit: this._lit || {},
      selected: this._selected,
    });
  },

  loadMemories() {
    db.listMemories(100)
      .then((list) => {
        this._all = list || [];
        const lit = {};
        this._all.forEach((m) => {
          const p = core.provinceByShort(core.normProv(m.province));
          if (p) lit[p.adcode] = (lit[p.adcode] || 0) + 1;
        });
        this._lit = lit;
        this.setData({
          total: this._all.length,
          litCount: Object.keys(lit).length,
          loaded: true,
        });
        this.draw();
        if (this.data.sheetOpen && this.data.active) {
          this.openSheet(this.data.active.adcode);
        }
      })
      .catch((err) => {
        this._all = [];
        this._lit = {};
        this.setData({ total: 0, litCount: 0, loaded: true });
        this.draw();
        wx.showToast({ title: err.message || '加载失败', icon: 'none', duration: 2800 });
      })
      .then(() => wx.stopPullDownRefresh());
  },

  onPullDownRefresh() {
    this.loadMemories();
  },

  onMapTap(e) {
    if (!this._ctx) return;
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (!t) return;
    const k = this.data.canvasW / core.WIDTH;
    const p = core.hitTest(t.x / k, t.y / k);
    if (!p) return;
    this._selected = p.adcode;
    this.draw();
    this.openSheet(p.adcode);
  },

  openSheet(adcode) {
    const p = core.PROVINCES.filter((it) => it.adcode === adcode)[0];
    if (!p) return;
    const list = (this._all || [])
      .filter((m) => core.normProv(m.province) === p.short)
      .slice(0, 4)
      .map((m) => ({
        _id: m._id,
        title: m.title,
        date: m.date,
        fileID: m.fileID,
        place: [m.city, m.district].filter(Boolean).join(' · '),
      }));
    this.setData({
      sheetOpen: true,
      active: {
        adcode: p.adcode,
        short: p.short,
        name: p.name,
        count: (this._lit && this._lit[p.adcode]) || 0,
        list,
      },
    });
  },

  closeSheet() {
    this._selected = null;
    this.setData({ sheetOpen: false, active: null });
    this.draw();
  },

  noop() {},

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goAddHere() {
    const a = this.data.active;
    this._selected = null;
    this.setData({ sheetOpen: false, active: null });
    this.draw();
    if (!a) return;
    wx.navigateTo({
      url: '/pages/add/add?province=' + encodeURIComponent(a.name) + '&short=' + encodeURIComponent(a.short),
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goAlbum() {
    wx.switchTab({ url: '/pages/album/album' });
  },

  onShareAppMessage() {
    return {
      title: '我在人生漫游地图上点亮了 ' + this.data.litCount + ' 个省份',
      path: '/pages/map/map',
    };
  },
});
