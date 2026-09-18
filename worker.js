export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
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

    // Device Flow: /api/device/code
    if (url.pathname === '/api/device/code') {
      try {
        const body = await request.text();
        const res = await fetch('https://github.com/login/device/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'gh-copilot' },
          body: body
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // Device Flow: /api/device/token
    if (url.pathname === '/api/device/token') {
      try {
        const body = await request.text();
        const res = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'gh-copilot' },
          body: body
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    async function getCopilotToken(auth) {
      const endpoints = [
        'https://api.github.com/copilot_internal/v2/token',
        'https://api.individual.githubcopilot.com/copilot_internal/v2/token',
        'https://api.githubcopilot.com/copilot_internal/v2/token'
      ];
      let lastRes = null;
      let lastText = '';
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: { 'Authorization': auth, 'Accept': 'application/json', 'User-Agent': 'gh-copilot', 'X-Github-Api-Version': '2023-07-07' }
          });
          const text = await res.text();
          if (res.ok) {
            return { ok: true, status: res.status, text, endpoint: ep };
          }
          lastRes = res;
          lastText = text;
          if (res.status === 401 || res.status === 403) {
            return { ok: false, status: res.status, text, endpoint: ep };
          }
        } catch (e) {
          lastText = e.message;
        }
      }
      return { ok: false, status: lastRes ? lastRes.status : 404, text: lastText, endpoint: 'all tried' };
    }

    if (url.pathname === '/api/token') {
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      
      const result = await getCopilotToken(auth);
      if (result.ok) {
        return new Response(result.text, { status: result.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
      } else {
        let msg = result.text;
        try {
          const j = JSON.parse(result.text);
          msg = j.message || j.error || result.text;
        } catch {}
        const is404 = result.status === 404;
        const help = is404 
          ? `PAT (ghp_) bị GitHub chặn 404. Hãy dùng OAuth Device Flow: Bấm "Bắt đầu Device Flow" để lấy token ghu_ (giống VS Code). Tài khoản phải có Copilot active tại github.com/settings/copilot.`
          : `Lỗi ${result.status}: ${msg}`;
        return new Response(JSON.stringify({ error: help, original: result.text, status: result.status, endpoint: result.endpoint }), { status: result.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

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

    if (url.pathname === '/api/chat/completions') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        const body = await request.text();
        const chatEndpoints = [
          'https://api.githubcopilot.com/chat/completions',
          'https://api.individual.githubcopilot.com/chat/completions'
        ];
        let targetRes = null;
        for (const ep of chatEndpoints) {
          try {
            targetRes = await fetch(ep, {
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
            if (targetRes.ok || targetRes.status !== 404) break;
          } catch {}
        }
        if (!targetRes) throw new Error('All chat endpoints failed');
        if (!targetRes.ok) {
          const errText = await targetRes.text();
          return new Response(errText, { status: targetRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
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

    try {
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
    } catch {}
    return new Response('Not found', { status: 404 });
  }
}
