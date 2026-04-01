# Mastoferr

A self-hosted Mastodon activity archiver with full-text search, profile updater, and automated toots.

> Built entirely through vibe coding with [Claude Code](https://claude.ai/claude-code). Security reviewed by [Claude Code](https://claude.ai/claude-code) and Gemini Code Assist.

## Features

- Archive toots, notifications, favorites, bookmarks, and media
- Full-text search (SQLite FTS5)
- Profile updater — now-playing music, last-watched movie, last-read book (Goodreads or Audiobookshelf)
- Auto-post when you finish an album (Navidrome), star a track, start/finish an audiobook (Audiobookshelf), or finish a book (Goodreads)
- Dedup failsafe — blocks the same post type within 30 minutes and the same content within 24 hours
- Discord confirmation flow before any auto-toot is posted
- Follower tracking with follow/unfollow history
- Weekly music recap post
- Live log viewer at `/logs` with auto-refresh
- AI-powered roast of your posting habits
- OAuth login — no tokens to copy/paste
- Dark, responsive web UI
- Docker-ready (amd64 + arm64)

## Quick Start

1. Create a `docker-compose.yml`:

```yaml
services:
  mastoferr:
    image: patuleia/mastoferr:latest
    ports:
      - "6886:6886"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

2. Create a `.env` file — see [Configuration](https://github.com/brunopatuleia/MastoFerr/wiki/Configuration) for all options.

3. Run it:

```bash
docker compose up -d
```

4. Open `http://localhost:6886`, enter your Mastodon instance, and authorize.

## Documentation

Full docs at the [Wiki](https://github.com/brunopatuleia/MastoFerr/wiki).

## Tech Stack

Python 3.12 · FastAPI · SQLite FTS5 · Mastodon.py · APScheduler · Jinja2 · Docker

## License

MIT
