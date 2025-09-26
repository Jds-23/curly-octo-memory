# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a Better-T-Stack monorepo with a React frontend and Hono/tRPC backend, both deployed to Cloudflare Workers. The stack includes:

- **Frontend** (`apps/web`): React + TanStack Router + TailwindCSS + shadcn/ui + Wagmi/Viem + Porto
- **Backend** (`apps/server`): Hono + tRPC + Drizzle ORM + Cloudflare D1 (SQLite)
- **Tooling**: Turborepo + Biome (linting/formatting) + Bun package manager

### Key Architectural Patterns

- **Type Safety**: End-to-end type safety via tRPC between frontend and backend
- **Database**: Drizzle ORM with SQLite/D1, schema-first approach
- **State Management**: TanStack Query for server state, React context for client state
- **Routing**: File-based routing with TanStack Router
- **Styling**: TailwindCSS with shadcn/ui components, uses CSS-in-JS patterns
- **Blockchain Integration**: Wagmi + Viem for Ethereum interactions, Porto for next-gen account management

### Monorepo Structure

```
apps/
├── web/         # React frontend (Vite + TanStack Router)
├── server/      # Hono backend (tRPC API + Drizzle DB)
```

- Web app runs on port 3001, server on port 3000
- tRPC client connects from web to server at `/trpc` endpoint
- CORS configured for cross-origin communication

## Development Commands

### Root Commands (run from repository root)
- `bun dev` - Start both web and server in development
- `bun build` - Build all applications
- `bun check-types` - TypeScript type checking across all apps
- `bun check` - Run Biome linting and formatting

### Individual App Development
- `bun dev:web` - Start only the web application (port 3001)
- `bun dev:server` - Start only the server (port 3000)

### Database Commands (run from root)
- `bun db:push` - Push schema changes to database (no migrations)
- `bun db:studio` - Open Drizzle Studio for database inspection
- `bun db:generate` - Generate migration files
- `bun db:migrate` - Apply migrations

### App-Specific Commands
- `cd apps/web && bun deploy` - Deploy web app to Cloudflare Pages
- `cd apps/server && bun deploy` - Deploy server to Cloudflare Workers

## Development Setup

1. Install dependencies: `bun install`
2. Set up environment variables in `apps/server/.env` and `apps/web/.env`
3. Push database schema: `bun db:push`
4. Start development: `bun dev`

## Code Organization

### Web App (`apps/web/src/`)
- `routes/` - File-based routing with TanStack Router
- `components/` - React components (including shadcn/ui in `ui/`)
- `config/wagmi.ts` - Wagmi configuration with Porto, injected, and WalletConnect connectors
- `utils/trpc.ts` - tRPC client configuration and React Query setup
- `lib/utils.ts` - Utility functions (includes `cn` for className merging)

### Server (`apps/server/src/`)
- `index.ts` - Hono app entry point with CORS and tRPC middleware
- `routers/` - tRPC procedure definitions
- `lib/` - Context creation and tRPC setup
- `db/` - Database schema and connection

## Important Notes

- Uses Bun as package manager and runtime
- Biome enforces tab indentation and double quotes
- Environment is Cloudflare Workers (not Node.js)
- Database operations use Drizzle ORM, not raw SQL
- All API calls go through tRPC for type safety
- Wagmi provider wraps the entire app in `main.tsx` with Porto connector configured
- Porto enables next-generation account abstraction for Ethereum interactions
- Web3 authentication available on homepage via Porto sign-in buttons