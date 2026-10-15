import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4170);
const dataDirectory = path.join(__dirname, 'data');
const dataPath = path.join(dataDirectory, 'projects.json');
const backupDirectory = path.join(dataDirectory, 'backups');
const sourcePath = path.resolve(__dirname, '..', 'portfolio', 'src', 'data', 'projects.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateProjects(value) {
  if (!Array.isArray(value)) {
    return 'JSON 根內容必須是 projects 陣列。';
  }

  const ids = new Set();
  for (const [index, project] of value.entries()) {
    if (!isObject(project)) {
      return `第 ${index + 1} 筆專案必須是物件。`;
    }
    if (typeof project.id !== 'string' || project.id.trim() === '') {
      return `第 ${index + 1} 筆專案缺少有效的 id。`;
    }
    if (ids.has(project.id)) {
      return `專案 id「${project.id}」重複。`;
    }
    ids.add(project.id);
    if (typeof project.title !== 'string' || project.title.trim() === '') {
      return `專案「${project.id}」缺少有效的 title。`;
    }
    for (const field of ['tags', 'collaborators', 'technologies', 'projectDetails', 'exhibition', 'processShots']) {
      if (project[field] !== undefined && !Array.isArray(project[field])) {
        return `專案「${project.id}」的 ${field} 必須是陣列。`;
      }
    }
    if (project.gallery !== undefined) {
      if (!Array.isArray(project.gallery)) {
        return `專案「${project.id}」的 gallery 必須是陣列。`;
      }
      for (const [mediaIndex, media] of project.gallery.entries()) {
        if (!isObject(media) || typeof media.url !== 'string' || media.url.trim() === '') {
          return `專案「${project.id}」的 gallery 第 ${mediaIndex + 1} 筆缺少有效的 url。`;
        }
        if (media.type !== undefined && !['photo', 'image', 'video', 'figma'].includes(media.type)) {
          return `專案「${project.id}」的 gallery 第 ${mediaIndex + 1} 筆 type 不受支援。`;
        }
      }
    }
  }

  return null;
}

async function ensureDataFile() {
  await fs.mkdir(backupDirectory, { recursive: true });
  try {
    await fs.access(dataPath);
  } catch {
    await fs.copyFile(sourcePath, dataPath);
  }
}

async function readProjects() {
  await ensureDataFile();
  const raw = await fs.readFile(dataPath, 'utf8');
  const projects = JSON.parse(raw);
  const error = validateProjects(projects);
  if (error) {
    throw new Error(`目前資料檔無效：${error}`);
  }
  return projects;
}

async function saveProjects(projects) {
  const error = validateProjects(projects);
  if (error) {
    const validationError = new Error(error);
    validationError.statusCode = 400;
    throw validationError;
  }

  await ensureDataFile();
  const current = await fs.readFile(dataPath, 'utf8');
  const backupName = `projects-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await fs.writeFile(path.join(backupDirectory, backupName), current, 'utf8');
  await fs.writeFile(dataPath, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
  return backupName;
}

app.get('/api/projects', async (_request, response) => {
  try {
    response.json(await readProjects());
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.put('/api/projects', async (request, response) => {
  try {
    const backupName = await saveProjects(request.body);
    response.json({ projects: request.body, backupName });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.get('/api/projects/download', async (_request, response) => {
  try {
    await ensureDataFile();
    response.download(dataPath, 'projects.json');
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.get('*', (_request, response) => {
  response.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`Portfolio backend running at http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Open http://localhost:${port}, or start with a different port: $env:PORT=4171; npm start`);
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
