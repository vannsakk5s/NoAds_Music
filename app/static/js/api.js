/**
 * Sak Music - API Client Module
 * Provides centralized Fetch API communication with CSRF token injection and error handling.
 */

const API = (() => {
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  async function request(endpoint, options = {}) {
    const defaultHeaders = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      defaultHeaders['X-CSRFToken'] = getCsrfToken();
    }

    if (options.body && !(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
      const response = await fetch(endpoint, options);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = (data && (data.error || data.message)) || `Request failed with status ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${method}] ${endpoint}:`, err);
      throw err;
    }
  }

  return {
    // YouTube Metadata
    fetchMetadata: (url) => request('/api/youtube/metadata', { method: 'POST', body: { url } }),
    fetchPlaylistMetadata: (url) => request('/api/youtube/playlist/metadata', { method: 'POST', body: { url } }),

    // Library
    getLibrary: (q = '') => request(`/api/library${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    addSong: (payload) => request('/api/library', { method: 'POST', body: payload }),
    deleteLibrarySong: (songId) => request(`/api/library/${songId}`, { method: 'DELETE' }),

    // Favorites
    getFavorites: () => request('/api/favorites'),
    setFavorite: (songId, isFavorite) =>
      request(`/api/library/${songId}/favorite`, { method: 'PUT', body: { is_favorite: Boolean(isFavorite) } }),

    // Playlists
    getPlaylists: () => request('/api/playlists'),
    createPlaylist: (payload) => request('/api/playlists', { method: 'POST', body: payload }),
    importPlaylist: (payload) => request('/api/playlists/import', { method: 'POST', body: payload }),
    getPlaylist: (id) => request(`/api/playlists/${id}`),
    updatePlaylist: (id, payload) => request(`/api/playlists/${id}`, { method: 'PATCH', body: payload }),
    deletePlaylist: (id) => request(`/api/playlists/${id}`, { method: 'DELETE' }),

    // Playlist Songs
    addSongToPlaylist: (playlistId, payload) =>
      request(`/api/playlists/${playlistId}/songs`, { method: 'POST', body: payload }),
    removeSongFromPlaylist: (playlistId, songId) =>
      request(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' }),
    reorderPlaylist: (playlistId, songIds) =>
      request(`/api/playlists/${playlistId}/order`, { method: 'PUT', body: { song_ids: songIds } }),

    // History
    getHistory: () => request('/api/history'),
    recordHistory: (songId) => request('/api/history', { method: 'POST', body: { song_id: songId } }),

    // Audio Download
    downloadSongAudio: (songId) => request(`/api/songs/${songId}/download`, { method: 'POST' })
  };
})();
