# Atelarch

Atelarch is a local content management dashboard for portfolio projects. It lets you manage projects through a form instead of editing JSON by hand. The browser stores the active working copy in `localStorage`, while the Express backend provides local initialization and JSON file backups.

## Getting started

Run these commands from the `atelarch` directory:

```bash
npm install
npm start
```

Open <http://localhost:4170> in your browser.

If port `4170` is already being used by another backend instance, open the existing URL without starting another server. To use a different port:

```powershell
$env:PORT=4171
npm start
```

For frontend development with Vite, run:

```bash
npm run dev
```

## Managing projects

1. On the Settings page, choose **Import JSON** and select your existing `projects.json` file.
2. Use the Works page to add, edit, duplicate, publish, draft, or delete projects.
3. Valid changes are saved automatically to the browser's `localStorage` and restored when the dashboard is opened again.
4. Use **Export JSON** to download a backup that can be copied back into the portfolio repository.
5. Use **Reset data** on the Settings page to restore the built-in sample projects.

Imported files must contain an array of projects in the portfolio's current format. Each project must have a unique `id` and a non-empty `title`. Array fields are also validated. Invalid imports are rejected without replacing the current local data.

## Project data format

The editor supports the following project fields:

- **Text fields:** `id`, `title`, `subtitle`, `description`, `thumbnail`, `link`, `medium`, `size`, `content`, `process`, and `technicalChallenges`
- **Comma-separated fields:** `tags` and `technologies`
- **One-item-per-line fields:** `collaborators`, `exhibition`, `details`, and `processShots`
- **Gallery:** one item per line using `type | URL`, for example `photo | https://example.com/image.jpg`
- **Boolean fields:** `selected` and `published`

## Code structure

- `src/main.tsx` defines the `Project` type and the default shape used by the editor.
- `normalize()` fills missing optional values so backend, `localStorage`, and imported data can be edited safely.
- `validate()` checks the JSON root, required identity fields, duplicate IDs, and supported array fields.
- Project loading follows this order: valid `localStorage` data, `/api/projects`, then built-in sample data when the backend is unavailable.
- All project changes go through `save()`, which keeps React state, `localStorage`, and the save indicator synchronized.
- `src/index.css` contains the dashboard layout and the layered folder-card styling. Folder cards use a back tab layer, a thumbnail peek layer, and a transparent front body layer.

## Data locations

- Backend project data: `data/projects.json`
- Automatic backups: `data/backups/`
- If `data/projects.json` does not exist on first startup, the server attempts to initialize it from the neighboring `portfolio/src/data/projects.json` file.

## Local-only usage

The browser's `localStorage` is the primary working data store. The backend does not provide authentication, so this tool is intended for use on your own computer. Do not expose it directly to the public internet.
