export {};

declare global {
  type DesktopHighScoreEntry = {
    name: string;
    score: number;
    victory: boolean;
    worldReached: number;
    createdAt: string;
  };

  type DesktopHighScoreSubmission = {
    name: string;
    score: number;
    victory: boolean;
    worldReached: number;
  };

  interface Window {
    desktop?: {
      platform: string;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
      highScores: {
        list(limit: number): Promise<DesktopHighScoreEntry[]>;
        submit(
          submission: DesktopHighScoreSubmission,
          limit?: number,
        ): Promise<{
          scores: DesktopHighScoreEntry[];
          insertedRank: number | null;
        }>;
      };
    };
  }
}
