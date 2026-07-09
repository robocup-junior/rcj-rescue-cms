from django.http import HttpResponse

# Dev-only demo page: NOT a migrated Express route, NOT part of the
# compat_auth API contract. It exists so the login -> Django -> Postgres
# flow can be seen working in a real browser without touching the
# production Express/Pug login page. Plain inline HTML/CSS/JS -- Django
# has no template engine configured (settings.py: TEMPLATES = []), and
# adding one just for this one throwaway page isn't worth it.

_PAGE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Django migration -- login demo</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
  }
  .card {
    background: #1e293b;
    border-radius: 12px;
    padding: 2rem 2.5rem;
    width: 320px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  h1 { font-size: 1.1rem; font-weight: 700; margin: 0 0 .25rem; }
  p.sub { color: #94a3b8; font-size: .8rem; margin: 0 0 1.5rem; }
  label { display: block; font-size: .8rem; margin-bottom: .3rem; color: #cbd5e1; }
  input {
    width: 100%; box-sizing: border-box; padding: .6rem .7rem; margin-bottom: 1rem;
    border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0;
  }
  button {
    width: 100%; padding: .65rem; border-radius: 6px; border: none;
    background: #3b82f6; color: white; font-weight: 700; cursor: pointer;
  }
  button:hover { background: #2563eb; }
  button.secondary { background: #334155; margin-top: .5rem; }
  button.secondary:hover { background: #475569; }
  #message { margin-top: 1rem; font-size: .85rem; white-space: pre-wrap; }
  #message.error { color: #f87171; }
  #message.ok { color: #4ade80; }
  #whoami { display: none; }
  #whoami pre {
    background: #0f172a; padding: .75rem; border-radius: 6px; font-size: .75rem;
    overflow-x: auto; border: 1px solid #334155;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>RCJ CMS -- Django migration demo</h1>
    <p class="sub">Authenticates against /api/auth/login (Postgres via compat_auth), not the Express/Mongo app.</p>

    <form id="loginForm">
      <label for="username">Username</label>
      <input id="username" autocomplete="username" value="tryitout">
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password">
      <button type="submit">Log in</button>
    </form>

    <div id="whoami">
      <p class="sub" style="margin-bottom:.5rem;">Logged in as:</p>
      <pre id="whoamiData"></pre>
      <button id="logoutBtn" class="secondary">Log out</button>
    </div>

    <div id="message"></div>
  </div>

<script>
  const messageEl = document.getElementById('message');
  const formEl = document.getElementById('loginForm');
  const whoamiEl = document.getElementById('whoami');
  const whoamiDataEl = document.getElementById('whoamiData');
  const logoutBtn = document.getElementById('logoutBtn');

  function showMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = kind || '';
  }

  async function refreshMe() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const body = await res.json();
    if (res.ok) {
      formEl.style.display = 'none';
      whoamiEl.style.display = 'block';
      whoamiDataEl.textContent = JSON.stringify(body, null, 2);
      showMessage('');
    } else {
      formEl.style.display = 'block';
      whoamiEl.style.display = 'none';
    }
    return res.ok;
  }

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('Logging in...');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();

    if (res.ok) {
      showMessage('Login successful, fetching /api/auth/me ...', 'ok');
      await refreshMe();
    } else {
      showMessage('Login failed: ' + (body.msg || res.status), 'error');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { credentials: 'same-origin' });
    showMessage('Logged out.', 'ok');
    formEl.style.display = 'block';
    whoamiEl.style.display = 'none';
  });

  refreshMe();
</script>
</body>
</html>
"""


def login_page(request):
    return HttpResponse(_PAGE)
