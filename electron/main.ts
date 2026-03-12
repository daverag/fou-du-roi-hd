import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type HighScoreEntry = {
  name: string;
  score: number;
  victory: boolean;
  worldReached: number;
  createdAt: string;
};

type HighScoreSubmission = {
  name: string;
  score: number;
  victory: boolean;
  worldReached: number;
};

const isDev = !app.isPackaged;
const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const MAX_SCORE = 999999;
const MAX_WORLD_REACHED = 99;
const MAX_NAME_LENGTH = 12;
const ALLOWED_NAME_PATTERN = /^[A-Z0-9]{1,12}$/;
const MAX_STORED_SCORES = 100;

function getAppIconPath(): string {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'dist/icons/hero-app-icon.png'),
    path.join(appPath, 'public/icons/hero-app-icon.png'),
    path.join(appPath, 'dist/icons/hero.png'),
    path.join(appPath, 'public/icons/hero.png'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function getHighScoreFilePath(): string {
  return path.join(app.getPath('userData'), 'highscores.json');
}

async function ensureHighScoreStorage(): Promise<string> {
  const filePath = getHighScoreFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, '[]', 'utf8');
  }

  return filePath;
}

async function loadHighScores(): Promise<HighScoreEntry[]> {
  const filePath = await ensureHighScoreStorage();

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isHighScoreEntry).sort(compareHighScores);
  } catch {
    return [];
  }
}

async function saveHighScores(scores: HighScoreEntry[]): Promise<void> {
  const filePath = await ensureHighScoreStorage();
  await writeFile(filePath, `${JSON.stringify(scores, null, 2)}\n`, 'utf8');
}

function isHighScoreEntry(value: unknown): value is HighScoreEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<HighScoreEntry>;
  return typeof entry.name === 'string'
    && typeof entry.score === 'number'
    && typeof entry.victory === 'boolean'
    && typeof entry.worldReached === 'number'
    && typeof entry.createdAt === 'string';
}

function compareHighScores(left: HighScoreEntry, right: HighScoreEntry): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.worldReached !== left.worldReached) {
    return right.worldReached - left.worldReached;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

function validateSubmission(submission: HighScoreSubmission): HighScoreSubmission {
  const name = submission.name.trim().toUpperCase();
  const score = Math.trunc(submission.score);
  const worldReached = Math.trunc(submission.worldReached);

  if (!ALLOWED_NAME_PATTERN.test(name) || name.length > MAX_NAME_LENGTH) {
    throw new Error('Name must contain only A-Z and 0-9.');
  }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new Error('Invalid score.');
  }

  if (!Number.isInteger(worldReached) || worldReached < 1 || worldReached > MAX_WORLD_REACHED) {
    throw new Error('Invalid world reached.');
  }

  if (typeof submission.victory !== 'boolean') {
    throw new Error('Invalid victory flag.');
  }

  return {
    name,
    score,
    victory: submission.victory,
    worldReached,
  };
}

ipcMain.handle('highscores:list', async (_event, limit: number) => {
  const scores = await loadHighScores();
  return scores.slice(0, Math.max(1, Math.min(50, Math.trunc(limit) || 10)));
});

ipcMain.handle('highscores:submit', async (_event, submission: HighScoreSubmission, limit: number) => {
  const sanitized = validateSubmission(submission);
  const entry: HighScoreEntry = {
    ...sanitized,
    createdAt: new Date().toISOString(),
  };

  const scores = await loadHighScores();
  scores.push(entry);
  const sortedScores = scores.sort(compareHighScores).slice(0, MAX_STORED_SCORES);
  await saveHighScores(sortedScores);

  const insertedRank = sortedScores.findIndex((scoreEntry) =>
    scoreEntry.createdAt === entry.createdAt
    && scoreEntry.name === entry.name
    && scoreEntry.score === entry.score
    && scoreEntry.worldReached === entry.worldReached
    && scoreEntry.victory === entry.victory);

  return {
    scores: sortedScores.slice(0, Math.max(1, Math.min(50, Math.trunc(limit) || 10))),
    insertedRank: insertedRank >= 0 ? insertedRank + 1 : null,
  };
});

function createMainWindow() {
  const iconPath = getAppIconPath();
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'Fou du Roi HD',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && devServerUrl) {
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
    return window;
  }

  void window.loadFile(path.join(__dirname, '../dist/index.html'));
  return window;
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(getAppIconPath()));
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
