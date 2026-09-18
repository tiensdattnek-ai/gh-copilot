export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' } });
  }
  const auth = request.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  try {
    const res = await fetch('https://api.github.com/user', { headers: { 'Authorization': auth, 'Accept': 'application/json', 'User-Agent': 'Copilot-Chat-Pro' } });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
}
