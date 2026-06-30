import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

// Node 18에서는 import.meta.dirname을 지원하지 않으므로 직접 계산한다.
const templateRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
