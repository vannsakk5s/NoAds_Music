# Sak Music
### Personal YouTube Music Playlist & Library Web Application

Sak Music is a modern, responsive web application built with **Python Flask** that allows users to create a personal music library, organize songs into custom playlists, and enjoy persistent sequential playback powered by the official **YouTube IFrame Player API**.

---

## 🌟 Key Features

- 🔐 **Authentication & Security**:
  - Secure registration and login with Werkzeug password hashing.
  - Flask-Login session authentication with HTTP-only cookies.
  - Full CSRF protection on forms and state-changing Fetch API requests.
  - Rate limiting on authentication routes via Flask-Limiter.
  - Strict ownership isolation across libraries, playlists, and listening history.
  - Safe relative redirect validation to prevent open redirects.

- 🎵 **Library & Song Management**:
  - Save songs by pasting official YouTube links (supports standard watch links, youtu.be, shorts, live, and music.youtube.com).
  - Server-side metadata extraction via official YouTube oEmbed endpoint with strict SSRF defense.
  - Fallback manual title entry if oEmbed metadata is private or offline.
  - Idempotent song saving to prevent duplicate personal library entries.
  - Favorite/unfavorite toggles.
  - Instant live search by song title or channel.
  - Cascading library removal: Removing a song from the library removes it from the user's playlists and history without affecting the shared catalog or other users.

- 📑 **Playlist Management**:
  - Create, rename, describe, and delete playlists.
  - Add existing library songs or new YouTube links directly to playlists.
  - Deterministic song ordering with accessible **Move Up (▲)** and **Move Down (▼)** controls.
  - Transactional position re-indexing.
  - Deleting a playlist safely preserves the songs in the user's personal library.

- 🎧 **Persistent Playback & Refresh Resilience**:
  - **Single Page Application (SPA) Shell**: Navigation between views (Dashboard, All Songs, Favorites, Playlists, History) never reloads the page or interrupts YouTube playback!
  - **Refresh-Proof State**: Active playback, current timestamp position, and queue are auto-persisted to `localStorage` and resume seamlessly across page refreshes (F5).
  - Fully visible, official YouTube IFrame Player (meeting YouTube terms and dimension requirements).
  - Controls: Play/Pause, Previous (restarts if > 3s), Next, Seek slider, Time/Duration display, Volume slider & Mute toggle.
  - Modes: Shuffle without repeats, Repeat (Off, All, One).
  - Visible dynamic playback queue with current song highlight and track removal.
  - Automatic listening history logging when playback starts.
  - Graceful handling of browser autoplay restrictions and unavailable/restricted video errors.

- 🌍 **Internationalization (i18n)**:
  - Tri-lingual support: **English (EN 🇬🇧)**, **Khmer (KH 🇰🇭)**, and **Chinese (CN 🇨🇳)**.
  - Instant in-place translation across navigation, library counts, queue, modals, and toasts without page reload.
  - Quick cycle switcher in topbar and compact flag-only switcher in user dropdown.

- 🎨 **Design Aesthetics**:
  - Contemporary Charcoal & Soft Mint-Green palette with subtle glassmorphic elements.
  - Clean multilingual typography with font fallbacks for English, Khmer, and Chinese.
  - Responsive layouts optimized for desktop, tablet, and mobile with dedicated mini-player.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, Flask 3.x (Application Factory & Blueprints)
- **Database & ORM**: SQLite (local) / PostgreSQL (production), Flask-SQLAlchemy, Flask-Migrate (Alembic)
- **Security & Forms**: Flask-WTF (CSRF), Flask-Login, Flask-Limiter, Werkzeug
- **Frontend**: Vanilla HTML5, Modern CSS, Vanilla JavaScript (Fetch API, YouTube IFrame API)
- **Testing**: Pytest

---

## 🚀 Local Setup & Installation (Windows PowerShell)

#### 1. Create and Activate Virtual Environment
Open **Windows PowerShell** in the project directory (`e:\aZer0 Python\Flask\MusicProject`):

```powershell
# 1. Create a virtual environment named .venv
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1
```

