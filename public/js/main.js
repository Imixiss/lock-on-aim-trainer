import { AudioEngine } from './audio.js';
import { DIFFICULTY_LABELS, getModeDefinition, iconSvg, MODES, ROUND_RESTART_DELAY_MS, WEAPONS } from './config.js';
import { Game } from './game.js';
import { Game3D } from './game3d.js';
import { integer } from './utils.js';
import { normalizeSensitivity } from './sensitivity.js';
import { isDurationScoreKey, prependHistory, scoreKey } from './records.js';
import { renderRecords } from './records-panel.js';

const STORAGE_KEY = 'lock-on-aim:v1';
const $ = (id) => document.getElementById(id);
const defaults = {
  difficulty: 'normal',
  duration: 30,
  dimension: '3d',
  sensitivity: 0.35,
  sensitivityFormat: 'valorant',
  crosshair: 'cross',
  theme: 'dark',
  muted: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  best: {},
  bestDates: {},
  history: [],
};

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const best = {};
    const bestDates = {};
    if (stored.best && typeof stored.best === 'object') {
      Object.entries(stored.best).forEach(([key, value]) => {
        if (isDurationScoreKey(key) && Number.isFinite(value)) best[key] = value;
      });
    }
    if (stored.bestDates && typeof stored.bestDates === 'object') {
      Object.entries(stored.bestDates).forEach(([key, value]) => {
        if (isDurationScoreKey(key) && Number.isFinite(value)) bestDates[key] = value;
      });
    }
    return {
      ...defaults,
      ...stored,
      difficulty: DIFFICULTY_LABELS[stored.difficulty] ? stored.difficulty : defaults.difficulty,
      duration: [30, 60, 90].includes(stored.duration) ? stored.duration : defaults.duration,
      dimension: stored.dimension === '2d' ? '2d' : '3d',
      sensitivity: stored.sensitivityFormat === 'valorant' ? normalizeSensitivity(stored.sensitivity) : defaults.sensitivity,
      sensitivityFormat: 'valorant',
      crosshair: stored.crosshair === 'dot' ? 'dot' : 'cross',
      theme: stored.theme === 'light' ? 'light' : 'dark',
      best,
      bestDates,
      history: Array.isArray(stored.history) ? stored.history.slice(0, 20) : [],
    };
  } catch {
    return { ...defaults };
  }
}

let preferences = readPreferences();
let selectedMode = null;
const recordsState = { tab: 'recent', dimension: 'all', duration: 'all' };
let toastTimer = 0;
let roundRestartAvailableAt = 0;
let replayCountdownTimer = 0;
const audio = new AudioEngine(preferences.muted);

function savePreferences() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
}

function setText(id, value) {
  const element = $(id);
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function renderModeCards() {
  $('mode-grid').innerHTML = MODES.map((mode) => {
    const weapon = WEAPONS[mode.weapon];
    return `
      <button class="mode-card" type="button" data-mode="${mode.id}" aria-label="开始${mode.name}训练">
        <div class="mode-card-top"><span class="mode-number">DRILL ${mode.number}</span><span class="mode-category">${mode.category}</span></div>
        <div class="mode-icon">${iconSvg(mode.icon)}</div>
        <div class="mode-title-row"><h3>${mode.name}</h3><span class="mode-weapon">${weapon.name}</span></div>
        <p>${mode.short}</p>
        <div class="mode-card-bottom"><span class="mode-best">BEST&nbsp; <strong data-best-for="${mode.id}">—</strong></span><span class="mode-arrow">↗</span></div>
      </button>`;
  }).join('');
  updateBestLabels();
}

function updateBestLabels() {
  document.querySelectorAll('[data-best-for]').forEach((element) => {
    const value = preferences.best[scoreKey(preferences.dimension, element.dataset.bestFor, preferences.duration)];
    element.textContent = Number.isFinite(value) ? integer(value) : '—';
  });
}

function applyTheme() {
  const light = preferences.theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  $('theme-button').setAttribute('aria-pressed', String(light));
  $('theme-label').textContent = light ? '夜间模式' : '白天模式';
  game.settings.theme = preferences.theme;
  if (game3d) {
    game3d.settings.theme = preferences.theme;
    game3d.setTheme(preferences.theme);
  }
}

function updateSettingsUI() {
  document.querySelectorAll('[data-dimension]').forEach((button) => {
    const active = button.dataset.dimension === preferences.dimension;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-crosshair]').forEach((button) => {
    const active = button.dataset.crosshair === preferences.crosshair;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (document.activeElement !== $('sensitivity-range')) $('sensitivity-range').value = preferences.sensitivity.toFixed(3);
  if (document.activeElement !== $('sensitivity-number')) $('sensitivity-number').value = preferences.sensitivity.toFixed(3);
  document.querySelectorAll('[data-difficulty]').forEach((button) => {
    const active = button.dataset.difficulty === preferences.difficulty;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-duration]').forEach((button) => {
    const active = Number(button.dataset.duration) === preferences.duration;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-action="toggle-sound"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(!preferences.muted));
    const label = button.querySelector('.sound-label');
    if (label) label.textContent = preferences.muted ? '已静音' : '声音开启';
  });
  $('motion-button').textContent = `动态效果：${preferences.reducedMotion ? '关' : '开'}`;
  $('motion-button').setAttribute('aria-pressed', String(!preferences.reducedMotion));
}

