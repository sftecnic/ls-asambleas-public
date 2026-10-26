import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server:{port:5173,watch:{ignored:['**/.tools/**','**/qa/**','**/playwright-report/**','**/test-results/**','**/dist/**']}}, build:{chunkSizeWarningLimit:1100,rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/@photo-sphere-viewer/')||id.includes('/node_modules/three/'))return 'tour-viewer';}}}} });
