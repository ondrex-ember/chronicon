// ============================================================================
// api/actor-favor-report.js — Vercel serverless function
// Přijímá {actorId, day} jednou/den/aktér od klienta a zapisuje anonymní
// flag do chronicon repa (mirror api/rescue-report.js, ale opačný směr
// efektu — mood/wealth boost, ne odbrždění krize; viz
// core/actor-favor-register.js na CHRONICON straně).
// Generický — libovolný actorId, žádný nový soubor/token při přidání
// dalšího cíleného aktéra příště.
// Vyžaduje env proměnnou CHRONICON_GITHUB_TOKEN — stejný token jako
// registrum-report.js / rescue-report.js / vrchnost-report.js.
//
// Tiché selhání směrem k hráči vždy (200 { ok:false }).
// ============================================================================

const REPO = 'ondrex-ember/chronicon';
const FILE_PATH = 'data/actor_favor_register.json';
const BRANCH = 'main';
const MAX_RETRIES = 3;
const PRUNE_AFTER_DAYS = 10;
const ACTOR_ID_RE = /^[a-z_]{1,40}$/; // mirror Chronicon actors.js id styl

function isValidPayload(body) {
  return !!body
    && typeof body.actorId === 'string' && ACTOR_ID_RE.test(body.actorId)
    && typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day);
}

function pruneOldBuckets(data) {
  const cutoff = Date.now() - PRUNE_AFTER_DAYS * 86400000;
  for (const key of Object.keys(data)) {
    if (Date.parse(key + 'T00:00:00Z') < cutoff) delete data[key];
  }
}

async function githubGet(token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'scriptorium-actor-favor-report',
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

async function githubPut(token, data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  return fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'scriptorium-actor-favor-report',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      message: 'actor-favor-registrum: daily sample',
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

  const { actorId, day } = req.body;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { sha, data } = await githubGet(token);

      if (!data[day]) data[day] = {};
      data[day][actorId] = true;
      pruneOldBuckets(data);

      const putRes = await githubPut(token, data, sha);
      if (putRes.ok) {
        res.status(200).json({ ok: true });
        return;
      }
      if (putRes.status === 409 && attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
        continue; // souběžný zápis — SHA se mezitím změnilo, zkusit znovu
      }
      throw new Error(`GitHub PUT selhal: ${putRes.status}`);
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error('[actor-favor-report] selhalo po retry:', err.message);
        res.status(200).json({ ok: false, reason: 'github_error' });
        return;
      }
    }
  }
};
