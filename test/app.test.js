import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initApp } from '../src/app.js';
import { localDate, stats, selectTasks, STORAGE_KEY, loadTasks, validDate } from '../src/tasks.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
test('preview resources resolve inside the page directory, including nested preview URLs', () => {
  for (const base of ['http://localhost:3000/', 'http://localhost:3000/index.html', 'https://preview.example/preview/my-to-do-list/index.html']) {
    const dom = new JSDOM(html, { url: base });
    const doc = dom.window.document;
    assert.equal(doc.querySelector('link[rel="stylesheet"]').href, new URL('./src/styles.css', base).href);
    assert.equal(doc.querySelector('script[type="module"]').src, new URL('./src/app.js', base).href);
    assert.equal(doc.querySelector('.brand').href, new URL('./index.html', base).href);
    dom.window.close();
  }
});
function setup(storage) {
  const dom = new JSDOM(html, { url: 'http://localhost' });
  const doc = dom.window.document;
  storage ||= dom.window.localStorage;
  initApp(doc, storage);
  const $ = selector => doc.querySelector(selector);
  const add = (title, priority = 'normal', date = '') => {
    $('#task-title').value = title; $('#task-priority').value = priority; $('#task-date').value = date;
    $('#task-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  };
  return { dom, doc, $, add, storage };
}

test('add, complete, restore and delete tasks; update today stats and progress', () => {
  const { $, add, storage, dom } = setup();
  add('完成阅读', 'high', localDate());
  add('整理书架', 'low', '');
  assert.equal($('#task-list').children.length, 2);
  assert.equal($('#stat-today').textContent, '1');
  assert.equal($('#stat-pending').textContent, '1');
  const todayRow = [...$('#task-list').children].find(row => row.textContent.includes('完成阅读'));
  assert.match(todayRow.textContent, /高优先级/);
  todayRow.querySelector('input').click();
  assert.equal($('#stat-done').textContent, '1');
  assert.equal($('#stat-pending').textContent, '0');
  assert.equal($('#progress-percent').textContent, '50%');
  const restored = setup(storage);
  assert.equal(restored.$('#task-list').children.length, 2);
  assert.equal(restored.$('.task-check:checked').getAttribute('aria-label'), '完成任务：完成阅读');
  restored.$('.task-check:checked').click();
  assert.equal(restored.$('#progress-percent').textContent, '0%');
  restored.$('.delete-button').click();
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 1);
  dom.window.close(); restored.dom.window.close();
});

test('view and completion filters show correct tasks and empty states', () => {
  const { $, add, dom } = setup();
  add('今天任务', 'normal', localDate()); add('没有日期');
  $('[data-view="today"]').click();
  assert.equal($('#task-list').children.length, 1);
  assert.match($('#task-list').textContent, /今天任务/);
  $('.task-check').click();
  $('[data-filter="pending"]').click();
  assert.equal($('#task-list').children.length, 0);
  assert.equal($('#empty-state').hidden, false);
  $('[data-view="completed"]').click();
  assert.equal($('#task-list').children.length, 1);
  assert.equal($('#visible-count').textContent, '1');
  dom.window.close();
});

test('whitespace rejected and user text rendered safely', () => {
  const { $, add, dom } = setup();
  add('   '); assert.equal($('#task-list').children.length, 0);
  add('<img src=x onerror=alert(1)>');
  assert.equal($('#task-list img'), null);
  assert.equal($('.task-name').textContent, '<img src=x onerror=alert(1)>');
  dom.window.close();
});

test('corrupted or unavailable storage does not prevent use and reports failed saving', () => {
  const storage = { getItem: () => '{invalid', setItem: () => { throw new Error('denied'); } };
  const { $, add, dom } = setup(storage);
  assert.match($('#feedback').textContent, /无法读取/);
  add('仍然可以添加');
  assert.equal($('#task-list').children.length, 1);
  assert.match($('#feedback').textContent, /保存失败/);
  dom.window.close();
});

test('priority/date sorting and today totals use deadline, including completed tasks', () => {
  const today = '2026-10-13';
  const tasks = [
    { title: '无日期', priority: 'low', date: '', done: false, created: 3 },
    { title: '今天', priority: 'high', date: today, done: true, created: 1 },
    { title: '过去', priority: 'normal', date: '2026-10-12', done: false, created: 2 }
  ];
  assert.deepEqual(selectTasks(tasks, { sort: 'priority', today }).map(t => t.title), ['今天', '过去', '无日期']);
  assert.deepEqual(selectTasks(tasks, { sort: 'date', today }).map(t => t.title), ['过去', '今天', '无日期']);
  assert.deepEqual(stats(tasks, today), { total: 3, done: 1, today: 1, todayDone: 1, todayPending: 0, percent: 33 });
  assert.equal(stats([], today).percent, 0);
});

test('stored schema rejects broken dates, duplicates and invalid records', () => {
  const task = { id: '1', title: '有效任务', priority: 'normal', date: '2026-10-13', done: false, created: 1 };
  const tasks = loadTasks({ getItem: () => JSON.stringify([task, task, { ...task, id: '2', date: '2026-02-30' }, { ...task, id: '3', done: 'false' }]) });
  assert.equal(tasks.length, 1);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(localDate(new Date(2026, 9, 13, 0, 1)), '2026-10-13');
});
