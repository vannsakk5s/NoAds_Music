/**
 * Sak Music - Persistent Audio & YouTube Hybrid Player Module
 * Supports both high-fidelity downloaded audio (HTML5 Audio) and official YouTube IFrame streaming.
 * Manages the queue state, repeat/shuffle logic, seek bar, volume, and playback error handling.
 */

const Player = (() => {
  let ytPlayer = null;
  let isApiReady = false;
  let isPlayerReady = false;

  // Active playback engine: 'yt' | 'audio'
  let activeEngine = 'yt';
  let html5Audio = null;

  // Queue & State
  let queue = [];               // Array of song objects: { id, youtube_video_id, title, channel_name, thumbnail_url, audio_url, is_downloaded, ... }
  let originalQueue = [];       // Backup before shuffle
  let currentIndex = -1;
  let isPlaying = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  // Persistent Player State
  const STATE_KEY = 'sak_player_state';
  let pendingSeekTime = 0;
  let pendingAutoPlay = false;
  let lastSavedTime = 0;

  // Modes & Settings (persisted to localStorage)
  let repeatMode = localStorage.getItem('sak_repeat_mode') || 'off'; // 'off' | 'all' | 'one'
  let isShuffled = localStorage.getItem('sak_shuffle') === 'true';
  let savedVolume = parseInt(localStorage.getItem('sak_volume') || '80', 10);
  let isMuted = false;

  // Time & Progress update interval
  let progressInterval = null;
  let isUserSeeking = false;

  // History tracking state to prevent spamming
  let lastRecordedHistorySongId = null;

  // DOM Elements
  let els = {};

  function init() {
    cacheDomElements();
    initHtml5Audio();
    initMediaSession();
    bindEvents();
    applyInitialSettings();

    // Restore persistent playback state if page was refreshed
    restorePlayerState();

    // In case YouTube API script is already loaded by browser
    if (window.YT && window.YT.Player) {
      onYouTubeIframeAPIReady();
    }
  }

  function cacheDomElements() {
    els = {
      container: document.getElementById('yt-player-container'),
      loadingOverlay: document.getElementById('player-loading-overlay'),
      loadingText: document.getElementById('player-loading-text'),
      autoplayAlert: document.getElementById('autoplay-alert-box'),
      btnAutoplayPlay: document.getElementById('btn-unblock-autoplay'),
      errorBox: document.getElementById('player-error-box'),
      errorText: document.getElementById('player-error-text'),
      btnErrorNext: document.getElementById('btn-error-next'),
      btnErrorYtLink: document.getElementById('btn-error-yt-link'),
      btnErrorDownload: document.getElementById('btn-error-download'),
      btnErrorDownloadText: document.getElementById('btn-error-download-text'),

      // Audio visualizer card
      audioVisualizerCard: document.getElementById('audio-visualizer-card'),
      audioVisCover: document.getElementById('audio-vis-cover'),
      
      nowPlayingTitle: document.getElementById('now-playing-title'),
      nowPlayingChannel: document.getElementById('now-playing-channel'),
      queueCountBadge: document.getElementById('queue-count-badge'),
      queueList: document.getElementById('queue-items-list'),
      btnShuffleQueue: document.getElementById('btn-shuffle-queue'),
      btnClearQueue: document.getElementById('btn-clear-queue'),

      // Bottom bar
      miniThumb: document.getElementById('mini-track-thumb'),
      miniTitle: document.getElementById('mini-track-title'),
      miniChannel: document.getElementById('mini-track-channel'),
      miniFavBtn: document.getElementById('mini-favorite-btn'),

      btnShuffle: document.getElementById('btn-control-shuffle'),
      btnPrev: document.getElementById('btn-control-prev'),
      btnPlayPause: document.getElementById('btn-control-play-pause'),
      iconPlay: document.querySelector('.icon-play'),
      iconPause: document.querySelector('.icon-pause'),
      btnNext: document.getElementById('btn-control-next'),
      btnRepeat: document.getElementById('btn-control-repeat'),
      repeatOneIndicator: document.getElementById('repeat-one-indicator'),

      currentTimeLabel: document.getElementById('current-time-label'),
      durationTimeLabel: document.getElementById('duration-time-label'),
      seekSlider: document.getElementById('seek-slider'),
      seekFill: document.getElementById('seek-fill'),

      btnMute: document.getElementById('btn-volume-mute'),
      volumeSlider: document.getElementById('volume-slider'),

      // Mobile Mini Player elements
      mobileMiniThumb: document.getElementById('mobile-mini-thumb'),
      mobileMiniTitle: document.getElementById('mobile-mini-title'),
      mobileMiniChannel: document.getElementById('mobile-mini-channel'),
      mobileMiniPlayPause: document.getElementById('mobile-mini-play-pause'),
      mobileIconPlay: document.querySelector('.mobile-icon-play'),
      mobileIconPause: document.querySelector('.mobile-icon-pause'),
      mobileMiniNext: document.getElementById('mobile-mini-next'),
      mobileMiniFavBtn: document.getElementById('mobile-mini-fav-btn'),
      mobileSeekFill: document.getElementById('mobile-seek-fill'),
      mobileMiniExpand: document.getElementById('mobile-mini-expand-trigger')
    };
  }

  function initHtml5Audio() {
    html5Audio = document.getElementById('html5-audio');
    if (!html5Audio) {
      html5Audio = new Audio();
      html5Audio.id = 'html5-audio';
      document.body.appendChild(html5Audio);
    }

    html5Audio.volume = savedVolume / 100;
    html5Audio.muted = isMuted;

    html5Audio.addEventListener('play', () => {
      if (activeEngine === 'audio') {
        isPlaying = true;
        updatePlayPauseUI(true);
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';
        if (els.errorBox) els.errorBox.style.display = 'none';
        savePlayerState(true);
      }
    });

    html5Audio.addEventListener('pause', () => {
      if (activeEngine === 'audio') {
        isPlaying = false;
        updatePlayPauseUI(false);
        savePlayerState(true);
      }
    });

    html5Audio.addEventListener('ended', () => {
      if (activeEngine === 'audio') {
        isPlaying = false;
        updatePlayPauseUI(false);
        handleTrackEnded();
      }
    });

    html5Audio.addEventListener('timeupdate', () => {
      if (activeEngine === 'audio' && !isUserSeeking) {
        updateProgressFromAudio();
      }
    });

    html5Audio.addEventListener('error', (e) => {
      if (activeEngine === 'audio') {
        console.warn('HTML5 Audio playback error:', e);
        if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';
        onAudioPlaybackError();
      }
    });
  }

  function applyInitialSettings() {
    if (els.volumeSlider) {
      els.volumeSlider.value = savedVolume;
    }
    updateShuffleUI();
    updateRepeatUI();
    startProgressTimer();
  }

  function bindEvents() {
    if (els.btnPlayPause) els.btnPlayPause.addEventListener('click', togglePlay);
    if (els.btnPrev) els.btnPrev.addEventListener('click', prevTrack);
    if (els.btnNext) els.btnNext.addEventListener('click', nextTrack);
    if (els.btnShuffle) els.btnShuffle.addEventListener('click', toggleShuffle);
    if (els.btnRepeat) els.btnRepeat.addEventListener('click', cycleRepeatMode);

    // Mobile Mini Player controls
    if (els.mobileMiniPlayPause) els.mobileMiniPlayPause.addEventListener('click', togglePlay);
    if (els.mobileMiniNext) els.mobileMiniNext.addEventListener('click', () => nextTrack());
    if (els.mobileMiniFavBtn) {
      els.mobileMiniFavBtn.addEventListener('click', () => {
        const currentSong = getCurrentSong();
        if (currentSong && window.App) {
          window.App.toggleFavorite(currentSong.id);
        }
      });
    }
    if (els.mobileMiniExpand) {
      els.mobileMiniExpand.addEventListener('click', () => {
        const panel = document.getElementById('app-player-panel');
        const backdrop = document.getElementById('mobile-drawer-backdrop');
        if (panel) panel.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
      });
    }

    if (els.btnAutoplayPlay) {
      els.btnAutoplayPlay.addEventListener('click', () => {
        if (activeEngine === 'audio' && html5Audio) {
          html5Audio.play();
        } else if (ytPlayer && ytPlayer.playVideo) {
          ytPlayer.playVideo();
        }
        if (els.autoplayAlert) els.autoplayAlert.style.display = 'none';
      });
    }

    if (els.btnErrorNext) {
      els.btnErrorNext.addEventListener('click', () => {
        if (els.errorBox) els.errorBox.style.display = 'none';
        nextTrack(true);
      });
    }

    // 1-Click Download & Play fallback in error box
    if (els.btnErrorDownload) {
      els.btnErrorDownload.addEventListener('click', async () => {
        const song = getCurrentSong();
        if (!song) return;

        const btn = els.btnErrorDownload;
        const textSpan = els.btnErrorDownloadText || btn;
        const originalText = textSpan.textContent;

        btn.disabled = true;
        textSpan.textContent = 'Downloading audio...';

        try {
          const res = await API.downloadSongAudio(song.id);
          if (res && res.song) {
            song.audio_url = res.song.audio_url;
            song.is_downloaded = true;
            if (els.errorBox) els.errorBox.style.display = 'none';
            if (window.App) window.App.showToast('Audio downloaded! Playing directly...', 'success');
            playAudioDirect(song);
          }
        } catch (err) {
          if (window.App) window.App.showToast('Download failed: ' + (err.message || 'Error'), 'error');
        } finally {
          btn.disabled = false;
          textSpan.textContent = originalText;
        }
      });
    }

    if (els.btnShuffleQueue) els.btnShuffleQueue.addEventListener('click', toggleShuffle);
    if (els.btnClearQueue) els.btnClearQueue.addEventListener('click', clearQueue);

    // Seek slider events
    if (els.seekSlider) {
      els.seekSlider.addEventListener('input', () => {
        isUserSeeking = true;
        updateSeekVisuals(els.seekSlider.value);
      });

      els.seekSlider.addEventListener('change', () => {
        const duration = getDuration();
        if (duration > 0) {
          const seekToSeconds = (els.seekSlider.value / 100) * duration;
          seekTo(seekToSeconds);
        }
        isUserSeeking = false;
      });
    }

    // Volume slider
    if (els.volumeSlider) {
      els.volumeSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value, 10);
        setVolume(vol);
      });
    }

    // Mute toggle
    if (els.btnMute) {
      els.btnMute.addEventListener('click', toggleMute);
    }

    // Favorite toggle in mini player
    if (els.miniFavBtn) {
      els.miniFavBtn.addEventListener('click', () => {
        const currentSong = getCurrentSong();
        if (currentSong && window.App) {
          window.App.toggleFavorite(currentSong.id);
        }
      });
    }

    // Save playback position immediately before page reload/refresh
    window.addEventListener('beforeunload', () => {
      savePlayerState(true);
    });
  }

  // Called when YouTube IFrame API is ready
  window.onYouTubeIframeAPIReady = () => {
    isApiReady = true;
    createPlayerInstance();
  };

  function createPlayerInstance() {
    if (!isApiReady || ytPlayer) return;

    ytPlayer = new YT.Player('yt-player-container', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  }

  function onPlayerReady(event) {
    isPlayerReady = true;
    if (ytPlayer && ytPlayer.setVolume) {
      ytPlayer.setVolume(savedVolume);
    }

    // If a track was queued or restored before player finished loading
    if (currentIndex >= 0 && queue[currentIndex] && activeEngine === 'yt') {
      const seek = pendingSeekTime || 0;
      const auto = pendingAutoPlay;
      pendingSeekTime = 0;
      pendingAutoPlay = false;
      playYouTube(queue[currentIndex], seek, auto);
    }
  }

  function onPlayerStateChange(event) {
    if (activeEngine !== 'yt') return;

    // YT.PlayerState: -1 (UNSTARTED), 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING), 5 (CUED)
    if (els.loadingOverlay) {
      els.loadingOverlay.style.display = (event.data === YT.PlayerState.BUFFERING) ? 'flex' : 'none';
    }

    if (event.data === YT.PlayerState.PLAYING) {
      isPlaying = true;
      consecutiveErrors = 0; // Reset error streak
      if (els.errorBox) els.errorBox.style.display = 'none';
      if (els.autoplayAlert) els.autoplayAlert.style.display = 'none';
      updatePlayPauseUI(true);
      savePlayerState(true);

      // Record listening history once when song actually begins playing
      const song = getCurrentSong();
      if (song && song.id !== lastRecordedHistorySongId) {
        lastRecordedHistorySongId = song.id;
        API.recordHistory(song.id).catch(() => {});
      }
    } else if (event.data === YT.PlayerState.PAUSED) {
      isPlaying = false;
      updatePlayPauseUI(false);
      savePlayerState(true);
    } else if (event.data === YT.PlayerState.ENDED) {
      isPlaying = false;
      updatePlayPauseUI(false);
      handleTrackEnded();
    }
  }

  function onPlayerError(event) {
    if (activeEngine !== 'yt') return;
    console.warn('YouTube Player Error code:', event.data);
    if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';

    consecutiveErrors++;
    const song = getCurrentSong();
    const ytUrl = song ? `https://www.youtube.com/watch?v=${song.youtube_video_id}` : 'https://www.youtube.com';

    let msg = 'Playback error for this video.';
    if (event.data === 101 || event.data === 150) {
      msg = 'The video owner does not allow embedded playback outside YouTube.';
    } else if (event.data === 100 || event.data === 2) {
      msg = 'This video is private, removed, or has an invalid video ID.';
    }

    if (els.errorBox && els.errorText) {
      els.errorText.textContent = msg;
      if (els.btnErrorYtLink) els.btnErrorYtLink.href = ytUrl;
      els.errorBox.style.display = 'block';
    }

    if (window.App) {
      window.App.showToast(`Error: ${msg}`, 'warning');
    }

    // Auto-download attempt or skip if multiple songs in queue
    if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS && queue.length > 1) {
      setTimeout(() => {
        nextTrack(true);
      }, 2500);
    } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      if (window.App) {
        window.App.showToast('Stopped playback after consecutive video errors.', 'error');
      }
    }
  }

  function onAudioPlaybackError() {
    consecutiveErrors++;
    if (els.errorBox && els.errorText) {
      els.errorText.textContent = 'Audio file playback failed. Falling back to video player...';
      els.errorBox.style.display = 'block';
    }
    const song = getCurrentSong();
    if (song) {
      // Clear audio url to force YT playback
      song.audio_url = null;
      song.is_downloaded = false;
      playYouTube(song);
    }
  }

  function handleTrackEnded() {
    if (repeatMode === 'one') {
      seekTo(0);
      if (activeEngine === 'audio') {
        html5Audio.play();
      } else if (ytPlayer && ytPlayer.playVideo) {
        ytPlayer.playVideo();
      }
    } else if (currentIndex < queue.length - 1) {
      nextTrack();
    } else if (repeatMode === 'all') {
      // Loop back to start
      currentIndex = 0;
      loadAndPlayCurrent();
    } else {
      // Repeat off -> stop at end of queue
      isPlaying = false;
      updatePlayPauseUI(false);
    }
  }

  function loadAndPlayCurrent(startSeconds = 0, autoPlay = true) {
    const song = getCurrentSong();
    if (!song) return;

    updateNowPlayingUI(song);
    updateQueueUI();

    // Check if song has downloaded local audio
    if (song.audio_url || song.is_downloaded) {
      playAudioDirect(song, startSeconds, autoPlay);
    } else {
      playYouTube(song, startSeconds, autoPlay);
    }
    savePlayerState(true);
  }

  function playAudioDirect(song, startSeconds = 0, autoPlay = true) {
    activeEngine = 'audio';

    // Pause / mute YouTube player if running
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch (e) {}
    }

    // Visualizer UI state
    if (els.audioVisualizerCard) {
      els.audioVisualizerCard.style.display = 'flex';
      if (els.audioVisCover) {
        els.audioVisCover.src = song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
      }
    }
    if (els.errorBox) els.errorBox.style.display = 'none';
    if (els.autoplayAlert) els.autoplayAlert.style.display = 'none';
    if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';

    // Setup Audio source
    const audioSrc = song.audio_url || `/api/audio/${song.youtube_video_id}.mp3`;
    if (html5Audio.src !== audioSrc && !html5Audio.src.endsWith(audioSrc)) {
      html5Audio.src = audioSrc;
    }

    const setAudioTime = () => {
      try {
        if (startSeconds > 0) {
          html5Audio.currentTime = startSeconds;
        }
      } catch (e) {}
    };

    if (startSeconds > 0) {
      if (html5Audio.readyState >= 1) {
        setAudioTime();
      } else {
        html5Audio.addEventListener('loadedmetadata', setAudioTime, { once: true });
      }
    } else {
      html5Audio.currentTime = 0;
    }

    html5Audio.volume = savedVolume / 100;
    html5Audio.muted = isMuted;

    if (autoPlay) {
      const playPromise = html5Audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          isPlaying = true;
          consecutiveErrors = 0;
          updatePlayPauseUI(true);
          savePlayerState(true);

          // Record history
          if (song.id !== lastRecordedHistorySongId) {
            lastRecordedHistorySongId = song.id;
            API.recordHistory(song.id).catch(() => {});
          }
        }).catch((err) => {
          console.warn('Autoplay prevented on HTML5 audio:', err);
          if (els.autoplayAlert) els.autoplayAlert.style.display = 'flex';
          isPlaying = false;
          updatePlayPauseUI(false);
          savePlayerState(true);
        });
      }
    } else {
      isPlaying = false;
      updatePlayPauseUI(false);
    }
  }

  function playYouTube(song, startSeconds = 0, autoPlay = true) {
    activeEngine = 'yt';

    // Pause HTML5 audio
    if (html5Audio) {
      html5Audio.pause();
    }

    // Hide visualizer card to reveal YouTube iframe
    if (els.audioVisualizerCard) {
      els.audioVisualizerCard.style.display = 'none';
    }

    if (isPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
      try {
        if (autoPlay) {
          ytPlayer.loadVideoById({
            videoId: song.youtube_video_id,
            startSeconds: startSeconds || 0
          });

          const promise = ytPlayer.playVideo();
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
              if (els.autoplayAlert) els.autoplayAlert.style.display = 'flex';
              isPlaying = false;
              updatePlayPauseUI(false);
            });
          }
        } else {
          ytPlayer.cueVideoById({
            videoId: song.youtube_video_id,
            startSeconds: startSeconds || 0
          });
          isPlaying = false;
          updatePlayPauseUI(false);
        }
      } catch (e) {
        console.warn('YouTube initiation error:', e);
      }
    } else {
      pendingSeekTime = startSeconds;
      pendingAutoPlay = autoPlay;
      if (els.loadingOverlay) {
        els.loadingOverlay.style.display = 'flex';
        if (els.loadingText) els.loadingText.textContent = 'Initializing YouTube player...';
      }
    }
  }

  // Queue Management
  function playSong(song, newQueue = null) {
    if (newQueue && Array.isArray(newQueue)) {
      setQueue(newQueue);
      const foundIdx = queue.findIndex(s => s.id === song.id);
      currentIndex = foundIdx !== -1 ? foundIdx : 0;
    } else {
      const foundIdx = queue.findIndex(s => s.id === song.id);
      if (foundIdx !== -1) {
        currentIndex = foundIdx;
      } else {
        queue.splice(currentIndex + 1, 0, song);
        currentIndex += 1;
      }
    }

    loadAndPlayCurrent();
  }

  function playPlaylist(songsList, startIndex = 0) {
    if (!songsList || songsList.length === 0) {
      if (window.App) window.App.showToast('No songs to play in this playlist.', 'info');
      return;
    }
    setQueue(songsList);
    currentIndex = Math.max(0, Math.min(startIndex, songsList.length - 1));
    loadAndPlayCurrent();
  }

  function setQueue(songs) {
    originalQueue = [...songs];
    if (isShuffled) {
      queue = shuffleArray([...songs]);
    } else {
      queue = [...songs];
    }
    updateQueueUI();
  }

  function clearQueue() {
    queue = [];
    originalQueue = [];
    currentIndex = -1;
    pendingSeekTime = 0;
    pendingAutoPlay = false;
    localStorage.removeItem(STATE_KEY);
    if (html5Audio) html5Audio.pause();
    if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
    isPlaying = false;
    updatePlayPauseUI(false);
    updateNowPlayingUI(null);
    updateQueueUI();
    if (els.audioVisualizerCard) els.audioVisualizerCard.style.display = 'none';
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= queue.length) return;
    queue.splice(index, 1);
    if (index < currentIndex) {
      currentIndex--;
      savePlayerState(true);
    } else if (index === currentIndex) {
      if (queue.length > 0) {
        currentIndex = currentIndex % queue.length;
        loadAndPlayCurrent();
      } else {
        clearQueue();
      }
    } else {
      savePlayerState(true);
    }
    updateQueueUI();
  }

  function jumpToQueueIndex(index) {
    if (index >= 0 && index < queue.length) {
      currentIndex = index;
      loadAndPlayCurrent();
    }
  }

  // Unified Playback Controls
  function togglePlay() {
    if (currentIndex === -1 && queue.length > 0) {
      currentIndex = 0;
      loadAndPlayCurrent();
      return;
    }

    if (activeEngine === 'audio' && html5Audio) {
      if (html5Audio.paused) {
        html5Audio.play();
        isPlaying = true;
        updatePlayPauseUI(true);
      } else {
        html5Audio.pause();
        isPlaying = false;
        updatePlayPauseUI(false);
      }
      return;
    }

    if (!isPlayerReady || !ytPlayer) return;
    if (isPlaying) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  }

  function getCurrentTime() {
    if (activeEngine === 'audio' && html5Audio) {
      return html5Audio.currentTime || 0;
    }
    return (ytPlayer && ytPlayer.getCurrentTime) ? (ytPlayer.getCurrentTime() || 0) : 0;
  }

  function getDuration() {
    if (activeEngine === 'audio' && html5Audio) {
      return html5Audio.duration || 0;
    }
    return (ytPlayer && ytPlayer.getDuration) ? (ytPlayer.getDuration() || 0) : 0;
  }

  function seekTo(seconds) {
    if (activeEngine === 'audio' && html5Audio) {
      html5Audio.currentTime = seconds;
      updateMediaSessionPosition();
      savePlayerState(true);
      return;
    }
    if (ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(seconds, true);
      updateMediaSessionPosition();
      savePlayerState(true);
    }
  }

  function prevTrack() {
    const curTime = getCurrentTime();
    if (curTime > 3.0) {
      seekTo(0);
      return;
    }

    if (currentIndex > 0) {
      currentIndex--;
      loadAndPlayCurrent();
    } else if (repeatMode === 'all' && queue.length > 0) {
      currentIndex = queue.length - 1;
      loadAndPlayCurrent();
    } else {
      seekTo(0);
    }
  }

  function nextTrack(isAutoSkip = false) {
    if (queue.length === 0) return;

    if (currentIndex < queue.length - 1) {
      currentIndex++;
      loadAndPlayCurrent();
    } else if (repeatMode === 'all') {
      currentIndex = 0;
      loadAndPlayCurrent();
    } else if (!isAutoSkip) {
      // Manual Next button at end of playlist wraps to start
      currentIndex = 0;
      loadAndPlayCurrent();
    }
  }

  function toggleShuffle() {
    isShuffled = !isShuffled;
    localStorage.setItem('sak_shuffle', isShuffled);
    const currentSong = getCurrentSong();

    if (isShuffled) {
      queue = shuffleArray([...queue]);
      if (currentSong) {
        const idx = queue.findIndex(s => s.id === currentSong.id);
        if (idx !== -1) {
          const [moved] = queue.splice(idx, 1);
          queue.unshift(moved);
          currentIndex = 0;
        }
      }
    } else {
      queue = [...originalQueue];
      if (currentSong) {
        currentIndex = queue.findIndex(s => s.id === currentSong.id);
      }
    }

    updateShuffleUI();
    updateQueueUI();
  }

  function cycleRepeatMode() {
    if (repeatMode === 'off') repeatMode = 'all';
    else if (repeatMode === 'all') repeatMode = 'one';
    else repeatMode = 'off';

    localStorage.setItem('sak_repeat_mode', repeatMode);
    updateRepeatUI();
  }

  function setVolume(vol) {
    savedVolume = Math.max(0, Math.min(100, vol));
    localStorage.setItem('sak_volume', savedVolume);

    if (html5Audio) {
      html5Audio.volume = savedVolume / 100;
      if (isMuted && savedVolume > 0) {
        html5Audio.muted = false;
        isMuted = false;
      }
    }

    if (isPlayerReady && ytPlayer && ytPlayer.setVolume) {
      ytPlayer.setVolume(savedVolume);
      if (isMuted && savedVolume > 0) {
        ytPlayer.unMute();
        isMuted = false;
      }
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (html5Audio) html5Audio.muted = isMuted;

    if (isPlayerReady && ytPlayer) {
      if (isMuted) {
        ytPlayer.mute();
      } else {
        ytPlayer.unMute();
      }
    }

    if (els.volumeSlider) {
      els.volumeSlider.value = isMuted ? 0 : savedVolume;
    }
  }

  // Progress Bar & Timer
  function startProgressTimer() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (!isPlaying || isUserSeeking) return;

      const current = getCurrentTime();
      const duration = getDuration();

      if (duration > 0) {
        const percent = (current / duration) * 100;
        updateSeekVisuals(percent);
        if (els.seekSlider) els.seekSlider.value = percent;
      }

      if (els.currentTimeLabel) els.currentTimeLabel.textContent = formatTime(current);
      if (els.durationTimeLabel && duration > 0) els.durationTimeLabel.textContent = formatTime(duration);

      updateMediaSessionPosition();
      savePlayerState(false);
    }, 400);
  }

  function updateProgressFromAudio() {
    if (!html5Audio || isUserSeeking) return;
    const current = html5Audio.currentTime || 0;
    const duration = html5Audio.duration || 0;

    if (duration > 0) {
      const percent = (current / duration) * 100;
      updateSeekVisuals(percent);
      if (els.seekSlider) els.seekSlider.value = percent;
    }

    if (els.currentTimeLabel) els.currentTimeLabel.textContent = formatTime(current);
    if (els.durationTimeLabel && duration > 0) els.durationTimeLabel.textContent = formatTime(duration);

    updateMediaSessionPosition();
    savePlayerState(false);
  }

  function updateSeekVisuals(percent) {
    const clamped = Math.min(100, Math.max(0, percent));
    if (els.seekFill) {
      els.seekFill.style.width = `${clamped}%`;
    }
    if (els.mobileSeekFill) {
      els.mobileSeekFill.style.width = `${clamped}%`;
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // UI Updaters
  function updatePlayPauseUI(playing) {
    if (els.iconPlay && els.iconPause) {
      els.iconPlay.style.display = playing ? 'none' : 'block';
      els.iconPause.style.display = playing ? 'block' : 'none';
    }
    if (els.mobileIconPlay && els.mobileIconPause) {
      els.mobileIconPlay.style.display = playing ? 'none' : 'block';
      els.mobileIconPause.style.display = playing ? 'block' : 'none';
    }
    if (els.btnPlayPause) {
      els.btnPlayPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      els.btnPlayPause.title = playing ? 'Pause' : 'Play';
    }
    if (els.mobileMiniPlayPause) {
      els.mobileMiniPlayPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      els.mobileMiniPlayPause.title = playing ? 'Pause' : 'Play';
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
    const discEl = document.getElementById('music-disc-record');
    const tonearmEl = document.getElementById('music-disc-tonearm');
    if (discEl) {
      if (playing) {
        discEl.classList.add('is-playing');
        discEl.classList.remove('is-paused');
      } else {
        discEl.classList.add('is-paused');
        discEl.classList.remove('is-playing');
      }
    }
    if (tonearmEl) {
      tonearmEl.classList.toggle('is-playing', Boolean(playing));
    }
  }

  function updateShuffleUI() {
    if (els.btnShuffle) {
      els.btnShuffle.classList.toggle('active', isShuffled);
      els.btnShuffle.title = isShuffled ? 'Shuffle: On' : 'Shuffle: Off';
    }
  }

  function updateRepeatUI() {
    if (els.btnRepeat) {
      els.btnRepeat.classList.toggle('active', repeatMode !== 'off');
      els.btnRepeat.classList.toggle('repeat-one', repeatMode === 'one');
      let title = 'Repeat: Off';
      if (repeatMode === 'all') title = 'Repeat: All';
      if (repeatMode === 'one') title = 'Repeat: One';
      els.btnRepeat.title = title;
    }
  }

  function updateNowPlayingUI(song) {
    const title = song ? song.title : 'No song playing';
    const channel = song ? (song.channel_name || 'YouTube Video') : 'Sak Music';
    const thumb = song ? (song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`) : '/static/images/placeholder.svg';

    if (els.nowPlayingTitle) els.nowPlayingTitle.textContent = title;
    if (els.nowPlayingChannel) els.nowPlayingChannel.textContent = channel;

    if (els.miniTitle) els.miniTitle.textContent = title;
    if (els.miniChannel) els.miniChannel.textContent = channel;
    if (els.miniThumb) {
      els.miniThumb.src = thumb;
      els.miniThumb.onerror = () => { els.miniThumb.src = '/static/images/placeholder.svg'; };
    }

    if (els.mobileMiniTitle) els.mobileMiniTitle.textContent = title;
    if (els.mobileMiniChannel) els.mobileMiniChannel.textContent = channel;
    if (els.mobileMiniThumb) {
      els.mobileMiniThumb.src = thumb;
      els.mobileMiniThumb.onerror = () => { els.mobileMiniThumb.src = '/static/images/placeholder.svg'; };
    }

    if (els.miniFavBtn && song) {
      const heartIcon = els.miniFavBtn.querySelector('.heart-icon');
      if (heartIcon) heartIcon.classList.toggle('favorited', Boolean(song.is_favorite));
    }
    if (els.mobileMiniFavBtn && song) {
      const mobHeart = els.mobileMiniFavBtn.querySelector('.heart-icon');
      if (mobHeart) mobHeart.classList.toggle('favorited', Boolean(song.is_favorite));
    }

    // Update webpage title
    if (song && song.title) {
      document.title = `${song.title} • Sak Music`;
    } else {
      document.title = 'Sak Music • Dashboard & Player';
    }

    // Update system lock screen & notification media player (iOS Control Center, Android, macOS)
    updateMediaSession(song);
  }

  // ========================================================
  // System MediaSession API (Lock Screen, Control Center, AirPlay, Dynamic Island)
  // ========================================================
  function initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers = [
      ['play', () => {
        if (!isPlaying) togglePlay();
      }],
      ['pause', () => {
        if (isPlaying) togglePlay();
      }],
      ['previoustrack', () => prevTrack()],
      ['nexttrack', () => nextTrack()],
      ['seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        seekTo(Math.max(0, getCurrentTime() - skip));
      }],
      ['seekforward', (details) => {
        const skip = details.seekOffset || 10;
        seekTo(Math.min(getDuration(), getCurrentTime() + skip));
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      }],
      ['stop', () => clearQueue()]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        // Safe failover for unsupported browser actions
      }
    }
  }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;

    if (!song) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch (e) {}
      return;
    }

    // Determine artwork URL and enforce HTTPS absolute URL (required for iOS Lock Screen / Control Center)
    let rawThumb = '';
    if (song.thumbnail_url && !song.thumbnail_url.endsWith('.svg')) {
      rawThumb = song.thumbnail_url;
    } else if (song.youtube_video_id) {
      rawThumb = `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
    }

    // Upgrade http to https and resolve relative to absolute URL
    let absoluteThumb = '';
    if (rawThumb) {
      rawThumb = rawThumb.replace(/^http:\/\//i, 'https://');
      try {
        absoluteThumb = rawThumb.startsWith('http') ? rawThumb : new URL(rawThumb, window.location.href).href;
      } catch (e) {
        absoluteThumb = rawThumb;
      }
    }

    const artwork = [];
    if (song.youtube_video_id) {
      const vid = song.youtube_video_id;
      artwork.push(
        { src: `https://i.ytimg.com/vi/${vid}/default.jpg`, sizes: '120x90', type: 'image/jpeg' },
        { src: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
        { src: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
        { src: `https://i.ytimg.com/vi/${vid}/sddefault.jpg`, sizes: '640x480', type: 'image/jpeg' },
        { src: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`, sizes: '512x512', type: 'image/jpeg' }
      );
    } else if (absoluteThumb) {
      artwork.push(
        { src: absoluteThumb, sizes: '96x96', type: 'image/jpeg' },
        { src: absoluteThumb, sizes: '128x128', type: 'image/jpeg' },
        { src: absoluteThumb, sizes: '192x192', type: 'image/jpeg' },
        { src: absoluteThumb, sizes: '256x256', type: 'image/jpeg' },
        { src: absoluteThumb, sizes: '384x384', type: 'image/jpeg' },
        { src: absoluteThumb, sizes: '512x512', type: 'image/jpeg' }
      );
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Sak Music',
        artist: song.channel_name || 'Sak Music',
        album: 'Sak Music Library',
        artwork: artwork
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('Error setting MediaMetadata:', e);
    }
  }

  function updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
    const dur = getDuration();
    const cur = getCurrentTime();
    if (dur > 0 && cur >= 0 && cur <= dur) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: 1.0,
          position: cur
        });
      } catch (e) {}
    }
  }

  function updateQueueUI() {
    if (!els.queueList) return;
    if (els.queueCountBadge) els.queueCountBadge.textContent = queue.length;

    if (queue.length === 0) {
      els.queueList.innerHTML = '<li class="queue-empty-msg">Queue is empty. Select songs or click Play All to begin.</li>';
      return;
    }

    els.queueList.innerHTML = '';
    queue.forEach((song, idx) => {
      const li = document.createElement('li');
      li.className = `queue-item ${idx === currentIndex ? 'active' : ''}`;
      li.title = `Click to play: ${song.title}`;

      const thumbUrl = song.thumbnail_url || `https://img.youtube.com/vi/${song.youtube_video_id}/hqdefault.jpg`;
      const isDownloaded = Boolean(song.is_downloaded || song.audio_url);

      li.innerHTML = `
        <img src="${thumbUrl}" alt="Thumb" class="queue-thumb" onerror="this.src='/static/images/placeholder.svg'">
        <div class="queue-song-meta">
          <div class="queue-song-title text-truncate flex items-center gap-1.5">
            <span>${song.title}</span>
            ${isDownloaded ? '<span class="text-[10px] text-mint-400 bg-mint-500/10 px-1 rounded font-mono">⚡Audio</span>' : ''}
          </div>
          <div class="queue-song-channel text-truncate">${song.channel_name || 'YouTube'}</div>
        </div>
        <button class="btn-icon-subtle queue-remove-btn" title="Remove from queue" aria-label="Remove">&times;</button>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.queue-remove-btn')) {
          e.stopPropagation();
          removeFromQueue(idx);
          return;
        }
        jumpToQueueIndex(idx);
      });

      els.queueList.appendChild(li);
    });
  }

  function getCurrentSong() {
    return (currentIndex >= 0 && currentIndex < queue.length) ? queue[currentIndex] : null;
  }

  function updateFavoriteStatus(songId, isFav) {
    queue.forEach(s => {
      if (s.id === songId) s.is_favorite = isFav;
    });
    originalQueue.forEach(s => {
      if (s.id === songId) s.is_favorite = isFav;
    });
    const current = getCurrentSong();
    if (current && current.id === songId) {
      if (els.miniFavBtn) {
        const icon = els.miniFavBtn.querySelector('.heart-icon');
        if (icon) icon.classList.toggle('favorited', isFav);
      }
      if (els.mobileMiniFavBtn) {
        const mobIcon = els.mobileMiniFavBtn.querySelector('.heart-icon');
        if (mobIcon) mobIcon.classList.toggle('favorited', isFav);
      }
    }
    savePlayerState(true);
  }

  // ========================================================
  // Player State Persistence Across Page Refreshes
  // ========================================================
  function savePlayerState(force = false) {
    if (currentIndex < 0 || !queue || queue.length === 0) {
      return;
    }

    const curTime = getCurrentTime();
    const dur = getDuration();

    const now = Date.now();
    if (!force && (now - lastSavedTime < 1500)) {
      return;
    }
    lastSavedTime = now;

    try {
      const state = {
        queue: queue.map(s => ({
          id: s.id,
          youtube_video_id: s.youtube_video_id,
          title: s.title,
          channel_name: s.channel_name,
          thumbnail_url: s.thumbnail_url,
          audio_url: s.audio_url,
          is_downloaded: Boolean(s.is_downloaded || s.audio_url),
          is_favorite: Boolean(s.is_favorite)
        })),
        originalQueue: (originalQueue || []).map(s => ({
          id: s.id,
          youtube_video_id: s.youtube_video_id,
          title: s.title,
          channel_name: s.channel_name,
          thumbnail_url: s.thumbnail_url,
          audio_url: s.audio_url,
          is_downloaded: Boolean(s.is_downloaded || s.audio_url),
          is_favorite: Boolean(s.is_favorite)
        })),
        currentIndex: currentIndex,
        currentTime: curTime,
        duration: dur,
        isPlaying: isPlaying,
        activeEngine: activeEngine
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save player state:', e);
    }
  }

  function restorePlayerState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (!state || !Array.isArray(state.queue) || state.queue.length === 0) return false;

      queue = state.queue;
      originalQueue = Array.isArray(state.originalQueue) && state.originalQueue.length > 0
        ? state.originalQueue
        : [...state.queue];
      currentIndex = Math.max(0, Math.min(state.currentIndex || 0, queue.length - 1));

      const song = queue[currentIndex];
      if (!song) return false;

      activeEngine = state.activeEngine || ((song.audio_url || song.is_downloaded) ? 'audio' : 'yt');
      const savedTime = Math.max(0, parseFloat(state.currentTime) || 0);
      const wasPlaying = state.isPlaying !== false;
      const savedDur = parseFloat(state.duration) || 0;

      pendingSeekTime = savedTime;
      pendingAutoPlay = wasPlaying;

      updateNowPlayingUI(song);
      updateQueueUI();

      if (savedTime > 0) {
        if (els.currentTimeLabel) els.currentTimeLabel.textContent = formatTime(savedTime);
        if (savedDur > 0) {
          if (els.durationTimeLabel) els.durationTimeLabel.textContent = formatTime(savedDur);
          const pct = (savedTime / savedDur) * 100;
          updateSeekVisuals(pct);
          if (els.seekSlider) els.seekSlider.value = pct;
        }
      }

      if (activeEngine === 'audio') {
        playAudioDirect(song, savedTime, wasPlaying);
      } else {
        if (isPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
          playYouTube(song, savedTime, wasPlaying);
          pendingSeekTime = 0;
          pendingAutoPlay = false;
        }
      }
      return true;
    } catch (e) {
      console.warn('Failed to restore player state:', e);
    }
    return false;
  }

  return {
    init,
    playSong,
    playPlaylist,
    togglePlay,
    prevTrack,
    nextTrack,
    clearQueue,
    getCurrentSong,
    updateFavoriteStatus,
    playAudioDirect
  };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Player.init();
});
