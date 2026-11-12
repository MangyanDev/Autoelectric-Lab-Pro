export interface GroundedSearchSource {
  title: string;
  uri: string;
  domain: string;
}

export interface GroundedSearchResult {
  status: 'SUCCESS' | 'ERROR';
  answer: string;
  sources: GroundedSearchSource[];
  searchQueries: string[];
  model: string;
  attemptedModels?: string[];
  reroutedFrom?: string;
  timestamp: string;
  error?: string;
}

export interface GroundedSearchRequest {
  query: string;
  ecuModel?: string;
  dtcCode?: string;
  contextType?: string;
  customPrompt?: string;
}

export async function performGroundedSearch(
  req: GroundedSearchRequest
): Promise<GroundedSearchResult> {
  try {
    const response = await fetch('/api/autoelectric/grounded-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });

    const data = await response.json();

    if (!response.ok) {
      let friendlyError = data.error || 'Failed to retrieve search grounded intelligence.';
      if (typeof data.details === 'string') {
        if (data.details.includes('429') || data.details.includes('RESOURCE_EXHAUSTED')) {
          friendlyError = 'Gemini API Rate Limit / Quota Exceeded (429). If using a free key tier, please wait a minute before retrying, or configure a billing-enabled key in Settings > Secrets.';
        } else if (data.details.includes('403') || data.details.includes('PERMISSION_DENIED')) {
          friendlyError = 'API key permission denied (403). Please verify your GEMINI_API_KEY in Settings > Secrets.';
        } else {
          friendlyError = `${data.error || 'Search error'}: ${data.details.slice(0, 150)}...`;
        }
      }
      return {
        status: 'ERROR',
        answer: friendlyError,
        sources: [],
        searchQueries: [],
        model: 'gemini-4-hydrogen',
        timestamp: new Date().toISOString(),
        error: friendlyError,
      };
    }

    return {
      status: 'SUCCESS',
      answer: data.answer || '',
      sources: data.sources || [],
      searchQueries: data.searchQueries || [],
      model: data.model || 'gemini-4-hydrogen',
      attemptedModels: data.attemptedModels || [],
      reroutedFrom: data.reroutedFrom || undefined,
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown communication error';
    return {
      status: 'ERROR',
      answer: 'Failed to connect to Google Search Grounding service.',
      sources: [],
      searchQueries: [],
      model: 'gemini-4-hydrogen',
      timestamp: new Date().toISOString(),
      error: msg,
    };
  }
}
