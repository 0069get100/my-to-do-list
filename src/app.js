import { STORAGE_KEY, localDate, validDate, loadTasks, stats, selectTasks } from './tasks.js';

export function initApp(doc = document, storage = localStorage) {
  const $ = selector => doc.querySelector(selector);
  let tasks = [], view = 'all', filter = 'all', sort = 'created';
  let storageWarning = '';
  try { tasks = loadTasks(storage); } catch { storageWarning = '无法读取本地记录；本次仍可使用任务清单。'; }
  const feedback = message => { $('#feedback').textContent = storageWarning || message; };
  const save = message => {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(tasks)); storageWarning = ''; }
    catch { storageWarning = '保存失败：当前任务仅在本次页面中保留，请检查浏览器存储权限。'; }
    render(); feedback(message);
  };
  function render() {
    const today = localDate();
    $('#date-label').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    const s = stats(tasks, today);
    for (const [id, value] of Object.entries({ 'all-count': s.total, 'today-count': s.today, 'completed-count': s.done, 'stat-today': s.today, 'stat-done': s.todayDone, 'stat-pending': s.todayPending })) $(`#${id}`).textContent = value;
    $('#progress-text').textContent = `${s.done} / ${s.total} 已完成`;
    $('#progress-percent').textContent = `${s.percent}%`;
    $('#progress-fill').style.width = `${s.percent}%`;
    $('.progress-track').setAttribute('aria-valuenow', s.percent);
    const titles = { all: '我的任务', today: '今天的任务', completed: '已完成的任务' };
    $('#breadcrumb').textContent = { all: '所有任务', today: '今天的任务', completed: '已完成' }[view];
    const visible = selectTasks(tasks, { view, filter, sort, today });
    $('#view-title').firstChild.textContent = `${titles[view]} `;
    $('#visible-count').textContent = visible.length;
    $('#task-list').replaceChildren();
    $('#empty-state').hidden = visible.length > 0;
    $('#empty-state h3').textContent = tasks.length ? '这里暂时没有任务' : '给这一天，一个小小的开始';
    $('#empty-state p').textContent = tasks.length ? '试试其他筛选，或为今天添加一个新任务。' : '添加你的第一个任务，慢慢把想做的事变成已完成。';
    for (const task of visible) {
      const row = doc.createElement('li'); row.className = `task-row${task.done ? ' is-done' : ''}`;
      const checkbox = doc.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done; checkbox.className = 'task-check'; checkbox.setAttribute('aria-label', `完成任务：${task.title}`);
      checkbox.addEventListener('change', () => { task.done = checkbox.checked; save(task.done ? '任务已完成，做得很好！' : '任务已恢复为待完成。'); });
      const body = doc.createElement('div'); body.className = 'task-body';
      const title = doc.createElement('span'); title.className = 'task-name'; title.textContent = task.title;
      const meta = doc.createElement('div'); meta.className = 'task-meta';
      const badge = doc.createElement('span'); badge.className = `priority ${task.priority}`; badge.textContent = { high: '● 高优先级', normal: '● 普通', low: '● 低优先级' }[task.priority]; meta.append(badge);
      if (task.date) {
        const date = doc.createElement('span'); date.className = `due-date${task.date < today && !task.done ? ' overdue' : ''}`;
        date.textContent = task.date === today ? '◷ 今天截止' : `◷ ${task.date.replaceAll('-', '/')}${task.date < today && !task.done ? ' · 已逾期' : ''}`; meta.append(date);
      }
      body.append(title, meta);
      const remove = doc.createElement('button'); remove.className = 'delete-button'; remove.textContent = '×'; remove.setAttribute('aria-label', `删除任务：${task.title}`);
      remove.addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); save('任务已删除。'); });
      row.append(checkbox, body, remove); $('#task-list').append(row);
    }
  }
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#task-title').value.trim(), date = $('#task-date').value;
    if (!title || title.length > 200) { feedback('请输入 1–200 字的任务名称。'); $('#task-title').focus(); return; }
    if (!validDate(date)) { feedback('请输入有效的截止日期。'); return; }
    tasks.unshift({ id: globalThis.crypto.randomUUID(), title, priority: $('#task-priority').value, date, done: false, created: Date.now() });
    $('#task-form').reset(); save('新任务已添加。'); $('#task-title').focus();
  });
  doc.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view; filter = 'all';
    doc.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === button));
    doc.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all')); render();
  }));
  doc.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    doc.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); render();
  }));
  $('#sort').addEventListener('change', () => { sort = $('#sort').value; render(); });
  render(); feedback('');
  return { refresh: render };
}

if (typeof document !== 'undefined') {
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
  const app = initApp(document, storage);
  window.addEventListener('focus', app.refresh);
  setInterval(app.refresh, 60000);
}
