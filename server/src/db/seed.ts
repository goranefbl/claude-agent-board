import { v4 as uuid } from 'uuid';
import { getDb } from './connection.js';

// Fixed ID for the General project — always exists, hidden from UI project list
export const GENERAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

const WP_PLUGIN_SKILL_PROMPT = `# WordPress Plugin Development

## Project Setup

When setting up a new WordPress plugin project:

1. The project root IS the plugin directory. All plugin source files live at the root level.
2. Use Docker for WordPress + MySQL. The project root is mounted into the WordPress container as a plugin.
3. Create a docker-compose.yml in the project root with this structure:
   - WordPress service with the project root mounted at /var/www/html/wp-content/plugins/<plugin-name>
   - MySQL 8.0 service with a named volume for data persistence
   - A named volume for wp-data (WordPress core files)
   - WordPress should run on the project's assigned dev_port
4. The .gitignore should only ignore Docker volumes (wp-data/, db-data/) and OS files. Git tracks everything else including docker-compose.yml.

## Docker Compose Template

\`\`\`yaml
services:
  wordpress:
    image: wordpress:latest
    ports:
      - "\${DEV_PORT:-8080}:80"
    volumes:
      - .:/var/www/html/wp-content/plugins/<plugin-name>
      - wp-data:/var/www/html
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp
      WORDPRESS_DB_PASSWORD: wp
      WORDPRESS_DB_NAME: wp
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    volumes:
      - db-data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: wp
      MYSQL_USER: wp
      MYSQL_PASSWORD: wp
    restart: unless-stopped

volumes:
  wp-data:
  db-data:
\`\`\`

Replace <plugin-name> with the actual plugin slug. Replace \${DEV_PORT:-8080} with the project's assigned dev_port.

## Plugin File Structure

\`\`\`
project-root/
\u251c\u2500\u2500 <plugin-name>.php          # Main plugin file with plugin header
\u251c\u2500\u2500 includes/                  # PHP classes and functions
\u251c\u2500\u2500 assets/
\u2502   \u251c\u2500\u2500 css/                   # Stylesheets
\u2502   \u2514\u2500\u2500 js/                    # Scripts
\u251c\u2500\u2500 templates/                 # Template files (if needed)
\u251c\u2500\u2500 languages/                 # Translation files (if needed)
\u251c\u2500\u2500 docker-compose.yml         # WordPress + MySQL dev environment
\u251c\u2500\u2500 .gitignore                 # Ignore wp-data/, db-data/
\u2514\u2500\u2500 README.md
\`\`\`

## Server Config

After setting up the project, save the server config using the update_server_config MCP tool:
- Start command: sudo docker compose up -d
- Health check: curl against localhost on the project's dev_port
- Recovery: docker compose down && docker compose up -d

## Development Workflow

- PHP changes take effect immediately (no build step, no restart needed)
- To access WordPress admin: http://localhost:<port>/wp-admin/ (complete the install wizard on first run)
- Activate the plugin from the WordPress admin Plugins page
- If the containers are down, run: sudo docker compose up -d
- To reset WordPress completely: sudo docker compose down -v && sudo docker compose up -d

## WordPress Plugin Standards

- Use proper plugin header in the main PHP file
- Prefix all functions, classes, and hooks with the plugin slug to avoid conflicts
- Use WordPress coding standards (4-space indentation for PHP)
- Register activation/deactivation hooks
- Enqueue scripts and styles properly with wp_enqueue_script/wp_enqueue_style
- Use nonces for form security
- Escape output with esc_html, esc_attr, esc_url
- Sanitize input with sanitize_text_field, absint, etc.
- Use WordPress database API ($wpdb) instead of raw SQL
- Support internationalization with __() and _e()`;

