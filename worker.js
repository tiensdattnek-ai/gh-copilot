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

    // NEW: Models list
    if (url.pathname === '/api/models') {
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      try {
        // Try multiple endpoints for models
        const endpoints = [
          'https://api.githubcopilot.com/models',
          'https://api.individual.githubcopilot.com/models'
        ];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, {
              headers: { 'Authorization': auth, 'Accept': 'application/json', 'Editor-Version': 'vscode/1.99.3', 'Copilot-Integration-Id': 'vscode-chat' }
            });
            if (res.ok) {
              const text = await res.text();
              return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
            }
          } catch {}
        }
        // Fallback: return known models
        return new Response(JSON.stringify({
          data: [
            { id: 'gpt-4o', name: 'GPT-4o', capabilities: { vision: true } },
            { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
            { id: 'gpt-4.1', name: 'GPT-4.1' },
            { id: 'o1', name: 'o1' },
            { id: 'o3-mini', name: 'o3-mini' },
            { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
            { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
        let bodyJson;
        try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = {}; }
        
        // Model fallback mapping - if claude-3.5-sonnet fails, try alternative IDs
        const modelFallbacks = {
          'claude-3.5-sonnet': ['claude-3.5-sonnet', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-latest'],
          'claude-3.7-sonnet': ['claude-3.7-sonnet', 'claude-3-7-sonnet-20250219', 'claude-3-7-sonnet-latest'],
          'gpt-4.1': ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
          'gemini-2.0-flash-001': ['gemini-2.0-flash-001', 'gemini-2.0-flash', 'gemini-1.5-flash']
        };

        const originalModel = bodyJson.model;
        const fallbacks = modelFallbacks[originalModel] || [originalModel, 'gpt-4o'];

        const chatEndpoints = [
          'https://api.githubcopilot.com/chat/completions',
          'https://api.individual.githubcopilot.com/chat/completions'
        ];

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
                  'Editor-Version': request.headers.get('Editor-Version') || 'vscode/1.99.3',
                  'Editor-Plugin-Version': request.headers.get('Editor-Plugin-Version') || 'copilot-chat/0.26.7',
                  'Copilot-Integration-Id': request.headers.get('Copilot-Integration-Id') || 'vscode-chat',
                  'OpenAI-Intent': request.headers.get('OpenAI-Intent') || 'conversation-panel',
                  'X-Github-Api-Version': '2023-07-07',
                  'Accept': 'text/event-stream',
                },
                body: newBody,
              });

              // If model not supported, try next fallback
              if (targetRes.status === 400) {
                const errText = await targetRes.clone().text();
                if (errText.includes('model_not_supported') || errText.includes('not supported')) {
                  console.log(`Model ${modelToTry} not supported, trying next fallback`);
                  continue;
                }
              }

              if (targetRes.ok) {
                const { readable, writable } = new TransformStream();
                targetRes.body.pipeTo(writable).catch(()=>{});
                // Add header to indicate which model actually used
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
                // For non-400 errors, return immediately
                if (targetRes.status !== 400) {
                  const errText = await targetRes.text();
                  return new Response(errText, { status: targetRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
                }
                // For 400, if it's not model_not_supported, return it
                const errText = await targetRes.text();
                if (!errText.includes('model_not_supported') && !errText.includes('not supported')) {
                  return new Response(errText, { status: targetRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
                }
                // Otherwise continue to next fallback
              }
            } catch (e) {
              console.log(`Error trying ${ep} with ${modelToTry}: ${e.message}`);
            }
          }
        }

        // All fallbacks failed
        return new Response(JSON.stringify({ 
          error: { 
            message: `Model ${originalModel} is not supported for your Copilot plan. Tried fallbacks: ${fallbacks.join(', ')}. Your plan may only support gpt-4o and gpt-4o-mini. Try switching to gpt-4o.`, 
            code: 'model_not_supported', 
            param: 'model',
            requested: originalModel,
            tried: fallbacks
          } 
        }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

      } catch (e) {
        return new Response(JSON.stringify({ error: { message: e.message, code: 'internal_error' } }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