function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3300);
}

function beginRoundCooldown() {
  roundRestartAvailableAt = performance.now() + ROUND_RESTART_DELAY_MS;
  const button = $('replay-button');
  clearInterval(replayCountdownTimer);
  button.disabled = true;
  const update = () => {
    const remaining = Math.max(0, roundRestartAvailableAt - performance.now());
    if (remaining <= 0) {
      clearInterval(replayCountdownTimer);
      replayCountdownTimer = 0;
      button.disabled = false;
      button.innerHTML = '再次训练 <kbd>R</kbd>';
      return;
    }
    button.textContent = `${Math.ceil(remaining / 1000)} 秒后可复练`;
  };
  update();
  replayCountdownTimer = setInterval(update, 100);
}

function requestRoundStart() {
  const remaining = Math.max(0, roundRestartAvailableAt - performance.now());
  if (remaining > 0) {
    showToast(`为防止误触，请等待 ${(remaining / 1000).toFixed(1)} 秒后再开始下一轮。`);
    return false;
  }
  return activeGame.start();
}

function updateReloadHint(state) {
  const hint = $('reload-key-hint');
  hint.hidden = state !== 'paused' && state !== 'finished';
  hint.innerHTML = state === 'finished' ? '<kbd>R</kbd> 复练' : '<kbd>R</kbd> 重开';
}

function updateArenaStatus(message) {
  const element = $('arena-status');
  if (element.textContent.trim() === message) return;
  element.innerHTML = '<span></span>';
  element.append(document.createTextNode(` ${message}`));
}

function handleStateChange(state) {
  $('start-overlay').hidden = state !== 'idle';
  $('countdown-overlay').hidden = state !== 'countdown';
  $('pause-overlay').hidden = state !== 'paused';
  $('results-overlay').hidden = state !== 'finished';
  $('arena-shell').classList.toggle('is-playing', state === 'running');
  const status = {
    idle: '等待训练开始',
    countdown: '倒计时准备中',
    running: '训练进行中 · 保持节奏',
    paused: '训练已暂停 · 计时冻结',
    finished: '训练完成 · 成绩已生成',
  };
  updateArenaStatus(status[state] || '');
  updateReloadHint(state);
}

function handleTick(snapshot) {
  setText('hud-time', snapshot.remaining.toFixed(1));
  if (snapshot.state === 'countdown') setText('countdown-value', snapshot.countdown);
  const { hud, weapon } = snapshot;
  ['primary', 'secondary', 'tertiary'].forEach((key) => {
    setText(`hud-${key}-label`, hud[key].label);
    setText(`hud-${key}-value`, hud[key].value);
  });
  setText('hud-weapon', `${weapon.name} // ${weapon.english}`);
  const ammoElement = $('hud-ammo');
  if (ammoElement.firstChild) ammoElement.firstChild.nodeValue = '∞';
  ammoElement.querySelector('small').textContent = '';
  setText('hud-reload', `SENS ${preferences.sensitivity.toFixed(3)}`);
  if (snapshot.dimension === '3d') setText('look-readout', `YAW ${(snapshot.yaw * 180 / Math.PI).toFixed(2)}°`);
  document.querySelector('.hud-ammo').classList.remove('is-reloading');
  if (snapshot.state === 'running') {
    const sensitivity = preferences.sensitivity.toFixed(3);
    updateArenaStatus(snapshot.pointerLockFallback
      ? `3D 移动视角 · 灵敏度 ${sensitivity}`
      : preferences.dimension === '3d'
        ? `3D 鼠标已锁定 · 灵敏度 ${sensitivity}`
        : '训练进行中 · 保持节奏');
  }
}

