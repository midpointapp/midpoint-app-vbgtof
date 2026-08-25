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

  const customSchemeLink = `midpointmeet://session?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
  const intentLink = `intent://session?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}#Intent;scheme=midpointmeet;package=com.anonymous.Natively;end`;
  const pageUrl = url.toString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Join MidPoint Meet</title>
  <meta name="description" content="Someone wants to meet you halfway. Tap to open MidPoint Meet and find your midpoint." />
  <meta property="og:title" content="Join MidPoint Meet" />
  <meta property="og:description" content="Someone wants to meet you halfway. Tap to open MidPoint Meet." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; background: #0f0f0f; color: #fff; text-align: center; padding: 32px 24px;
    }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
    p { color: #aaa; font-size: 16px; margin-bottom: 40px; line-height: 1.5; max-width: 320px; }
    .btn {
      display: inline-block; background: #3F51B5; color: #fff;
      padding: 18px 40px; border-radius: 14px; text-decoration: none;
      font-size: 18px; font-weight: 700; letter-spacing: 0.3px;
      box-shadow: 0 4px 24px rgba(63,81,181,0.4);
      cursor: pointer; border: none; width: 100%; max-width: 320px;
    }
    .hint { margin-top: 20px; color: #666; font-size: 13px; }
    #fallback { display: none; margin-top: 24px; color: #f59e0b; font-size: 14px; max-width: 320px; }
  </style>
</head>
<body>
  <div class="icon">📍</div>
  <h1>Join MidPoint Meet</h1>
  <p>Someone wants to meet you halfway.<br/>Tap below to open the app and find your midpoint.</p>

  <a class="btn" id="openBtn" href="${customSchemeLink}">Open MidPoint Meet</a>

  <p class="hint">Make sure MidPoint Meet is installed</p>
  <div id="fallback">App didn't open? Make sure MidPoint Meet is installed, then tap the button again.</div>

  <script>
    var isAndroid = /android/i.test(navigator.userAgent);
    var btn = document.getElementById('openBtn');
    var fallback = document.getElementById('fallback');

    if (isAndroid) {
      btn.href = '${intentLink}';
    }

    btn.addEventListener('click', function(e) {
      // Show fallback message after 2.5s if app didn't open
      setTimeout(function() {
        fallback.style.display = 'block';
      }, 2500);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
});
