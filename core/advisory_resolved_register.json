// ============================================================================
// api/advisory-resolve-report.js — Vercel serverless function
// Přijímá {id} jednou po vyřešení JAKÉKOLIV chroniconAdvisory (accept/decline,
// ne 'defer') a zapisuje ji do chronicon repa jako vyřešenou — mirror
// api/vrchnost-report.js 1:1, ale GENERICKY pro libovolný advisory typ
// (studovna/ctenar/vypujcka/cokoliv budoucího), ne per-typ zvlášť.
// Řeší: bez tohohle pendingStudovna/pendingCtenar/pendingVypujcka (single-slot
// pending v Chronicon core/engine.js) zůstávaly navždy zaseknuté — žádný
// kanál nehlásil zpět "vyřešeno", takže guard `if (!GameState.pendingX)`
// navždy blokoval další žádost stejného typu (knihovna-rozsireni-mrd, C1/C2
// fix, 28.8.2026).
// Vyžaduje env proměnnou CHRONICON_GITHUB_TOKEN — stejný token jako
// vrchnost-report.js / registrum-report.js / rescue-report.js, žádný nový secret.
//
// Tiché selhání směrem k hráči vždy (200 { ok:false }).
// ============================================================================

const REPO = 'ondrex-ember/chronicon';
const FILE_PATH = 'data/advisory_resolved_register.json';
const BRANCH = 'main';
const MAX_RETRIES = 3;
const PRUNE_AFTER_DAYS = 30; // velkorysejší než vrchnost (10) — advisory ID
                              // musí přežít i pomalejší denní snapshot sync

function isValidPayload(body) {
  return !!body
    && typeof body.id === 'string' && body.id.length > 0 && body.id.length < 200;
}

function pruneOldEntries(data) {
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 86400000;
  for (const key of Object.keys(data)) {
    if (typeof data[key] !== 'number' || data[key] < cutoff) delete data[key];
  }
}

async function githubGet(token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'scriptorium-advisory-resolve-report',
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return { sha: null, data: {} };
  if (!res.ok) throw new Error(`GitHub GET selhal: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  let data;
  try { data = JSON.parse(content); } catch { data = {}; }
  return { sha: json.sha, data };
}

async function githubPut(token, data, sha, lastId) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  return fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'scriptorium-advisory-resolve-report',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      message: 'advisory-resolved-registrum: mark ' + lastId + ' resolved',
      content,
      sha: sha || undefined,
      branch: BRANCH,
    }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const token = process.env.CHRONICON_GITHUB_TOKEN;
  if (!token) {
    res.status(200).json({ ok: false, reason: 'no_token' });
    return;
  }

  if (!isValidPayload(req.body)) {
    res.status(400).json({ error: 'invalid payload' });
    return;
  }

  const { id } = req.body;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { sha, data } = await githubGet(token);

      data[id] = Date.now();
      pruneOldEntries(data);

      const putRes = await githubPut(token, data, sha, id);
      if (putRes.ok) {
        res.status(200).json({ ok: true });
        return;
      }
      if (putRes.status === 409 && attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
        continue;
      }
      throw new Error(`GitHub PUT selhal: ${putRes.status}`);
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error('[advisory-resolve-report] selhalo po retry:', err.message);
        res.status(200).json({ ok: false, reason: 'github_error' });
        return;
      }
    }
  }
};
