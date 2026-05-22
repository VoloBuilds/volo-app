import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Parse CLI arguments for dynamic configuration
const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const apiUrlIndex = args.indexOf('--api-url');
  const firebaseAuthPortIndex = args.indexOf('--firebase-auth-port');
  const useFirebaseEmulatorIndex = args.indexOf('--use-firebase-emulator');
  
  return {
    port: portIndex !== -1 ? parseInt(args[portIndex + 1]) : 5173,
    apiUrl: apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : 'http://localhost:5500',
    firebaseAuthPort: firebaseAuthPortIndex !== -1 ? args[firebaseAuthPortIndex + 1] : '5503',
    useFirebaseEmulator: useFirebaseEmulatorIndex !== -1 ? args[useFirebaseEmulatorIndex + 1] : 'false'
  };
};

const { port, apiUrl, firebaseAuthPort, useFirebaseEmulator } = parseCliArgs();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: port
  },
  define: {
    'import.meta.env.VITE_API_URL': `"${apiUrl}"`,
    'import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT': `"${firebaseAuthPort}"`,
    'import.meta.env.VITE_USE_FIREBASE_EMULATOR': `"${useFirebaseEmulator}"`
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@server": path.resolve(__dirname, "../server/src"),
    },
  }
})
