import { getModeDefinition } from './config.js';
import { integer } from './utils.js';
import { isDurationScoreKey, parseScoreKey } from './records.js';

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function matches(record, state) {
  return (state.dimension === 'all' || record.dimension === state.dimension)
    && (state.duration === 'all' || record.duration === Number(state.duration));
}

function createTable(headers, rows) {
  const table = document.createElement('table');
  table.className = 'records-table';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = header;
    headerRow.append(th);
  });
  thead.append(headerRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell, index) => {
      const td = document.createElement('td');
      td.textContent = cell.text;
      if (cell.className) td.className = cell.className;
      else if (index === 0) td.className = 'record-mode';
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  return table;
}

function emptyState(title, description) {
  const empty = document.createElement('div');
  empty.className = 'records-empty';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const text = document.createElement('span');
  text.textContent = description;
  empty.append(heading, text);
  return empty;
}

export function renderRecords(preferences, state) {
  document.querySelectorAll('[data-records-tab]').forEach((button) => {
    const active = button.dataset.recordsTab === state.tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.getElementById('records-dimension').value = state.dimension;
  document.getElementById('records-duration').value = state.duration;
  const content = document.getElementById('records-content');
  content.replaceChildren();

  if (state.tab === 'recent') {
    const records = preferences.history.filter((record) => matches(record, state));
    document.getElementById('records-summary').textContent = `共 ${preferences.history.length} 局 · 当前筛选 ${records.length} 局`;
    if (!records.length) {
      content.append(emptyState('还没有训练成绩', '完成一局训练后，成绩会自动出现在这里。'));
      return;
    }
    content.append(createTable(['项目', '维度', '时长', '得分', '关键数据', '日期'], records.map((record) => {
      const primaryStat = record.stats?.[0];
      return [
        { text: record.modeName },
        { text: record.dimension.toUpperCase(), className: 'record-dimension' },
        { text: `${record.duration} 秒` },
        { text: `${integer(record.score)} ${record.unit}`, className: 'record-score' },
        { text: primaryStat ? `${primaryStat.label} ${primaryStat.value}` : '—', className: 'record-detail' },
        { text: formatTime(record.timestamp), className: 'record-detail' },
      ];
    })));
    return;
  }

  const entries = Object.entries(preferences.best)
    .filter(([key]) => isDurationScoreKey(key))
    .map(([key, score]) => ({ ...parseScoreKey(key), score }))
    .filter((record) => matches(record, state))
    .sort((a, b) => {
      const modeOrder = getModeDefinition(a.modeId).number.localeCompare(getModeDefinition(b.modeId).number);
      return modeOrder || a.dimension.localeCompare(b.dimension) || a.duration - b.duration;
    });
  document.getElementById('records-summary').textContent = `当前筛选 ${entries.length} 项最佳纪录`;
  if (!entries.length) {
    content.append(emptyState('这个条件下还没有最佳纪录', '选择其他维度或时长，或者先完成一局训练。'));
    return;
  }
  content.append(createTable(['项目', '维度', '时长', '最佳成绩', '创下时间'], entries.map((record) => {
    const key = `${record.dimension}:${record.modeId}:${record.duration}`;
    return [
      { text: getModeDefinition(record.modeId).name },
      { text: record.dimension.toUpperCase(), className: 'record-dimension' },
      { text: `${record.duration} 秒` },
      { text: `${integer(record.score)} ${getModeDefinition(record.modeId).unit}`, className: 'record-score' },
      { text: formatTime(preferences.bestDates[key]), className: 'record-detail' },
    ];
  })));
}
