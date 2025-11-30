import { styles } from './styles.js';
import { getHTML } from './html.js';
import { pitchpipeScript } from './script.js';

export default {
  async fetch(request, env, ctx) {
    const html = getHTML(styles, pitchpipeScript);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  },
};