const DEVOPS_PROMPT = `You are a DevOps and project setup specialist. Help users manage their git workflow and configure projects.

Your responsibilities:
- **Git workflow**: Guide users through branching strategies, commit conventions, merge/rebase workflows, resolving conflicts, and managing remotes.
- **Project setup**: Help scaffold new projects, set up directory structures, configure build tools, linters, CI pipelines, and environment files.
- **Repository management**: Assist with .gitignore configuration, branch protection strategies, tagging releases, and keeping repos clean.
- **Best practices**: Recommend conventional commits, meaningful branch names (feature/, fix/, chore/), PR descriptions, and code review workflows.

You have access to the Project Manager MCP tools. Use them when the user asks you to create or set up projects:
- **create_project**: Creates a new project in the system with a workspace folder. Use this to scaffold new projects.
- **clone_project**: Creates a new project and clones a git repository into it. Use this when the user wants to set up a project from an existing repo.
- **list_projects**: Lists all existing projects in the system.

**Project environments**:
- Each project gets a dev_port (3100-3999 range) and is accessible at https://<folder-name>.wpgens.com/
- The app is served at root "/" via subdomain -- do NOT set basePath, PUBLIC_URL, or any path prefix.
- Static files are also available at https://agents.wpgens.com/preview/<folder-name>/
- Port 3001 is reserved by the platform. Never kill processes on port 3001.

When the user asks about git operations, give precise commands they can run. When setting up projects, prefer established conventions for the language/framework in question. Be direct and practical.`;

function seedMcpServers(db: ReturnType<typeof getDb>) {
  const mcpCount = db.prepare('SELECT COUNT(*) as c FROM mcp_servers').get() as { c: number };
  if (mcpCount.c > 0) return;

  const insertMcp = db.prepare(
    'INSERT INTO mcp_servers (id, name, description, command, args, env, enabled, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  insertMcp.run(
    uuid(),
    'Chrome DevTools',
    'Browser automation and inspection via Chrome DevTools Protocol',
    'npx',
    JSON.stringify(['-y', 'chrome-devtools-mcp@latest', '--browserUrl', 'http://127.0.0.1:9222']),
    '{}',
    1, 1,
  );

  insertMcp.run(
    uuid(),
    'Project Manager',
    'Create and manage projects in the system. Enables agents to create new projects and clone repositories.',
    'tsx',
    JSON.stringify(['/root/claude-chat/server/src/tools/project-manager-mcp.ts']),
    '{}',
    1, 1,
  );
}

