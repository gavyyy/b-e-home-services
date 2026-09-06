const storageKey = 'be-home-services-content';
const adminForm = document.querySelector('#adminForm');
const quoteForm = document.querySelector('#quoteForm');
const adminStatus = document.querySelector('.admin-status');
const loginModal = document.querySelector('#loginModal');
const loginForm = document.querySelector('#loginForm');
const adminSection = document.querySelector('#admin');
const adminAccessPassword = 'BEHome2026!';

function valuesFrom(form) { return Object.fromEntries(new FormData(form).entries()); }

function updatePage(values) {
  document.querySelectorAll('[data-field]').forEach((element) => {
    const value = values[element.dataset.field];
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-list]').forEach((list) => {
    const text = values[list.dataset.list];
    if (!text) return;
    const services = text.split('\n').map((item) => item.trim()).filter(Boolean);
    list.replaceChildren(...services.map((service) => {
      const item = document.createElement('li');
      item.textContent = service;
      return item;
    }));
  });
}

function restoreSavedValues() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (!saved) return;
  Object.entries(saved).forEach(([name, value]) => {
    const field = adminForm.elements.namedItem(name);
    if (field) field.value = value;
  });
  updatePage(saved);
}

adminForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = valuesFrom(adminForm);
  localStorage.setItem(storageKey, JSON.stringify(values));
  updatePage(values);
  adminStatus.textContent = 'Saved — your page and quote inbox are updated.';
});

document.querySelector('#resetChanges').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  window.location.reload();
});

quoteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = valuesFrom(adminForm);
  const note = quoteForm.querySelector('.form-note');
  if (!settings.quoteEmail) {
    note.textContent = 'The business has not set a quote request email yet.';
    return;
  }
  const quote = valuesFrom(quoteForm);
  const submitButton = quoteForm.querySelector('button');
  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';
  note.textContent = 'Sending your quote request…';
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(settings.quoteEmail)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: quote.customerName,
        email: quote.customerEmail,
        phone: quote.customerPhone || 'Not provided',
        service: quote.service,
        message: quote.details || 'Not provided',
        _subject: `New B & E quote request — ${quote.service}`,
        _replyto: quote.customerEmail,
        _template: 'table'
      })
    });
    if (!response.ok) throw new Error('Quote service could not accept the request.');
    quoteForm.reset();
    note.textContent = 'Thanks! Your quote request has been sent.';
  } catch (error) {
    note.textContent = 'We could not send your request. Please try again shortly.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Request my free quote <span>→</span>';
  }
});

restoreSavedValues();

function openAdminLogin() {
  loginModal.hidden = false;
  document.querySelector('#adminPassword').focus();
}

if (new URLSearchParams(window.location.search).get('admin') === 'true') {
  openAdminLogin();
}

document.querySelector('#closeAdmin').addEventListener('click', () => { loginModal.hidden = true; });

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const password = document.querySelector('#adminPassword').value;
  const loginStatus = document.querySelector('.login-status');
  if (password !== adminAccessPassword) {
    loginStatus.textContent = 'That password does not match. Please try again.';
    return;
  }
  loginForm.reset();
  loginStatus.textContent = '';
  loginModal.hidden = true;
  adminSection.hidden = false;
  adminSection.scrollIntoView({ behavior: 'smooth' });
});
