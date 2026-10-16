const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * When the app is opened via another address (127.0.0.1, or the LAN IP from another device),
 * a configured "localhost" API URL would point at the wrong machine. Use the page's host instead.
 */
const resolve = (configured, fallback) => {
  try {
    const url = new URL(configured || fallback);
    const pageHost = window.location.hostname;
    if (LOCAL_HOSTS.includes(url.hostname) && pageHost && !LOCAL_HOSTS.includes(pageHost)) {
      url.hostname = pageHost;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured || fallback;
  }
};

export const API_URL = resolve(process.env.REACT_APP_API_URL, 'http://localhost:5000/api');
export const SOCKET_URL = resolve(process.env.REACT_APP_SOCKET_URL, 'http://localhost:5000');
