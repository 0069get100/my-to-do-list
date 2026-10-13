export const STORAGE_KEY = 'little-day.tasks.v1';
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function loadTasks(storage) {
  const raw = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(raw)) throw new Error('Invalid saved tasks');
  const ids = new Set();
  return raw.filter(t => {
    const valid = t && typeof t.id === 'string' && !ids.has(t.id) && typeof t.title === 'string' && t.title.trim().length > 0 && t.title.length <= 200 && ['normal', 'high', 'low'].includes(t.priority) && validDate(t.date) && typeof t.done === 'boolean' && Number.isFinite(t.created);
    if (valid) ids.add(t.id);
    return valid;
  });
}
export function stats(tasks, today) {
  const daily = tasks.filter(t => t.date === today);
  const done = tasks.filter(t => t.done).length;
  const todayDone = daily.filter(t => t.done).length;
  return { total: tasks.length, done, today: daily.length, todayDone, todayPending: daily.length - todayDone, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
}
export function selectTasks(tasks, { view = 'all', filter = 'all', sort = 'created', today }) {
  const ranks = { high: 0, normal: 1, low: 2 };
  return tasks.filter(t => (view !== 'today' || t.date === today) && (view !== 'completed' || t.done) && (filter !== 'pending' || !t.done) && (filter !== 'done' || t.done)).sort((a, b) => {
    if (sort === 'priority') return ranks[a.priority] - ranks[b.priority] || b.created - a.created;
    if (sort === 'date') return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || b.created - a.created;
    return b.created - a.created;
  });
}