function handleFinish(result) {
  beginRoundCooldown();
  const bestKey = scoreKey(preferences.dimension, selectedMode.id, preferences.duration);
  const timestamp = Date.now();
  preferences.history = prependHistory(preferences.history, {
    modeId: selectedMode.id,
    modeName: selectedMode.name,
    dimension: preferences.dimension,
    duration: preferences.duration,
    difficulty: preferences.difficulty,
    score: Math.round(result.score),
    unit: result.unit,
    stats: result.stats.map((stat) => ({ ...stat })),
    timestamp,
  });
  const previous = Number.isFinite(preferences.best[bestKey]) ? preferences.best[bestKey] : -1;
  const isNewBest = result.score > 0 && result.score > previous;
  if (isNewBest) {
    preferences.best[bestKey] = result.score;
    preferences.bestDates[bestKey] = timestamp;
  }
  savePreferences();
  updateBestLabels();
  setText('result-score', integer(result.score));
  setText('result-unit', result.unit);
  $('new-best-badge').hidden = !isNewBest;
  $('result-stats').replaceChildren(...result.stats.map((stat) => {
    const item = document.createElement('div');
    item.className = 'result-stat';
    const label = document.createElement('span');
    label.textContent = stat.label;
    const value = document.createElement('strong');
    value.textContent = stat.value;
    item.append(label, value);
    return item;
  }));
  setText('result-summary', isNewBest
    ? '新纪录已保存到本机。保持设置，再把极限向前推一点。'
    : result.score === 0
      ? '先放慢动作、保证命中，再逐渐提高速度。'
      : `本机最佳 ${integer(Math.max(previous, 0))} · 复盘数据，然后再试一组。`);
}

const gameCallbacks = {
  onStateChange: handleStateChange,
  onTick: handleTick,
  onFinish: handleFinish,
  onNotice: showToast,
};
const game = new Game($('game-canvas'), audio, gameCallbacks);
let game3d = null;
try {
  game3d = new Game3D($('game-canvas-3d'), audio, gameCallbacks);
} catch (error) {
  console.error('3D renderer initialization failed:', error);
  preferences.dimension = '2d';
  queueMicrotask(() => showToast('当前环境无法初始化 WebGL，已保留 2D 训练模式。'));
}
let activeGame = preferences.dimension === '3d' && game3d ? game3d : game;

function openMode(id) {
  selectedMode = getModeDefinition(id);
  const weapon = WEAPONS[selectedMode.weapon];
  activeGame = preferences.dimension === '3d' && game3d ? game3d : game;
  $('game-canvas').hidden = activeGame !== game;
  $('game-canvas-3d').hidden = activeGame !== game3d;
  $('crosshair-3d').hidden = activeGame !== game3d;
  $('crosshair-3d').classList.toggle('is-dot', preferences.crosshair === 'dot');
  $('look-readout').hidden = activeGame !== game3d;
  $('arena-shell').classList.toggle('is-3d', activeGame === game3d);
  $('lobby-view').hidden = true;
  $('game-view').hidden = false;
  setText('game-mode-kicker', `DRILL ${selectedMode.number} // ${selectedMode.categoryEn}`);
  setText('game-mode-title', selectedMode.name);
  setText('game-settings-label', `${preferences.dimension.toUpperCase()} · ${DIFFICULTY_LABELS[preferences.difficulty]} · ${preferences.duration} 秒 · SENS ${preferences.sensitivity.toFixed(3)}`);
  setText('start-mode-number', `DRILL ${selectedMode.number} // ${selectedMode.categoryEn}`);
  setText('start-mode-title', `${selectedMode.name} · ${preferences.dimension.toUpperCase()}`);
  setText('start-mode-description', selectedMode.description);
  setText('start-tip', activeGame === game3d
    ? `${selectedMode.tip} 点击后请求鼠标锁定权限，拒绝时也可移动视角。`
    : selectedMode.tip);
  $('start-icon').innerHTML = iconSvg(selectedMode.icon);
  $('start-controls').replaceChildren(...selectedMode.controls.map((control) => {
    const chip = document.createElement('span');
    chip.textContent = activeGame === game3d && control === '移动鼠标 · 瞄准' ? '移动鼠标 · 控制视角' : control;
    return chip;
  }));
  $('weapon-specs').innerHTML = `
    <span><b>${weapon.name}</b> ${weapon.english}</span>
    <span><b>${weapon.fireRate.toFixed(2)}</b> 发/秒</span>
    <span><b>∞</b> 无限弹药</span>
    <span><b>${weapon.headDamage}</b> 头部伤害</span>`;
  activeGame.load(id, preferences);
  window.scrollTo({ top: 0, behavior: preferences.reducedMotion ? 'instant' : 'smooth' });
}

function returnToLobby() {
  game.unload();
  game3d?.unload();
  $('game-view').hidden = true;
  $('lobby-view').hidden = false;
  updateBestLabels();
  window.scrollTo({ top: 0, behavior: preferences.reducedMotion ? 'instant' : 'smooth' });
}

