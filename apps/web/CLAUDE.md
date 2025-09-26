# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Frontend Architecture

This is the React frontend for the Better-T-Stack application, built with:

- **Framework**: React 19 + TanStack Router
- **Build Tool**: Vite with Cloudflare Pages plugin
- **Styling**: TailwindCSS v4 + shadcn/ui components
- **State Management**: TanStack Query for server state, React context for client state
- **API Client**: tRPC client for type-safe server communication

## Key Files

- `src/main.tsx` - React app entry point and router setup
- `src/routes/` - File-based routing with TanStack Router
- `src/utils/trpc.ts` - tRPC client configuration and React Query setup
- `src/components/` - React components (shadcn/ui in `ui/` subdirectory)
- `src/lib/utils.ts` - Utility functions including `cn` for className merging
- `vite.config.ts` - Vite configuration with TanStack Router plugin

## Development Commands

- `bun dev` - Start development server (port 3001)
- `bun build` - Build for production
- `bun check-types` - TypeScript type checking
- `bun deploy` - Build and deploy to Cloudflare Pages

## Routing

- File-based routing with TanStack Router
- Route definitions in `src/routes/` directory
- `__root.tsx` defines the root layout
- Type-safe routing with automatic route generation

## Component Patterns

- shadcn/ui components in `src/components/ui/`
- Custom components follow shadcn/ui patterns
- TailwindCSS with `cn()` utility for conditional classes
- Class variance authority (CVA) for component variants

## API Integration

- tRPC client configured in `src/utils/trpc.ts`
- React Query for caching and state management
- Toast notifications on API errors
- Server state accessed via tRPC hooks

## Styling

- TailwindCSS v4 with Vite plugin
- Theme provider for dark/light mode
- Component styling follows shadcn/ui conventions
- CSS-in-JS patterns for dynamic styling

## Environment

- Vite-based development server
- Environment variables prefixed with `VITE_`
- Deploys to Cloudflare Pages
- `VITE_SERVER_URL` points to backend API