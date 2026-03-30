(function () {
  const USERS_KEY = 'authPortalUsers';

  function getUsers() {
    const rawUsers = localStorage.getItem(USERS_KEY);
    if (!rawUsers) return [];

    try {
      const parsed = JSON.parse(rawUsers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function setMessage(messageElement, text, variant) {
    messageElement.textContent = text;
    messageElement.classList.remove('error', 'success');
    if (variant) messageElement.classList.add(variant);
  }

  function register() {
    const form = document.getElementById('register-form');
    const message = document.getElementById('register-message');
    if (!form || !message) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const name = form.name.value.trim();
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;

      if (!name || !email || password.length < 8) {
        setMessage(message, 'Enter a valid name, email, and a password with at least 8 characters.', 'error');
        return;
      }

      const users = getUsers();
      const existing = users.some(function (user) {
        return user.email === email;
      });

      if (existing) {
        setMessage(message, 'This email is already registered. Please sign in instead.', 'error');
        return;
      }

      users.push({ name: name, email: email, password: password });
      saveUsers(users);

      form.reset();
      setMessage(message, 'Account created successfully. You can now log in.', 'success');
    });
  }

  function login() {
    const form = document.getElementById('login-form');
    const message = document.getElementById('login-message');
    if (!form || !message) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;

      const users = getUsers();
      const user = users.find(function (candidate) {
        return candidate.email === email && candidate.password === password;
      });

      if (!user) {
        setMessage(message, 'Invalid email or password. Please try again.', 'error');
        return;
      }

      setMessage(message, 'Login successful. Welcome back, ' + user.name + '!', 'success');
    });
  }

  register();
  login();
})();
