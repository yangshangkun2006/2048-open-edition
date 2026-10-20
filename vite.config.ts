/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';

// CSP is injected only into the production build: Vite's dev server injects
// <style> tags that would be blocked by `style-src 'self'` (PRD §9.4 requires
// no inline styles/scripts in production).
function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        'form-action none',
      ].join('; ');
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [cspPlugin()],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
