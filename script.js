import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
const quoteRequests = collection(database, 'quoteRequests');
const quoteList = document.querySelector('#quoteList');
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
  const sections = { showHero: 'heroSection', showTrust: 'why-us', showServices: 'services', showPromise: 'promiseSection', showPrices: 'priceSection', showGallery: 'gallerySection', showReviews: 'reviewsSection', showContact: 'contact' };
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
  renderGallery(values);
  renderReviews(values);
}

function renderGallery(values) {
  const gallery = document.querySelector('#galleryGrid');
  const photos = ['One', 'Two', 'Three'].map((number) => ({ image: values[`gallery${number}Image`], caption: values[`gallery${number}Caption`] }));
  const visiblePhotos = photos.filter(({ image }) => image && /^https:\/\//i.test(image));
  if (!visiblePhotos.length) {
    gallery.innerHTML = '<p class="review-empty">Project photos will be shared here soon.</p>';
    return;
  }
  gallery.replaceChildren(...visiblePhotos.map(({ image, caption }) => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.style.backgroundImage = `linear-gradient(140deg, #17392d88, #35594866), url("${image.replace(/"/g, '%22')}")`;
    const label = document.createElement('span');
    label.textContent = caption || 'B & E Home Services project';
    card.append(label);
    return card;
  }));
}

function renderReviews(values) {
  const reviewGrid = document.querySelector('#reviewGrid');
  const reviews = ['One', 'Two', 'Three'].map((number) => ({ name: values[`review${number}Name`], location: values[`review${number}Location`], text: values[`review${number}Text`] }));
  const visibleReviews = reviews.filter(({ text }) => text && text.trim());
  if (!visibleReviews.length) {
    reviewGrid.innerHTML = '<p class="review-empty">Customer reviews will be added soon.</p>';
    return;
  }
  reviewGrid.replaceChildren(...visibleReviews.map(({ name, location, text }) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    const quote = document.createElement('p');
    quote.textContent = `“${text}”`;
    const person = document.createElement('strong');
    person.textContent = name || 'B & E customer';
    const place = document.createElement('cite');
    place.textContent = location || 'Columbia, SC';
    card.append(quote, person, place);
    return card;
  }));
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

function quoteReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BE-${date}-${code}`;
}

async function saveQuoteForOwner(quote, reference) {
  try {
    await addDoc(quoteRequests, {
      reference,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      service: quote.service,
      propertyType: quote.propertyType,
      contactMethod: quote.contactMethod,
      preferredTime: quote.preferredTime || '',
      bookingDate: quote.bookingDate || '',
      bookingWindow: quote.bookingWindow || '',
      serviceArea: quote.serviceArea || '',
      details: quote.details,
      status: 'New',
      createdAt: Date.now()
    });
  } catch (error) {
    // Email delivery still works if private quote storage has not been enabled yet.
  }
}

async function loadQuoteInbox() {
  if (!auth.currentUser || auth.currentUser.email !== ownerEmail) return;
  quoteList.innerHTML = '<p class="quote-empty">Loading quote requests…</p>';
  try {
    const results = await getDocs(query(quoteRequests, orderBy('createdAt', 'desc'), limit(50)));
    if (results.empty) {
      quoteList.innerHTML = '<p class="quote-empty">No tracked quote requests yet.</p>';
      return;
    }
    quoteList.replaceChildren(...results.docs.map((quoteDoc) => {
      const quote = quoteDoc.data();
      const item = document.createElement('article');
      item.className = 'quote-item';
      const title = document.createElement('p');
      const reference = document.createElement('strong');
      reference.textContent = quote.reference || 'Quote request';
      title.append(reference, document.createTextNode(` — ${quote.customerName || 'Customer'}`));
      const info = document.createElement('p');
      info.textContent = `${quote.service || 'Service'} · ${quote.customerPhone || ''} · ${quote.customerEmail || ''}`;
      const details = document.createElement('p');
      details.textContent = quote.details || '';
      const status = document.createElement('select');
      ['New', 'Contacted', 'Scheduled', 'Completed', 'Closed'].forEach((option) => {
        const choice = document.createElement('option');
        choice.value = option;
        choice.textContent = option;
        choice.selected = option === (quote.status || 'New');
        status.append(choice);
      });
      status.addEventListener('change', async () => {
        try { await updateDoc(quoteDoc.ref, { status: status.value }); } catch (error) { status.value = quote.status || 'New'; }
      });
      item.append(title, info, details, status);
      return item;
    }));
  } catch (error) {
    quoteList.innerHTML = '<p class="quote-empty">Private quote tracking is not enabled yet.</p>';
  }
}

document.querySelector('#refreshQuotes').addEventListener('click', loadQuoteInbox);

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
  const reference = quoteReference();
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
        requested_service_date: quote.bookingDate || 'Not requested',
        requested_arrival_window: quote.bookingWindow || 'No preference',
        message: quote.details || 'Not provided',
        quote_reference: reference,
        _subject: `New B & E quote request ${reference} — ${quote.service}`,
        _replyto: quote.customerEmail,
        _template: 'table'
      })
    });
    if (!response.ok) throw new Error('Quote service could not accept the request.');
    saveQuoteForOwner(quote, reference);
    localStorage.setItem(quoteRateLimitKey, String(Date.now()));
    quoteForm.reset();
    quoteForm.dataset.openedAt = String(Date.now());
    note.textContent = `Thanks! Your quote request has been sent. Your reference number is ${reference}.`;
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
  loadQuoteInbox();
  adminSection.scrollIntoView({ behavior: 'smooth' });
});
