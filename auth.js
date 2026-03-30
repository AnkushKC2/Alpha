(function () {
  const SESSION_KEY = 'authPortalSession';

  function setMessage(element, text, variant) {
    if (!element) return;
    element.textContent = text;
    element.classList.remove('error', 'success');
    if (variant) element.classList.add(variant);
  }

  function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function appendRealtimeEvent(text) {
    const feed = document.getElementById('realtime-feed');
    if (!feed) return;

    const row = document.createElement('li');
    row.textContent = text;
    feed.prepend(row);

    while (feed.children.length > 8) {
      feed.removeChild(feed.lastChild);
    }
  }

  function startRealtimeFeed() {
    const status = document.getElementById('realtime-status');
    if (!status) return;

    try {
      const stream = new EventSource('/events');
      status.textContent = 'Live';
      status.classList.add('success');

      stream.onmessage = function (event) {
        try {
          const payload = JSON.parse(event.data);
          if (payload.eventType === 'connected') {
            appendRealtimeEvent('Connected to live auth events.');
            return;
          }

          if (payload.eventType === 'register') {
            appendRealtimeEvent(`[${payload.at}] ${payload.detail.name} registered.`);
            return;
          }

          if (payload.eventType === 'login') {
            appendRealtimeEvent(`[${payload.at}] ${payload.detail.name} logged in.`);
          }
        } catch {
          appendRealtimeEvent('Received an unreadable realtime event.');
        }
      };

      stream.onerror = function () {
        status.textContent = 'Offline';
        status.classList.remove('success');
        status.classList.add('error');
      };
    } catch {
      status.textContent = 'Unavailable';
      status.classList.add('error');
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { ok: response.ok, ...data };
  }

  function register() {
    const form = document.getElementById('register-form');
    const message = document.getElementById('register-message');
    if (!form) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value,
      };

      try {
        const result = await postJson('/api/register', payload);

        if (!result.ok) {
          setMessage(message, result.message || 'Could not create account.', 'error');
          return;
        }

        form.reset();
        setMessage(message, result.message, 'success');
      } catch {
        setMessage(message, 'Network issue. Is the Node server running?', 'error');
      }
    });
  }

  function login() {
    const form = document.getElementById('login-form');
    const message = document.getElementById('login-message');
    if (!form) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const payload = {
        email: form.email.value.trim(),
        password: form.password.value,
      };

      try {
        const result = await postJson('/api/login', payload);

        if (!result.ok) {
          setMessage(message, result.message || 'Login failed.', 'error');
          return;
        }

        saveSession(result.user);
        setMessage(message, result.message + ' Redirecting...', 'success');
        window.setTimeout(function () {
          window.location.href = 'home.html';
        }, 500);
      } catch {
        setMessage(message, 'Network issue. Is the Node server running?', 'error');
      }
    });
  }

  function renderHome() {
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const createdEl = document.getElementById('profile-created');
    const logoutButton = document.getElementById('logout-button');
    if (!nameEl || !emailEl || !createdEl || !logoutButton) return;

    const user = getSession();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    nameEl.textContent = user.name || '-';
    emailEl.textContent = user.email || '-';
    createdEl.textContent = user.createdAt ? new Date(user.createdAt).toLocaleString() : '-';

    logoutButton.addEventListener('click', function () {
      clearSession();
      window.location.href = 'login.html';
    });
  }

  startRealtimeFeed();
  register();
  login();
  renderHome();
})();
