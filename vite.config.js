import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// EduLink GH - cloud web dashboard.
// Unlike the offline capture app (a separate PWA project), this app is
// meant to be viewed live and online every time - report generation and
// district/school analytics deliberately require a live connection to
// Supabase, so no service-worker/offline caching is registered here.
// Caching a stale dashboard or a stale "generate report" button would
// work against that rule rather than support it.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@pages": path.resolve(__dirname, "./src/pages"),
            "@layouts": path.resolve(__dirname, "./src/layouts"),
            "@services": path.resolve(__dirname, "./src/services"),
            "@database": path.resolve(__dirname, "./src/database"),
            "@models": path.resolve(__dirname, "./src/models"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@validation": path.resolve(__dirname, "./src/validation"),
            "@reporting": path.resolve(__dirname, "./src/reporting"),
            "@config": path.resolve(__dirname, "./src/config"),
            "@hooks": path.resolve(__dirname, "./src/hooks"),
            "@contexts": path.resolve(__dirname, "./src/contexts"),
            "@styles": path.resolve(__dirname, "./src/styles"),
        },
    },
    build: {
        target: "es2020",
        sourcemap: true,
        minify: "esbuild",
        cssMinify: true,
        chunkSizeWarningLimit: 600,
    },
});
