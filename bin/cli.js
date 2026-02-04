#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Prevent running as root
if (process.getuid && process.getuid() === 0) {
  console.error(`
  Error: OptimusHQ cannot run as root.

  Claude CLI requires --dangerously-skip-permissions which is
  blocked for root users (for security reasons).

  Please run as a non-root user:
    sudo useradd -m claude
    sudo su - claude
    npx @goranefbl/optimushq
`);
  process.exit(1);
}

const args = process.argv.slice(2);
const port = process.env.PORT || 3001;
const authUser = process.env.AUTH_USER || 'admin';
const authPass = process.env.AUTH_PASS || 'admin';

// Find the package root (where server/dist is)
const pkgRoot = path.resolve(__dirname, '..');
// Try both possible build output paths
const serverEntryDirect = path.join(pkgRoot, 'server', 'dist', 'index.js');
const serverEntryNested = path.join(pkgRoot, 'server', 'dist', 'server', 'src', 'index.js');
const serverEntry = fs.existsSync(serverEntryDirect) ? serverEntryDirect : serverEntryNested;

// Check if just showing help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
OptimusHQ - Multi-Agent Platform

Usage: optimushq [options]

Options:
  --help, -h    Show this help message

Environment Variables:
  PORT          Server port (default: 3001)
  AUTH_USER     Admin username (default: admin)
  AUTH_PASS     Admin password (default: admin)

Examples:
  npx @goranefbl/optimushq                    Start the server
  PORT=8080 npx @goranefbl/optimushq          Start on port 8080

Features:
  - Multi-project workspace with agents
  - Skills, APIs, and MCP server management
  - WhatsApp integration (Settings > WhatsApp)
  - Real-time chat with Claude
`);
  process.exit(0);
}

if (!fs.existsSync(serverEntry)) {
  console.error('Error: Server not built. Run "npm run build" first.');
  process.exit(1);
}

console.log(`
  +-----------------------------------------------------------+
  |                                                           |
  |   OptimusHQ - Multi-Agent Platform                        |
  |                                                           |
  |   Server: http://localhost:${port}                          |
  |   Login:  ${authUser} / ${'*'.repeat(authPass.length)}                                   |
  |                                                           |
  |   WhatsApp: Settings > WhatsApp Integration               |
  |                                                           |
  +-----------------------------------------------------------+
`);

const server = spawn('node', [serverEntry], {
  cwd: pkgRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    AUTH_USER: authUser,
    AUTH_PASS: authPass,
  },
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

server.on('close', (code) => {
  process.exit(code || 0);
});

// Handle termination
process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
