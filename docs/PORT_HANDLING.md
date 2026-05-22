# Port Handling in volo-app

## Overview

volo-app automatically handles port assignments to prevent conflicts and enable running multiple instances simultaneously. The system uses **smart port detection** with **graceful fallbacks** to ensure your development environment works seamlessly.

## 🚀 How It Works

### Automatic Port Detection

When you run `pnpm run dev`, volo-app:

1. **Finds available ports** starting from 5500-5504 for the first instance
2. **Uses clean port blocks** (5600-5604, 5700-5704, etc.) for additional instances
3. **Temporarily updates configuration files** with the assigned ports
4. **Displays clear status** showing which ports are being used
5. **Restores original configuration** when you stop the server

### Port Allocation Strategy

The system allocates ports in clean 100-port blocks:

- **Instance 1:** 5500-5504 (backend, frontend, postgres, firebase auth, firebase UI)
- **Instance 2:** 5600-5604  
- **Instance 3:** 5700-5704
- **And so on...**

If any port in a block is occupied, the system jumps to the next 100-port block to ensure clean groupings.

### Dynamic Configuration Updates

For dynamic port management, the system:

- ✅ **Temporarily modifies `.env` file** with dynamic PostgreSQL and Firebase Auth ports
- ✅ **Passes CLI arguments** to services with correct ports  
- ✅ **Sets environment variables** for frontend Firebase Auth emulator connection
- ✅ **Restores original `.env`** when services are stopped
- ✅ **Ensures all services** use the dynamically assigned ports

This prevents port conflicts between multiple instances and ensures proper service isolation.

### Services and Default Ports


| Service                    | Default Port | Purpose                  |
| -------------------------- | ------------ | ------------------------ |
| **Backend API**            | 8787         | Your Hono server         |
| **Frontend (Vite)**        | 5173         | React development server |
| **PostgreSQL**             | 5433         | Embedded database        |
| **Firebase Auth Emulator** | 9099         | Authentication testing   |
| **Firebase Emulator UI**   | 4000         | Emulator dashboard       |


## 📋 Port Status Display

When starting development, you'll see output like this:

```
🎉 Your app is ready at:
   Frontend:  http://localhost:5173
   Backend:   http://localhost:8787
   Firebase:  http://localhost:4000
   Database:  postgresql://postgres:password@localhost:5433/postgres
```

**Note:** If default ports are occupied, the system automatically finds available alternatives.

## 🔄 Multiple Instance Support

### Running Multiple volo-apps

You can run multiple volo-app projects simultaneously by:

1. **Creating separate project folders** for each app
2. **Running each from its own directory** - ports are automatically managed
3. **Each gets its own database** and isolated configuration

```bash
# Terminal 1
cd ~/projects/my-first-app
pnpm run dev    # Uses ports 8787, 5173, 5433, etc.

# Terminal 2  
cd ~/projects/my-second-app
pnpm run dev    # Uses ports 8788, 5174, 5434, etc.
```

### What Gets Isolated:

- ✅ **PostgreSQL databases** - each project has its own `data/postgres` directory
- ✅ **HTTP services** - automatic port conflict resolution
- ✅ **Firebase emulator data** - stored in each project's `data/firebase-emulator` folder
- ✅ **Configuration files** - temporarily updated with correct ports per instance

**Important:** Each instance temporarily modifies its own `.env` file with the correct database port, ensuring proper isolation between multiple running instances.

## 🛠️ Development Modes

### Node.js Mode (Default)

```bash
pnpm run dev
```

**Features:**

- ✅ Embedded PostgreSQL database
- ✅ Hot reload for server and frontend
- ✅ Firebase Auth emulator
- ✅ Automatic port management

### Cloudflare Workers Mode

```bash
pnpm run dev -- --wrangler
# or
pnpm run dev -- --cloudflare
```

**Features:**

- ⚡ Wrangler dev server (simulates Cloudflare Workers)
- 🌐 **Requires remote database** (Neon, Supabase, etc.)
- ✅ Firebase Auth emulator
- ✅ Automatic port management

**Note:** Embedded PostgreSQL is not available in Cloudflare Workers mode.

## 🗄️ Database Handling

### Embedded PostgreSQL (Node.js Mode)

When using embedded PostgreSQL (the default for local development):

- **Port assignment:** Dynamic, starting from 5433
- **Data isolation:** Each project folder has its own `data/postgres` directory
- **Conflict detection:** Prevents multiple instances from using the same data directory
- **Port conflicts matter:** If PostgreSQL ports conflict, the system finds alternatives

### External Database (Production & Wrangler Mode)

When using external databases (Neon, Supabase, etc.):

```env
DATABASE_URL=postgresql://user:password@host.neon.tech:5432/mydb
```

- **No port conflicts:** Database runs remotely, no local port management needed
- **Shared access:** Multiple projects can connect to the same external database
- **Required for Wrangler mode:** Cloudflare Workers cannot run embedded PostgreSQL

**Supported providers:** Neon (recommended), Supabase, Railway, or any PostgreSQL-compatible service.

## 🔧 Configuration

### Port Management

The system uses simple defaults and automatic port detection:

1. **Default values** (hardcoded in the run-dev.js script)
2. **Automatic alternatives** if defaults are occupied
3. **No manual configuration needed**

Your `server/.env` focuses on essential configuration:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/postgres
FIREBASE_PROJECT_ID=demo-project
```

**Note:** Port numbers in DATABASE_URL are handled automatically - the system will update the actual port used for embedded PostgreSQL.