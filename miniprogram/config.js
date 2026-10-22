// config.js —— 全局配置，换云开发环境只改这一个文件
module.exports = {
  // 云开发环境 ID（云开发控制台 → 设置 → 环境 ID）
  // TODO: 换成你自己的环境 ID。在微信开发者工具中开通云开发后，
  //       控制台「设置 → 环境 ID」可以找到。
  envId: 'YOUR_ENV_ID_HERE',
  // 记忆集合名（需在云开发控制台创建，权限设为「仅创建者可读写」）
  collection: 'memories',
  // 照片存储目录前缀
  photoDir: 'memories',
};
