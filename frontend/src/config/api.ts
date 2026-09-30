// Get API base URL from environment or use current origin
// If page is HTTPS, ensure API calls use HTTPS too
const getApiBaseUrl = (): string => {
  // If VITE_API_URL is set, use it (but ensure HTTPS if page is HTTPS)
  if (import.meta.env.VITE_API_URL) {
    const envUrl = import.meta.env.VITE_API_URL;
    // If page is HTTPS and env URL is HTTP, convert to HTTPS
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://')) {
      return envUrl.replace('http://', 'https://');
    }
    return envUrl;
  }
  
  // In production (HTTPS), use same origin (relative URLs will use HTTPS automatically)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // Return empty string to use relative URLs
    return '';
  }
  
  // In development, default to localhost
  return 'http://localhost:5050';
};

const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;