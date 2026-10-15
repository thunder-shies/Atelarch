import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

type Project = {
  id: string; title: string; subtitle?: string; description?: string; tags: string[];
  thumbnail?: string; link?: string; year?: string | number; medium?: string;
  size?: string; collaborators: string[]; technologies: string[]; content?: string;
  details: string[]; process?: string; technicalChallenges?: string;
  gallery: { type: string; url: string }[]; processShots: string[]; exhibition: string[];
  selected: boolean; published: boolean;
};
type View = 'overview' | 'works' | 'alerts' | 'settings';
type ProjectField = keyof Project;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const STORAGE_KEY = 'atelarch.projects.v1';
const emptyProject: Project = {
  id: '', title: '', subtitle: '', description: '', tags: [], thumbnail: '', link: '',
  year: new Date().getFullYear(), medium: '', size: '', collaborators: [], technologies: [], content: '',
  details: [], process: '', technicalChallenges: '', gallery: [], processShots: [], exhibition: [],
  selected: false, published: true,
};
const seedProjects: Project[] = [
  { ...emptyProject, id: 'untitled-03', title: 'Untitled Study No. 03', description: 'A quiet study exploring material memory, light, and archive fragments through a visual diary.', year: 2026, medium: 'Photography', tags: ['Research', 'Archive'], technologies: ['Camera'], thumbnail: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80', published: true },
  { ...emptyProject, id: 'soft-structures', title: 'Soft Structures', description: 'A responsive installation grounded in softness, tension, and light movement through built forms.', year: 2025, medium: 'Installation', tags: ['Installation', 'Selected'], technologies: ['TouchDesigner'], thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', selected: true, published: true },
  { ...emptyProject, id: 'fragments-memory', title: 'Fragments of Memory', description: 'A layered exploration of loss, atmosphere, and emotional residue through collage and image drift.', year: 2026, medium: 'Mixed Media', tags: ['Collage'], technologies: ['Photoshop'], thumbnail: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80', published: false },
];

const palettes = [
  { tab: '#7C5CFF', body: '#F4F1FF', ink: '#1A1A1A', accent: '#7C5CFF' },
  { tab: '#FF8A3D', body: '#FFF4EA', ink: '#1A1A1A', accent: '#FF8A3D' },
  { tab: '#2FD3C5', body: '#E8FFFB', ink: '#1A1A1A', accent: '#12B3A8' },
  { tab: '#FF5D8F', body: '#FFF0F5', ink: '#1A1A1A', accent: '#FF5D8F' },
  { tab: '#F5C518', body: '#FFF8DC', ink: '#1A1A1A', accent: '#E0AE00' },
  { tab: '#5B8CFF', body: '#EEF3FF', ink: '#1A1A1A', accent: '#5B8CFF' },
];
// Normalize imported and backend data so every editor field has a predictable value.
const normalize = (value: unknown): Project => {
  const source = isRecord(value) ? value : {};
  return {
    ...emptyProject,
    ...source,
    id: String(source.id ?? '').trim(),
    title: String(source.title ?? '').trim(),
    tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
    collaborators: Array.isArray(source.collaborators) ? source.collaborators.map(String) : [],
    technologies: Array.isArray(source.technologies) ? source.technologies.map(String) : [],
    details: Array.isArray(source.details) ? source.details.map(String) : [],
    gallery: Array.isArray(source.gallery)
      ? source.gallery
        .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.url === 'string')
        .map((item) => ({ type: String(item.type || 'photo'), url: String(item.url) }))
      : [],
    processShots: Array.isArray(source.processShots) ? source.processShots.map(String) : [],
    exhibition: Array.isArray(source.exhibition) ? source.exhibition.map(String) : [],
    published: source.published !== false,
    selected: Boolean(source.selected),
  };
};

function validate(value: unknown): string | null {
  if (!Array.isArray(value)) return 'The JSON root must be an array of projects.';
  const ids = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const project = normalize(raw);
    const source = isRecord(raw) ? raw : {};
    if (!project.id) return `Project ${index + 1} is missing an id.`;
    if (ids.has(project.id)) return `Project id "${project.id}" is duplicated.`;
    if (!project.title) return `Project "${project.id}" is missing a title.`;
    for (const field of ['tags', 'collaborators', 'technologies', 'details', 'gallery', 'processShots', 'exhibition']) {
      if (source[field] !== undefined && !Array.isArray(source[field])) {
        return `Project "${project.id}" ${field} must be an array.`;
      }
    }
    ids.add(project.id);
  }
  return null;
}

const splitTags = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const splitLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const formatGallery = (gallery: Project['gallery']) => gallery.map((item) => `${item.type} | ${item.url}`).join('\n');
const parseGallery = (value: string) => splitLines(value).map((item) => {
  const separator = item.indexOf('|');
  return separator === -1
    ? { type: 'photo', url: item }
    : { type: item.slice(0, separator).trim() || 'photo', url: item.slice(separator + 1).trim() };
}).filter((item) => item.url);
const needsAttention = (project: Project) => !project.description || project.description.length < 40 || !project.thumbnail;

// Validation is intentionally strict about identity and required text, but tolerant of
// optional fields because normalize() supplies the editor's defaults for those fields.
function IconCamera() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3v10H4z" /><circle cx="12" cy="13.2" r="3.1" /></svg>;
}
function IconSettings() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.8 13.4 5l1.9-.2.8-1.1 2.1 1.2-.2 1.4 1.2 1.5 1.4.2v2.4l-1.4.4-1.2 1.5.2 1.4-2.1 1.2-.9-1.1-1.8-.2L12 19l-1.4-1.2-1.9.2-.8 1.1-2.1-1.2.2-1.4-1.2-1.5-1.4-.2v-2.4l1.4-.4 1.2-1.5-.2-1.4 2.1-1.2.9 1.1 1.8.2Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16.2 16.2 20 20" /></svg>;
}
function IconFolderPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 19V7.5A1.5 1.5 0 0 1 5 6h5l2 2.5h7a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" /><path d="M12 11.5v6M9 14.5h6" /></svg>;
}
function IconClipboard() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 10h6M9 14h4" /></svg>;
}
function IconProgress() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
}
function IconCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.3 2.3 4.7-5" /></svg>;
}
function IconAlert() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 8 15H4Z" /><path d="M12 9v4M12 16h.01" /></svg>;
}
function IconArrow({ direction }: { direction: 'left' | 'right' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {direction === 'left'
      ? <path d="M6 12H18M6 12L11 7M6 12L11 17" />
      : <path d="M6 12H18M18 12L13 7M18 12L13 17" />}
  </svg>;
}
function IconBell() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.2 1.8H4.8Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>;
}
function IconList() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" /></svg>;
}
function IconLogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" /><path d="M4 12h10M7 9l-3 3 3 3" /></svg>;
}

