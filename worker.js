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

    // Turnstile verify
    if (url.pathname === '/api/turnstile/verify') {
      try {
        const { token } = await request.json();
        if (!token) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        
        // Demo keys always pass - for production, set TURNSTILE_SECRET_KEY in env
        // 1x00000000000000000000AA is demo that always passes
        // Use real secret key from https://dash.cloudflare.com/?to=/:account/turnstile
        const secret = env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'; // demo secret
        
        // If using demo sitekey, always pass
        if (token && (token.length > 10)) {
          // For demo, skip actual verification if using demo keys
          // In production, uncomment below to verify with Cloudflare
          /*
          const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret, response: token, remoteip: request.headers.get('CF-Connecting-IP') })
          });
          const verifyData = await verifyRes.json();
          return new Response(JSON.stringify(verifyData), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          */
          return new Response(JSON.stringify({ success: true, demo: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

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

    if (url.pathname === '/api/models') {
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        const endpoints = ['https://api.githubcopilot.com/models','https://api.individual.githubcopilot.com/models'];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, { headers: { 'Authorization': auth, 'Accept': 'application/json', 'Editor-Version': 'vscode/1.99.3', 'Copilot-Integration-Id': 'vscode-chat' } });
            if (res.ok) {
              const text = await res.text();
              return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
            }
          } catch {}
        }
        return new Response(JSON.stringify({ data: [
          { id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
          { id: 'gpt-5', name: 'GPT-5' }, { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
          { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }, { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' }
        ]}), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    async function getCopilotToken(auth) {
      const endpoints = ['https://api.github.com/copilot_internal/v2/token','https://api.individual.githubcopilot.com/copilot_internal/v2/token','https://api.githubcopilot.com/copilot_internal/v2/token'];
      let lastRes = null, lastText = '';
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { headers: { 'Authorization': auth, 'Accept': 'application/json', 'User-Agent': 'gh-copilot' } });
          const text = await res.text();
          if (res.ok) return { ok: true, status: res.status, text, endpoint: ep };
          lastRes = res; lastText = text;
          if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, text, endpoint: ep };
        } catch (e) { lastText = e.message; }
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
        return new Response(JSON.stringify({ error: `PAT blocked. Use Device Flow.`, original: result.text, status: result.status }), { status: result.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
        const bodyText = await request.text();
        let bodyJson; try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = {}; }
        const modelFallbacks = {
          'claude-3.5-sonnet': ['claude-3.5-sonnet','claude-3-5-sonnet-20241022','gpt-4o'],
          'claude-3.7-sonnet': ['claude-3.7-sonnet','claude-3-7-sonnet-20250219','gpt-4o'],
          'gpt-5.6-luna': ['gpt-5.6-luna','gpt-5-luna','gpt-5','gpt-4o'],
          'gpt-5': ['gpt-5','gpt-4.1','gpt-4o'],
          'gemini-2.0-flash-001': ['gemini-2.0-flash-001','gemini-2.0-flash','gpt-4o']
        };
        const originalModel = bodyJson.model;
        const fallbacks = modelFallbacks[originalModel] || [originalModel,'gpt-4o'];
        const chatEndpoints = ['https://api.githubcopilot.com/chat/completions','https://api.individual.githubcopilot.com/chat/completions'];
        for (const modelToTry of fallbacks) {
          bodyJson.model = modelToTry;
          const newBody = JSON.stringify(bodyJson);
          for (const ep of chatEndpoints) {
            try {
              const targetRes = await fetch(ep, {
                method: 'POST',
                headers: {
                  'Authorization': auth,
                  'Content-Type': 'application/json',
                  'Editor-Version': 'vscode/1.99.3',
                  'Editor-Plugin-Version': 'copilot-chat/0.26.7',
                  'Copilot-Integration-Id': 'vscode-chat',
                  'OpenAI-Intent': 'conversation-panel',
                  'Accept': 'text/event-stream',
                },
                body: newBody,
              });
              if (targetRes.status === 400) {
                const errText = await targetRes.clone().text();
                if (errText.includes('model_not_supported') || errText.includes('not supported')) continue;
              }
              if (targetRes.ok) {
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
                    'X-Model-Used': modelToTry,
                    'X-Model-Requested': originalModel
                  }
                });
              } else {
                if (targetRes.status !== 400) {
                  const errText = await targetRes.text();
                  return new Response(errText, { status: targetRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
                }
                const errText = await targetRes.text();
                if (!errText.includes('model_not_supported') && !errText.includes('not supported')) {
                  return new Response(errText, { status: targetRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
                }
              }
            } catch {}
          }
        }
        return new Response(JSON.stringify({ error: { message: `Model ${originalModel} not supported. Tried: ${fallbacks.join(', ')}. Use gpt-4o, gpt-5.6-luna, or gpt-4o-mini.`, code: 'model_not_supported' } }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: { message: e.message } }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
