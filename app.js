document.querySelectorAll('style').forEach((style) => {
  style.textContent = style.textContent.replace(/^\+/gm, '');
});
for (const node of [...document.body.childNodes]) {
  if (node.nodeType === Node.TEXT_NODE) {
    node.textContent = node.textContent.replace(/^\s*\+\s*$/gm, '');
    if (!node.textContent.trim()) node.remove();
  }
}

const STORAGE_KEY = 'atelarch.projects.v1';
const emptyProject = {
  id: '', title: '', subtitle: '', description: '', tags: [], thumbnail: '', link: '',
  year: new Date().getFullYear(), medium: '', technologies: [], content: '', gallery: [],
  processShots: [], exhibition: [], collaborators: [], projectDetails: [], selected: false, published: false,
};

let projects = [];
let editingId = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value).replace(/[&<>\'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast${isError ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = 'toast hidden'; }, 3200);
}

function validate(data) {
  if (!Array.isArray(data)) return '資料必須是 projects 陣列。';
  const ids = new Set();
  for (const [index, project] of data.entries()) {
    if (!project || typeof project !== 'object') return `第 ${index + 1} 筆不是有效物件。`;
    if (!String(project.id || '').trim()) return `第 ${index + 1} 筆缺少作品 ID。`;
    if (ids.has(project.id)) return `作品 ID「${project.id}」重複。`;
    ids.add(project.id);
    if (!String(project.title || '').trim()) return `作品「${project.id}」缺少作品名稱。`;
    for (const field of ['tags', 'technologies', 'gallery', 'processShots', 'collaborators', 'projectDetails', 'exhibition']) {
      if (project[field] !== undefined && !Array.isArray(project[field])) return `作品「${project.id}」的 ${field} 必須是陣列。`;
    }
  }
  return '';
}

function normalize(data) {
  return data.map((project) => ({
    ...emptyProject,
    ...project,
    id: String(project.id),
    title: String(project.title),
    tags: Array.isArray(project.tags) ? project.tags : [],
    technologies: Array.isArray(project.technologies) ? project.technologies : [],
    gallery: Array.isArray(project.gallery) ? project.gallery : [],
  }));
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  const savedAt = new Date().toLocaleString('zh-Hant');
  localStorage.setItem('atelarch.lastSaved', savedAt);
  $('#save-state').textContent = `已保存 ${savedAt}`;
  $('#settings-status').textContent = `已保存 ${savedAt}，共 ${projects.length} 個作品。`;
}

function issueCount(project) {
  return (!project.description || project.description.length < 40 ? 1 : 0)
    + (!project.thumbnail ? 1 : 0)
    + (!project.tags?.length ? 1 : 0);
}

function projectRow(project) {
  const tags = (project.tags || []).slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const image = project.thumbnail
    ? `<img class="thumb" src="${escapeHtml(project.thumbnail)}" alt="${escapeHtml(project.title)}">`
    : '<div class="thumb thumb-empty">無圖片</div>';
  return `<article class="project-row">
    <div>${image}</div>
    <div><div class="project-title">${escapeHtml(project.title)}</div><div class="project-meta">${escapeHtml(String(project.year || '未設定'))} · ${escapeHtml(project.medium || '未設定類別')}</div></div>
    <div>${project.published === false ? '<span class="status draft">草稿</span>' : '<span class="status">已發布</span>'}</div>
    <div class="tags">${tags || '<span class="project-meta">尚無標籤</span>'}</div>
    <div class="row-actions"><button class="icon-button duplicate" data-action="duplicate" data-id="${escapeHtml(project.id)}" title="複製">⧉</button><button class="icon-button" data-action="edit" data-id="${escapeHtml(project.id)}" title="編輯">✎</button><button class="icon-button" data-action="delete" data-id="${escapeHtml(project.id)}" title="刪除">×</button></div>
  </article>`;
}

function recentCard(project) {
  const statusLabel = project.published === false ? 'Draft' : 'Published';
  const statusClass = project.published === false ? 'draft' : 'published';
  const image = project.thumbnail
    ? `<img class="recent-image" src="${escapeHtml(project.thumbnail)}" alt="${escapeHtml(project.title)}">`
    : '<div class="recent-image" style="display:grid;place-items:center;background:#e2e4e0;color:#7d7d7a;font-size:0.8rem;">No image</div>';

  return `
    <article class="recent-card">
      ${image}
      <div class="recent-meta">
        <div>
          <div class="recent-title">${escapeHtml(project.title)}</div>
          <div class="recent-sub">
            <span>${escapeHtml(String(project.year || ''))}</span>
            ${project.medium ? `<span>·</span><span>${escapeHtml(project.medium)}</span>` : ''}
          </div>
        </div>
        <span class="recent-status ${statusClass}">${statusLabel}</span>
      </div>
    </article>
  `;
}

function render() {
  const query = $('#global-search').value.trim().toLowerCase();
  const status = $('#status-filter').value;
  const featured = $('#featured-filter').value;
  const year = $('#year-filter').value;
  $('#stat-total').textContent = projects.length;
  $('#stat-published').textContent = projects.filter((project) => project.published !== false).length;
  $('#stat-featured').textContent = projects.filter((project) => project.selected).length;
  $('#stat-issues').textContent = projects.reduce((total, project) => total + issueCount(project), 0);
  const filtered = projects.filter((project) => {
    const text = `${project.title} ${project.description} ${(project.tags || []).join(' ')}`.toLowerCase();
    return (!query || text.includes(query))
      && (status === 'all' || (status === 'published' ? project.published !== false : project.published === false))
      && (featured === 'all' || (featured === 'featured' ? project.selected : !project.selected))
      && (year === 'all' || String(project.year) === year);
  });
  $('#project-list').innerHTML = filtered.length ? filtered.map(projectRow).join('') : '<div class="empty"><strong>找不到符合的作品</strong>試試其他搜尋字詞或篩選條件。</div>';
  $('#recent-list').innerHTML = projects.slice(0, 3).map(recentCard).join('') || '<div class="empty"><strong>還沒有作品</strong>按下「新增作品」開始建立你的作品集。</div>';
  $('#results-label').textContent = `${filtered.length} / ${projects.length} 個作品`;
  const years = [...new Set(projects.map((project) => project.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  $('#year-filter').innerHTML = '<option value="all">全部年份</option>' + years.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  $('#year-filter').value = years.some((value) => String(value) === year) ? year : 'all';
}

function openEditor(id = null) {
  editingId = id;
  const project = id ? projects.find((item) => item.id === id) : { ...emptyProject, id: `project-${Date.now()}` };
  if (!project) return;
  $('#dialog-title').textContent = id ? '編輯作品' : '新增作品';
  for (const field of ['id', 'title', 'subtitle', 'year', 'description', 'medium', 'link', 'thumbnail', 'content']) $(`#field-${field}`).value = project[field] ?? '';
  $('#field-tags').value = (project.tags || []).join(', ');
  $('#field-technologies').value = (project.technologies || []).join(', ');
  $('#field-published').checked = project.published !== false;
  $('#field-selected').checked = Boolean(project.selected);
  $('#project-dialog').showModal();
}

function formProject() {
  const value = (field) => $(`#field-${field}`).value.trim();
  return {
    ...emptyProject, id: value('id'), title: value('title'), subtitle: value('subtitle'), year: Number(value('year')) || '',
    description: value('description'), medium: value('medium'), link: value('link') || `/projects/${value('id')}`, thumbnail: value('thumbnail'),
    tags: value('tags').split(',').map((item) => item.trim()).filter(Boolean),
    technologies: value('technologies').split(',').map((item) => item.trim()).filter(Boolean),
    content: value('content'), published: $('#field-published').checked, selected: $('#field-selected').checked,
  };
}

function downloadJson() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' }));
  link.download = 'projects.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('JSON 已下載。');
}

function switchView(view) {
  $$('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#view-label').textContent = view === 'overview' ? '總覽' : view === 'projects' ? '作品' : '設定';
  ['overview', 'projects', 'settings'].forEach((name) => $(`#${name}-view`).classList.toggle('hidden', name !== view));
}

async function loadInitial() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      const data = JSON.parse(local);
      if (!validate(data)) { projects = normalize(data); render(); return; }
    } catch { /* Load from backend when local data is malformed. */ }
  }
  try {
    const response = await fetch('/api/projects');
    const data = await response.json();
    if (!response.ok || validate(data)) throw new Error();
    projects = normalize(data);
    saveLocal();
    render();
    showToast('已從本機 backend 載入作品。');
  } catch {
    projects = [];
    render();
    showToast('目前沒有作品，請匯入 JSON 或新增第一個作品。');
  }
}

