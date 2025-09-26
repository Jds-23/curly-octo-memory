# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Server Architecture

This is the backend API for the Better-T-Stack application, built with:

- **Framework**: Hono (Cloudflare Workers-optimized)
- **API Layer**: tRPC for type-safe API procedures
- **Database**: Drizzle ORM with Cloudflare D1 (SQLite)
- **Runtime**: Cloudflare Workers (not Node.js)

## Key Files

- `src/index.ts` - Main Hono app with CORS and tRPC middleware
- `src/routers/index.ts` - tRPC router definitions (API procedures)
- `src/lib/trpc.ts` - tRPC server configuration
- `src/lib/context.ts` - Request context creation (database, environment)
- `src/db/index.ts` - Database connection and Drizzle setup
- `drizzle.config.ts` - Drizzle Kit configuration for D1

## Development Commands

- `bun dev` - Start development server with Wrangler (port 3000)
- `bun check-types` - TypeScript type checking
- `bun db:push` - Push schema changes to database
- `bun db:studio` - Open Drizzle Studio
- `bun db:generate` - Generate migration files
- `bun db:migrate` - Apply migrations
- `bun deploy` - Deploy to Cloudflare Workers

## Database Patterns

- Schema defined in `src/db/schema/` directory
- Use Drizzle ORM queries, not raw SQL
- Database connection available via tRPC context
- D1 database for production, local SQLite for development

## API Patterns

- All API endpoints are tRPC procedures in `src/routers/`
- Context includes database connection and Cloudflare environment
- Input validation with Zod schemas
- Type safety enforced across frontend/backend boundary

## Environment

- Runs on Cloudflare Workers (not Node.js)
- Environment variables accessed via `env` from `cloudflare:workers`
- CORS configured for web frontend communication