/**
 * Sak Music - Internationalization (i18n)
 * Supports English (en) and Khmer (km - ភាសាខ្មែរ)
 */
var I18n = (() => {
  const translations = {
    en: {
      // Navigation
      nav_home: 'Home',
      nav_all_songs: 'All Songs',
      nav_favorites: 'Favorites',
      nav_recently_played: 'Recently Played',
      nav_playlists: 'Playlists',
      nav_new_playlist: 'New Playlist',
      logout: 'Log Out',
      theme: 'Theme',
      theme_dark: 'Dark',
      theme_light: 'Light',
      language: 'Language',

      // Topbar
      search_placeholder: 'Search songs...',
      add_song: 'Add Song',
      add_short: 'Add',

      // Dashboard
      dashboard_badge: 'Sak Music Dashboard',
      welcome_back: 'Welcome back',
      hero_desc: 'Stream your YouTube catalog in an uncluttered, persistent music dashboard with zero playback disruptions.',
      play_all_songs: 'Play All Songs',
      paste_link: '+ Paste Link',
      stat_library_songs: 'Library Songs',
      stat_favorites: 'Favorites',
      stat_playlists: 'Playlists',
      your_playlists: 'Your Playlists',
      new_playlist_btn: '+ New Playlist',
      recently_added: 'Recently Added',
      view_all: 'View All →',

      // Table Headers
      col_number: '#',
      col_cover: 'Cover',
      col_title: 'Title',
      col_channel: 'Channel',
      col_actions: 'Actions',
      col_reorder: 'Reorder',
      col_played_at: 'Played At',
      col_title_channel: 'Title & Channel',

      // Views
      all_songs_title: 'All Songs',
      all_songs_subtitle: 'Every song saved in your personal library catalog.',
      play_all: 'Play All',
      favorites_title: 'Favorites',
      favorites_subtitle: 'Your curated collection of loved songs.',
      play_favorites: 'Play Favorites',
      history_title: 'Listening History',
      history_subtitle: 'Your recently played songs and audio tracks.',
      play_history: 'Play History',

      // Playlist Detail
      playlist_badge: 'Playlist',
      add_song_btn: 'Add Song',
      edit: 'Edit',
      delete: 'Delete',
      songs_count: 'songs',
      updated: 'Updated',
      empty_playlist_title: 'This playlist is currently empty',
      empty_playlist_desc: 'Add songs from YouTube or pick from your existing library.',
      empty_playlist_btn: '+ Add Songs to this Playlist',

      // Empty States
      empty_library_title: 'Your Library is Empty',
      empty_library_desc: 'Add songs from YouTube using the button below or at the top right.',
      empty_library_btn: '+ Add Your First Song',
      empty_favorites_title: 'No Favorites Yet',
      empty_favorites_desc: 'Tap the heart icon on any song to add it to your favorites list.',
      empty_history_title: 'No Listening History Yet',
      empty_history_desc: 'Play some songs to build your history log!',

      // Player & Queue
      now_playing: 'Now Playing',
      no_song_playing: 'No song playing',
      sak_player_subtitle: 'Sak Music Player',
      select_song_to_start: 'Select a song to start playback',
      direct_audio: 'Direct Audio',
      upcoming_queue: 'UPCOMING QUEUE',
      shuffle: 'Shuffle',
      clear: 'Clear',
      queue_empty: 'Queue is empty. Select songs or click Play All to begin.',
      not_playing: 'Not Playing',

      // Modals
      modal_add_title: 'Add Song from YouTube',
      youtube_url_label: 'YouTube Video URL or ID',
      youtube_url_placeholder: 'e.g. https://www.youtube.com/watch?v=... or dQw4w9WgXcQ',
      add_to_playlist_label: 'Add to Playlist (Optional)',
      select_playlist_placeholder: '-- No Playlist (Library Only) --',
      cancel: 'Cancel',
      add_to_library: 'Add to Library',
      modal_create_playlist_title: 'Create New Playlist',
      tab_blank_playlist: 'Blank Playlist',
      tab_import_playlist: 'From YouTube Link',
      import_playlist_btn: 'Import by Link',
      import_playlist: 'Import Playlist',
      playlist_url_label: 'YouTube Playlist URL',
      playlist_url_placeholder: 'e.g. https://youtube.com/playlist?list=...',
      playlist_url_hint: 'Supports youtube.com/playlist?list=... and video URLs containing a playlist',
      playlist_url_detected: 'YouTube playlist link detected!',
      import_as_playlist_btn: 'Import Playlist →',
      preview_btn: 'Preview',
      playlist_name_label: 'Playlist Name',
      playlist_name_placeholder: 'e.g. Chill Vibes, Morning Coffee...',
      description_label: 'Description (Optional)',
      description_placeholder: 'What is this playlist about?',
      create_playlist: 'Create Playlist',
      modal_edit_playlist_title: 'Edit Playlist',
      save_changes: 'Save Changes',
      confirm_action: 'Confirm Action',
      confirm: 'Confirm',
      confirm_delete_song: 'Are you sure you want to delete this song from your library?',
      confirm_delete_playlist: 'Are you sure you want to delete this playlist?',

      // Alerts & Notifications
      switched_to_km: 'បានប្តូរទៅភាសាខ្មែរ',
      switched_to_en: 'Switched to English',
      switched_to_zh: 'Switched to Chinese',
      switched_to_dark: 'Switched to Dark Mode',
      switched_to_light: 'Switched to Light Mode',
      song_added: 'Song added successfully!',
      playlist_created: 'Playlist created successfully!'
    },

    km: {
      // Navigation
      nav_home: 'ទំព័រដើម',
      nav_all_songs: 'បទចម្រៀងទាំងអស់',
      nav_favorites: 'បទចូលចិត្ត',
      nav_recently_played: 'បានចាក់ថ្មីៗ',
      nav_playlists: 'បញ្ជីចម្រៀង',
      nav_new_playlist: 'បង្កើតបញ្ជីថ្មី',
      logout: 'ចាកចេញ',
      theme: 'រចនាប័ទ្ម',
      theme_dark: 'ងងឹត',
      theme_light: 'ភ្លឺ',
      language: 'ភាសា',

      // Topbar
      search_placeholder: 'ស្វែងរកបទចម្រៀង...',
      add_song: 'បន្ថែមបទចម្រៀង',
      add_short: 'បន្ថែម',

      // Dashboard
      dashboard_badge: 'ផ្ទាំងគ្រប់គ្រង Sak Music',
      welcome_back: 'សូមស្វាគមន៍មកវិញ',
      hero_desc: 'ចាក់បទចម្រៀង YouTube របស់អ្នកដោយរលូន គ្មានការរំខាន នៅក្នុងផ្ទាំងគ្រប់គ្រងផ្ទាល់ខ្លួន។',
      play_all_songs: 'ចាក់ចម្រៀងទាំងអស់',
      paste_link: '+ បិទភ្ជាប់តំណ',
      stat_library_songs: 'បទក្នុងបណ្ណាល័យ',
      stat_favorites: 'បទចូលចិត្ត',
      stat_playlists: 'បញ្ជីចម្រៀង',
      your_playlists: 'បញ្ជីចម្រៀងរបស់អ្នក',
      new_playlist_btn: '+ បញ្ជីថ្មី',
      recently_added: 'បានបន្ថែមថ្មីៗ',
      view_all: 'មើលទាំងអស់ →',

      // Table Headers
      col_number: '#',
      col_cover: 'គម្រប',
      col_title: 'ចំណងជើង',
      col_channel: 'ឆានែល',
      col_actions: 'សកម្មភាព',
      col_reorder: 'តម្រៀប',
      col_played_at: 'បានចាក់នៅ',
      col_title_channel: 'ចំណងជើង និងឆានែល',

      // Views
      all_songs_title: 'បទចម្រៀងទាំងអស់',
      all_songs_subtitle: 'រាល់បទចម្រៀងទាំងអស់ដែលបានរក្សាទុកក្នុងបណ្ណាល័យផ្ទាល់ខ្លួនរបស់អ្នក។',
      play_all: 'ចាក់ទាំងអស់',
      favorites_title: 'បទចូលចិត្ត',
      favorites_subtitle: 'បណ្តុំបទចម្រៀងដែលអ្នកស្រឡាញ់ពេញចិត្តបំផុត។',
      play_favorites: 'ចាក់បទចូលចិត្ត',
      history_title: 'ប្រវត្តិស្តាប់ចម្រៀង',
      history_subtitle: 'បទចម្រៀងដែលអ្នកបានចាក់ស្តាប់ថ្មីៗនេះ។',
      play_history: 'ចាក់ប្រវត្តិស្តាប់',

      // Playlist Detail
      playlist_badge: 'បញ្ជីចម្រៀង',
      add_song_btn: 'បន្ថែមបទ',
      edit: 'កែសម្រួល',
      delete: 'លុប',
      songs_count: 'បទ',
      updated: 'កាលបរិច្ឆេទ',
      empty_playlist_title: 'បញ្ជីចម្រៀងនេះនៅទទេ',
      empty_playlist_desc: 'បន្ថែមបទពី YouTube ឬជ្រើសរើសពីបណ្ណាល័យរបស់អ្នក។',
      empty_playlist_btn: '+ បន្ថែមបទទៅបញ្ជីនេះ',

      // Empty States
      empty_library_title: 'បណ្ណាល័យរបស់អ្នកនៅទទេ',
      empty_library_desc: 'បន្ថែមបទចម្រៀងពី YouTube ដោយប្រើប៊ូតុងខាងក្រោម ឬនៅខាងស្តាំខាងលើ។',
      empty_library_btn: '+ បន្ថែមបទចម្រៀងដំបូងរបស់អ្នក',
      empty_favorites_title: 'មិនទាន់មានបទចូលចិត្តនៅឡើយទេ',
      empty_favorites_desc: 'ចុចរូបបេះដូងលើបទចម្រៀងណាមួយ ដើម្បីបញ្ចូលវាទៅក្នុងបញ្ជីបទចូលចិត្ត។',
      empty_history_title: 'មិនទាន់មានប្រវត្តិស្តាប់នៅឡើយទេ',
      empty_history_desc: 'ចាក់បទចម្រៀងមួយចំនួនដើម្បីបង្កើតប្រវត្តិស្តាប់របស់អ្នក!',

      // Player & Queue
      now_playing: 'កំពុងចាក់',
      no_song_playing: 'មិនមានបទកំពុងចាក់',
      sak_player_subtitle: 'អ្នកចាក់តន្ត្រី Sak',
      select_song_to_start: 'ជ្រើសរើសបទចម្រៀងដើម្បីចាប់ផ្តើមចាក់',
      direct_audio: 'សំឡេងផ្ទាល់',
      upcoming_queue: 'ជួរបទបន្ទាប់',
      shuffle: 'ចៃដន្យ',
      clear: 'សម្អាត',
      queue_empty: 'ជួរបទចម្រៀងទទេ។ សូមជ្រើសរើសបទចម្រៀងដើម្បីចាក់។',
      not_playing: 'មិនមានចាក់បទ',

      // Modals
      modal_add_title: 'បន្ថែមបទចម្រៀងពី YouTube',
      youtube_url_label: 'តំណភ្ជាប់ ឬលេខសម្គាល់ YouTube',
      youtube_url_placeholder: 'ឧទាហរណ៍ https://www.youtube.com/watch?v=... ឬ dQw4w9WgXcQ',
      add_to_playlist_label: 'បន្ថែមទៅបញ្ជីចម្រៀង (ជម្រើស)',
      select_playlist_placeholder: '-- គ្មានបញ្ជី (តែក្នុងបណ្ណាល័យ) --',
      cancel: 'បោះបង់',
      add_to_library: 'បន្ថែមទៅបណ្ណាល័យ',
      modal_create_playlist_title: 'បង្កើតបញ្ជីចម្រៀងថ្មី',
      tab_blank_playlist: 'បញ្ជីទទេ',
      tab_import_playlist: 'ពីតំណ YouTube',
      import_playlist_btn: 'នាំចូលតាមតំណ',
      import_playlist: 'នាំចូលបញ្ជីចម្រៀង',
      playlist_url_label: 'តំណភ្ជាប់បញ្ជីចម្រៀង YouTube',
      playlist_url_placeholder: 'ឧទាហរណ៍ https://youtube.com/playlist?list=...',
      playlist_url_hint: 'គាំទ្រ youtube.com/playlist?list=... និងតំណវីដេអូដែលមានបញ្ជី',
      playlist_url_detected: 'បានរកឃើញតំណភ្ជាប់បញ្ជីចម្រៀង YouTube!',
      import_as_playlist_btn: 'នាំចូលបញ្ជី →',
      preview_btn: 'មើលជាមុន',
      playlist_name_label: 'ឈ្មោះបញ្ជីចម្រៀង',
      playlist_name_placeholder: 'ឧទាហរណ៍ ចម្រៀងពិរោះៗ, កាហ្វេពេលព្រឹក...',
      description_label: 'ការពិពណ៌នា (ជម្រើស)',
      description_placeholder: 'តើបញ្ជីនេះមានចម្រៀងប្រភេទអ្វី?',
      create_playlist: 'បង្កើតបញ្ជី',
      modal_edit_playlist_title: 'កែសម្រួលបញ្ជីចម្រៀង',
      save_changes: 'រក្សាទុកការផ្លាស់ប្តូរ',
      confirm_action: 'បញ្ជាក់សកម្មភាព',
      confirm: 'យល់ព្រម',
      confirm_delete_song: 'តើអ្នកប្រាកដជាចង់លុបបទចម្រៀងនេះចេញពីបណ្ណាល័យរបស់អ្នកទេ?',
      confirm_delete_playlist: 'តើអ្នកប្រាកដជាចង់លុបបញ្ជីចម្រៀងនេះទេ?',

      // Alerts & Notifications
      switched_to_km: 'បានប្តូរទៅភាសាខ្មែរ',
      switched_to_en: 'Switched to English',
      switched_to_zh: 'បានប្តូរទៅភាសាចិន',
      switched_to_dark: 'បានប្តូរទៅរចនាប័ទ្មងងឹត',
      switched_to_light: 'បានប្តូរទៅរចនាប័ទ្មភ្លឺ',
      song_added: 'បានបន្ថែមបទចម្រៀងដោយជោគជ័យ!',
      playlist_created: 'បានបង្កើតបញ្ជីចម្រៀងដោយជោគជ័យ!'
    },

    zh: {
      // Navigation
      nav_home: '首页',
      nav_all_songs: '所有歌曲',
      nav_favorites: '我的收藏',
      nav_recently_played: '最近播放',
      nav_playlists: '我的歌单',
      nav_new_playlist: '新建歌单',
      logout: '退出登录',
      theme: '主题',
      theme_dark: '深色',
      theme_light: '浅色',
      language: '语言',

      // Topbar
      search_placeholder: '搜索歌曲...',
      add_song: '添加歌曲',
      add_short: '添加',

      // Dashboard
      dashboard_badge: 'Sak 音乐控制台',
      welcome_back: '欢迎回来',
      hero_desc: '在极简流畅的控制台中畅享 YouTube 音乐曲库，全程无干扰。',
      play_all_songs: '播放全部歌曲',
      paste_link: '+ 粘贴链接',
      stat_library_songs: '曲库歌曲',
      stat_favorites: '收藏歌曲',
      stat_playlists: '我的歌单',
      your_playlists: '你的歌单',
      new_playlist_btn: '+ 新建歌单',
      recently_added: '最近添加',
      view_all: '查看全部 →',

      // Table Headers
      col_number: '#',
      col_cover: '封面',
      col_title: '歌曲标题',
      col_channel: '频道',
      col_actions: '操作',
      col_reorder: '排序',
      col_played_at: '播放时间',
      col_title_channel: '标题与频道',

      // Views
      all_songs_title: '所有歌曲',
      all_songs_subtitle: '已保存在个人曲库中的全部歌曲。',
      play_all: '播放全部',
      favorites_title: '我的收藏',
      favorites_subtitle: '你喜爱的珍藏歌曲列表。',
      play_favorites: '播放收藏',
      history_title: '播放历史',
      history_subtitle: '你最近播放过的歌曲与音频。',
      play_history: '播放历史记录',

      // Playlist Detail
      playlist_badge: '歌单',
      add_song_btn: '添加歌曲',
      edit: '编辑',
      delete: '删除',
      songs_count: '首歌曲',
      updated: '更新于',
      empty_playlist_title: '此歌单当前为空',
      empty_playlist_desc: '从 YouTube 添加歌曲或从现有曲库中选取。',
      empty_playlist_btn: '+ 为该歌单添加歌曲',

      // Empty States
      empty_library_title: '你的曲库为空',
      empty_library_desc: '点击下方按钮或右上角从 YouTube 添加歌曲。',
      empty_library_btn: '+ 添加第一首歌曲',
      empty_favorites_title: '暂无收藏',
      empty_favorites_desc: '点击任意歌曲上的爱心图标将其加入收藏列表。',
      empty_history_title: '暂无播放历史',
      empty_history_desc: '播放歌曲以记录你的聆听足迹！',

      // Player & Queue
      now_playing: '正在播放',
      no_song_playing: '未在播放歌曲',
      sak_player_subtitle: 'Sak 播放器',
      select_song_to_start: '选择歌曲开始播放',
      direct_audio: '直接音频',
      upcoming_queue: '待播队列',
      shuffle: '随机播放',
      clear: '清空',
      queue_empty: '队列为空。选择歌曲或点击“播放全部”开始。',
      not_playing: '未播放',

      // Modals
      modal_add_title: '从 YouTube 添加歌曲',
      youtube_url_label: 'YouTube 视频链接或视频 ID',
      youtube_url_placeholder: '例如 https://www.youtube.com/watch?v=... 或 dQw4w9WgXcQ',
      add_to_playlist_label: '添加到歌单（可选）',
      select_playlist_placeholder: '-- 不加入歌单（仅在曲库）--',
      cancel: '取消',
      add_to_library: '添加到曲库',
      modal_create_playlist_title: '创建新歌单',
      tab_blank_playlist: '空白歌单',
      tab_import_playlist: '从 YouTube 链接导入',
      import_playlist_btn: '通过链接导入',
      import_playlist: '导入歌单',
      playlist_url_label: 'YouTube 歌单链接',
      playlist_url_placeholder: '例如 https://youtube.com/playlist?list=...',
      playlist_url_hint: '支持 youtube.com/playlist?list=... 及带有歌单参数的视频链接',
      playlist_url_detected: '已检测到 YouTube 歌单链接！',
      import_as_playlist_btn: '导入歌单 →',
      preview_btn: '预览',
      playlist_name_label: '歌单名称',
      playlist_name_placeholder: '例如 轻松旋律、早晨咖啡...',
      description_label: '描述（可选）',
      description_placeholder: '介绍一下这个歌单吧？',
      create_playlist: '创建歌单',
      modal_edit_playlist_title: '编辑歌单',
      save_changes: '保存更改',
      confirm_action: '确认操作',
      confirm: '确认',
      confirm_delete_song: '确定要从曲库中删除此歌曲吗？',
      confirm_delete_playlist: '确定要删除此歌单吗？',

      // Alerts & Notifications
      switched_to_km: '已切换为高棉语',
      switched_to_en: '已切换为英语',
      switched_to_zh: '已切换为中文',
      switched_to_dark: '已切换为深色模式',
      switched_to_light: '已切换为浅色模式',
      song_added: '歌曲添加成功！',
      playlist_created: '歌单创建成功！'
    }
  };

  // Support aliases
  translations.cn = translations.zh;
  translations.kh = translations.km;

  let currentLang = 'en';

  function init() {
    let saved = localStorage.getItem('sak_lang') || 'en';
    if (saved === 'kh') saved = 'km';
    if (saved === 'cn') saved = 'zh';
    currentLang = saved;
    applyLanguage(currentLang, false);
    bindUI();
  }

  function t(key, fallback = '') {
    const dict = translations[currentLang] || translations.en;
    return dict[key] || fallback || key;
  }

  function setLanguage(lang) {
    if (lang === 'kh') lang = 'km';
    if (lang === 'cn') lang = 'zh';
    if (lang !== 'en' && lang !== 'km' && lang !== 'zh') return;
    currentLang = lang;
    localStorage.setItem('sak_lang', lang);
    applyLanguage(lang, true);
  }

  function applyLanguage(lang, notify = false) {
    if (lang === 'kh') lang = 'km';
    if (lang === 'cn') lang = 'zh';
    document.documentElement.lang = lang;
    const dict = translations[lang] || translations.en;

    // Translate all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    // Translate placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) {
        el.placeholder = dict[key];
      }
    });

    // Update active state in Dropdown buttons
    const btnEn = document.getElementById('btn-lang-en');
    const btnKm = document.getElementById('btn-lang-km');
    const btnZh = document.getElementById('btn-lang-zh') || document.getElementById('btn-lang-cn');
    if (btnEn) btnEn.classList.toggle('active-lang', lang === 'en');
    if (btnKm) btnKm.classList.toggle('active-lang', lang === 'km');
    if (btnZh) btnZh.classList.toggle('active-lang', lang === 'zh');

    // Update Topbar Language Switcher Button
    const topbarFlag = document.getElementById('topbar-lang-flag');
    const topbarText = document.getElementById('topbar-lang-text');
    if (topbarFlag && topbarText) {
      const FLAG_ICONS = {
        en: `<svg class="w-3.5 h-2.5 rounded-[2px] overflow-hidden flex-shrink-0 shadow-sm pointer-events-none" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="uk-flag-top"><rect width="60" height="30"/></clipPath><g clip-path="url(#uk-flag-top)"><path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></g></svg>`,
        km: `<svg class="w-3.5 h-2.5 rounded-[2px] overflow-hidden flex-shrink-0 shadow-sm pointer-events-none" viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#032EA1"/><rect y="7.5" width="60" height="15" fill="#E00025"/><g fill="#FFFFFF"><polygon points="30,8.5 28,12 32,12"/><rect x="28.5" y="12" width="3" height="3"/><polygon points="23,10.5 21.5,13 24.5,13"/><rect x="22" y="13" width="2" height="2"/><polygon points="37,10.5 35.5,13 38.5,13"/><rect x="36" y="13" width="2" height="2"/><rect x="19" y="15" width="22" height="2"/><rect x="17" y="17" width="26" height="2"/><rect x="15" y="19" width="30" height="2.5"/></g></svg>`,
        zh: `<svg class="w-3.5 h-2.5 rounded-[2px] overflow-hidden flex-shrink-0 shadow-sm pointer-events-none" viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#DE2910"/><defs><polygon id="cn-star-top" points="0,-1 0.2245,-0.309 0.9511,-0.309 0.3633,0.118 0.5878,0.809 0,0.382 -0.5878,0.809 -0.3633,0.118 -0.9511,-0.309 -0.2245,-0.309" fill="#FFDE00"/></defs><use href="#cn-star-top" transform="translate(10, 7.5) scale(4.5)"/><use href="#cn-star-top" transform="translate(20, 3) rotate(114) scale(1.5)"/><use href="#cn-star-top" transform="translate(24, 6) rotate(140) scale(1.5)"/><use href="#cn-star-top" transform="translate(24, 10.5) rotate(170) scale(1.5)"/><use href="#cn-star-top" transform="translate(20, 13.5) rotate(196) scale(1.5)"/></svg>`
      };
      FLAG_ICONS.cn = FLAG_ICONS.zh;
      FLAG_ICONS.kh = FLAG_ICONS.km;

      // Show what the NEXT language to toggle is
      const nextLang = { en: 'km', km: 'zh', zh: 'en' };
      const target = nextLang[lang] || 'en';
      topbarFlag.innerHTML = FLAG_ICONS[target] || FLAG_ICONS.en;
      const textLabels = { en: 'EN', km: 'KH', zh: 'CN' };
      topbarText.textContent = textLabels[target] || 'EN';
    }

    // Update playlist card counts (e.g. "7 songs" -> "7 បទ" -> "7 首歌曲")
    document.querySelectorAll('.playlist-card-meta').forEach(metaEl => {
      const songLabelEl = metaEl.querySelector('[data-i18n="songs_count"]');
      if (songLabelEl) {
        songLabelEl.textContent = dict.songs_count || 'songs';
      } else {
        const text = metaEl.textContent.trim();
        const numMatch = text.match(/\d+/);
        const count = numMatch ? numMatch[0] : '0';
        metaEl.innerHTML = `<span class="playlist-song-num">${count}</span> <span data-i18n="songs_count">${dict.songs_count || 'songs'}</span>`;
      }
    });

    const detailCountEl = document.getElementById('detail-playlist-count');
    if (detailCountEl) {
      const labelEl = detailCountEl.querySelector('[data-i18n="songs_count"]');
      if (labelEl) {
        labelEl.textContent = dict.songs_count || 'songs';
      } else {
        const text = detailCountEl.textContent.trim();
        const numMatch = text.match(/\d+/);
        const count = numMatch ? numMatch[0] : '0';
        detailCountEl.innerHTML = `<span class="playlist-song-num">${count}</span> <span data-i18n="songs_count">${dict.songs_count || 'songs'}</span>`;
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    } catch (e) {}

    if (notify && window.App && window.App.showToast) {
      let toastMsg = dict.switched_to_en;
      if (lang === 'km') toastMsg = dict.switched_to_km;
      else if (lang === 'zh') toastMsg = dict.switched_to_zh;
      window.App.showToast(toastMsg, 'info');
    }
  }

  let uiBound = false;
  function bindUI() {
    if (uiBound) return;
    const btnEn = document.getElementById('btn-lang-en');
    const btnKm = document.getElementById('btn-lang-km');
    const btnZh = document.getElementById('btn-lang-zh') || document.getElementById('btn-lang-cn');
    const btnTopbar = document.getElementById('btn-topbar-lang-toggle');

    if (btnEn) {
      btnEn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLanguage('en');
      });
    }
    if (btnKm) {
      btnKm.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLanguage('km');
      });
    }
    if (btnZh) {
      btnZh.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLanguage('zh');
      });
    }
    if (btnTopbar) {
      btnTopbar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cycle = { en: 'km', km: 'zh', zh: 'en' };
        setLanguage(cycle[currentLang] || 'en');
      });
    }
    uiBound = true;
  }

  const api = {
    init,
    t,
    getLanguage: () => currentLang,
    setLanguage,
    applyLanguage
  };

  return api;
})();

window.I18n = I18n;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.I18n) window.I18n.init();
  });
} else {
  if (window.I18n) window.I18n.init();
}
