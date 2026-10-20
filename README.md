# 2048 Open Edition

网页版 2048 2.0 —— 一款可信、跟手、可分享、对所有人可用的 2048。无广告、无账号、无内购、打开即玩。

在 4×4 棋盘上滑动数字方块，合并相同数值，目标合成 2048。

## 功能（PRD v3.0 P0 切片）

- **规则零改变**：90/10 生成、每回合每方块最多合并一次、先滑动后合并、计分 = 合并后的数值
- **可复现对局**：种子化 PRNG（xorshift32 + 拒绝采样），`seed + 移动序列` 可回放
- **可靠性**：schema v2 存档校验、损坏存档归档、内存降级、v1 存档迁移、多标签租约（BroadcastChannel + fencing token）
- **防误触**：有进度时开始新局需确认；误触不再丢局
- **分享**：Canvas 1080×1350 成绩卡（分数/最大方块/用时，无棋盘布局）→ 系统分享 → 下载 → 复制文本三级降级
- **无障碍**：语义棋盘（role=table）、aria-live 每步播报、焦点陷阱、`I` 键棋盘对话框、AA 修订配色、减弱动态
- **双语**：英文 / 简体中文，按浏览器语言自动匹配
- **PWA**：离线外壳 + Service Worker 更新提示
- **隐私**：无 PII 的分桶埋点（可关闭）、数据导出 / 删除、生产环境 CSP

## 开发

```bash
npm install
npm run dev        # 开发服务器
npm test           # 单元测试（黄金向量 + 状态机 + 序列化 + 1 万局属性测试）
npm run test:e2e   # Playwright E2E（31 条，含 axe 无障碍审计与 PWA 离线）
npm run build      # 类型检查 + 生产构建
npm run icons      # 重新生成 PWA 图标
```

## 技术栈

TypeScript（strict）· Vite · 原生 DOM/CSS · Vitest · Playwright · 零运行时依赖。
核心规则为纯 reducer，不依赖 DOM，可脱离浏览器测试。

## 许可与署名

基于 [Gabriele Cirulli 的开源 2048](https://github.com/gabrielecirulli/2048)（MIT 许可）。玩法概念受 Threes（Asher Vollmer）与 1024（Veewo Studio）启发。本项目同样以 MIT 许可发布，保留原作者署名。
