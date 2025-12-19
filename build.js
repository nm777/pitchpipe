import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Read package.json to get current version
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const currentVersion = packageJson.version;

// Read static files
const html = fs.readFileSync(path.join(__dirname, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'src', 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'src', 'script.js'), 'utf8');
const pitches = fs.readFileSync(path.join(__dirname, 'src', 'pitches.js'), 'utf8');

// Create cache-busting version string
const cacheBuster = `v${currentVersion}_${Date.now()}`;

// Update version display and add cache busting in HTML
const updatedHtml = html
  .replace('v1.0.0', `v${currentVersion}`)
  .replace('script.js"', `script.js?${cacheBuster}"`)
  .replace('styles.css"', `styles.css?${cacheBuster}"`)
  .replace('pitches.js"', `pitches.js?${cacheBuster}"`);

// Create bundled worker
const workerCode = `
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let content;
      let contentType;

      switch (path) {
        case '/':
        case '/index.html':
          content = ${JSON.stringify(updatedHtml)};
          contentType = 'text/html';
          break;
        case '/styles.css':
          content = ${JSON.stringify(css)};
          contentType = 'text/css';
          break;
        case '/script.js':
          // Handle cache-busted script requests
          if (path.includes('?')) {
            const [cleanPath] = path.split('?');
            content = ${JSON.stringify(script)};
          } else {
            content = ${JSON.stringify(script)};
          }
          contentType = 'application/javascript';
          break;
        case '/pitches.js':
          content = ${JSON.stringify(pitches)};
          contentType = 'application/javascript';
          break;
        default:
          return new Response('Not Found', { status: 404 });
      }

      // Add cache busting headers for CSS and JS
      const headers = {
        'Content-Type': contentType,
      };
      
      if (contentType.includes('css') || contentType.includes('javascript')) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      } else {
        headers['Cache-Control'] = 'public, max-age=86400';
      }

      return new Response(content, { headers });
    } catch (error) {
      console.error('Error serving file:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
`;

// Write the bundled worker
fs.writeFileSync(path.join(__dirname, 'dist', 'index.js'), workerCode);
console.log(`Build complete! Version ${currentVersion} written to dist/index.js with cache buster ${cacheBuster}`);