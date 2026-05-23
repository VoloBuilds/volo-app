import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

const PRODUCTION_API_URL_ERROR = `UI production build requires a production API URL.

  Set VITE_API_URL in ui/.env.production, or run:
    pnpm run deploy
  from the project root (deploys the API first and sets this automatically).

  Local dev is unaffected — ui/.env.local keeps VITE_API_URL=http://localhost:5500.`;

const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const index = args.indexOf(name);
    return index !== -1 ? args[index + 1] : undefined;
  };

  return {
    port: getArg("--port") ? parseInt(getArg("--port")!, 10) : 5173,
    apiUrl: getArg("--api-url"),
    firebaseAuthPort: getArg("--firebase-auth-port"),
    useFirebaseEmulator: getArg("--use-firebase-emulator"),
  };
};

function validateProductionApiUrl(url: string | undefined): string {
  if (!url || url.trim() === "") {
    throw new Error(PRODUCTION_API_URL_ERROR);
  }
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    throw new Error(PRODUCTION_API_URL_ERROR);
  }
  if (url.includes("YOUR_SUBDOMAIN")) {
    throw new Error(PRODUCTION_API_URL_ERROR);
  }
  return url;
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const cliArgs = parseCliArgs();
  const define: Record<string, string> = {};

  if (cliArgs.apiUrl) {
    define["import.meta.env.VITE_API_URL"] = JSON.stringify(cliArgs.apiUrl);
  } else if (command === "build") {
    const productionEnv = loadEnv("production", __dirname, "");
    const apiUrl = validateProductionApiUrl(
      process.env.VITE_API_URL || productionEnv.VITE_API_URL
    );
    define["import.meta.env.VITE_API_URL"] = JSON.stringify(apiUrl);
  } else {
    const devEnv = loadEnv("development", __dirname, "");
    const apiUrl = devEnv.VITE_API_URL || "http://localhost:5500";
    define["import.meta.env.VITE_API_URL"] = JSON.stringify(apiUrl);
  }

  if (cliArgs.firebaseAuthPort !== undefined) {
    define["import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT"] = JSON.stringify(
      cliArgs.firebaseAuthPort
    );
  }
  if (cliArgs.useFirebaseEmulator !== undefined) {
    define["import.meta.env.VITE_USE_FIREBASE_EMULATOR"] = JSON.stringify(
      cliArgs.useFirebaseEmulator
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: cliArgs.port,
    },
    define,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@server": path.resolve(__dirname, "../server/src"),
      },
    },
  };
});
