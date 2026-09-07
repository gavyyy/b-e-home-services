import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { doc, getDoc, getFirestore, setDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseApp = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(firebaseApp);
const database = getFirestore(firebaseApp);
const settingsDocument = doc(database, 'siteSettings', 'main');
const ownerEmail = 'gavindun2025@gmail.com';
const storageKey = 'be-home-services-content';
const adminForm = document.querySelector('#adminForm');
const quoteForm = document.querySelector('#quoteForm');
const adminStatus = document.querySelector('.admin-status');
const loginModal = document.querySelector('#loginModal');
const loginForm = document.querySelector('#loginForm');
const adminSection = document.querySelector('#admin');
const adminAccessPin = '2026';
const quoteRateLimitKey = 'be-home-services-last-quote-request';
let adminLockTimer;
quoteForm.dataset.openedAt = String(Date.now());

// Always begin a fresh visit at the top instead of restoring a previous scroll position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
  if (!window.location.hash) window.scrollTo(0, 0);
});

function valuesFrom(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((field) => { values[field.name] = field.checked; });
  return values;
}

function updatePage(values) {
  const sections = { showHero: 'heroSection', showTrust: 'why-us', showServices: 'services', showPromise: 'promiseSection', showContact: 'contact' };
  Object.entries(sections).forEach(([setting, id]) => {
    if (typeof values[setting] === 'boolean') document.querySelector(`#${id}`).hidden = !values[setting];
  });
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
  if (values.phoneNumber) {
    const digits = values.phoneNumber.replace(/[^0-9+]/g, '');
    document.querySelectorAll('[data-phone-link]').forEach((link) => {
      link.href = `tel:${digits}`;
      link.textContent = values.phoneNumber;
    });
  }
}

function applySavedValues(saved) {
  if (!saved) return;
  Object.entries(saved).forEach(([name, value]) => {
    const field = adminForm.elements.namedItem(name);
    if (field) {
      if (field.type === 'checkbox') field.checked = value === true;
      else field.value = value;
    }
  });
  updatePage(saved);
}

async function restoreSavedValues() {
  try {
    const shared = await getDoc(settingsDocument);
    if (shared.exists()) {
      applySavedValues(shared.data());
      return;
    }
  } catch (error) { /* Local backup is used while offline. */ }
  applySavedValues(JSON.parse(localStorage.getItem(storageKey) || 'null'));
}

adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = valuesFrom(adminForm);
  localStorage.setItem(storageKey, JSON.stringify(values));
  updatePage(values);
  try {
    if (!auth.currentUser || auth.currentUser.email !== ownerEmail) throw new Error('Owner sign-in required');
    await setDoc(settingsDocument, values);
    adminStatus.textContent = 'Saved — changes are now live for every visitor.';
  } catch (error) {
    adminStatus.textContent = 'Saved on this device. Sign in with the owner Google account to publish everywhere.';
  }
});

document.querySelector('#resetChanges').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  window.location.reload();
});

function lockAdmin() {
  clearTimeout(adminLockTimer);
  adminSection.hidden = true;
  signOut(auth).catch(() => {});
  adminStatus.textContent = '';
}

function refreshAdminLock() {
  clearTimeout(adminLockTimer);
  adminLockTimer = window.setTimeout(lockAdmin, 15 * 60 * 1000);
}

document.querySelector('#lockAdmin').addEventListener('click', lockAdmin);
['pointerdown', 'keydown', 'input'].forEach((eventName) => {
  adminSection.addEventListener(eventName, () => {
    if (!adminSection.hidden) refreshAdminLock();
  });
});

quoteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = valuesFrom(adminForm);
  const note = quoteForm.querySelector('.form-note');
  const quote = valuesFrom(quoteForm);
  const secondsOpen = (Date.now() - Number(quoteForm.dataset.openedAt || 0)) / 1000;
  const linkCount = (quote.details.match(/https?:\/\//gi) || []).length;
  const lastRequest = Number(localStorage.getItem(quoteRateLimitKey) || 0);
  if (quote.companyWebsite || secondsOpen < 3 || linkCount > 2) {
    note.textContent = 'We could not submit that request. Please review the form and try again.';
    return;
  }
  if (Date.now() - lastRequest < 60 * 1000) {
    note.textContent = 'Please wait one minute before sending another quote request.';
    return;
  }
  if (!settings.quoteEmail) {
    note.textContent = 'The business has not set a quote request email yet.';
    return;
  }
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
        property_type: quote.propertyType,
        preferred_contact: quote.contactMethod,
        best_time: quote.preferredTime || 'Not provided',
        service_address_or_neighborhood: quote.serviceArea || 'Not provided',
        message: quote.details || 'Not provided',
        _subject: `New B & E quote request — ${quote.service}`,
        _replyto: quote.customerEmail,
        _template: 'table'
      })
    });
    if (!response.ok) throw new Error('Quote service could not accept the request.');
    localStorage.setItem(quoteRateLimitKey, String(Date.now()));
    quoteForm.reset();
    quoteForm.dataset.openedAt = String(Date.now());
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

document.querySelector('#openAdmin').addEventListener('click', openAdminLogin);

if (new URLSearchParams(window.location.search).get('admin') === 'true') {
  openAdminLogin();
}

document.querySelector('#closeAdmin').addEventListener('click', () => { loginModal.hidden = true; });

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = document.querySelector('#adminPassword').value;
  const loginStatus = document.querySelector('.login-status');
  if (pin !== adminAccessPin) {
    loginStatus.textContent = 'That PIN does not match. Please try again.';
    return;
  }
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    if (result.user.email !== ownerEmail) throw new Error('Wrong account');
  } catch (error) {
    loginStatus.textContent = 'Use the owner Google account to unlock shared admin controls.';
    return;
  }
  loginForm.reset();
  loginStatus.textContent = '';
  loginModal.hidden = true;
  adminSection.hidden = false;
  refreshAdminLock();
  adminSection.scrollIntoView({ behavior: 'smooth' });
});
