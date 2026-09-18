export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Editor-Version, Editor-Plugin-Version, Copilot-Integration-Id, OpenAI-Intent, X-Github-Api-Version',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const auth = request.headers.get('Authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const body = await request.text();
    
    // Forward to Copilot API with streaming
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

    // Stream the response back
    const { readable, writable } = new TransformStream();
    targetRes.body.pipeTo(writable).catch(() => {});

    return new Response(readable, {
      status: targetRes.status,
      headers: {
        'Content-Type': targetRes.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'X-Accel-Buffering': 'no',
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
}
