// ============================================================================
// API Client for Oracle OMOP Queries
// ============================================================================
import axios, { AxiosError } from 'axios';
import type {
  SearchRequest,
  SearchResult,
  HierarchyRequest,
  HierarchyResult,
  CodeSetRequest,
  CodeSetResult,
  ApiResponse,
  UserProfile,
  SaveCodeSetRequest,
  GetCodeSetsResponse,
  GetCodeSetDetailResponse,
  SearchHistoryRecord,
  LabTestSearchRequest,
  LabTestSearchResult,
} from './types';

// In development with Vercel Dev, API routes are served on the same origin
// In production, API routes are also on the same origin
const API_BASE_URL = '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes timeout to match backend and health check
});

// SWA automatically injects the user identity into API requests via headers.
// No Authorization token injection needed.

// ============================================================================
// Error Handling
// ============================================================================
const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const message =
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'An unexpected error occurred';
    throw new Error(message);
  }
  throw error;
};

// ============================================================================
// Health Check / Database Warmup
// ============================================================================
export const checkHealth = async (): Promise<{
  success: boolean;
  duration_ms?: number;
  message?: string;
}> => {
  try {
    const response = await apiClient.get('/api/health');
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Test connection with extended timeout for initial database warmup
// This is used on the Landing page where Azure SQL cold starts can take 60-120 seconds
export const testConnection = async (): Promise<{
  success: boolean;
  duration_ms?: number;
  message?: string;
}> => {
  try {
    const response = await apiClient.get('/api/health', {
      timeout: 20000, // 20 seconds — backend fails fast, frontend polls on retry
    });
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 1: Search Query
// ============================================================================
export const searchConcepts = async (
  request: SearchRequest
): Promise<SearchResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<SearchResult[]>>(
      '/api/search',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Search failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Lab Test Search (Measurement Domain)
// ============================================================================
export const searchLabTests = async (
  request: LabTestSearchRequest
): Promise<LabTestSearchResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<LabTestSearchResult[]>>(
      '/api/labtest-search',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Lab test search failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 2: Hierarchy Query
// ============================================================================
export const getHierarchy = async (
  request: HierarchyRequest
): Promise<HierarchyResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<HierarchyResult[]>>(
      '/api/hierarchy',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Hierarchy query failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Step 3: Build Code Set Query
// ============================================================================
export const buildCodeSet = async (
  request: CodeSetRequest
): Promise<CodeSetResult[]> => {
  try {
    const response = await apiClient.post<ApiResponse<CodeSetResult[]>>(
      '/api/codeset',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Code set build failed');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ============================================================================
// Export Helper Functions
// ============================================================================

/**
 * Export code set results as tab-delimited TXT file
 */
export const exportToTxt = (data: CodeSetResult[]): void => {
  const headers = ['CHILD_VOCABULARY_ID', 'CHILD_CODE', 'CHILD_NAME'].join('\t');
  const rows = data.map((row) =>
    [row.child_vocabulary_id, row.child_code, row.child_name].join('\t')
  );

  const content = [headers, ...rows].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `codeset_${timestamp}.txt`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate SQL snippet and copy to clipboard
 */
export const exportToSql = async (data: CodeSetResult[]): Promise<void> => {
  // Group codes by vocabulary
  const grouped = data.reduce((acc, row) => {
    if (!acc[row.child_vocabulary_id]) {
      acc[row.child_vocabulary_id] = [];
    }
    acc[row.child_vocabulary_id].push(row.child_code);
    return acc;
  }, {} as Record<string, string[]>);

  // Build SQL snippet
  const sqlParts = Object.entries(grouped).map(([vocab, codes]) => {
    const codeList = codes.map((code) => `'${code}'`).join(',');
    return `VOCABULARY_ID = '${vocab}' AND CODE IN (${codeList})`;
  });

  const sql = sqlParts.join('\nOR ');

  // Copy to clipboard
  await navigator.clipboard.writeText(sql);
};

// ============================================================================
// User Data API Functions (Azure SQL)
// ============================================================================

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (
  userId: string,
  email: string,
  displayName?: string
): Promise<UserProfile> => {
  try {
    const response = await apiClient.post<ApiResponse<UserProfile>>(
      '/api/user/profile',
      { user_id: userId, email, display_name: displayName }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update user profile');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Get user profile
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const response = await apiClient.get<ApiResponse<UserProfile>>(
      `/api/user/profile/${userId}`
    );

    if (!response.data.success) {
      return null;
    }

    return response.data.data || null;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
};

/**
 * Save a code set
 */
export const saveCodeSet = async (
  request: SaveCodeSetRequest
): Promise<{ id: number }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ id: number }>>(
      '/api/user/codesets',
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save code set');
    }

    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Get user's saved code sets (metadata only)
 */
export const getSavedCodeSets = async (): Promise<GetCodeSetsResponse[]> => {
  try {
    console.log('📡 API: Requesting saved code sets');
    // Don't pass userId in URL - the API will use the authenticated user's ID
    const response = await apiClient.get<ApiResponse<GetCodeSetsResponse[]>>(
      '/api/user/codesets'
    );

    console.log('📡 API: Response:', response.data);

    if (!response.data.success || !response.data.data) {
      console.warn('⚠️ API: No data returned or unsuccessful response');
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error('❌ API: Failed to get saved code sets:', error);
    return [];
  }
};

/**
 * Get specific code set with full details
 */
export const getCodeSetDetail = async (
  codeSetId: number
): Promise<GetCodeSetDetailResponse | null> => {
  try {
    // Use query parameter instead of URL path
    const response = await apiClient.get<ApiResponse<GetCodeSetDetailResponse>>(
      `/api/user/codesets?codeSetId=${codeSetId}`
    );

    if (!response.data.success || !response.data.data) {
      return null;
    }

    return response.data.data;
  } catch (error) {
    console.error('Failed to get code set detail:', error);
    return null;
  }
};

/**
 * Delete a saved code set
 */
export const deleteCodeSet = async (codeSetId: number): Promise<boolean> => {
  try {
    // Use query parameter instead of URL path
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/user/codesets?codeSetId=${codeSetId}`
    );

    return response.data.success;
  } catch (error) {
    console.error('Failed to delete code set:', error);
    return false;
  }
};

/**
 * Track a search in history
 */
export const trackSearch = async (
  searchTerm: string,
  domainType?: string,
  resultCount?: number
): Promise<void> => {
  try {
    await apiClient.post('/api/user/search-history', {
      search_term: searchTerm,
      domain_type: domainType,
      result_count: resultCount,
    });
  } catch (error) {
    // Don't throw error for search tracking failures
    console.error('Failed to track search:', error);
  }
};

/**
 * Get user's search history
 */
export const getSearchHistory = async (
  userId: string,
  limit: number = 10
): Promise<SearchHistoryRecord[]> => {
  try {
    const response = await apiClient.get<ApiResponse<SearchHistoryRecord[]>>(
      `/api/user/search-history/${userId}`,
      { params: { limit } }
    );

    if (!response.data.success || !response.data.data) {
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error('Failed to get search history:', error);
    return [];
  }
};

