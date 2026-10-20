// All user-visible copy, externalized per FR-13. No hardcoded strings in
// HTML/CSS/JS. Copy follows PRD §8.8 (table 60) where specified.
export interface Messages {
  lang: string;
  langLabel: string;
  title: string;
  metaDescription: string;
  skipToBoard: string;
  introHint: string;
  score: string;
  best: string;
  newGame: string;
  keepGoing: string;
  tryAgain: string;
  win: string;
  winNoMoves: string;
  lose: string;
  soClose: string;
  confirmTitle: string;
  confirmBody: string;
  keepPlaying: string;
  startNewGame: string;
  restored: string;
  share: string;
  shareCopied: string;
  shareCancelled: string;
  shareFailed: string;
  shareDownloaded: string;
  shareAlt: string;
  shareText: string;
  errorBanner: string;
  refresh: string;
  copyErrorCode: string;
  errorCopied: string;
  settings: string;
  settingsGame: string;
  settingsA11y: string;
  settingsDisplay: string;
  settingsData: string;
  settingsPrivacy: string;
  settingsAbout: string;
  sound: string;
  haptics: string;
  motion: string;
  motionSystem: string;
  motionReduce: string;
  motionFull: string;
  shortcuts: string;
  announce: string;
  announceConcise: string;
  announceVerbose: string;
  language: string;
  resetBest: string;
  resetBestConfirm: string;
  exportData: string;
  deleteData: string;
  deleteDataConfirm: string;
  analytics: string;
  version: string;
  license: string;
  aboutText: string;
  confirm: string;
  cancel: string;
  moveDirection: Record<string, string>;
  announceMove: string;
  announceWin: string;
  announceLose: string;
  cellLabel: string;
  boardInfo: string;
  boardInfoHint: string;
  emptyCell: string;
  duration: string;
  durationShort: string;
  readOnlyBanner: string;
  takeOver: string;
  newVersion: string;
  saveFailed: string;
  corruptNotice: string;
  storageUnavailable: string;
  migrateFailed: string;
  howToPlay: string;
  footer: string;
  privacyPolicy: string;
  winSub: string;
  loseSub: string;
  winWinBoth: string;
  maxTile: string;
  moves: string;
  time: string;
  shareDone: string;
}

export const zhCN: Messages = {
  lang: 'zh-CN',
  langLabel: '简体中文',
  title: '2048 Open Edition',
  metaDescription: '2048 Open Edition：在线免费玩 2048，无广告、无账号、打开即玩。',
  skipToBoard: '跳到棋盘',
  introHint: '滑动或按方向键，合并相同数字，合成 2048。',
  score: '分数',
  best: '最佳',
  newGame: '新游戏',
  keepGoing: '继续挑战',
  tryAgain: '再来一局',
  win: '你做到了！',
  winNoMoves: '棋盘已满，无法继续',
  lose: '没有可移动的方块了',
  soClose: '差一点：最大方块 {tile}',
  confirmTitle: '开始新局？',
  confirmBody: '当前进度将结束。',
  keepPlaying: '继续游戏',
  startNewGame: '开始新局',
  restored: '已恢复上一局',
  share: '分享成绩',
  shareCopied: '已复制到剪贴板',
  shareCancelled: '已取消',
  shareFailed: '分享失败，已复制文本',
  shareDownloaded: '图片已下载',
  shareAlt: '2048 成绩卡：分数 {score}，最大方块 {tile}',
  shareText: '2048 · {score} 分 · 最大方块 {tile} · 用时 {duration}',
  errorBanner: '出了点问题。你的进度已保存，刷新即可继续。',
  refresh: '刷新',
  copyErrorCode: '复制错误码',
  errorCopied: '错误码已复制',
  settings: '设置',
  settingsGame: '游戏',
  settingsA11y: '无障碍',
  settingsDisplay: '显示',
  settingsData: '数据',
  settingsPrivacy: '隐私',
  settingsAbout: '关于',
  sound: '音效',
  haptics: '震动',
  motion: '减弱动态',
  motionSystem: '跟随系统',
  motionReduce: '始终减弱',
  motionFull: '从不减弱',
  shortcuts: '单键快捷键',
  announce: '播报模式',
  announceConcise: '简洁',
  announceVerbose: '详细',
  language: '语言',
  resetBest: '重置最佳成绩',
  resetBestConfirm: '重置最佳成绩？此操作不影响统计。',
  exportData: '导出数据',
  deleteData: '删除本地数据',
  deleteDataConfirm: '删除所有本地数据？此操作不可恢复。',
  analytics: '匿名分析',
  version: '版本',
  license: 'MIT 许可与署名',
  aboutText:
    '2048 Open Edition 基于 Gabriele Cirulli 的开源实现（MIT 许可）。玩法概念受 Threes（Asher Vollmer）与 1024（Veewo Studio）启发。',
  confirm: '确认',
  cancel: '取消',
  moveDirection: { left: '向左', right: '向右', up: '向上', down: '向下' },
  announceMove: '{direction}。合并 {merges} 次。得分 {score}。最大方块 {tile}。',
  announceWin: '你做到了。分数 {score}。最大方块 {tile}。用时 {duration}。',
  announceLose: '没有可移动的方块了。分数 {score}。最大方块 {tile}。',
  cellLabel: '第 {r} 行第 {c} 列，{value}',
  boardInfo: '棋盘状态',
  boardInfoHint: '按 Tab 逐格浏览，Esc 关闭',
  emptyCell: '空',
  duration: '{m} 分 {s} 秒',
  durationShort: '{m} 分 {s} 秒',
  readOnlyBanner: '此局已在另一标签继续',
  takeOver: '在此继续',
  newVersion: '新版本已就绪，刷新以更新',
  saveFailed: '本次进度无法保存',
  corruptNotice: '存档已损坏，已为你开始新局',
  storageUnavailable: '浏览器存储不可用，本次进度无法保存',
  migrateFailed: '旧存档无法迁移，已为你开始新局',
  howToPlay: '滑动合并相同数字，合成 2048！',
  footer: '基于 Gabriele Cirulli 的开源 2048（MIT 许可）',
  privacyPolicy: '隐私政策',
  winSub: '你合成了 2048！',
  loseSub: '棋盘已满且没有可合并的方块',
  winWinBoth: '你合成了 2048，但棋盘已满，无法继续',
  maxTile: '最大方块',
  moves: '步数',
  time: '用时',
  shareDone: '已分享',
};

