// 内置公告。用户已读状态仍然写在 data/notice-state.json。
export const NOTICES = [
  {
    id: 1,
    title: 'ModBox v0.0.1',
    time: '2026-09-28 15:07:00',
    tag: '置顶',
    content: ['1.自制Mod盒子，项目启动。', '2.完成了标题栏和主题切换。']
  },
  {
    id: 2,
    title: 'ModBox v0.0.2',
    time: '2026-09-30 10:45:00',
    tag: '更新',
    content: ['1.已完成了公告栏基本设计。', '2.准备完成公告栏后端数据动态更新和公告栏UI补充。']
  },
  {
    id: 3,
    title: 'ModBox v0.0.3',
    time: '2026-10-1 13:40:00',
    tag: '更新',
    content: [
      '1.已完成公告栏全部设计。',
      '2.已完成导航栏UI设计。',
      '3.准备完成导航栏后端逻辑设计。'
    ]
  }
]
