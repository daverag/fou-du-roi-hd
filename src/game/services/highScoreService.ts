export type HighScoreEntry = {
  name: string;
  score: number;
  victory: boolean;
  worldReached: number;
  createdAt: string;
};

export type HighScoreSubmission = {
  name: string;
  score: number;
  victory: boolean;
  worldReached: number;
};

type HighScoreApiResponse = {
  scores: HighScoreEntry[];
  insertedRank?: number | null;
  error?: string;
};

const API_BASE_URL = (import.meta.env.VITE_HIGH_SCORE_API_BASE_URL ?? '').replace(/\/$/, '');
const HIGH_SCORE_URL = `${API_BASE_URL}/api/highscores.php`;
const HIGH_SCORE_REQUEST_TIMEOUT_MS = 1800;
const DEFAULT_LIMIT = 5;

function isDesktopHighScoreProviderAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.desktop?.highScores !== 'undefined';
}

export async function fetchHighScores(limit = 5): Promise<HighScoreEntry[]> {
  if (isDesktopHighScoreProviderAvailable()) {
    return window.desktop!.highScores.list(limit);
  }

  const response = await fetchWithTimeout(`${HIGH_SCORE_URL}?limit=${limit}`);
  const payload = await parseResponse(response);
  return payload.scores ?? [];
}

export async function submitHighScore(submission: HighScoreSubmission): Promise<HighScoreApiResponse> {
  if (isDesktopHighScoreProviderAvailable()) {
    return window.desktop!.highScores.submit(submission, DEFAULT_LIMIT);
  }

  const response = await fetchWithTimeout(HIGH_SCORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submission),
  });

  return parseResponse(response);
}

async function parseResponse(response: Response): Promise<HighScoreApiResponse> {
  let payload: HighScoreApiResponse | null = null;

  try {
    payload = await response.json() as HighScoreApiResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `High score API returned ${response.status}`);
  }

  return payload ?? { scores: [] };
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), HIGH_SCORE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
