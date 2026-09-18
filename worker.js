export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Editor-Version, Editor-Plugin-Version, Copilot-Integration-Id, OpenAI-Intent, X-Github-Api-Version',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // API Proxy: /api/token -> GitHub Copilot token
    if (url.pathname === '/api/token') {
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
          headers: { 'Authorization': auth, 'Accept': 'application/json', 'User-Agent': 'gh-copilot' }
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // API Proxy: /api/user -> GitHub user
    if (url.pathname === '/api/user') {
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        const res = await fetch('https://api.github.com/user', { headers: { 'Authorization': auth, 'Accept': 'application/json', 'User-Agent': 'gh-copilot' } });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // API Proxy: /api/chat/completions -> Copilot chat (streaming)
    if (url.pathname === '/api/chat/completions') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        const body = await request.text();
        const targetRes = await fetch('https://api.githubcopilot.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Editor-Version': request.headers.get('Editor-Version') || 'vscode/1.99.3',
            'Editor-Plugin-Version': request.headers.get('Editor-Plugin-Version') || 'copilot-chat/0.26.7',
            'Copilot-Integration-Id': request.headers.get('Copilot-Integration-Id') || 'vscode-chat',
            'OpenAI-Intent': request.headers.get('OpenAI-Intent') || 'conversation-panel',
            'X-Github-Api-Version': '2023-07-07',
            'Accept': 'text/event-stream',
          },
          body: body,
        });
        const { readable, writable } = new TransformStream();
        targetRes.body.pipeTo(writable).catch(()=>{});
        return new Response(readable, {
          status: targetRes.status,
          headers: {
            'Content-Type': targetRes.headers.get('Content-Type') || 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // Serve static assets (index.html etc) via ASSETS binding if available, otherwise fallback
    try {
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
    } catch (e) {
      // fallback to fetch index.html
    }

    // Fallback: return index.html for SPA
    return new Response('Not found - Please use Pages deployment for full static support. For Worker, make sure assets binding is enabled.', { status: 404 });
  }
}