function Dropdown({ value, options, onChange, className = '' }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={selectRef} className={`custom-select ${className} ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); setOpen((currentOpen) => !currentOpen); }}
      >
        {current.label}
        <svg className="custom-select-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.70711 9.71069C5.31658 10.1012 5.31658 10.7344 5.70711 11.1249L10.5993 16.0123C11.3805 16.7927 12.6463 16.7924 13.4271 16.0117L18.3174 11.1213C18.708 10.7308 18.708 10.0976 18.3174 9.70708C17.9269 9.31655 17.2937 9.31655 16.9032 9.70708L12.7176 13.8927C12.3271 14.2833 11.6939 14.2832 11.3034 13.8927L7.12132 9.71069C6.7308 9.32016 6.09763 9.32016 5.70711 9.71069Z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'selected' : ''}
              key={option.value}
              onClick={(event) => {
                event.stopPropagation();
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>('works');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState('all');
  const [year, setYear] = useState('all');
  const [medium, setMedium] = useState('all');
  const [layout, setLayout] = useState<'list' | 'cards'>('list');
  const [checked, setChecked] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toast, setToast] = useState('');
  const [savedAt, setSavedAt] = useState('Not saved yet');
  const [scope, setScope] = useState<'all' | 'team'>('all');
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageSize = 6;

  // All edits use this path so React state, localStorage, and the save indicator stay in sync.
  const save = (next: Project[], message?: string) => {
    setProjects(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedAt(new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
    if (message) setToast(message);
  };

  useEffect(() => {
    // Restore a valid local backup first; otherwise hydrate from the backend, then use seeds offline.
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const data = JSON.parse(local);
        if (!validate(data)) { setProjects(data.map(normalize)); setSavedAt('Restored locally'); return; }
      } catch { /* Use backend data when local data is malformed. */ }
    }
    fetch('/api/projects')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (validate(data)) throw new Error(); save(data.map(normalize)); })
      .catch(() => save(seedProjects));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => { setPage(1); }, [query, status, selected, year, medium, view]);
  useEffect(() => {
    const ids = new Set(projects.map((project) => project.id));
    setChecked((current) => current.filter((id) => ids.has(id)));
  }, [projects]);

  const scoped = useMemo(() => (
    scope === 'team' ? projects.filter((project) => project.selected) : projects
  ), [projects, scope]);

  const filtered = useMemo(() => scoped.filter((project) => {
    const text = `${project.title} ${project.description ?? ''} ${project.tags.join(' ')} ${project.id}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (status === 'all' || (status === 'published' ? project.published : !project.published))
      && (selected === 'all' || (selected === 'selected' ? project.selected : !project.selected))
      && (year === 'all' || String(project.year) === year)
      && (medium === 'all' || (project.medium || 'Archive') === medium);
  }), [scoped, query, status, selected, year, medium]);

  const alertItems = filtered.filter(needsAttention);
  const years = [...new Set(projects.map((project) => String(project.year)).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const mediums = [...new Set(projects.map((project) => project.medium || 'Archive'))];
  const issueCount = projects.filter(needsAttention).length;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const alertPages = Math.max(1, Math.ceil(alertItems.length / pageSize));
  const alertPaged = alertItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const maxPage = view === 'alerts' ? alertPages : pages;
    setPage((current) => Math.min(current, maxPage));
  }, [alertPages, pages, view]);

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const error = validate(data);
      if (error) throw new Error(error);
      save(data.map(normalize), `Imported ${data.length} works.`);
    } catch (error) { setToast(error instanceof Error ? error.message : 'Import failed.'); }
    event.target.value = '';
  };
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'portfolio.json'; link.click(); URL.revokeObjectURL(url); setToast('Portfolio JSON exported.');
  };
  const openNew = () => setEditing({ ...emptyProject, id: `project-${Date.now()}` });
  const duplicate = (project: Project) => {
    let id = `${project.id}-copy`; let count = 2;
    while (projects.some((item) => item.id === id)) id = `${project.id}-copy-${count++}`;
    save([{ ...project, id, title: `${project.title} Copy`, published: false, selected: false }, ...projects], 'Project duplicated as a draft.');
    setMenuFor(null);
  };
  const remove = (project: Project) => { if (window.confirm(`Delete "${project.title}"?`)) save(projects.filter((item) => item.id !== project.id), 'Project deleted.'); setMenuFor(null); };
  const update = (event: React.FormEvent) => {
    event.preventDefault(); if (!editing) return;
    const originalId = editing.id;
    const project = { ...editing, id: editing.id.trim(), title: editing.title.trim(), link: editing.link?.trim() || `/projects/${editing.id.trim()}` };
    const error = validate([project]);
    if (error) { setToast(error); return; }
    const previousProject = projects.find((item) => item.id === originalId);
    const duplicateId = projects.some((item) => item.id === project.id && item.id !== previousProject?.id);
    if (duplicateId) { setToast(`Project id "${project.id}" is already in use.`); return; }
    const exists = Boolean(previousProject);
    save(exists ? projects.map((item) => item.id === originalId ? project : item) : [project, ...projects], exists ? 'Project updated.' : 'Project added.');
    setEditing(null);
  };
  const change = (key: ProjectField, value: Project[ProjectField]) => setEditing((current) => current ? { ...current, [key]: value } : null);
  const setStatusQuick = (project: Project, published: boolean) => save(projects.map((item) => item.id === project.id ? { ...item, published } : item), published ? 'Marked published.' : 'Moved to draft.');
  const toggleChecked = (id: string) => setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = (items: Project[]) => {
    const pageIds = new Set(items.map((project) => project.id));
    const pageIsChecked = items.length > 0 && items.every((project) => checked.includes(project.id));
    setChecked((current) => pageIsChecked
      ? current.filter((id) => !pageIds.has(id))
      : [...current, ...items.filter((project) => !current.includes(project.id)).map((project) => project.id)]);
  };
  const stats = [['Total works', projects.length], ['Published', projects.filter((project) => project.published).length], ['Selected', projects.filter((project) => project.selected).length], ['Need attention', issueCount]];
  const nav: { key: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview', label: 'Collections', icon: <IconCamera /> },
    { key: 'works', label: 'Works', icon: <IconList /> },
    { key: 'alerts', label: 'Alert', icon: <IconBell />, badge: issueCount },
    { key: 'settings', label: 'Settings', icon: <IconSettings /> },
  ];

  return <div className="app-shell" onClick={() => setMenuFor(null)}>
    <div className="dash-window">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-label="Atelarch logo">
            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
              <path d="M26.375 14.833c1.548-0.494 3.096-1.594 4.644-3.19-1.549-1.624-3.063-2.424-4.644-2.725v-2.263h-18.874v1.643h-6.355c1.146 3.109 3.659 5.252 6.355 5.985v2.68h4.97c-0.863 2.931-2.652 5.337-4.839 7.419h-1.878v1.644c-0.008 0.007-0.016 0.013-0.024 0.020h0.024v2.223h23.505v-3.886h-2.499c-2.444-2.080-4.177-4.484-4.984-7.419h4.599v-2.131z" />
            </svg>
          </span>
          <div>
            <div className="brand">Atelarch</div>
            <div className="brand-sub">Make. Keep. Evolve.</div>
          </div>
        </div>
        <nav className="nav-list">
          {nav.map((item) => (
            <button key={item.key} className={`nav-button ${view === item.key ? 'active' : ''}`} onClick={() => setView(item.key)}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <button className="nav-button logout" onClick={exportJson}><span className="nav-icon"><IconLogout /></span>Export archive</button>
      </aside>
      <section className="dash-main">
        <header className="dash-top">
          <label className="search-pill">
            <IconSearch />
            <input value={query} onChange={(event) => { setQuery(event.target.value); if (view !== 'works') setView('works'); }} placeholder="Search" />
          </label>
          <button className="icon-btn yellow" onClick={openNew} aria-label="Add work"><IconFolderPlus /></button>
        </header>
        <div className="dash-body">
          {view === 'overview' && <Overview scoped={scoped} stats={stats} openNew={openNew} setView={setView} scope={scope} setScope={setScope} setYear={setYear} setEditing={setEditing} />}
          {view === 'works' && <Works filtered={filtered} paged={paged} query={query} status={status} setStatus={setStatus} selected={selected} setSelected={setSelected} year={year} setYear={setYear} years={years} medium={medium} setMedium={setMedium} mediums={mediums} layout={layout} setLayout={setLayout} openNew={openNew} duplicate={duplicate} remove={remove} setEditing={setEditing} checked={checked} toggleChecked={toggleChecked} toggleAll={() => toggleAll(paged)} menuFor={menuFor} setMenuFor={setMenuFor} setStatusQuick={setStatusQuick} page={page} pages={pages} setPage={setPage} />}
          {view === 'alerts' && <Works filtered={alertItems} paged={alertPaged} query={query} status={status} setStatus={setStatus} selected={selected} setSelected={setSelected} year={year} setYear={setYear} years={years} medium={medium} setMedium={setMedium} mediums={mediums} layout={layout} setLayout={setLayout} openNew={openNew} duplicate={duplicate} remove={remove} setEditing={setEditing} checked={checked} toggleChecked={toggleChecked} toggleAll={() => toggleAll(alertPaged)} menuFor={menuFor} setMenuFor={setMenuFor} setStatusQuick={setStatusQuick} page={page} pages={alertPages} setPage={setPage} alerts />}
          {view === 'settings' && <Settings savedAt={savedAt} count={projects.length} importFile={importFile} fileRef={fileRef} exportJson={exportJson} reset={() => { if (window.confirm('Reset local portfolio data?')) save(seedProjects, 'Local data reset.'); }} />}
        </div>
      </section>
    </div>
    {editing && <Editor project={editing} projects={projects} change={change} update={update} close={() => setEditing(null)} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function FolderCard({
  title, meta, count, palette, featured, onClick,
}: {
  title: string; meta?: string; count?: string; palette: typeof palettes[number]; featured?: boolean; onClick?: () => void;
}) {
  return (
    <button className={`folder-card ${featured ? 'featured' : ''}`} onClick={onClick} style={{ '--folder-color': palette.tab, '--body': palette.body, '--ink': palette.ink, '--accent': palette.accent } as React.CSSProperties}>
      <span className="folder-tab" aria-hidden="true" />
      <span className="folder-peek" aria-hidden="true" />
      <span className="folder-body">
        <span className="folder-top">
          <span className="folder-copy">
            <strong>{title}</strong>
            {count && <em>{count}</em>}
          </span>
        </span>
        {meta && <span className="folder-footer">{meta}</span>}
      </span>
    </button>
  );
}

function Overview({ scoped, stats, openNew, setView, scope, setScope, setYear, setEditing }: any) {
  const selectedWorks = scoped.filter((project: Project) => project.selected);
  const yearGroups = [...new Set<string>(scoped.map((project: Project) => String(project.year || 'Undated')))]
    .sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return Number(b) - Number(a);
    });

  return (
    <div className="view-section">
      <div className="section-row">
        <h1 className="page-title">Collections</h1>
        <div className="segment">
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All</button>
          <button className={scope === 'team' ? 'on' : ''} onClick={() => setScope('team')}>Selected</button>
        </div>
      </div>
      <div className="mini-stats">
        {stats.map(([label, value]: [string, number]) => (
          <div className={`mini-stat ${label.toLowerCase().replace(/\s+/g, '-')}`} key={label}>
            <span className="mini-stat-icon" aria-hidden="true">
              {label === 'Total works' && <IconClipboard />}
              {label === 'Published' && <IconProgress />}
              {label === 'Selected' && <IconCheck />}
              {label === 'Need attention' && <IconAlert />}
            </span>
            <span className="mini-stat-copy">
              <span>{label}</span>
              <strong>{value}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="folder-grid">
        <FolderCard title="Selected Works" count={`${selectedWorks.length} links`} palette={palettes[3]} onClick={() => setView('works')} />
        {yearGroups.map((year: string, index: number) => {
          const group = scoped.filter((project: Project) => String(project.year || 'Undated') === year);
          return (
            <FolderCard
              key={year}
              title={year}
              count={`${group.length} links`}
              palette={palettes[index % palettes.length]}
              onClick={() => { setYear(year); setView('works'); }}
            />
          );
        })}
      </div>
    </div>
  );
}

function StatusSelect({
  project,
  onChange,
}: {
  project: Project;
  onChange: (published: boolean) => void;
}) {
  return (
    <Dropdown
      value={project.published ? 'live' : 'draft'}
      options={[
        { value: 'live', label: 'Published' },
        { value: 'draft', label: 'Draft' },
      ]}
      onChange={(value) => onChange(value === 'live')}
      className={`status-select ${project.published ? 'live' : 'draft'}`}
    />
  );
}

function Works(props: any) {
  const rows: Project[] = props.paged;
  const allChecked = rows.length > 0 && rows.every((project: Project) => props.checked.includes(project.id));
  return (
    <div className="view-section works-view">
      <div className="page-heading">
        <h1 className="page-title">{props.alerts ? 'Alert' : 'Works'}</h1>
        <div className="heading-tools">
          {!props.alerts && <>
            <div className="filter-group">
              <Dropdown value={props.medium} options={[{ value: 'all', label: 'Type' }, ...props.mediums.map((item: string) => ({ value: item, label: item }))]} onChange={props.setMedium} />
              <Dropdown value={props.year} options={[{ value: 'all', label: 'Year' }, ...props.years.map((item: string) => ({ value: item, label: item }))]} onChange={props.setYear} />
              <Dropdown value={props.selected} options={[{ value: 'all', label: 'Reason' }, { value: 'selected', label: 'Selected' }, { value: 'regular', label: 'Regular' }]} onChange={props.setSelected} />
              <Dropdown value={props.status} options={[{ value: 'all', label: 'Status' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }]} onChange={props.setStatus} />
            </div>
          </>}
          <div className="segment">
            <button className={props.layout === 'list' ? 'on' : ''} onClick={() => props.setLayout('list')}>List</button>
            <button className={props.layout === 'cards' ? 'on' : ''} onClick={() => props.setLayout('cards')}>Cards</button>
          </div>
        </div>
      </div>

      {props.layout === 'list' ? (
        <div className="table-wrap">
          <div className="table-head">
            <label className="check"><input type="checkbox" checked={allChecked} onChange={props.toggleAll} /></label>
            <span>ID</span><span>Title</span><span>Type</span><span>Year</span><span>Tags</span><span>Status</span><span></span>
          </div>
          {rows.map((project: Project, index: number) => (
            <article className={`table-row ${props.menuFor === project.id ? 'menu-open' : ''}`} key={project.id} style={{ '--tab': palettes[index % palettes.length].tab } as React.CSSProperties}>
              <label className="check"><input type="checkbox" checked={props.checked.includes(project.id)} onChange={() => props.toggleChecked(project.id)} /></label>
              <strong className="mono-id">{project.id.slice(0, 8)}</strong>
              <button className="linkish" onClick={() => props.setEditing({ ...project })}>{project.title}</button>
              <span className="type-link">{project.medium || 'Archive'}</span>
              <span>{project.year}</span>
              <span className="reason">{project.tags.join(', ') || (needsAttention(project) ? 'Needs review' : '—')}</span>
              <StatusSelect project={project} onChange={(published) => props.setStatusQuick(project, published)} />
              <div className="row-menu">
                <button className="dots" onClick={(event) => { event.stopPropagation(); props.setMenuFor(props.menuFor === project.id ? null : project.id); }}>⋯</button>
                {props.menuFor === project.id && (
                  <div className="menu-pop" onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => props.setEditing({ ...project })}>Edit</button>
                    <button onClick={() => props.duplicate(project)}>Duplicate</button>
                    <button className="danger" onClick={() => props.remove(project)}>Delete</button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!rows.length && <div className="empty-state">No works match the current filters.</div>}
        </div>
      ) : (
        <div className="folder-grid">
          {rows.map((project: Project, index: number) => (
            <article
              className={`work-folder ${project.thumbnail ? 'has-thumbnail' : ''}`}
              key={project.id}
              style={{
                '--folder-color': palettes[index % palettes.length].tab,
                '--folder-thumbnail': project.thumbnail ? `url("${project.thumbnail}")` : 'none'
              } as React.CSSProperties}
            >
              <span className="folder-tab" aria-hidden="true" />
              <span className="folder-peek" aria-hidden="true" />
              <div className="folder-body work-folder-body">
                <div className="work-copy">
                  <h3>{project.title}</h3>
                  <p>{project.year} · {project.medium || 'Portfolio work'}</p>
                </div>
                <div className="work-actions">
                  <button className="chip-btn" onClick={() => props.setEditing({ ...project })}>Edit</button>
                  <button className="chip-btn danger" onClick={() => props.remove(project)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
          {!rows.length && <div className="empty-state">No works match the current filters.</div>}
        </div>
      )}

      <div className="pager">
        <button aria-label="Previous page" title="Previous page" disabled={props.page <= 1} onClick={() => props.setPage(props.page - 1)}>
          <IconArrow direction="left" />
        </button>
        {Array.from({ length: props.pages }, (_, index) => index + 1).map((item) => (
          <button key={item} className={item === props.page ? 'on' : ''} onClick={() => props.setPage(item)}>{item}</button>
        ))}
        <button aria-label="Next page" title="Next page" disabled={props.page >= props.pages} onClick={() => props.setPage(props.page + 1)}>
          <IconArrow direction="right" />
        </button>
      </div>
    </div>
  );
}

function Settings({ savedAt, count, importFile, fileRef, exportJson, reset }: any) {
  return (
    <div className="view-section">
      <h1 className="page-title">Settings</h1>
      <p className="lede">Import, export, and reset the local archive without leaving this studio.</p>
      <div className="folder-grid settings-grid">
        <FolderCard title="Import JSON" meta="Bring a backup in" palette={palettes[5]} onClick={() => fileRef.current?.click()} />
        <FolderCard title="Export JSON" meta="Download a backup" palette={palettes[4]} onClick={exportJson} />
        <FolderCard title="Reset data" meta="Restore sample works" palette={palettes[3]} onClick={reset} />
        <FolderCard title={savedAt} meta={`${count} works stored locally`} palette={palettes[2]} />
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
    </div>
  );
}

function Editor({ project, projects, change, update, close }: any) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={update}>
          <div className="modal-header">
            <div>
              <p className="kicker">{projects.some((item: Project) => item.id === project.id) ? 'Edit collection' : 'New collection'}</p>
              <h2>{projects.some((item: Project) => item.id === project.id) ? 'Edit project' : 'Add project'}</h2>
            </div>
            <button type="button" className="icon-btn white close-x" onClick={close}>×</button>
          </div>
          <div className="modal-body">
            <div className="field-grid">
              <label>Project ID<input value={project.id} onChange={(event) => change('id', event.target.value)} /></label>
              <label>Title<input value={project.title} onChange={(event) => change('title', event.target.value)} /></label>
              <label>Subtitle<input value={project.subtitle} onChange={(event) => change('subtitle', event.target.value)} /></label>
              <label>Year<input type="number" value={String(project.year ?? '')} onChange={(event) => change('year', event.target.value)} /></label>
              <label className="full-width">Description<textarea value={project.description} onChange={(event) => change('description', event.target.value)} /></label>
              <label>Medium<input value={project.medium} onChange={(event) => change('medium', event.target.value)} /></label>
              <label>Size<input value={project.size ?? ''} onChange={(event) => change('size', event.target.value)} /></label>
              <label>Project link<input value={project.link} onChange={(event) => change('link', event.target.value)} /></label>
              <label className="full-width">Thumbnail URL<input value={project.thumbnail} onChange={(event) => change('thumbnail', event.target.value)} /></label>
              <label>Tags<input value={project.tags.join(', ')} onChange={(event) => change('tags', splitTags(event.target.value))} /></label>
              <label>Technologies<input value={project.technologies.join(', ')} onChange={(event) => change('technologies', splitTags(event.target.value))} /></label>
              <label>Collaborators<textarea value={project.collaborators.join('\n')} onChange={(event) => change('collaborators', splitLines(event.target.value))} /></label>
              <label>Exhibitions<textarea value={project.exhibition.join('\n')} onChange={(event) => change('exhibition', splitLines(event.target.value))} /></label>
              <label className="full-width">Details<textarea value={project.details.join('\n')} onChange={(event) => change('details', splitLines(event.target.value))} /></label>
              <label className="full-width">Content<textarea value={project.content} onChange={(event) => change('content', event.target.value)} /></label>
              <label className="full-width">Process<textarea value={project.process ?? ''} onChange={(event) => change('process', event.target.value)} /></label>
              <label className="full-width">Technical challenges<textarea value={project.technicalChallenges ?? ''} onChange={(event) => change('technicalChallenges', event.target.value)} /></label>
              <label className="full-width">Gallery <span className="field-help">One item per line: type | URL</span><textarea value={formatGallery(project.gallery)} onChange={(event) => change('gallery', parseGallery(event.target.value))} /></label>
              <label className="full-width">Process shots<textarea value={project.processShots.join('\n')} onChange={(event) => change('processShots', splitLines(event.target.value))} /></label>
              <div className="checkbox-row full-width">
                <label className="check-item"><input type="checkbox" checked={project.published} onChange={(event) => change('published', event.target.checked)} /> Published</label>
                <label className="check-item"><input type="checkbox" checked={project.selected} onChange={(event) => change('selected', event.target.checked)} /> Selected work</label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="chip-btn" onClick={close}>Cancel</button>
            <button type="submit" className="chip-btn primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
