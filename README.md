# Claude Agent Board

A full-stack local web UI for managing and chatting with Claude Code agents. Built with React, Express, WebSocket, and SQLite.

## Features

- **Multi-session chat** — Run multiple Claude agents concurrently across different projects. Switch between sessions while agents work in the background.
- **Mission Control** — Kanban board with Backlog, In Progress, Review, and Done columns. Drag-and-drop cards, filter by project, and track activity.
- **Project management** — Create projects with auto-generated folders or link existing codebases. Each project gets its own directory and preview URL.
- **Skills system** — Create custom prompt skills or import from [skills.sh](https://skills.sh). Toggle skills per session, scope them globally or per project.
- **Agent personas** — Configure multiple agents with different system prompts and models (Builder, Researcher, Debugger, Writer, DevOps).
- **Memory** — Per-session memory with auto-summarization and pinned facts.
- **Theme color** — Pick an accent color from 17 options in Settings. Persists across sessions.
- **Live preview** — Projects served at `/preview/<project-name>/` for instant browser preview.
- **Chrome DevTools** — Built-in MCP integration for browser automation, screenshots, and page inspection.
- **Source control** — Git integration with staging, commits, diffs, branching, push/pull — all from the UI.
- **File explorer** — Browse and edit project files with a built-in code editor.

## Architecture

```
claude-agent-board/
├── client/          # React + Tailwind frontend (Vite)
├── server/          # Express + WebSocket backend
├── shared/          # Shared TypeScript types
├── mcp-config.json  # MCP server configuration
└── start-chrome.sh  # Headless Chrome launcher
```

- **Frontend**: React 18, React Router, Tailwind CSS, Lucide icons
- **Backend**: Express, WebSocket (`ws`), better-sqlite3 (WAL mode)
- **Agent**: Spawns `claude` CLI with `--output-format stream-json` for structured NDJSON streaming
- **Database**: SQLite with projects, sessions, messages, agents, skills, memory, settings, activity log

## Prerequisites

- Node.js 20+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed and authenticated (`claude --version` should work)
- Chrome/Chromium (optional, for DevTools MCP)

## Quick Start

```bash
# Clone
git clone https://github.com/goranefbl/claude-agent-board.git
cd claude-agent-board

# Install dependencies
npm install

# Start in development mode (server + client with hot reload)
npm run dev
```

Open `http://localhost:5173` (Vite dev server proxies API to port 3001).

**Default login**: `admin` / `admin`

## Production Setup

```bash
# Build the frontend
npm run build

# Option 1: Run directly
AUTH_USER=admin AUTH_PASS=changeme PORT=3001 npx tsx server/src/index.ts

# Option 2: Use PM2
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'claude-agent-board',
    script: 'npx',
    args: 'tsx server/src/index.ts',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      AUTH_USER: 'admin',
      AUTH_PASS: 'changeme',
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '1G',
  }],
};
EOF

pm2 start ecosystem.config.cjs
```

The app runs at `http://localhost:3001`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `AUTH_USER` | Login username | `admin` |
| `AUTH_PASS` | Login password | `admin` |

## Default Seed Data

On first run the server creates:

- **5 agents**: Builder, Researcher, Debugger, Writer, DevOps
- **3 skills**: Code Review, Concise Output, Testing
- **2 MCP servers**: Chrome DevTools, Project Manager

## How It Works

1. **Chat** — Send a message → saved to SQLite → spawns `claude` CLI process → streams NDJSON back over WebSocket → displays in real-time.
2. **Multi-agent** — Each session spawns its own `claude` process. Switch sessions freely while background agents keep working.
3. **Mission Control** — Sessions have a status (backlog / in_progress / review / done). Change status from the chat header or drag cards on the board. All moves are logged in the activity feed.
4. **Projects** — Creating a project makes a folder at `~/projects/<slug>/`. The agent's system prompt includes the project path so it knows where to work.

## Optional: HTTPS with Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3001
```

## Optional: Chrome for DevTools MCP

```bash
# Launch headless Chrome with remote debugging
./start-chrome.sh
```

## License

MIT