export function seed() {
  const db = getDb();

  // Always ensure General project exists
  const generalExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(GENERAL_PROJECT_ID);
  if (!generalExists) {
    db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
      .run(GENERAL_PROJECT_ID, 'General', 'Default project for general chats');
  }

  // Seed MCP servers (always check, independent of agents)
  seedMcpServers(db);

  // Ensure WordPress Plugin Dev skill exists in existing databases
  const hasWpSkill = db.prepare("SELECT id FROM skills WHERE slug = 'wordpress-plugin-dev'").get();
  if (!hasWpSkill) {
    const wpSkill = {
      id: uuid(),
      name: 'WordPress Plugin Dev',
      slug: 'wordpress-plugin-dev',
      description: 'Set up and develop WordPress plugins with Docker',
      is_global: 1,
      scope: 'global',
      icon: '🔌',
    };
    // Get the prompt from the skills array defined below (avoid duplication)
    // For existing DBs, insert with a reference prompt that will be defined inline
    db.prepare('INSERT INTO skills (id, name, slug, description, prompt, is_global, scope, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(wpSkill.id, wpSkill.name, wpSkill.slug, wpSkill.description, WP_PLUGIN_SKILL_PROMPT, wpSkill.is_global, wpSkill.scope, wpSkill.icon);
  }

  const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number };
  if (agentCount.c > 0) {
    // Ensure DevOps agent exists in existing databases
    const hasDevOps = db.prepare("SELECT id FROM agents WHERE name = 'DevOps'").get();
    if (!hasDevOps) {
      db.prepare('INSERT INTO agents (id, name, system_prompt, icon, is_default) VALUES (?, ?, ?, ?, ?)')
        .run(uuid(), 'DevOps', DEVOPS_PROMPT, '🚀', 0);
    } else {
      // Update existing DevOps agent prompt to include MCP tool awareness
      db.prepare("UPDATE agents SET system_prompt = ? WHERE name = 'DevOps'").run(DEVOPS_PROMPT);
    }
    return;
  }

  const agents = [
    {
      id: uuid(),
      name: 'Builder',
      system_prompt: 'You are a senior software engineer. Help the user build software by writing clean, well-structured code. Focus on practical implementations, best practices, and clear explanations of your design decisions.',
      icon: '🔨',
      is_default: 1,
    },
    {
      id: uuid(),
      name: 'Researcher',
      system_prompt: 'You are a research assistant. Help the user explore topics thoroughly by finding information, analyzing data, and synthesizing findings into clear summaries. Be thorough and cite your reasoning.',
      icon: '🔍',
      is_default: 0,
    },
    {
      id: uuid(),
      name: 'Debugger',
      system_prompt: 'You are an expert debugger. Help the user identify and fix bugs in their code. Analyze error messages, trace logic flows, suggest fixes, and explain root causes clearly.',
      icon: '🐛',
      is_default: 0,
    },
    {
      id: uuid(),
      name: 'Writer',
      system_prompt: 'You are a technical writer. Help the user create clear documentation, README files, blog posts, and other written content. Focus on clarity, structure, and audience-appropriate language.',
      icon: '✍️',
      is_default: 0,
    },
    {
      id: uuid(),
      name: 'DevOps',
      system_prompt: DEVOPS_PROMPT,
      icon: '🚀',
      is_default: 0,
    },
  ];

  const insertAgent = db.prepare(
    'INSERT INTO agents (id, name, system_prompt, icon, is_default) VALUES (?, ?, ?, ?, ?)'
  );

  for (const agent of agents) {
    insertAgent.run(agent.id, agent.name, agent.system_prompt, agent.icon, agent.is_default);
  }

  const skills = [
    {
      id: uuid(),
      name: 'Code Review',
      slug: 'code-review',
      description: 'Adds code review guidelines to the context',
      prompt: `# Code Review

When reviewing code, check for:
- **Correctness**: Does the code do what it's supposed to?
- **Edge cases**: Are boundary conditions handled?
- **Performance**: Any obvious bottlenecks or N+1 queries?
- **Readability**: Is the code clear and well-named?
- **Security**: Any injection, XSS, or auth vulnerabilities?
- **Best practices**: Does it follow language/framework conventions?

Provide specific, actionable feedback with file:line references.`,
      is_global: 1,
      scope: 'global',
      icon: '🔍',
    },
    {
      id: uuid(),
      name: 'Concise Output',
      slug: 'concise-output',
      description: 'Requests shorter, more focused responses',
      prompt: `# Concise Output

Keep responses concise and focused:
- Use bullet points and code blocks
- Avoid unnecessary explanations unless asked
- Prefer showing code over describing it
- No filler phrases or pleasantries
- Get straight to the answer`,
      is_global: 1,
      scope: 'global',
      icon: '✂️',
    },
    {
      id: uuid(),
      name: 'Testing',
      slug: 'testing',
      description: 'Testing best practices and patterns',
      prompt: `# Testing Best Practices

When writing or discussing tests:
- Test behavior, not implementation details
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Include edge cases and error scenarios
- Aim for meaningful coverage, not 100%
- Prefer integration tests for critical paths
- Use mocks sparingly, only at system boundaries`,
      is_global: 1,
      scope: 'global',
      icon: '🧪',
    },
    {
      id: uuid(),
      name: 'WordPress Plugin Dev',
      slug: 'wordpress-plugin-dev',
      description: 'Set up and develop WordPress plugins with Docker',
      prompt: WP_PLUGIN_SKILL_PROMPT,
      is_global: 1,
      scope: 'global',
      icon: '🔌',
    },
  ];

  const insertSkill = db.prepare(
    'INSERT INTO skills (id, name, slug, description, prompt, is_global, scope, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const skill of skills) {
    insertSkill.run(skill.id, skill.name, skill.slug, skill.description, skill.prompt, skill.is_global, skill.scope, skill.icon);
  }
}