*(If you encounter execution policy restrictions, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`)*

#### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
You can edit `.env` to configure your `SECRET_KEY` or keep defaults for local development.

#### 4. Run Database Migrations
Initialize database tables with Flask-Migrate:
```powershell
$env:FLASK_APP = "run.py"
flask db upgrade
```

#### 5. Register an Account or Seed Sample Playlists
You can register an account in the web UI (`/auth/register`), then optionally seed curated sample playlists using the CLI:
```powershell
flask seed-data --email your_email@example.com
```

#### 6. Start the Development Server
```powershell
python run.py
```
Open your browser and navigate to: **`http://127.0.0.1:5000`**

---

## 🧪 Testing & Verification

Automated test suite covers authentication, CSRF, URL parsing, metadata mocks, library isolation, duplicate saves, and playlist ordering:

```powershell
python -m pytest -v
```

All 18 automated tests pass out-of-the-box:
- `test_register_success`, `test_register_duplicate_email`
- `test_login_success`, `test_login_invalid_password`, `test_logout`
- `test_unauthenticated_api_returns_401_json`
- `test_csrf_protection_blocks_post_without_token`
- `test_add_song_idempotent`
- `test_favorites_toggle`
- `test_library_removal_cascades_only_to_current_user`
- `test_playlist_creation_and_empty_name`
- `test_playlist_reordering_and_deterministic_order`
- `test_delete_playlist_preserves_library_songs`
- `test_playlist_ownership_isolation`
- `test_extract_video_id_valid_formats`, `test_extract_video_id_rejected_urls`
- `test_fetch_youtube_metadata_success`, `test_fetch_youtube_metadata_failure_fallback`

---

## 🌐 API Endpoints Reference

All state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require authentication and a valid CSRF token in the `X-CSRFToken` request header.

### 1. YouTube Metadata Preview
- **`POST /api/youtube/metadata`**
  - Request: `{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}`
  - Response (200):
    ```json
    {
      "success": true,
      "video_id": "dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "channel_name": "Rick Astley",
      "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "note": "Metadata retrieved successfully."
    }
    ```

### 2. User Library
- **`GET /api/library`** (Supports search filter: `?q=query`)
  - Response (200): List of saved songs in personal library.
- **`POST /api/library`**
  - Request: `{"url": "https://youtu.be/dQw4w9WgXcQ", "title": "Optional Custom Title", "playlist_id": 1}`
  - Response (201 Created / 200 Idempotent):
    ```json
    {
      "message": "Song successfully added to your library.",
      "already_saved": false,
      "song": {
        "id": 1,
        "library_id": 1,
        "youtube_video_id": "dQw4w9WgXcQ",
        "title": "Never Gonna Give You Up",
        "channel_name": "Rick Astley",
        "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        "is_favorite": false
      }
    }
    ```
- **`DELETE /api/library/<song_id>`**
  - Response (200): `{"message": "Song removed from your library and playlists."}`

### 3. Favorites
- **`GET /api/favorites`**
  - Response (200): List of songs where `is_favorite = true`.
- **`PUT /api/library/<song_id>/favorite`**
  - Request: `{"is_favorite": true}`
  - Response (200): `{"message": "Favorite status updated successfully.", "is_favorite": true, "song_id": 1}`

### 4. Playlists
- **`GET /api/playlists`**: Returns user's playlists with song counts.
- **`POST /api/playlists`**: `{"name": "Study Lo-Fi", "description": "Beats to focus"}` -> `201 Created`.
- **`GET /api/playlists/<id>`**: Returns playlist details and deterministically ordered song list.
- **`PATCH /api/playlists/<id>`**: `{"name": "New Name", "description": "New Desc"}`.
- **`DELETE /api/playlists/<id>`**: Deletes playlist (preserves library songs).
- **`POST /api/playlists/<id>/songs`**: `{"song_id": 1}` or `{"url": "https://..."}`.
- **`DELETE /api/playlists/<id>/songs/<song_id>`**: Removes song from playlist and re-indexes remaining positions.
- **`PUT /api/playlists/<id>/order`**: `{"song_ids": [3, 1, 2]}` (Validates exact match of target playlist tracks).

### 5. Listening History
- **`GET /api/history`**: Returns recently played songs ordered by `last_played_at DESC`.
- **`POST /api/history`**: `{"song_id": 1}` -> Upserts recent playback timestamp.

---

## 🚢 Production Deployment Notes

1. **WSGI Server**: Use **Gunicorn** or **Waitress** instead of Flask's development server:
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 run:app
   ```
2. **Database**: Configure PostgreSQL in `.env`:
   ```bash
   DATABASE_URL=postgresql://user:password@hostname:5432/sak_music_db
   ```
3. **Environment Security**:
   - Set a strong, unique `SECRET_KEY`.
   - Set `SESSION_COOKIE_SECURE=True` behind HTTPS / SSL reverse proxy (Nginx or Cloudflare).
   - Use Redis or Memcached for `RATELIMIT_STORAGE_URI` if running across multiple worker processes.

---

## 📜 YouTube API Terms Notice
This application strictly adheres to the official YouTube IFrame Player API terms:
- Audio/video files are not downloaded, extracted, or hosted on our servers.
- Playback occurs exclusively through the official YouTube player embed.
- Ads served by YouTube are unaltered and unobstructed.
- Embedding permissions remain under the control of the respective video owners.
#   N o A d s _ M u s i c 
 
 
