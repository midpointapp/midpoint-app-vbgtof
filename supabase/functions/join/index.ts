Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      },
    });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  const token = url.searchParams.get('token');

  if (!sessionId || !token) {
    return new Response('Missing sessionId or token', { status: 400 });
  }

  const netlifyUrl = `https://golden-biscochitos-cff794.netlify.app/?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': netlifyUrl,
      'Cache-Control': 'no-store',
    },
  });
});
