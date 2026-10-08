/**
 * INSTAChat API Client
 * High-resilience REST client for user authentication, friend requests, and conversation data.
 * Features automatic fallback from external backend to same-origin endpoint.
 */

const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
let configuredBaseUrl = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, '') : '';
const isSameOriginPreferred = typeof window !== 'undefined' && (
  window.location.hostname.includes('netlify.app') ||
  window.location.hostname === 'localhost' ||
  !configuredBaseUrl
);
let useSameOriginFallback = isSameOriginPreferred;

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

  // 1. Try configured external backend if available and not marked dead
  if (configuredBaseUrl && !useSameOriginFallback) {
    try {
      const res = await fetch(`${configuredBaseUrl}${endpoint}`, {
        ...options,
        signal: AbortSignal.timeout(3500),
      });
      const routingHeader = res.headers.get('x-render-routing');
      
      // If Render router returned 404 no-server, trigger immediate fallback
      if (res.status === 404 && routingHeader === 'no-server') {
        console.warn(`[API] Remote host ${configuredBaseUrl} has no active server. Falling back to same-origin API.`);
        useSameOriginFallback = true;
      } else {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `HTTP error ${res.status}`);
        }
        return data;
      }
    } catch (err) {
      if (err.message && err.message.includes('HTTP error')) {
        throw err;
      }
      console.warn(`[API] Network failure connecting to ${configuredBaseUrl}: ${err.message}. Retrying via same-origin API.`);
      useSameOriginFallback = true;
    }
  }

  // 2. Same-origin request (Netlify Functions or Vite local proxy)
  const fallbackRes = await fetch(endpoint, options);
  const data = await fallbackRes.json().catch(() => ({}));

  if (!fallbackRes.ok) {
    throw new Error(data.error || `HTTP error ${fallbackRes.status}`);
  }

  return data;
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, 'GET'),
  post: (endpoint, body) => apiRequest(endpoint, 'POST', body),
};