export const en: Messages = {
  lang: 'en',
  langLabel: 'English',
  title: '2048 Open Edition',
  metaDescription: '2048 Open Edition: play 2048 online for free. No ads, no account, play instantly.',
  skipToBoard: 'Skip to board',
  introHint: 'Slide or use arrow keys to merge matching numbers. Reach 2048.',
  score: 'Score',
  best: 'Best',
  newGame: 'New Game',
  keepGoing: 'Keep going',
  tryAgain: 'Try again',
  win: 'You did it!',
  winNoMoves: 'Board is full, no moves left',
  lose: 'No moves left',
  soClose: 'So close — max tile {tile}',
  confirmTitle: 'Start a new game?',
  confirmBody: 'Your current progress will end.',
  keepPlaying: 'Keep playing',
  startNewGame: 'Start new game',
  restored: 'Game restored',
  share: 'Share score',
  shareCopied: 'Copied to clipboard',
  shareCancelled: 'Cancelled',
  shareFailed: 'Share failed, text copied instead',
  shareDownloaded: 'Image downloaded',
  shareAlt: '2048 score card: {score} points, max tile {tile}',
  shareText: '2048 · {score} pts · max tile {tile} · {duration}',
  errorBanner: 'Something went wrong. Your progress is saved — refresh to continue.',
  refresh: 'Refresh',
  copyErrorCode: 'Copy error code',
  errorCopied: 'Error code copied',
  settings: 'Settings',
  settingsGame: 'Game',
  settingsA11y: 'Accessibility',
  settingsDisplay: 'Display',
  settingsData: 'Data',
  settingsPrivacy: 'Privacy',
  settingsAbout: 'About',
  sound: 'Sound',
  haptics: 'Haptics',
  motion: 'Reduced motion',
  motionSystem: 'Follow system',
  motionReduce: 'Always reduce',
  motionFull: 'Never reduce',
  shortcuts: 'Single-key shortcuts',
  announce: 'Announce mode',
  announceConcise: 'Concise',
  announceVerbose: 'Verbose',
  language: 'Language',
  resetBest: 'Reset best score',
  resetBestConfirm: 'Reset best score? Your stats are not affected.',
  exportData: 'Export data',
  deleteData: 'Delete local data',
  deleteDataConfirm: 'Delete all local data? This cannot be undone.',
  analytics: 'Anonymous analytics',
  version: 'Version',
  license: 'MIT license & attribution',
  aboutText:
    '2048 Open Edition is based on the open-source implementation by Gabriele Cirulli (MIT license). The concept is inspired by Threes (Asher Vollmer) and 1024 (Veewo Studio).',
  confirm: 'Confirm',
  cancel: 'Cancel',
  moveDirection: { left: 'Left', right: 'Right', up: 'Up', down: 'Down' },
  announceMove: '{direction}. {merges} merges. Score {score}. Max tile {tile}.',
  announceWin: 'You did it. Score {score}. Max tile {tile}. Time {duration}.',
  announceLose: 'No moves left. Score {score}. Max tile {tile}.',
  cellLabel: 'Row {r}, column {c}: {value}',
  boardInfo: 'Board status',
  boardInfoHint: 'Press Tab to browse cells, Esc to close',
  emptyCell: 'empty',
  duration: '{m}m {s}s',
  durationShort: '{m}m {s}s',
  readOnlyBanner: 'This game is being played in another tab',
  takeOver: 'Continue here',
  newVersion: 'A new version is ready — refresh to update',
  saveFailed: 'Progress could not be saved',
  corruptNotice: 'Your save was corrupted, a new game has been started',
  storageUnavailable: 'Browser storage is unavailable, progress will not be saved',
  migrateFailed: 'Your old save could not be migrated, a new game has been started',
  howToPlay: 'Slide to merge matching numbers. Reach 2048!',
  footer: 'Based on the open-source 2048 by Gabriele Cirulli (MIT license)',
  privacyPolicy: 'Privacy policy',
  winSub: 'You merged your way to 2048!',
  loseSub: 'The board is full and no tiles can merge',
  winWinBoth: 'You reached 2048, but the board is full — no more moves',
  maxTile: 'Max tile',
  moves: 'Moves',
  time: 'Time',
  shareDone: 'Shared',
};
