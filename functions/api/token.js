export async function onRequest(context) {
  const { request } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, User-Agent',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const auth = request.headers.get('Authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Missing Authorization' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
        'User-Agent': 'Copilot-Chat-Pro/1.0',
      }
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
}
