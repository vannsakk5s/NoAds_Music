/**
 * Sak Music - Main Application Controller
 * Handles SPA navigation, modals, playlist management, song library, search, and toasts.
 */

const App = (() => {
  // Current view state
  let activeView = 'dashboard';
  let currentPlaylistId = null;

  // Cached data
  let librarySongs = [];
  let userPlaylists = [];

  // Debounce timer for search
  let searchDebounce = null;

  function init() {
    bindNavigation();
    bindModals();
    bindGlobalSearch();
    bindMobileDrawers();
    bindUserMenu();
    initTheme();
    if (window.I18n) window.I18n.init();
    window.addEventListener('languageChanged', () => {
      if (userPlaylists && userPlaylists.length > 0) {
        renderDashboardPlaylistsGrid(userPlaylists);
      }
      if (activeView === 'playlist-detail' && currentPlaylistId) {
        loadPlaylistDetail(currentPlaylistId);
      }
    });
    loadPlaylists();
    loadDashboard();
  }

  // ========================================================
  // Navigation & View Swapping
  // ========================================================
  function bindNavigation() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.dataset.view;
        const playlistId = btn.dataset.playlistId;
        switchView(view, playlistId);
      });
    });

    document.querySelectorAll('[data-view-target]').forEach(card => {
      card.addEventListener('click', () => {
        const view = card.dataset.viewTarget;
        switchView(view);
      });
    });

    // Hero buttons
    const btnHeroPlayAll = document.getElementById('btn-hero-play-all');
    if (btnHeroPlayAll) {
      btnHeroPlayAll.addEventListener('click', () => {
        if (librarySongs.length > 0) {
          Player.playPlaylist(librarySongs);
        } else {
          showToast('No songs in your library yet! Add one first.', 'info');
        }
      });
    }

    const btnHeroAddSong = document.getElementById('btn-hero-add-song');
    if (btnHeroAddSong) {
      btnHeroAddSong.addEventListener('click', () => openModal('modal-add-song'));
    }

    const btnPlayAllLibrary = document.getElementById('btn-play-all-library');
    if (btnPlayAllLibrary) {
      btnPlayAllLibrary.addEventListener('click', () => {
        if (librarySongs.length > 0) {
          Player.playPlaylist(librarySongs);
        } else {
          showToast('Your library is empty.', 'info');
        }
      });
    }

    const btnPlayAllFavorites = document.getElementById('btn-play-all-favorites');
    if (btnPlayAllFavorites) {
      btnPlayAllFavorites.addEventListener('click', async () => {
        try {
          const favs = await API.getFavorites();
          if (favs && favs.length > 0) {
            Player.playPlaylist(favs);
          } else {
            showToast('No favorite songs yet.', 'info');
          }
        } catch (err) {
          showToast('Failed to load favorites.', 'error');
        }
      });
    }

    const btnPlayAllHistory = document.getElementById('btn-play-all-history');
    if (btnPlayAllHistory) {
      btnPlayAllHistory.addEventListener('click', async () => {
        try {
          const history = await API.getHistory();
          if (history && history.length > 0) {
            Player.playPlaylist(history);
          } else {
            showToast('No history tracks recorded yet.', 'info');
          }
        } catch (err) {
          showToast('Failed to load history.', 'error');
        }
      });
    }
  }

  function switchView(viewName, playlistId = null) {
    activeView = viewName;
    currentPlaylistId = playlistId;

    // Update active nav button state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      el.classList.remove('active');
    });

    const activeNavBtn = document.querySelector(`.sidebar-nav [data-view="${viewName}"]${playlistId ? `[data-playlist-id="${playlistId}"]` : ''}`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    // Update mobile bottom nav active tab
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Switch view sections
    document.querySelectorAll('.content-view').forEach(sec => sec.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.add('active');

    // Close drawers and backdrop
    closeAllDrawers();

    // Load data for specific view
    if (viewName === 'dashboard') {
      loadDashboard();
    } else if (viewName === 'all-songs') {
      loadAllSongs();
    } else if (viewName === 'favorites') {
      loadFavorites();
    } else if (viewName === 'playlist-detail') {
      loadPlaylistDetail(playlistId);
    } else if (viewName === 'history') {
      loadHistory();
    }
  }

  // ========================================================
  // Data Loading & Rendering
  // ========================================================
  async function loadDashboard() {
    try {
      const [songs, favs, playlists] = await Promise.all([
        API.getLibrary(),
        API.getFavorites(),
        API.getPlaylists()
      ]);

      librarySongs = songs || [];
      userPlaylists = playlists || [];

      // Update stats counters
      const statTotal = document.getElementById('stat-total-songs');
      const statFav = document.getElementById('stat-total-favorites');
      const statPl = document.getElementById('stat-total-playlists');
      if (statTotal) statTotal.textContent = librarySongs.length;
      if (statFav) statFav.textContent = (favs || []).length;
      if (statPl) statPl.textContent = userPlaylists.length;

      // Render Dashboard Playlists Grid
      renderDashboardPlaylistsGrid(userPlaylists);

      // Render Recent additions table (up to 5)
      renderDashboardRecentTable(librarySongs.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  function renderDashboardPlaylistsGrid(playlists) {
    const grid = document.getElementById('dashboard-playlists-grid');
    if (!grid) return;

    if (!playlists || playlists.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 2rem;">
          <p>No playlists created yet. Create your first playlist to organize your songs!</p>
          <button class="btn btn-secondary mt-2" onclick="App.openCreatePlaylistModal()">+ Create Playlist</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.innerHTML = `
        <div class="playlist-card-cover">
          <span>♬</span>
          <div class="playlist-card-play-overlay">
            <div class="overlay-play-btn" title="Play Playlist">▶</div>
          </div>
        </div>
        <div class="playlist-card-title text-truncate">${escapeHtml(pl.name)}</div>
        <div class="playlist-card-meta"><span class="playlist-song-num">${pl.song_count || 0}</span> <span data-i18n="songs_count">${window.I18n ? I18n.t('songs_count') : 'songs'}</span></div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.overlay-play-btn')) {
          e.stopPropagation();
          playEntirePlaylist(pl.id);
        } else {
          switchView('playlist-detail', pl.id);
        }
      });

      grid.appendChild(card);
    });
  }

  function renderDashboardRecentTable(songs) {
    const tbody = document.querySelector('#dashboard-recent-table tbody');
    if (!tbody) return;

    if (!songs || songs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate-500 py-6 text-xs italic">No songs in your library yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    songs.forEach((song, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'group hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0';
      const thumb = song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
      tr.innerHTML = `
        <td class="py-3 pl-3 sm:pl-5 pr-1 sm:pr-2 w-8 sm:w-12 text-center text-xs font-mono text-slate-500 group-hover:text-mint-400 font-semibold select-none hidden sm:table-cell">
          <span class="group-hover:hidden">${idx + 1}</span>
          <button class="hidden group-hover:inline-flex w-6 h-6 rounded-md bg-mint-500/20 text-mint-400 hover:bg-mint-500 hover:text-dark-950 items-center justify-center transition-all mx-auto" onclick="App.playSongById(${song.id})" title="Play">
            <svg class="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <div class="relative w-12 h-9 rounded-lg overflow-hidden bg-dark-800 border border-white/10 group/thumb cursor-pointer shadow-sm flex-shrink-0" onclick="App.playSongById(${song.id})">
              <img src="${thumb}" alt="Thumb" class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200" onerror="this.src='/static/images/placeholder.svg'">
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-mint-400 transition-opacity">
                <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <div class="overflow-hidden min-w-0">
              <div class="font-medium text-slate-100 group-hover:text-white truncate max-w-[280px] xl:max-w-[400px] cursor-pointer hover:underline" onclick="App.playSongById(${song.id})">${escapeHtml(song.title)}</div>
              <div class="text-xs text-slate-400 truncate">${escapeHtml(song.channel_name || 'YouTube')}</div>
            </div>
          </div>
        </td>
        <td class="py-3 pl-3 pr-5 w-32 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button class="w-8 h-8 rounded-lg bg-mint-500/10 hover:bg-mint-500 hover:text-dark-950 text-mint-400 flex items-center justify-center transition-all shadow-sm hover:scale-105" onclick="App.playSongById(${song.id})" title="Play">
              <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all" onclick="App.openAddToPlaylistModal(${song.id}, '${escapeQuote(song.title)}')" title="Add to Playlist">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all" onclick="App.toggleFavorite(${song.id})" title="Toggle Favorite">
              <svg class="w-4 h-4 ${song.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-400'}" viewBox="0 0 24 24" fill="${song.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ALL SONGS
  async function loadAllSongs(query = '') {
    try {
      const songs = await API.getLibrary(query);
      librarySongs = songs || [];
      renderSongTable(librarySongs, 'all-songs-tbody', 'all-songs-empty', {
        allowDeleteFromLibrary: true,
        allowAddToPlaylist: true
      });
    } catch (err) {
      showToast('Error loading library songs.', 'error');
    }
  }

  // FAVORITES
  async function loadFavorites() {
    try {
      const songs = await API.getFavorites();
      renderSongTable(songs || [], 'favorites-tbody', 'favorites-empty', {
        allowDeleteFromLibrary: false,
        allowAddToPlaylist: true
      });
    } catch (err) {
      showToast('Error loading favorites.', 'error');
    }
  }

  // HISTORY
  async function loadHistory() {
    try {
      const history = await API.getHistory();
      renderHistoryTable(history || []);
    } catch (err) {
      showToast('Error loading history.', 'error');
    }
  }

  function renderHistoryTable(items) {
    const tbody = document.getElementById('history-tbody');
    const emptyState = document.getElementById('history-empty');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = '';

    items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'group hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0';
      const thumb = item.thumbnail_url || `https://img.youtube.com/vi/${item.youtube_video_id}/hqdefault.jpg`;
      const dateStr = item.last_played_at ? new Date(item.last_played_at).toLocaleString() : 'Just now';

      tr.innerHTML = `
        <td class="py-3 pl-3 sm:pl-5 pr-1 sm:pr-2 w-8 sm:w-12 text-center text-xs font-mono text-slate-500 group-hover:text-mint-400 font-semibold select-none hidden sm:table-cell">
          <span class="group-hover:hidden">${idx + 1}</span>
          <button class="hidden group-hover:inline-flex w-6 h-6 rounded-md bg-mint-500/20 text-mint-400 hover:bg-mint-500 hover:text-dark-950 items-center justify-center transition-all mx-auto" onclick="App.playSongFromList(${JSON.stringify(escapeQuotesInObj(item)).replace(/"/g, '&quot;')})" title="Play">
            <svg class="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </td>
        <td class="py-2.5 sm:py-3 px-2 w-14 sm:w-16">
          <div class="relative w-11 h-8 sm:w-12 sm:h-9 rounded-lg overflow-hidden bg-dark-800 border border-white/10 group/thumb cursor-pointer shadow-sm flex-shrink-0" onclick="App.playSongFromList(${JSON.stringify(escapeQuotesInObj(item)).replace(/"/g, '&quot;')})">
            <img src="${thumb}" alt="Thumb" class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200" onerror="this.src='/static/images/placeholder.svg'">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-mint-400 transition-opacity">
              <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        </td>
        <td class="py-2.5 sm:py-3 px-2 sm:px-3">
          <div class="font-medium text-xs sm:text-sm text-slate-100 group-hover:text-white truncate max-w-[170px] sm:max-w-[280px] xl:max-w-[420px] cursor-pointer hover:underline" onclick="App.playSongFromList(${JSON.stringify(escapeQuotesInObj(item)).replace(/"/g, '&quot;')})" title="${escapeHtml(item.title)}">
            ${escapeHtml(item.title)}
          </div>
          <div class="text-[11px] text-slate-400 truncate max-w-[170px] sm:hidden mt-0.5">
            ${escapeHtml(item.channel_name || 'YouTube')} &bull; ${dateStr}
          </div>
        </td>
        <td class="py-3 px-3 text-xs text-slate-400 truncate max-w-[200px] hidden sm:table-cell">
          ${escapeHtml(item.channel_name || 'YouTube')}
        </td>
        <td class="py-3 px-3 text-xs text-slate-400 hidden md:table-cell">
          ${dateStr}
        </td>
        <td class="py-2.5 sm:py-3 pl-1 sm:pl-3 pr-3 sm:pr-5 w-24 sm:w-28 text-right">
          <div class="flex items-center justify-end gap-1 sm:gap-1.5">
            <button class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-mint-500/10 hover:bg-mint-500 hover:text-dark-950 text-mint-400 flex items-center justify-center transition-all shadow-sm active:scale-90" onclick="App.playSongFromList(${JSON.stringify(escapeQuotesInObj(item)).replace(/"/g, '&quot;')})" title="Play">
              <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all" onclick="App.openAddToPlaylistModal(${item.id}, '${escapeQuote(item.title)}')" title="Add to Playlist">
              <svg class="w-3.5 sm:w-4 h-3.5 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // PLAYLIST DETAIL
  async function loadPlaylistDetail(playlistId) {
    if (!playlistId) return;
    try {
      const res = await API.getPlaylist(playlistId);
      const playlist = res.playlist;
      if (!playlist) return;

      // Update Header
      const nameEl = document.getElementById('detail-playlist-name');
      const descEl = document.getElementById('detail-playlist-desc');
      const countEl = document.getElementById('detail-playlist-count');
      const updatedEl = document.getElementById('detail-playlist-updated');

      if (nameEl) nameEl.textContent = playlist.name;
      if (descEl) descEl.textContent = playlist.description || 'No description provided.';
      if (countEl) {
        const num = playlist.song_count || 0;
        countEl.innerHTML = `<span class="playlist-song-num">${num}</span> <span data-i18n="songs_count">${window.I18n ? I18n.t('songs_count') : 'songs'}</span>`;
      }
      if (updatedEl) {
        const d = playlist.updated_at ? new Date(playlist.updated_at).toLocaleDateString() : (window.I18n && I18n.getLanguage() === 'km' ? 'ថ្មីៗ' : (window.I18n && I18n.getLanguage() === 'zh' ? '最近' : 'recently'));
        updatedEl.innerHTML = `<span data-i18n="updated">${window.I18n ? I18n.t('updated') : 'Updated'}</span> <span>${d}</span>`;
      }

      // Bind Header Action Buttons
      const btnPlayAll = document.getElementById('btn-play-playlist');
      if (btnPlayAll) {
        btnPlayAll.onclick = () => {
          if (playlist.songs && playlist.songs.length > 0) {
            Player.playPlaylist(playlist.songs);
          } else {
            showToast('Playlist is empty.', 'info');
          }
        };
      }

      const btnAddSong = document.getElementById('btn-add-to-current-playlist');
      if (btnAddSong) {
        btnAddSong.onclick = () => openAddSongModalWithPlaylist(playlist.id);
      }

      const btnEmptyAddSong = document.getElementById('btn-empty-add-song');
      if (btnEmptyAddSong) {
        btnEmptyAddSong.onclick = () => openAddSongModalWithPlaylist(playlist.id);
      }

      const btnEdit = document.getElementById('btn-edit-playlist-info');
      if (btnEdit) {
        btnEdit.onclick = () => openEditPlaylistModal(playlist.id, playlist.name, playlist.description);
      }

      const btnDelete = document.getElementById('btn-delete-playlist-action');
      if (btnDelete) {
        btnDelete.onclick = () => confirmDeletePlaylist(playlist.id, playlist.name);
      }

      // Render Playlist Songs Table
      renderPlaylistSongsTable(playlist.songs || [], playlist.id);
    } catch (err) {
      showToast('Could not load playlist details.', 'error');
    }
  }

  function renderPlaylistSongsTable(songs, playlistId) {
    const tbody = document.getElementById('playlist-songs-tbody');
    const emptyState = document.getElementById('playlist-empty-state');
    if (!tbody) return;

    if (!songs || songs.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = '';

    songs.forEach((song, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'group hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0';
      const thumb = song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
      const isFirst = idx === 0;
      const isLast = idx === songs.length - 1;

      tr.innerHTML = `
        <td class="py-3 pl-3 sm:pl-5 pr-1 sm:pr-2 w-8 sm:w-12 text-center text-xs font-mono text-slate-500 group-hover:text-mint-400 font-semibold select-none hidden sm:table-cell">
          <span class="group-hover:hidden">${idx + 1}</span>
          <button class="hidden group-hover:inline-flex w-6 h-6 rounded-md bg-mint-500/20 text-mint-400 hover:bg-mint-500 hover:text-dark-950 items-center justify-center transition-all mx-auto" onclick="App.playPlaylistTrack(${playlistId}, ${idx})" title="Play">
            <svg class="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </td>
        <td class="py-2.5 sm:py-3 px-2 sm:px-3 w-14 sm:w-16">
          <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-dark-800 border border-white/10 group/thumb cursor-pointer shadow-md flex-shrink-0" onclick="App.playPlaylistTrack(${playlistId}, ${idx})">
            <img src="${thumb}" alt="Thumb" class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200" onerror="this.src='/static/images/placeholder.svg'">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-mint-400 transition-opacity">
              <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        </td>
        <td class="py-2.5 sm:py-3 px-2 sm:px-3 min-w-0">
          <div class="font-semibold text-xs sm:text-sm text-slate-100 group-hover:text-white truncate cursor-pointer hover:underline flex items-center gap-1.5" onclick="App.playPlaylistTrack(${playlistId}, ${idx})" title="${escapeHtml(song.title)}">
            <span class="truncate">${escapeHtml(song.title)}</span>
            ${(song.is_downloaded || song.audio_url) ? '<span class="text-[9px] text-mint-400 bg-mint-500/10 border border-mint-500/20 px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0">⚡ Audio</span>' : ''}
          </div>
          <div class="text-[11px] text-slate-400 truncate sm:hidden mt-0.5">
            ${escapeHtml(song.channel_name || 'YouTube')}
          </div>
        </td>
        <td class="py-3 px-3 text-xs text-slate-400 truncate max-w-[200px] hidden sm:table-cell">
          ${escapeHtml(song.channel_name || 'YouTube')}
        </td>
        <td class="py-3 px-3 w-28 text-center hidden md:table-cell">
          <div class="flex items-center justify-center gap-1.5">
            <button class="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-white/5 ${isFirst ? 'opacity-25 cursor-not-allowed' : 'hover:border-mint-500/30'}" title="Move Up" aria-label="Move Up" ${isFirst ? 'disabled' : ''} onclick="App.movePlaylistItem(${playlistId}, ${idx}, -1)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-white/5 ${isLast ? 'opacity-25 cursor-not-allowed' : 'hover:border-mint-500/30'}" title="Move Down" aria-label="Move Down" ${isLast ? 'disabled' : ''} onclick="App.movePlaylistItem(${playlistId}, ${idx}, 1)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </td>
        <td class="py-2.5 sm:py-3 pl-1 sm:pl-3 pr-3 sm:pr-5 w-20 sm:w-32 text-right">
          <div class="flex items-center justify-end gap-1 sm:gap-1.5">
            ${!(song.is_downloaded || song.audio_url) ? `
              <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-mint-400 hover:bg-mint-500/10 flex items-center justify-center transition-all active:scale-90" onclick="App.downloadTrackAudio(${song.id}, this)" title="Download Audio">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
            ` : ''}
            <button class="w-8 h-8 rounded-lg bg-mint-500/10 hover:bg-mint-500 hover:text-dark-950 text-mint-400 flex items-center justify-center transition-all shadow-sm active:scale-90" onclick="App.playPlaylistTrack(${playlistId}, ${idx})" title="Play Track">
              <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all border border-transparent hover:border-rose-500/20 active:scale-90" title="Remove from playlist" aria-label="Remove" onclick="App.removeSongFromPlaylist(${playlistId}, ${song.id})">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Generic Song Table Renderer (All Songs / Favorites)
  function renderSongTable(songs, tbodyId, emptyStateId, options = {}) {
    const tbody = document.getElementById(tbodyId);
    const emptyState = document.getElementById(emptyStateId);
    if (!tbody) return;

    if (!songs || songs.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = '';

    songs.forEach((song, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'group hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0';
      const thumb = song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
      const isFav = Boolean(song.is_favorite);

      tr.innerHTML = `
        <td class="py-3 pl-3 sm:pl-5 pr-1 sm:pr-2 w-8 sm:w-12 text-center text-xs font-mono text-slate-500 group-hover:text-mint-400 font-semibold select-none hidden sm:table-cell">
          <span class="group-hover:hidden">${idx + 1}</span>
          <button class="hidden group-hover:inline-flex w-6 h-6 rounded-md bg-mint-500/20 text-mint-400 hover:bg-mint-500 hover:text-dark-950 items-center justify-center transition-all mx-auto" onclick="App.playSongById(${song.id})" title="Play">
            <svg class="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </td>
        <td class="py-2.5 sm:py-3 px-2 sm:px-3 w-14 sm:w-16">
          <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-dark-800 border border-white/10 group/thumb cursor-pointer shadow-md flex-shrink-0" onclick="App.playSongById(${song.id})">
            <img src="${thumb}" alt="Thumb" class="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200" onerror="this.src='/static/images/placeholder.svg'">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-mint-400 transition-opacity">
              <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        </td>
        <td class="py-2.5 sm:py-3 px-2 sm:px-3 min-w-0">
          <div class="font-semibold text-xs sm:text-sm text-slate-100 group-hover:text-white truncate cursor-pointer hover:underline flex items-center gap-1.5" onclick="App.playSongById(${song.id})" title="${escapeHtml(song.title)}">
            <span class="truncate">${escapeHtml(song.title)}</span>
            ${(song.is_downloaded || song.audio_url) ? '<span class="text-[9px] text-mint-400 bg-mint-500/10 border border-mint-500/20 px-1.5 py-0.5 rounded font-mono font-medium flex-shrink-0">⚡ Audio</span>' : ''}
          </div>
          <div class="text-[11px] text-slate-400 truncate sm:hidden mt-0.5">
            ${escapeHtml(song.channel_name || 'YouTube')}
          </div>
        </td>
        <td class="py-3 px-3 text-xs text-slate-400 truncate max-w-[200px] hidden sm:table-cell">
          ${escapeHtml(song.channel_name || 'YouTube')}
        </td>
        <td class="py-2.5 sm:py-3 pl-1 sm:pl-3 pr-3 sm:pr-5 w-24 sm:w-40 text-right">
          <div class="flex items-center justify-end gap-1 sm:gap-1.5">
            ${!(song.is_downloaded || song.audio_url) ? `
              <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-mint-400 hover:bg-mint-500/10 flex items-center justify-center transition-all active:scale-90" onclick="App.downloadTrackAudio(${song.id}, this)" title="Download Audio">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
            ` : ''}
            <button class="w-8 h-8 rounded-lg bg-mint-500/10 hover:bg-mint-500 hover:text-dark-950 text-mint-400 flex items-center justify-center transition-all shadow-sm active:scale-90" onclick="App.playSongById(${song.id})" title="Play">
              <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            ${options.allowAddToPlaylist ? `
              <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all active:scale-90" onclick="App.openAddToPlaylistModal(${song.id}, '${escapeQuote(song.title)}')" title="Add to Playlist">
                <svg class="w-3.5 sm:w-4 h-3.5 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            ` : ''}
            <button class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all active:scale-90" onclick="App.toggleFavorite(${song.id})" title="Toggle Favorite">
              <svg class="w-3.5 sm:w-4 h-3.5 sm:h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-400'}" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            ${options.allowDeleteFromLibrary ? `
              <button class="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-all active:scale-90" onclick="App.confirmDeleteLibrarySong(${song.id}, '${escapeQuote(song.title)}')" title="Delete from Library">
                <svg class="w-3.5 sm:w-4 h-3.5 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // ========================================================
  // Playlist Reordering & Actions
  // ========================================================
  async function movePlaylistItem(playlistId, index, direction) {
    try {
      const res = await API.getPlaylist(playlistId);
      const songs = res.playlist.songs || [];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= songs.length) return;

      // Swap
      const temp = songs[index];
      songs[index] = songs[targetIndex];
      songs[targetIndex] = temp;

      const newOrderedIds = songs.map(s => s.id);
      await API.reorderPlaylist(playlistId, newOrderedIds);
      showToast('Playlist reordered successfully.', 'success');
      loadPlaylistDetail(playlistId);
    } catch (err) {
      showToast(err.message || 'Failed to reorder playlist.', 'error');
    }
  }

  async function removeSongFromPlaylist(playlistId, songId) {
    try {
      await API.removeSongFromPlaylist(playlistId, songId);
      showToast('Song removed from playlist.', 'info');
      loadPlaylistDetail(playlistId);
      loadPlaylists();
    } catch (err) {
      showToast('Could not remove song from playlist.', 'error');
    }
  }

  async function playPlaylistTrack(playlistId, trackIndex) {
    try {
      const res = await API.getPlaylist(playlistId);
      if (res && res.playlist && res.playlist.songs) {
        Player.playPlaylist(res.playlist.songs, trackIndex);
      }
    } catch (e) {
      showToast('Error playing track.', 'error');
    }
  }

  async function playEntirePlaylist(playlistId) {
    try {
      const res = await API.getPlaylist(playlistId);
      if (res && res.playlist && res.playlist.songs && res.playlist.songs.length > 0) {
        Player.playPlaylist(res.playlist.songs, 0);
      } else {
        showToast('This playlist contains no songs.', 'info');
      }
    } catch (e) {
      showToast('Could not start playlist playback.', 'error');
    }
  }

  // ========================================================
  // Song Actions (Play, Favorite, Delete)
  // ========================================================
  function playSongById(songId) {
    const song = librarySongs.find(s => s.id === songId);
    if (song) {
      Player.playSong(song, librarySongs);
    }
  }

  function playSongFromList(song) {
    if (song) {
      Player.playSong(song);
    }
  }

  async function toggleFavorite(songId) {
    // Find current state
    const currentSong = librarySongs.find(s => s.id === songId);
    const newStatus = currentSong ? !currentSong.is_favorite : true;

    try {
      const res = await API.setFavorite(songId, newStatus);
      showToast(newStatus ? 'Added to Favorites!' : 'Removed from Favorites.', 'info');

      // Update in cached library
      if (currentSong) currentSong.is_favorite = res.is_favorite;

      // Update in player
      Player.updateFavoriteStatus(songId, res.is_favorite);

      // Refresh current view
      if (activeView === 'all-songs') loadAllSongs();
      else if (activeView === 'favorites') loadFavorites();
      else if (activeView === 'dashboard') loadDashboard();
    } catch (err) {
      showToast('Failed to update favorite status.', 'error');
    }
  }

  function confirmDeleteLibrarySong(songId, songTitle) {
    const modal = document.getElementById('modal-confirm');
    const msg = document.getElementById('confirm-dialog-message');
    const btnSubmit = document.getElementById('btn-confirm-action-submit');

    if (!modal || !msg || !btnSubmit) return;

    msg.textContent = `Are you sure you want to remove "${songTitle}" from your personal library? This will also remove it from all your playlists and history.`;
    btnSubmit.onclick = async () => {
      try {
        await API.deleteLibrarySong(songId);
        closeModal('modal-confirm');
        showToast('Song removed from your library successfully.', 'success');
        loadAllSongs();
        loadPlaylists();
      } catch (err) {
        showToast('Failed to remove song.', 'error');
      }
    };

    openModal('modal-confirm');
  }

  function confirmDeletePlaylist(playlistId, playlistName) {
    const modal = document.getElementById('modal-confirm');
    const msg = document.getElementById('confirm-dialog-message');
    const btnSubmit = document.getElementById('btn-confirm-action-submit');

    if (!modal || !msg || !btnSubmit) return;

    msg.textContent = `Are you sure you want to delete playlist "${playlistName}"? Songs will remain safely in your personal library.`;
    btnSubmit.onclick = async () => {
      try {
        await API.deletePlaylist(playlistId);
        closeModal('modal-confirm');
        showToast('Playlist deleted successfully.', 'success');
        loadPlaylists();
        switchView('dashboard');
      } catch (err) {
        showToast('Failed to delete playlist.', 'error');
      }
    };

    openModal('modal-confirm');
  }

  // ========================================================
  // Playlists Navigation & Sidebar
  // ========================================================
  async function loadPlaylists() {
    try {
      userPlaylists = await API.getPlaylists() || [];
      renderSidebarPlaylists(userPlaylists);
      updatePlaylistSelectDropdowns(userPlaylists);
    } catch (err) {
      console.warn('Failed to load playlists:', err);
    }
  }

  function renderSidebarPlaylists(playlists) {
    const list = document.getElementById('sidebar-playlists-list');
    if (!list) return;

    if (!playlists || playlists.length === 0) {
      list.innerHTML = '<li class="empty-nav-text px-3 py-2 text-xs italic text-slate-500">No playlists yet</li>';
      return;
    }

    list.innerHTML = '';
    playlists.forEach(pl => {
      const li = document.createElement('li');
      const isActive = (activeView === 'playlist-detail' && currentPlaylistId == pl.id);
      li.innerHTML = `
        <button class="nav-item playlist-nav-item w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all group ${isActive ? 'active' : ''}" data-view="playlist-detail" data-playlist-id="${pl.id}">
          <div class="flex items-center gap-2.5 truncate min-w-0">
            <div class="playlist-icon-box w-6 h-6 rounded-lg bg-dark-800/80 group-hover:bg-dark-750 flex items-center justify-center text-mint-400 flex-shrink-0 transition-colors border border-white/5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <span class="playlist-name-text truncate font-medium text-slate-300 group-hover:text-white">${escapeHtml(pl.name)}</span>
          </div>
          <span class="badge-count ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-dark-800 text-slate-400 group-hover:bg-dark-750 flex-shrink-0 border border-white/5">
            ${pl.song_count || 0}
          </span>
        </button>
      `;

      li.querySelector('button').addEventListener('click', () => {
        switchView('playlist-detail', pl.id);
      });

      list.appendChild(li);
    });
  }

  function updatePlaylistSelectDropdowns(playlists) {
    const targetSelect = document.getElementById('select-target-playlist');
    const atpSelect = document.getElementById('atp-playlist-select');

    if (targetSelect) {
      const currentValue = targetSelect.value;
      targetSelect.innerHTML = '<option value="">-- Personal Library Only --</option>';
      playlists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        targetSelect.appendChild(opt);
      });
      targetSelect.value = currentValue;
    }

    if (atpSelect) {
      atpSelect.innerHTML = '';
      playlists.forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = `${pl.name} (${pl.song_count || 0} songs)`;
        atpSelect.appendChild(opt);
      });
    }
  }

  // ========================================================
  // Global Search
  // ========================================================
  function bindGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    const searchClear = document.getElementById('search-clear-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchClear) searchClear.style.display = query ? 'block' : 'none';

        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          if (query && activeView !== 'all-songs') {
            switchView('all-songs');
          }
          loadAllSongs(query);
        }, 300);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchClear.style.display = 'none';
          loadAllSongs();
        }
      });
    }
  }

  // ========================================================
  // Modals Controller
  // ========================================================
  function bindModals() {
    // Add Song Modal Trigger
    const btnAddSongModal = document.getElementById('btn-add-song-modal');
    if (btnAddSongModal) {
      btnAddSongModal.addEventListener('click', () => openAddSongModal());
    }

    // Preview Metadata button
    const btnPreview = document.getElementById('btn-preview-metadata');
    if (btnPreview) {
      btnPreview.addEventListener('click', async () => {
        const urlInput = document.getElementById('input-yt-url');
        const url = (urlInput ? urlInput.value : '').trim();
        if (!url) {
          showToast('Please enter a YouTube video URL first.', 'warning');
          return;
        }

        const previewCard = document.getElementById('metadata-preview-card');
        const previewThumb = document.getElementById('preview-thumb-img');
        const previewTitle = document.getElementById('preview-title-text');
        const previewChannel = document.getElementById('preview-channel-text');
        const previewNote = document.getElementById('preview-note-text');
        const customTitleInput = document.getElementById('input-custom-title');
        const spinnerText = document.getElementById('preview-btn-text');
        const spinner = document.getElementById('preview-spinner');

        try {
          if (spinnerText) spinnerText.style.display = 'none';
          if (spinner) spinner.style.display = 'inline-block';

          const meta = await API.fetchMetadata(url);

          if (previewCard) previewCard.style.display = 'flex';
          if (previewThumb) previewThumb.src = meta.thumbnail_url || `https://img.youtube.com/vi/${meta.video_id}/hqdefault.jpg`;
          if (previewTitle) previewTitle.textContent = meta.title;
          if (previewChannel) previewChannel.textContent = meta.channel_name;
          if (previewNote) previewNote.textContent = meta.note || '';

          if (customTitleInput && !customTitleInput.value) {
            customTitleInput.value = meta.title;
          }
        } catch (err) {
          showToast(err.message || 'Failed to fetch metadata. You can still save with a manual title.', 'warning');
        } finally {
          if (spinnerText) spinnerText.style.display = 'inline';
          if (spinner) spinner.style.display = 'none';
        }
      });
    }

    // Playlist link detection on Add Song URL input
    const inputYtUrl = document.getElementById('input-yt-url');
    const alertPlDetect = document.getElementById('alert-add-song-is-playlist');
    const btnSwitchToPlImport = document.getElementById('btn-switch-to-import-playlist');
    if (inputYtUrl && alertPlDetect) {
      inputYtUrl.addEventListener('input', () => {
        const val = inputYtUrl.value.trim();
        if (val.includes('list=') || val.includes('/playlist')) {
          alertPlDetect.style.display = 'flex';
        } else {
          alertPlDetect.style.display = 'none';
        }
      });
    }
    if (btnSwitchToPlImport) {
      btnSwitchToPlImport.addEventListener('click', () => {
        const val = inputYtUrl ? inputYtUrl.value.trim() : '';
        closeModal('modal-add-song');
        openCreatePlaylistModal('import', val);
      });
    }

    // Save Song Submit
    const btnSaveSong = document.getElementById('btn-save-song-submit');
    if (btnSaveSong) {
      btnSaveSong.addEventListener('click', async () => {
        const url = (document.getElementById('input-yt-url').value || '').trim();
        const customTitle = (document.getElementById('input-custom-title').value || '').trim();
        const playlistId = document.getElementById('select-target-playlist').value;
        const downloadAudio = document.getElementById('input-download-audio') ? document.getElementById('input-download-audio').checked : true;

        if (!url) {
          showToast('Please enter a YouTube URL.', 'warning');
          return;
        }

        const origHtml = btnSaveSong.innerHTML;
        try {
          btnSaveSong.disabled = true;
          btnSaveSong.innerHTML = `
            <div class="flex items-center gap-2">
              <div class="w-3.5 h-3.5 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin"></div>
              <span>${downloadAudio ? 'Downloading audio & saving...' : 'Saving song...'}</span>
            </div>
          `;

          const res = await API.addSong({
            url,
            title: customTitle,
            playlist_id: playlistId ? parseInt(playlistId, 10) : null,
            download: downloadAudio
          });

          closeModal('modal-add-song');
          showToast(res.message, res.already_saved ? 'info' : 'success');

          // Refresh data
          loadDashboard();
          loadPlaylists();
          if (activeView === 'all-songs') loadAllSongs();
          if (playlistId && activeView === 'playlist-detail' && currentPlaylistId == playlistId) {
            loadPlaylistDetail(playlistId);
          }
        } catch (err) {
          showToast(err.message || 'Could not save song.', 'error');
        } finally {
          btnSaveSong.disabled = false;
          btnSaveSong.innerHTML = origHtml;
        }
      });
    }

    // Create Playlist Modal Triggers
    const btnCreateTrigger = document.getElementById('btn-create-playlist-trigger');
    const btnCreateLink = document.getElementById('btn-create-playlist-link');
    const btnImportHeaderLink = document.getElementById('btn-import-playlist-header-link');
    if (btnCreateTrigger) btnCreateTrigger.addEventListener('click', () => openCreatePlaylistModal('blank'));
    if (btnCreateLink) btnCreateLink.addEventListener('click', () => openCreatePlaylistModal('blank'));
    if (btnImportHeaderLink) btnImportHeaderLink.addEventListener('click', () => openCreatePlaylistModal('import'));

    // Mode Selector Tabs inside Modal
    const tabBlankBtn = document.getElementById('tab-playlist-blank-btn');
    const tabImportBtn = document.getElementById('tab-playlist-import-btn');
    if (tabBlankBtn) tabBlankBtn.addEventListener('click', () => setPlaylistModalTab('blank'));
    if (tabImportBtn) tabImportBtn.addEventListener('click', () => setPlaylistModalTab('import'));

    // Preview YouTube Playlist button & input Enter
    const btnPreviewPl = document.getElementById('btn-preview-playlist-url');
    const inputPlImportUrl = document.getElementById('input-playlist-import-url');
    if (btnPreviewPl) btnPreviewPl.addEventListener('click', () => handlePlaylistPreview());
    if (inputPlImportUrl) {
      inputPlImportUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handlePlaylistPreview();
        }
      });
    }

    // Import YouTube Playlist Submit
    const btnImportPlSubmit = document.getElementById('btn-import-playlist-submit');
    if (btnImportPlSubmit) {
      btnImportPlSubmit.addEventListener('click', async () => {
        const urlInput = document.getElementById('input-playlist-import-url');
        const nameInput = document.getElementById('input-playlist-import-name');
        const descInput = document.getElementById('input-playlist-import-desc');
        const downloadCheckbox = document.getElementById('input-playlist-download-audio');

        const url = (urlInput ? urlInput.value : '').trim();
        const name = (nameInput ? nameInput.value : '').trim();
        const desc = (descInput ? descInput.value : '').trim();
        const downloadAudio = downloadCheckbox ? downloadCheckbox.checked : true;

        if (!url) {
          showToast('Please provide a YouTube playlist URL.', 'warning');
          return;
        }

        const submitBtnText = document.getElementById('import-playlist-submit-text');
        const spinner = document.getElementById('import-playlist-spinner');
        const origText = submitBtnText ? submitBtnText.textContent : 'Import Playlist';

        try {
          btnImportPlSubmit.disabled = true;
          if (submitBtnText) submitBtnText.textContent = 'Importing playlist...';
          if (spinner) spinner.style.display = 'inline-block';

          const res = await API.importPlaylist({
            url,
            name: name || undefined,
            description: desc,
            download_audio: downloadAudio
          });

          closeModal('modal-create-playlist');
          showToast(res.message || 'Playlist imported successfully!', 'success');
          loadPlaylists();
          loadDashboard();
          if (res.playlist && res.playlist.id) {
            switchView('playlist-detail', res.playlist.id);
          }
        } catch (err) {
          showToast(err.message || 'Failed to import playlist.', 'error');
        } finally {
          btnImportPlSubmit.disabled = false;
          if (submitBtnText) submitBtnText.textContent = origText;
          if (spinner) spinner.style.display = 'none';
        }
      });
    }

    // Blank Playlist Submit

    const btnCreatePlSubmit = document.getElementById('btn-create-playlist-submit');
    if (btnCreatePlSubmit) {
      btnCreatePlSubmit.addEventListener('click', async () => {
        const nameInput = document.getElementById('input-playlist-name');
        const descInput = document.getElementById('input-playlist-desc');
        const name = (nameInput ? nameInput.value : '').trim();
        const desc = (descInput ? descInput.value : '').trim();

        if (!name) {
          showToast('Please provide a playlist name.', 'warning');
          return;
        }

        try {
          const res = await API.createPlaylist({ name, description: desc });
          closeModal('modal-create-playlist');
          showToast('Playlist created successfully!', 'success');
          loadPlaylists();
          switchView('playlist-detail', res.playlist.id);
        } catch (err) {
          showToast(err.message || 'Failed to create playlist.', 'error');
        }
      });
    }

    // Edit Playlist Submit
    const btnEditPlSubmit = document.getElementById('btn-edit-playlist-submit');
    if (btnEditPlSubmit) {
      btnEditPlSubmit.addEventListener('click', async () => {
        const id = document.getElementById('edit-playlist-id').value;
        const name = document.getElementById('edit-playlist-name').value.trim();
        const desc = document.getElementById('edit-playlist-desc').value.trim();

        if (!name) {
          showToast('Playlist name cannot be empty.', 'warning');
          return;
        }

        try {
          await API.updatePlaylist(id, { name, description: desc });
          closeModal('modal-edit-playlist');
          showToast('Playlist updated successfully!', 'success');
          loadPlaylists();
          loadPlaylistDetail(id);
        } catch (err) {
          showToast(err.message || 'Failed to update playlist.', 'error');
        }
      });
    }

    // Add To Playlist Modal Submit
    const btnAtpSubmit = document.getElementById('btn-atp-submit');
    if (btnAtpSubmit) {
      btnAtpSubmit.addEventListener('click', async () => {
        const songId = document.getElementById('atp-song-id').value;
        const playlistId = document.getElementById('atp-playlist-select').value;

        if (!playlistId) {
          showToast('Please select a playlist.', 'warning');
          return;
        }

        try {
          const res = await API.addSongToPlaylist(playlistId, { song_id: parseInt(songId, 10) });
          closeModal('modal-add-to-playlist');
          showToast(res.message, res.already_in_playlist ? 'info' : 'success');
          loadPlaylists();
          if (activeView === 'playlist-detail' && currentPlaylistId == playlistId) {
            loadPlaylistDetail(playlistId);
          }
        } catch (err) {
          showToast(err.message || 'Failed to add song to playlist.', 'error');
        }
      });
    }
  }

  function openAddSongModal() {
    const urlInput = document.getElementById('input-yt-url');
    const titleInput = document.getElementById('input-custom-title');
    const previewCard = document.getElementById('metadata-preview-card');
    if (urlInput) urlInput.value = '';
    if (titleInput) titleInput.value = '';
    if (previewCard) previewCard.style.display = 'none';

    openModal('modal-add-song');
  }

  function openAddSongModalWithPlaylist(playlistId) {
    openAddSongModal();
    const select = document.getElementById('select-target-playlist');
    if (select) select.value = playlistId;
  }

  function setPlaylistModalTab(mode) {
    const tabBlankBtn = document.getElementById('tab-playlist-blank-btn');
    const tabImportBtn = document.getElementById('tab-playlist-import-btn');
    const panelBlank = document.getElementById('panel-playlist-blank');
    const panelImport = document.getElementById('panel-playlist-import');

    const activeClasses = 'flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-dark-750 shadow-sm transition-all flex items-center justify-center gap-1.5 border border-white/5';
    const inactiveClasses = 'flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';

    if (mode === 'import') {
      if (panelBlank) panelBlank.style.display = 'none';
      if (panelImport) panelImport.style.display = 'block';
      if (tabBlankBtn) tabBlankBtn.className = inactiveClasses;
      if (tabImportBtn) tabImportBtn.className = activeClasses;
    } else {
      if (panelBlank) panelBlank.style.display = 'block';
      if (panelImport) panelImport.style.display = 'none';
      if (tabBlankBtn) tabBlankBtn.className = activeClasses;
      if (tabImportBtn) tabImportBtn.className = inactiveClasses;
    }
  }

  async function handlePlaylistPreview() {
    const input = document.getElementById('input-playlist-import-url');
    const url = (input ? input.value : '').trim();
    if (!url) {
      showToast('Please enter a YouTube playlist URL.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-preview-playlist-url');
    const spinnerText = document.getElementById('preview-playlist-btn-text');
    const spinner = document.getElementById('preview-playlist-spinner');
    const previewCard = document.getElementById('playlist-import-preview-card');
    const previewThumb = document.getElementById('preview-playlist-thumb-img');
    const previewTitle = document.getElementById('preview-playlist-title-text');
    const previewChannel = document.getElementById('preview-playlist-channel-text');
    const previewCountBadge = document.getElementById('preview-playlist-count-badge');
    const nameInput = document.getElementById('input-playlist-import-name');
    const descInput = document.getElementById('input-playlist-import-desc');
    const submitBtnText = document.getElementById('import-playlist-submit-text');

    try {
      if (spinnerText) spinnerText.style.display = 'none';
      if (spinner) spinner.style.display = 'inline-block';
      if (btn) btn.disabled = true;

      const info = await API.fetchPlaylistMetadata(url);

      if (previewCard) previewCard.style.display = 'flex';
      if (previewThumb) previewThumb.src = info.thumbnail_url || 'https://img.youtube.com/vi/placeholder/hqdefault.jpg';
      if (previewTitle) previewTitle.textContent = info.title;
      if (previewChannel) previewChannel.textContent = info.channel_name || 'YouTube Playlist';
      if (previewCountBadge) previewCountBadge.textContent = `${info.song_count || 0} tracks`;

      if (nameInput && !nameInput.value) {
        nameInput.value = info.title || '';
      }
      if (descInput && !descInput.value && info.description) {
        descInput.value = info.description;
      }
      if (submitBtnText && info.song_count) {
        submitBtnText.textContent = `Import Playlist (${info.song_count} songs)`;
      }
      showToast(`Found playlist: "${info.title}" (${info.song_count} songs)`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not fetch playlist metadata.', 'error');
    } finally {
      if (spinnerText) spinnerText.style.display = 'inline';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  }

  function openCreatePlaylistModal(initialTab = 'blank', initialUrl = '') {
    const nameInput = document.getElementById('input-playlist-name');
    const descInput = document.getElementById('input-playlist-desc');
    const importUrlInput = document.getElementById('input-playlist-import-url');
    const importNameInput = document.getElementById('input-playlist-import-name');
    const importDescInput = document.getElementById('input-playlist-import-desc');
    const previewCard = document.getElementById('playlist-import-preview-card');
    const submitBtnText = document.getElementById('import-playlist-submit-text');

    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (importUrlInput) importUrlInput.value = initialUrl || '';
    if (importNameInput) importNameInput.value = '';
    if (importDescInput) importDescInput.value = '';
    if (previewCard) previewCard.style.display = 'none';
    if (submitBtnText) submitBtnText.textContent = 'Import Playlist';

    setPlaylistModalTab(initialTab);
    openModal('modal-create-playlist');

    if (initialTab === 'import' && initialUrl) {
      handlePlaylistPreview();
    }
  }

  function openEditPlaylistModal(id, name, desc) {
    document.getElementById('edit-playlist-id').value = id;
    document.getElementById('edit-playlist-name').value = name;
    document.getElementById('edit-playlist-desc').value = desc || '';
    openModal('modal-edit-playlist');
  }

  function openAddToPlaylistModal(songId, songTitle) {
    document.getElementById('atp-song-id').value = songId;
    document.getElementById('atp-song-title').textContent = `Adding: "${songTitle}"`;
    openModal('modal-add-to-playlist');
  }

  // ========================================================
  // Mobile Drawers
  // ========================================================
  function openSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }

  function openPlayerPanel() {
    const playerPanel = document.getElementById('app-player-panel');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (playerPanel) playerPanel.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeAllDrawers() {
    const sidebar = document.getElementById('app-sidebar');
    const playerPanel = document.getElementById('app-player-panel');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (playerPanel) playerPanel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  function bindMobileDrawers() {
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    const toggleSidebar = document.getElementById('mobile-sidebar-toggle');
    const closeSidebar = document.getElementById('sidebar-close-btn');

    const togglePlayer = document.getElementById('mobile-queue-toggle');
    const togglePlayerBottom = document.getElementById('btn-toggle-queue-panel');
    const closePlayer = document.getElementById('close-player-panel-btn');

    // Mobile Bottom Nav tabs
    const mobHome = document.getElementById('mob-nav-home');
    const mobSongs = document.getElementById('mob-nav-songs');
    const mobPlaylists = document.getElementById('mob-nav-playlists');
    const mobPlayer = document.getElementById('mob-nav-player');

    if (toggleSidebar) toggleSidebar.addEventListener('click', openSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', closeAllDrawers);

    if (togglePlayer) togglePlayer.addEventListener('click', openPlayerPanel);
    if (togglePlayerBottom) togglePlayerBottom.addEventListener('click', openPlayerPanel);
    if (closePlayer) closePlayer.addEventListener('click', closeAllDrawers);

    if (backdrop) backdrop.addEventListener('click', closeAllDrawers);

    if (mobHome) mobHome.addEventListener('click', () => switchView('dashboard'));
    if (mobSongs) mobSongs.addEventListener('click', () => switchView('all-songs'));
    if (mobPlaylists) mobPlaylists.addEventListener('click', openSidebar);
    if (mobPlayer) mobPlayer.addEventListener('click', openPlayerPanel);
  }

  // ========================================================
  // Sidebar User Account Menu
  // ========================================================
  function bindUserMenu() {
    const trigger = document.getElementById('sidebar-user-trigger');
    const menu = document.getElementById('sidebar-user-menu');
    const chevron = document.getElementById('sidebar-user-chevron-icon');

    if (!trigger || !menu) return;

    function toggleMenu(show) {
      const shouldOpen = show !== undefined ? show : menu.classList.contains('hidden');
      if (shouldOpen) {
        menu.classList.remove('hidden');
        trigger.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.classList.add('rotate-180');
      } else {
        menu.classList.add('hidden');
        trigger.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !trigger.contains(e.target)) {
        toggleMenu(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
        toggleMenu(false);
        trigger.focus();
      }
    });
  }

  // ========================================================
  // Theme Manager (Dark / Light Mode)
  // ========================================================
  function initTheme() {
    const savedTheme = localStorage.getItem('sak_theme') || 'dark';
    applyTheme(savedTheme, false);

    const btnDark = document.getElementById('btn-theme-dark');
    const btnLight = document.getElementById('btn-theme-light');
    const btnTopbar = document.getElementById('btn-topbar-theme-toggle');

    if (btnDark) {
      btnDark.addEventListener('click', () => setTheme('dark'));
    }
    if (btnLight) {
      btnLight.addEventListener('click', () => setTheme('light'));
    }
    if (btnTopbar) {
      btnTopbar.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'light' : 'dark');
      });
    }
  }

  function setTheme(theme) {
    localStorage.setItem('sak_theme', theme);
    applyTheme(theme, true);
  }

  function applyTheme(theme, notify = false) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }

    // Update active styles on pills in dropdown
    const btnDark = document.getElementById('btn-theme-dark');
    const btnLight = document.getElementById('btn-theme-light');
    if (btnDark && btnLight) {
      btnDark.classList.toggle('active-theme', isDark);
      btnLight.classList.toggle('active-theme', !isDark);
    }

    // Update Topbar icons
    const iconSun = document.querySelector('.theme-icon-sun');
    const iconMoon = document.querySelector('.theme-icon-moon');
    if (iconSun && iconMoon) {
      if (isDark) {
        iconSun.classList.remove('hidden');
        iconMoon.classList.add('hidden');
      } else {
        iconSun.classList.add('hidden');
        iconMoon.classList.remove('hidden');
      }
    }

    if (notify) {
      showToast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`, 'info');
    }
  }

  // ========================================================
  // Toast Notifications
  // ========================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Modern behavior: dismiss previous toast so toasts don't stack up
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let icon = 'ℹ';
    let iconSvg = `
      <svg class="w-4 h-4 text-sky-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
    if (type === 'success') {
      iconSvg = `
        <svg class="w-4 h-4 text-mint-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    } else if (type === 'error') {
      iconSvg = `
        <svg class="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    } else if (type === 'warning') {
      iconSvg = `
        <svg class="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `;
    }

    toast.innerHTML = `
      <span class="toast-icon flex items-center justify-center">${iconSvg}</span>
      <span class="toast-message flex-1 leading-snug">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close dialog">&times;</button>
    `;

    const closeToast = () => {
      if (typeof dismissToast === 'function') {
        dismissToast(toast);
      } else {
        toast.remove();
      }
    };

    toast.querySelector('.toast-close').addEventListener('click', closeToast);
    container.appendChild(toast);

    setTimeout(closeToast, 3000);
  }

  // Utility string escaping
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeQuote(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function escapeQuotesInObj(obj) {
    const clean = {};
    for (const k in obj) {
      if (typeof obj[k] === 'string') {
        clean[k] = obj[k].replace(/'/g, "\\'");
      } else {
        clean[k] = obj[k];
      }
    }
    return clean;
  }

  async function downloadTrackAudio(songId, btnEl) {
    if (!songId) return;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.classList.add('animate-pulse');
    }
    showToast('Downloading audio from YouTube...', 'info');
    try {
      const res = await API.downloadSongAudio(songId);
      showToast('Audio downloaded! Ready for direct playback.', 'success');
      // Refresh views
      if (activeView === 'playlist-detail' && currentPlaylistId) {
        loadPlaylistDetail(currentPlaylistId);
      } else if (activeView === 'all-songs') {
        loadAllSongs();
      } else {
        loadDashboard();
      }
    } catch (err) {
      showToast(err.message || 'Download failed.', 'error');
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.classList.remove('animate-pulse');
      }
    }
  }

  return {
    init,
    switchView,
    openCreatePlaylistModal,
    openAddToPlaylistModal,
    playSongById,
    playSongFromList,
    playPlaylistTrack,
    movePlaylistItem,
    removeSongFromPlaylist,
    toggleFavorite,
    confirmDeleteLibrarySong,
    downloadTrackAudio,
    setTheme,
    showToast
  };
})();

// Global Modal helper functions for inline HTML event handlers
window.openModal = (modalId) => {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'flex';
};

window.closeModal = (modalId) => {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'none';
};

window.openAddSongModal = () => {
  window.openModal('modal-add-song');
};

// Initialize App on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.App = App;
  App.init();
});
