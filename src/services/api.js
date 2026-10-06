/**
 * INSTAChat API Client
 * Clean REST client for user authentication, friend requests, and conversation data.
 */

const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
const BASE_URL = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, '') : '';

export async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('instachat_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data;
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, 'GET'),
  post: (endpoint, body) => apiRequest(endpoint, 'POST', body),
};
