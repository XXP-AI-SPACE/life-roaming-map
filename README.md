# Life Roaming Map · 人生漫游地图

一个**给自己看**的空间记忆工具。用一张照片和一句话，把去过的地方点亮在地图上。

不是朋友圈，不是旅行社交，不做路线规划，也不打卡签到。**一次记录只需 30 秒**：选个地方、传张照片、写一句话，就够了。

## 先体验，不用装任何东西

打开 `h5/index.html`——这是一个完整的可交互版本，数据存在浏览器 `localStorage` 里，双击即可用。

它和小程序版本共用同一套地图渲染逻辑，可以先在这里确认这是不是你想要的东西。

## 跑起来要几步

小程序版本基于微信原生小程序 + 云开发，不需要服务器。

1. 在[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)里导入本项目根目录
2. 填好 `project.config.json` 里的 `appid`（换成你自己的小程序 AppID）
3. 开通云开发，把 `miniprogram/config.js` 里的 `envId` 换成你的环境 ID
4. 在云开发控制台建一个名为 `memories` 的集合，权限设为**「仅创建者可读写」**
5. 编译运行

数据模型很简单：

```
memories: title / province / city / district / date / note / fileID / createdAt
```

照片进云存储只保存 `fileID`，每条记录自动带上 `_openid`，权限配好之后用户之间天然隔离。

> **关于定位**：本项目刻意不使用 `wx.getLocation`。个人主体小程序获取定位权限门槛高，而「手动选一个地方」这个动作本身就是一次回忆，比自动打点更接近记录的本来目的。

## 地图数据说明（重要）

本项目**不接入任何地图 SDK**，地图是用 Canvas 2D 静态自绘的。这样不需要申请地图 Key，也没有配额和费用。

坐标数据来源：

- **数据源**：[阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)
- **数据文件**：`100000_full.json`（全国省级行政区，含 34 个省级区域与南海诸岛界线）
- **处理方式**：Web Mercator 投影后按 0.1° 简化，产出 `miniprogram/utils/china-map.js`（59KB，35 个区域）
- **工具的**：转换脚本在 `tools/convert_map.py`，可复现

需要说明的是：

1. 边界数据**按数据源原样渲染，未作任何修改或取舍**，包括南海诸岛界线
2. 该数据用于**个人记录场景的可视化示意**，不作为行政区划权属、边界争议的依据
3. 如需用于正式出版物、商业展示或对外发布，请使用自然资源部[标准地图服务](http://bzdt.ch.mnr.gov.cn/)的审核版本
4. DataV.GeoAtlas 的使用请同时遵循其自身的服务条款

如果你要把衍生版本部署到境外服务，请自行判断上述数据的合规性——这是使用者的责任。

## 目录结构

```
h5/index.html                     完整可交互版本，双击即用
miniprogram/
  app.js / app.json / app.wxss    小程序入口
  config.js                       唯一需要改配置的地方
  pages/
    map/                          首页：地图点亮 + 省份弹层
    album/                        Tab2：按月分组的足迹列表
    add/                          新增页（是一个动作，不是 Tab）
    detail/                       详情页
  utils/
    china-map.js                  地图坐标数据
    map-core.js                   渲染与命中测试（纯逻辑，不依赖 wx API）
    db.js                         云数据库读写封装
tools/convert_map.py              从 DataV 原始数据生成 china-map.js
docs/                             设计规格与思维导图
```

`map-core.js` 被刻意写成不依赖任何微信 API，所以可以直接在 Node 里跑单元测试，也能在浏览器里复用——H5 版就是这么来的。

## 已知边界

- 列表上限 100 条，MVP 阶段够用，超出需要分页
- 安卓真机可能存在 EXIF 方向问题（已列入待办）
- 微信开发者工具与真机均未完整验证，属于 MVP 状态
- 不处理跨设备同步冲突

## License

代码部分采用 MIT，见 [LICENSE](./LICENSE)。

**例外**：`miniprogram/utils/china-map.js` 是第三方地理数据的转换产物，其使用受 DataV.GeoAtlas 服务条款约束，请见上文「地图数据说明」。
