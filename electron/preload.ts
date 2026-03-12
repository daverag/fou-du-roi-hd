import { contextBridge } from 'electron';
import { ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  highScores: {
    list(limit: number) {
      return ipcRenderer.invoke('highscores:list', limit);
    },
    submit(submission: { name: string; score: number; victory: boolean; worldReached: number }, limit?: number) {
      return ipcRenderer.invoke('highscores:submit', submission, limit ?? 5);
    },
  },
});