function openRecords() {
  renderRecords(preferences, recordsState);
  if (!$('records-dialog').open) $('records-dialog').showModal();
}

renderModeCards();
updateSettingsUI();
applyTheme();

$('mode-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-mode]');
  if (card) openMode(card.dataset.mode);
});

document.querySelectorAll('[data-dimension]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.dimension === '3d' && !game3d) {
      showToast('当前环境不支持 WebGL，请继续使用 2D 模式。');
      return;
    }
    preferences.dimension = button.dataset.dimension;
    savePreferences();
    updateSettingsUI();
    updateBestLabels();
  });
});

function updateSensitivity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  preferences.sensitivity = normalizeSensitivity(numeric);
  game.settings.sensitivity = preferences.sensitivity;
  if (game3d) game3d.settings.sensitivity = preferences.sensitivity;
  savePreferences();
  updateSettingsUI();
}

$('sensitivity-range').addEventListener('input', (event) => updateSensitivity(event.target.value));
$('sensitivity-number').addEventListener('change', (event) => updateSensitivity(event.target.value));

$('theme-button').addEventListener('click', () => {
  preferences.theme = preferences.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  savePreferences();
});

document.querySelectorAll('[data-crosshair]').forEach((button) => {
  button.addEventListener('click', () => {
    preferences.crosshair = button.dataset.crosshair;
    game.settings.crosshair = preferences.crosshair;
    if (game3d) game3d.settings.crosshair = preferences.crosshair;
    $('crosshair-3d').classList.toggle('is-dot', preferences.crosshair === 'dot');
    savePreferences();
    updateSettingsUI();
  });
});

document.querySelectorAll('[data-difficulty]').forEach((button) => {
  button.addEventListener('click', () => {
    preferences.difficulty = button.dataset.difficulty;
    savePreferences();
    updateSettingsUI();
  });
});

document.querySelectorAll('[data-duration]').forEach((button) => {
  button.addEventListener('click', () => {
    preferences.duration = Number(button.dataset.duration);
    savePreferences();
    updateSettingsUI();
    updateBestLabels();
  });
});

document.querySelectorAll('[data-action="toggle-sound"]').forEach((button) => {
  button.addEventListener('click', () => {
    preferences.muted = !preferences.muted;
    audio.setMuted(preferences.muted);
    savePreferences();
    updateSettingsUI();
  });
});

$('motion-button').addEventListener('click', () => {
  preferences.reducedMotion = !preferences.reducedMotion;
  game.settings.reducedMotion = preferences.reducedMotion;
  if (game.mode) game.mode.reducedMotion = preferences.reducedMotion;
  if (game3d) {
    game3d.settings.reducedMotion = preferences.reducedMotion;
    if (game3d.mode) game3d.mode.reducedMotion = preferences.reducedMotion;
  }
  savePreferences();
  updateSettingsUI();
});

$('start-button').addEventListener('click', requestRoundStart);
$('resume-button').addEventListener('click', () => activeGame.resume());
$('pause-restart-button').addEventListener('click', requestRoundStart);
$('replay-button').addEventListener('click', requestRoundStart);
$('back-button').addEventListener('click', returnToLobby);
$('pause-lobby-button').addEventListener('click', returnToLobby);
$('results-lobby-button').addEventListener('click', returnToLobby);
function clearAllRecords() {
  if (!window.confirm('确定清空全部训练历史与最佳成绩吗？训练设置会保留。')) return;
  preferences.best = {};
  preferences.bestDates = {};
  preferences.history = [];
  savePreferences();
  updateBestLabels();
  if ($('records-dialog').open) renderRecords(preferences, recordsState);
  showToast('训练历史与最佳成绩已清空。');
}

$('reset-best-button').addEventListener('click', clearAllRecords);
$('records-clear-button').addEventListener('click', clearAllRecords);
$('records-button').addEventListener('click', openRecords);
$('records-close').addEventListener('click', () => $('records-dialog').close());
$('records-dialog').addEventListener('click', (event) => {
  if (event.target === $('records-dialog')) $('records-dialog').close();
});
document.querySelectorAll('[data-records-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    recordsState.tab = button.dataset.recordsTab;
    renderRecords(preferences, recordsState);
  });
});
$('records-dimension').addEventListener('change', (event) => {
  recordsState.dimension = event.target.value;
  renderRecords(preferences, recordsState);
});
$('records-duration').addEventListener('change', (event) => {
  recordsState.duration = event.target.value;
  renderRecords(preferences, recordsState);
});
$('brand-button').addEventListener('click', () => {
  if (!$('game-view').hidden) returnToLobby();
  else window.scrollTo({ top: 0, behavior: preferences.reducedMotion ? 'instant' : 'smooth' });
});
