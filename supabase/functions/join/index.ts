import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const token = url.searchParams.get('token');

  if (!sessionId || !token) {
    return new Response('Missing sessionId or token', { status: 400, headers: CORS_HEADERS });
  }

  const deepLink = `midpointmeet://session?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening MidPoint Meet...</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f0f0f; color: #fff; text-align: center; padding: 24px; box-sizing: border-box; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #aaa; font-size: 16px; margin-bottom: 32px; }
    a { background: #3F51B5; color: #fff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-size: 18px; font-weight: 600; }
  </style>
  <script>
    window.onload = function() {
      window.location.href = "${deepLink}";
    };
  </script>
</head>
<body>
  <h1>Opening MidPoint Meet...</h1>
  <p>If the app doesn't open automatically, tap the button below.</p>
  <a href="${deepLink}">Open App</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ...CORS_HEADERS,
    },
  });
});
