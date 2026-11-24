export const ROUND_RESTART_DELAY_MS = 3000;
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
export const MIN_TARGET_GAP_DIAMETERS = 1;

export function minimumTargetCenterDistance(radius) {
  return radius * 2 * (1 + MIN_TARGET_GAP_DIAMETERS);
}

export const WEAPONS = {
  guardian: {
    id: 'guardian',
    name: '戍卫',
    english: 'GUARDIAN',
    fireRate: 5.25,
    headDamage: 195,
    bodyDamage: 65,
    automatic: false,
  },
  vandal: {
    id: 'vandal',
    name: '狂徒',
    english: 'VANDAL',
    fireRate: 9.75,
    headDamage: 160,
    bodyDamage: 40,
    automatic: true,
  },
};

export const DIFFICULTY_LABELS = { easy: '轻松', normal: '标准', hard: '困难' };

export const MODES = [
  {
    id: 'precision', number: '01', category: '基础瞄准', categoryEn: 'FUNDAMENTALS',
    name: '精准定位', icon: 'target', weapon: 'guardian', unit: '得分',
    short: '快速切换目标，让每一次甩枪都稳定落点。',
    description: '同屏保持 3 个目标。命中后立即刷新，以戍卫的单发节奏完成快速定位，兼顾速度与命中率。',
    controls: ['移动鼠标 · 瞄准', '左键 · 单发射击', '无限弹药'],
    tip: '先看准再点击；连续命中会获得更高分数。',
  },
  {
    id: 'reaction', number: '02', category: '基础瞄准', categoryEn: 'FUNDAMENTALS',
    name: '反应射击', icon: 'bolt', weapon: 'guardian', unit: '得分',
    short: '打破预判，在目标出现的瞬间做出反应。',
    description: '目标会在随机延迟后出现。不要提前点击，以最短反应时间完成命中，刷新你的神经反应上限。',
    controls: ['等待目标出现', '左键 · 快速击发', '无限弹药'],
    tip: '过早点击会记为脱靶，并打断当前连击。',
  },
  {
    id: 'tracking', number: '03', category: '基础瞄准', categoryEn: 'FUNDAMENTALS',
    name: '动态跟枪', icon: 'wave', weapon: 'vandal', unit: '得分',
    short: '以准星悬停时间与目标环数，衡量平滑跟枪能力。',
    description: '准星悬停在目标上即累计时间，并按 10、8、6、4 环计算积分。子弹只提供射击反馈，不决定得分。',
    controls: ['准星悬停 · 累计环数', '左键 · 射击反馈', '无限弹药'],
    tip: '中心 20% 为 10 环；越稳定地跟随中心，每秒积分越高。',
  },
  {
    id: 'sniper', number: '04', category: '进阶枪械', categoryEn: 'ADVANCED',
    name: '精确射手', icon: 'scope', weapon: 'guardian', unit: '总环数',
    short: '控制呼吸与准星，在有限暴露时间内击中靶心。',
    description: '以戍卫进行高精度单发训练。呼吸会带来轻微准星漂移，短暂屏息后抓住时机，争取每一发都命中十环。',
    controls: ['左键 · 单发射击', '按住 Shift · 屏息', '无限弹药'],
    tip: '屏息体力有限；目标超时未击中会自动更换。',
  },
  {
    id: 'grid', number: '05', category: '速度瞄准', categoryEn: 'GRIDSHOT',
    name: '九宫格射击', icon: 'grid', weapon: 'vandal', unit: '得分',
    short: '在 3×3 虚拟格中追踪三颗目标，命中后即刻换格刷新。',
    description: '九宫格内始终保留三颗球。每次点击单发射击，命中后目标会在其他空格刷新，在固定时长内兼顾速度、命中率与连击。',
    controls: ['3 × 3 · 三球同屏', '左键 · 单发射击', '命中 · 空格刷新'],
    tip: '新目标不会出现在刚被击中的格子，也不会与另外两颗球重叠。',
  },
  {
    id: 'clay', number: '06', category: '趣味挑战', categoryEn: 'CHALLENGE',
    name: '飞碟射击', icon: 'clay', weapon: 'guardian', unit: '得分',
    short: '判断弧线与提前量，在飞碟逃逸前将其击碎。',
    description: '飞碟从两侧以不同速度沿抛物线进入靶场。用戍卫完成短促而精准的击发，别让目标飞出边界。',
    controls: ['观察轨迹 · 预判', '左键 · 单发射击', '无限弹药'],
    tip: '飞碟离开靶场会记为逃逸，并中断当前连击。',
  },
];

export function getModeDefinition(id) {
  return MODES.find((mode) => mode.id === id) || MODES[0];
}

export function iconSvg(name) {
  const icons = {
    target: '<circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="7"/><path d="M20 2v8M20 30v8M2 20h8M30 20h8"/><circle cx="20" cy="20" r="1"/>',
    bolt: '<path d="M23 3L9 22h10l-2 15 14-20H21l2-14z"/><path d="M5 8h5M30 32h5M33 7l-3 3"/>',
    wave: '<path d="M3 25c6-20 11 13 18-8s10 9 16-7"/><circle cx="21" cy="17" r="5"/><path d="M21 7v3M21 24v3M11 17h3M28 17h3"/>',
    scope: '<circle cx="20" cy="20" r="15"/><circle cx="20" cy="20" r="9" stroke-dasharray="2 3"/><path d="M20 2v13M20 25v13M2 20h13M25 20h13"/><path d="M17 20h6M20 17v6"/>',
    grid: '<path d="M5 5h30v30H5zM15 5v30M25 5v30M5 15h30M5 25h30"/><circle cx="10" cy="10" r="2.5"/><circle cx="20" cy="20" r="2.5"/><circle cx="30" cy="30" r="2.5"/>',
    clay: '<ellipse cx="20" cy="20" rx="16" ry="8" transform="rotate(-25 20 20)"/><ellipse cx="20" cy="20" rx="9" ry="3.5" transform="rotate(-25 20 20)"/><path d="M4 7l4 2M32 31l4 2M31 5l-2 4"/>',
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${icons[name] || icons.target}</svg>`;
}
