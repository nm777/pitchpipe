export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let file;
      let contentType;

      switch (path) {
        case '/':
        case '/index.html':
          file = await import('./index.html?raw');
          contentType = 'text/html';
          break;
        case '/styles.css':
          file = await import('./styles.css?raw');
          contentType = 'text/css';
          break;
        case '/script.js':
          file = await import('./script.js?raw');
          contentType = 'application/javascript';
          break;
        case '/pitches.js':
          file = await import('./pitches.js?raw');
          contentType = 'application/javascript';
          break;
        default:
          return new Response('Not Found', { status: 404 });
      }

      return new Response(file.default, {
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