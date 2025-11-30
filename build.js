import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read static files
const html = fs.readFileSync(path.join(__dirname, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'src', 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'src', 'script.js'), 'utf8');
const pitches = fs.readFileSync(path.join(__dirname, 'src', 'pitches.js'), 'utf8');

// Create the bundled worker
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
          content = ${JSON.stringify(html)};
          contentType = 'text/html';
          break;
        case '/styles.css':
          content = ${JSON.stringify(css)};
          contentType = 'text/css';
          break;
        case '/script.js':
          content = ${JSON.stringify(script)};
          contentType = 'application/javascript';
          break;
        case '/pitches.js':
          content = ${JSON.stringify(pitches)};
          contentType = 'application/javascript';
          break;
        default:
          return new Response('Not Found', { status: 404 });
      }

      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch (error) {
      console.error('Error serving file:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
`;

// Write the bundled worker
fs.writeFileSync(path.join(__dirname, 'dist', 'index.js'), workerCode);
console.log('Build complete! Output written to dist/index.js');