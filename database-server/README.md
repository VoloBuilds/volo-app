# Database Server

This package contains a standalone PostgreSQL database server for local development in volo-app projects.

## Overview

The database server runs as a separate Node.js process that hosts an embedded PostgreSQL instance on a dynamically allocated port (default: 5502). This allows the main server to treat it as any standard PostgreSQL database without tight coupling.

## Features

- **Standalone Process**: Runs independently from the main server
- **Graceful Shutdown**: Proper cleanup on process termination
- **Dynamic Port Management**: PostgreSQL port dynamically allocated by port-manager.js (default: 5502)
- **Data Persistence**: Database files stored in `../data/postgres/`

## Database Access

The database server provides a standard PostgreSQL interface without additional HTTP endpoints. You can check if it's running by connecting to the PostgreSQL port (see `DATABASE_URL` from the dev script), or by calling the main API root `GET /` or the tRPC `health` procedure once the app server is up.

## Scripts

- `pnpm dev` - Start database server in watch mode
- `pnpm start` - Start database server in production mode

## Configuration

The database server accepts the following CLI arguments:

- `--port <number>` - PostgreSQL port (dynamically allocated, default: 5502)

During development, the port is automatically allocated by the port-manager.js script to avoid conflicts.

## Environment Variables

The following environment variables control the main server's connection pool to this database:

| Variable | Default | Description |
|---|---|---|
| `DB_POOL_MAX` | `10` | Maximum connections in the postgres.js pool (see `server/.env.example`). Lower to `1` for Cloudflare Workers–style single-connection limits; raise for high-concurrency Node.js servers. |

## Connection String

When running, the database can be accessed at:
```
postgresql://postgres:password@localhost:{dynamicPort}/postgres
```

During development, the actual port is dynamically allocated and set in the `DATABASE_URL` environment variable.

## Integration

This database server is automatically started by the main development script (`pnpm dev` from the root) when using local database configuration. It should not be started manually during normal development.

## Data Directory

Database files are stored in `../data/postgres/` relative to the database-server package. This directory is shared with the root project data folder for consistency. 