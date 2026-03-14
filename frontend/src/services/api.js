import axios from "axios";
import { supabase } from "../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REQUEST_TIMEOUT_MS = 15_000; // 15s timeout for all fetch calls
const MAX_RETRIES = 1; // Retry once on transient failures
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]); // Gateway errors only

// ── Authenticated axios instance (used by dashboard components) ─────────────

export const authAxios = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS });

authAxios.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Auth header helpers ─────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.warn("No active session — request will be sent without auth.");
  }
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function getAuthHeadersMultipart() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.warn("No active session — request will be sent without auth.");
  }
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// ── Core fetch wrapper with timeout, response.ok check, and retry ───────────

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function apiFetch(url, options = {}, retries = MAX_RETRIES) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    if (!response.ok) {
      // Try to parse error body for a meaningful message
      let errorData;
      try { errorData = await response.json(); } catch { errorData = null; }

      // Retry on transient gateway errors
      if (retries > 0 && RETRYABLE_STATUS_CODES.has(response.status)) {
        await new Promise((r) => setTimeout(r, 500));
        return apiFetch(url, options, retries - 1);
      }

      const message = errorData?.error || errorData?.message || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, errorData);
    }

    return response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError("Request timed out. Please check your connection and try again.", 0, null);
    }
    if (err instanceof ApiError) throw err;

    // Network error — retry once
    if (retries > 0 && err.name === "TypeError") {
      await new Promise((r) => setTimeout(r, 500));
      return apiFetch(url, options, retries - 1);
    }

    throw new ApiError(err.message || "Network error", 0, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Request APIs ────────────────────────────────────────────────────────────

export const createRequest = async (studentId, docTypeId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/create`, {
    method: "POST", headers,
    body: JSON.stringify({ student_id: studentId, doc_type_id: docTypeId }),
  });
};

export const getStudentRequests = async (studentId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/student/${studentId}`, { headers });
};

export const resubmitRequest = async (requestId, studentId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/${requestId}/resubmit`, {
    method: "POST", headers,
    body: JSON.stringify({ student_id: studentId }),
  });
};

export const getAdminRequests = async (role) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/admin/${role}`, { headers });
};

export const approveRequest = async (requestId, adminId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/${requestId}/approve`, {
    method: "POST", headers,
    body: JSON.stringify({ admin_id: adminId }),
  });
};

export const rejectRequest = async (requestId, adminId, reason) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/${requestId}/reject`, {
    method: "POST", headers,
    body: JSON.stringify({ admin_id: adminId, reason }),
  });
};

export const getRequestHistory = async (requestId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/${requestId}/history`, { headers });
};

export const deleteRequest = async (requestId, studentId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/requests/${requestId}/delete`, {
    method: "DELETE", headers,
    body: JSON.stringify({ student_id: studentId }),
  });
};

// ── Document APIs ───────────────────────────────────────────────────────────

export const uploadDocument = async (requestId, userId, file) => {
  const headers = await getAuthHeadersMultipart();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("request_id", requestId);
  formData.append("user_id", userId);
  return apiFetch(`${API_URL}/documents/upload`, {
    method: "POST", headers, body: formData,
  });
};

export const getRequestDocuments = async (requestId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/documents/request/${requestId}?user_id=${userId}`, { headers });
};

export const deleteDocument = async (documentId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE", headers,
    body: JSON.stringify({ user_id: userId }),
  });
};

// ── Comment APIs ────────────────────────────────────────────────────────────

export const createComment = async (requestId, userId, commentText) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/comments/create`, {
    method: "POST", headers,
    body: JSON.stringify({ request_id: requestId, user_id: userId, comment_text: commentText }),
  });
};

export const getRequestComments = async (requestId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/comments/request/${requestId}?user_id=${userId}`, { headers });
};

export const updateComment = async (commentId, userId, commentText) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/comments/${commentId}`, {
    method: "PUT", headers,
    body: JSON.stringify({ user_id: userId, comment_text: commentText }),
  });
};

export const deleteComment = async (commentId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/comments/${commentId}`, {
    method: "DELETE", headers,
    body: JSON.stringify({ user_id: userId }),
  });
};

// ── Clearance Comment APIs ──────────────────────────────────────────────────

export const createClearanceComment = async (clearanceId, userId, commentText, visibility = "all") => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/clearance/${clearanceId}/comments`, {
    method: "POST", headers,
    body: JSON.stringify({ user_id: userId, comment_text: commentText, visibility }),
  });
};

export const getClearanceComments = async (clearanceId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/clearance/${clearanceId}/comments?user_id=${userId}`, { headers });
};

export const deleteClearanceComment = async (commentId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/clearance/comments/${commentId}`, {
    method: "DELETE", headers,
    body: JSON.stringify({ user_id: userId }),
  });
};

export const updateClearanceComment = async (commentId, userId, commentText) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/clearance/comments/${commentId}`, {
    method: "PUT", headers,
    body: JSON.stringify({ user_id: userId, comment_text: commentText }),
  });
};

// ── Certificate APIs ────────────────────────────────────────────────────────

export const generateCertificate = async (requestId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/certificates/generate`, {
    method: "POST", headers,
    body: JSON.stringify({ request_id: requestId, user_id: userId }),
  });
};

export const getRequestCertificate = async (requestId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/certificates/request/${requestId}?user_id=${userId}`, { headers });
};

export const verifyCertificate = async (verificationCode) => {
  return apiFetch(`${API_URL}/certificates/verify/${verificationCode}`);
};

// ── Escalation APIs ─────────────────────────────────────────────────────────

export const checkEscalations = async (adminId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/escalation/check`, {
    method: "POST", headers,
    body: JSON.stringify({ admin_id: adminId }),
  });
};

export const getEscalationStats = async (adminId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/escalation/stats?admin_id=${adminId}`, { headers });
};

export const manuallyEscalateRequest = async (requestId, adminId, reason) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/escalation/manual`, {
    method: "POST", headers,
    body: JSON.stringify({ request_id: requestId, admin_id: adminId, reason }),
  });
};

export const getEscalationHistory = async (requestId, userId) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/escalation/history/${requestId}?user_id=${userId}`, { headers });
};

// ── Secret Code Management ──────────────────────────────────────────────────

export const getSecretCodes = async () => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/admin/secret-codes`, { headers });
};

export const createSecretCode = async (role, description, maxUses, expiresAt) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/admin/secret-codes`, {
    method: "POST", headers,
    body: JSON.stringify({ role, description, max_uses: maxUses, ...(expiresAt ? { expires_at: expiresAt } : {}) }),
  });
};

export const toggleSecretCode = async (id) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/admin/secret-codes/${id}/toggle`, { method: "PATCH", headers });
};

export const deleteSecretCode = async (id) => {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_URL}/admin/secret-codes/${id}`, { method: "DELETE", headers });
};