$('#project-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const next = formProject();
  const error = validate([next]);
  if (error) { showToast(error, true); return; }
  const wasEditing = Boolean(editingId);
  projects = wasEditing ? projects.map((project) => project.id === editingId ? next : project) : [next, ...projects];
  saveLocal(); render(); $('#project-dialog').close(); editingId = null;
  showToast(wasEditing ? '作品已更新。' : '作品已新增。');
});

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const project = projects.find((item) => item.id === action.dataset.id);
    if (action.dataset.action === 'edit') openEditor(action.dataset.id);
    if (action.dataset.action === 'duplicate' && project) {
      let id = `${project.id}-copy`; let number = 2;
      while (projects.some((item) => item.id === id)) id = `${project.id}-copy-${number++}`;
      projects = [{ ...project, id, title: `${project.title} 副本`, published: false, selected: false }, ...projects];
      saveLocal(); render(); showToast('已複製作品，副本目前為草稿。');
    }
    if (action.dataset.action === 'delete' && project && confirm(`確定要刪除「${project.title}」嗎？`)) {
      projects = projects.filter((item) => item.id !== project.id); saveLocal(); render(); showToast('作品已刪除。');
    }
  }
  if (event.target.closest('[data-close]')) $('#project-dialog').close();
});

$$('.nav button').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#overview-projects').addEventListener('click', () => switchView('projects'));
$('#overview-add').addEventListener('click', () => openEditor());
$('#projects-add').addEventListener('click', () => openEditor());
$('#global-search').addEventListener('input', render);
['status-filter', 'featured-filter', 'year-filter'].forEach((id) => $(`#${id}`).addEventListener('change', render));
$('#export-button').addEventListener('click', downloadJson);
$('#settings-export').addEventListener('click', downloadJson);
$('#settings-import').addEventListener('click', () => $('#import-input').click());
$('#reset-button').addEventListener('click', () => {
  if (confirm('確定要清除瀏覽器中的本地資料嗎？')) { localStorage.removeItem(STORAGE_KEY); projects = []; render(); showToast('本地資料已清除。'); }
});
$('#import-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const error = validate(data);
    if (error) throw new Error(error);
    projects = normalize(data); saveLocal(); render(); showToast(`已匯入 ${projects.length} 個作品（${file.name}）。`);
  } catch (error) { showToast(`匯入失敗：${error.message}`, true); }
  event.target.value = '';
});

loadInitial();
