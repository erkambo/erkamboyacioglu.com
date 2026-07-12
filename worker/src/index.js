// Goose leaderboard API — Cloudflare Worker backed by a KV namespace.
//
//   GET  /   -> top 5 scores, e.g. [{ initials: "ERK", score: 38 }]
//   POST /   -> { initials, score }, returns the updated top 5
//
// The browser can't be trusted: anything it sends could be hand-crafted in
// devtools, so every rule (letters only, no slurs, plausible score) is enforced
// here as well as in the page.

const BOARD_SIZE = 5;

// no goose has ever eaten this many crumbs on a 15x15 board
const MAX_PLAUSIBLE_SCORE = 200;

const BAD_INITIALS = new Set([
  'ASS', 'FUK', 'FCK', 'FUC', 'FKU', 'SEX', 'KKK', 'FAG',
  'NIG', 'NGR', 'NGA', 'CUM', 'JIZ', 'DIK', 'DCK', 'COK',
  'COC', 'TIT', 'VAG', 'PNS', 'GOD', 'DIE', 'PEE',
]);

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function readBoard(env) {
  return (await env.GOOSE.get('scores', 'json')) || [];
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method === 'GET') {
      return Response.json(await readBoard(env), { headers: cors });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('bad json', { status: 400, headers: cors });
      }

      const initials = String(body.initials || '').toUpperCase();
      const score = body.score;

      if (!/^[A-Z]{3}$/.test(initials) || BAD_INITIALS.has(initials)) {
        return new Response('bad initials', { status: 400, headers: cors });
      }
      if (!Number.isInteger(score) || score < 1 || score > MAX_PLAUSIBLE_SCORE) {
        return new Response('bad score', { status: 400, headers: cors });
      }

      const board = await readBoard(env);
      board.push({ initials, score });
      board.sort((a, b) => b.score - a.score);
      const top = board.slice(0, BOARD_SIZE);

      await env.GOOSE.put('scores', JSON.stringify(top));
      return Response.json(top, { headers: cors });
    }

    return new Response('method not allowed', { status: 405, headers: cors });
  },
};
