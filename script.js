import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseApp = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(firebaseApp);
const database = getFirestore(firebaseApp);
const settingsDocument = doc(database, 'siteSettings', 'main');
const ownerEmail = 'owner@behomeservices.art';
const storageKey = 'be-home-services-content';
const adminForm = document.querySelector('#adminForm');
const quoteForm = document.querySelector('#quoteForm');
const adminStatus = document.querySelector('.admin-status');
const loginModal = document.querySelector('#loginModal');
const loginForm = document.querySelector('#loginForm');
const adminSection = document.querySelector('#admin');
const quoteRateLimitKey = 'be-home-services-last-quote-request';
const quoteRequests = collection(database, 'quoteRequests');
const quoteList = document.querySelector('#quoteList');
const customerLoginForm = document.querySelector('#customerLoginForm');
const customerPortalStatus = document.querySelector('#customerPortalStatus');
const customerQuoteList = document.querySelector('#customerQuoteList');
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
  const sections = { showHero: 'heroSection', showTrust: 'why-us', showServices: 'services', showPromise: 'promiseSection', showPrices: 'priceSection', showGallery: 'gallerySection', showReviews: 'reviewsSection', showCustomerPortal: 'customerPortal', showContact: 'contact', showHeaderPhone: 'headerPhone', showQuickContact: 'quickContact' };
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
  if (typeof values.announcementEnabled === 'boolean') {
    document.querySelector('#siteNotice').hidden = !values.announcementEnabled;
  }
  if (values.siteTheme) document.body.dataset.theme = values.siteTheme;
  renderGoogleReviewLink(values);
  if (typeof values.quoteEnabled === 'boolean') {
    const acceptingQuotes = values.quoteEnabled;
    quoteForm.dataset.acceptingQuotes = String(acceptingQuotes);
    quoteForm.querySelector('button[type="submit"]').disabled = !acceptingQuotes;
    const pausedMessage = document.querySelector('#quotePauseMessage');
    pausedMessage.hidden = acceptingQuotes;
    pausedMessage.textContent = values.quotePauseMessage || 'We are not accepting new quote requests right now. Please check back soon.';
  }
  updateQuoteEstimate();
  renderGallery(values);
  renderReviews(values);
}

function renderGoogleReviewLink(values) {
  const link = document.querySelector('#googleReviewLink');
  const url = values.googleReviewUrl;
  link.hidden = !url || !/^https:\/\//i.test(url);
  if (!link.hidden) link.href = url;
}

function renderGallery(values) {
  const gallery = document.querySelector('#galleryGrid');
  const photos = ['One', 'Two', 'Three'].map((number) => ({ image: values[`gallery${number}Image`], caption: values[`gallery${number}Caption`] }));
  const visiblePhotos = photos.filter(({ image }) => image && /^https:\/\//i.test(image));
  if (!visiblePhotos.length) {
    gallery.hidden = true;
    gallery.replaceChildren();
    return;
  }
  gallery.hidden = false;
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

function updateQuoteEstimate() {
  const estimate = getQuoteEstimate();
  document.querySelector('#quoteEstimate').textContent = estimate.label;
}

function getQuoteEstimate() {
  const service = quoteForm.elements.namedItem('service').value;
  const size = quoteForm.elements.namedItem('projectSize').value;
  if (!service || !size) {
    return { label: 'Choose a service and size', size, service };
  }
  const outdoorServices = ['Lawn & landscaping', 'Hedge trimming', 'Tree trimming', 'Mulching', 'Pressure washing'];
  const group = outdoorServices.includes(service) ? 'Outdoor' : 'Cleaning';
  const field = `calc${group}${size}`;
  const amount = Number(adminForm.elements.namedItem(field).value);
  return { label: amount > 0 ? `From $${amount.toLocaleString()}` : 'Custom quote needed', size, service };
}

function applySavedValues(saved) {
  if (!saved) return;
  Object.entries(saved).forEach(([name, value]) => {
    const field = adminForm.elements.namedItem(name);
    if (field) {
      if (field.type === 'checkbox') field.checked = value === true;
      else if (name === 'workerEmails' && Array.isArray(value)) field.value = value.join('\n');
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

quoteForm.elements.namedItem('service').addEventListener('change', updateQuoteEstimate);
quoteForm.elements.namedItem('projectSize').addEventListener('change', updateQuoteEstimate);

document.querySelector('#resetChanges').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  window.location.reload();
});

function lockAdmin() {
  clearTimeout(adminLockTimer);
  adminSection.hidden = true;
  if (adminForm.elements.namedItem('signOutOnLock').checked) signOut(auth).catch(() => {});
  adminStatus.textContent = '';
}

function refreshAdminLock() {
  clearTimeout(adminLockTimer);
  const lockMinutes = Number(adminForm.elements.namedItem('lockMinutes').value) || 15;
  adminLockTimer = window.setTimeout(lockAdmin, lockMinutes * 60 * 1000);
}

document.querySelector('#lockAdmin').addEventListener('click', lockAdmin);
document.querySelector('#quickLock').addEventListener('click', lockAdmin);
['pointerdown', 'keydown', 'input'].forEach((eventName) => {
  adminSection.addEventListener(eventName, () => {
    if (!adminSection.hidden) refreshAdminLock();
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !adminSection.hidden && adminForm.elements.namedItem('lockOnHidden').checked) lockAdmin();
});

function quoteReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BE-${date}-${code}`;
}

function setFormField(form, name, value) {
  let field = form.querySelector(`input[name="${name}"]`);
  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    form.append(field);
  }
  field.value = value;
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
      projectSize: quote.projectSize || '',
      calculatorEstimate: quote.calculatorEstimate || 'Custom quote needed',
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
    renderOwnerDashboard(results.docs.map((quoteDoc) => quoteDoc.data()));
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
      ['New', 'Contacted', 'Scheduled', 'Estimate ready', 'Estimate sent', 'Completed', 'Closed'].forEach((option) => {
        const choice = document.createElement('option');
        choice.value = option;
        choice.textContent = option;
        choice.selected = option === (quote.status || 'New');
        status.append(choice);
      });
      status.addEventListener('change', async () => {
        try { await updateDoc(quoteDoc.ref, { status: status.value }); } catch (error) { status.value = quote.status || 'New'; }
      });
      const estimateAmount = document.createElement('input');
      estimateAmount.placeholder = 'Estimate amount, such as $150';
      estimateAmount.value = quote.estimateAmount || '';
      const estimateNotes = document.createElement('textarea');
      estimateNotes.rows = 2;
      estimateNotes.placeholder = 'Estimate details, scope, or notes';
      estimateNotes.value = quote.estimateNotes || '';
      const actions = document.createElement('div');
      actions.className = 'quote-actions';
      const saveEstimate = document.createElement('button');
      saveEstimate.type = 'button';
      saveEstimate.textContent = 'Save estimate';
      saveEstimate.addEventListener('click', async () => {
        try {
          await updateDoc(quoteDoc.ref, { estimateAmount: estimateAmount.value.trim(), estimateNotes: estimateNotes.value.trim() });
          saveEstimate.textContent = 'Saved';
          setTimeout(() => { saveEstimate.textContent = 'Save estimate'; }, 1500);
        } catch (error) { saveEstimate.textContent = 'Could not save'; }
      });
      const requestPdf = document.createElement('button');
      requestPdf.type = 'button';
      requestPdf.textContent = 'Download request + calculator PDF';
      requestPdf.addEventListener('click', () => downloadQuotePdf('Customer quote request', quote));
      const estimatePdf = document.createElement('button');
      estimatePdf.type = 'button';
      estimatePdf.textContent = 'Download final estimate PDF';
      estimatePdf.addEventListener('click', () => downloadQuotePdf('B & E Home Services estimate', { ...quote, estimateAmount: estimateAmount.value.trim(), estimateNotes: estimateNotes.value.trim() }));
      actions.append(saveEstimate, requestPdf, estimatePdf);
      item.append(title, info, details, status, estimateAmount, estimateNotes, actions);
      return item;
    }));
  } catch (error) {
    quoteList.innerHTML = '<p class="quote-empty">Private quote tracking is not enabled yet.</p>';
  }
}

function renderOwnerDashboard(quotes) {
  const dashboard = document.querySelector('#dashboardStats');
  const customers = new Set(quotes.map((quote) => quote.customerEmail).filter(Boolean)).size;
  const completed = quotes.filter((quote) => quote.status === 'Completed').length;
  const active = quotes.filter((quote) => !['Completed', 'Closed'].includes(quote.status || 'New')).length;
  dashboard.replaceChildren(...[
    ['Customers', customers],
    ['Active jobs', active],
    ['Completed work', completed]
  ].map(([label, value]) => {
    const stat = document.createElement('article');
    stat.className = 'dashboard-stat';
    const total = document.createElement('strong');
    total.textContent = String(value);
    const name = document.createElement('span');
    name.textContent = label;
    stat.append(total, name);
    return stat;
  }));
}

function downloadQuotePdf(title, quote) {
  const calculatorEstimate = quote.calculatorEstimate || (quote.details || '').match(/Calculator starting estimate: (.*)/)?.[1] || 'Not available';
  const details = [
    title,
    `Reference: ${quote.reference || 'Not provided'}`,
    `Customer: ${quote.customerName || 'Not provided'}`,
    `Email: ${quote.customerEmail || 'Not provided'}`,
    `Phone: ${quote.customerPhone || 'Not provided'}`,
    `Service: ${quote.service || 'Not provided'}`,
    `Property: ${quote.propertyType || 'Not provided'}`,
    `Status: ${quote.status || 'New'}`,
    `Requested date: ${quote.bookingDate || 'Not requested'}`,
    `Address / area: ${quote.serviceArea || 'Not provided'}`,
    `Calculator starting estimate: ${calculatorEstimate}`,
    '',
    'Customer request:',
    quote.details || 'Not provided',
    '',
    'Estimate:',
    quote.estimateAmount || 'Not set',
    quote.estimateNotes || 'No estimate notes yet.'
  ];
  const lines = details.flatMap((line) => String(line).match(/.{1,78}(?:\s|$)|\S+?(?:\s|$)/g) || ['']);
  const escapePdf = (text) => text.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
  const textStream = ['BT', '/F1 12 Tf', '50 760 Td', ...lines.map((line, index) => `${index ? '0 -16 Td' : ''} (${escapePdf(line.trim())}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  link.download = `${(quote.reference || 'be-quote').toLowerCase()}-${title.includes('estimate') ? 'estimate' : 'request'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

document.querySelector('#refreshQuotes').addEventListener('click', loadQuoteInbox);

async function loadCustomerQuotes() {
  const user = auth.currentUser;
  if (!user?.email) return;
  customerQuoteList.innerHTML = '<p>Loading your quote status…</p>';
  try {
    const results = await getDocs(query(quoteRequests, where('customerEmail', '==', user.email)));
    const quotes = results.docs.map((quoteDoc) => quoteDoc.data()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    if (!quotes.length) {
      customerQuoteList.innerHTML = '<p>No quote requests were found for this email address yet.</p>';
      return;
    }
    customerQuoteList.replaceChildren(...quotes.map((quote) => {
      const item = document.createElement('article');
      item.className = 'customer-quote';
      const heading = document.createElement('strong');
      heading.textContent = `${quote.reference || 'Quote request'} · ${quote.service || 'Service'}`;
      const status = document.createElement('p');
      status.textContent = `Status: ${quote.status || 'New'}`;
      const schedule = document.createElement('p');
      schedule.textContent = `Requested schedule: ${quote.bookingDate || 'Not selected'}${quote.bookingWindow ? ` · ${quote.bookingWindow}` : ''}`;
      const estimate = document.createElement('p');
      estimate.textContent = `Starting estimate: ${quote.calculatorEstimate || 'Custom quote needed'}`;
      item.append(heading, status, schedule, estimate);
      return item;
    }));
  } catch (error) {
    customerQuoteList.innerHTML = '<p>Your account is ready, but quote access is still being set up. Please try again in a minute.</p>';
  }
}

customerLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = customerLoginForm.elements.namedItem('customerPortalEmail').value.trim();
  const password = customerLoginForm.elements.namedItem('customerPortalPassword').value;
  customerPortalStatus.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    customerPortalStatus.textContent = 'Signed in. Your quote details are below.';
    document.querySelector('#customerSignOut').hidden = false;
    loadCustomerQuotes();
  } catch (error) {
    customerPortalStatus.textContent = 'Sign-in did not work. Check your email and password, or create an account.';
  }
});

document.querySelector('#createCustomerAccount').addEventListener('click', async () => {
  const email = customerLoginForm.elements.namedItem('customerPortalEmail').value.trim();
  const password = customerLoginForm.elements.namedItem('customerPortalPassword').value;
  if (!email || password.length < 6) {
    customerPortalStatus.textContent = 'Enter your quote email and a password with at least 6 characters.';
    return;
  }
  customerPortalStatus.textContent = 'Creating your account…';
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    customerPortalStatus.textContent = 'Account created. Your quote details are below.';
    document.querySelector('#customerSignOut').hidden = false;
    loadCustomerQuotes();
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        customerPortalStatus.textContent = 'You already had an account, so we signed you in.';
        document.querySelector('#customerSignOut').hidden = false;
        loadCustomerQuotes();
      } catch (signInError) {
        customerPortalStatus.textContent = 'An account already exists with that email. Use the correct password and select Sign in.';
      }
      return;
    }
    if (error.code === 'auth/weak-password') {
      customerPortalStatus.textContent = 'Please use a password with at least 6 characters.';
      return;
    }
    if (error.code === 'auth/invalid-email') {
      customerPortalStatus.textContent = 'Please enter a valid email address.';
      return;
    }
    customerPortalStatus.textContent = 'We could not create the account just yet. Please try again in a moment.';
  }
});

document.querySelector('#resetCustomerPassword').addEventListener('click', async () => {
  const email = customerLoginForm.elements.namedItem('customerPortalEmail').value.trim();
  if (!email) {
    customerPortalStatus.textContent = 'Enter your quote email first, then select Send reset link.';
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    customerPortalStatus.textContent = 'Password reset link sent. Check your email, including spam, then return here to sign in.';
  } catch (error) {
    customerPortalStatus.textContent = 'We could not send a reset link yet. Double-check the email address and try again.';
  }
});

document.querySelector('#customerSignOut').addEventListener('click', async () => {
  await signOut(auth);
  customerPortalStatus.textContent = 'Signed out.';
  customerQuoteList.innerHTML = '<p>Sign in to view your B & E quote status.</p>';
  document.querySelector('#customerSignOut').hidden = true;
});

document.querySelector('#createReviewInvite').addEventListener('click', async () => {
  const name = document.querySelector('#reviewCustomerName').value.trim();
  const jobDate = document.querySelector('#reviewJobDate').value || new Date().toISOString().slice(0, 10);
  const jobCode = `JOB-${jobDate.replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const invite = new URL('review.html', window.location.href);
  invite.searchParams.set('job', jobCode);
  const status = document.querySelector('#reviewInviteStatus');
  try {
    await navigator.clipboard.writeText(invite.href);
    status.textContent = `${name ? `${name}'s ` : ''}review link copied. Send it on or after the job date.`;
  } catch (error) {
    status.textContent = `Review link: ${invite.href}`;
  }
});

quoteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = valuesFrom(adminForm);
  const note = quoteForm.querySelector('.form-note');
  const quote = valuesFrom(quoteForm);
  const secondsOpen = (Date.now() - Number(quoteForm.dataset.openedAt || 0)) / 1000;
  const linkCount = (quote.details.match(/https?:\/\//gi) || []).length;
  const lastRequest = Number(localStorage.getItem(quoteRateLimitKey) || 0);
  const attachments = Array.from(quoteForm.elements.namedItem('attachment').files || []);
  if (quoteForm.dataset.acceptingQuotes === 'false') {
    note.textContent = document.querySelector('#quotePauseMessage').textContent;
    return;
  }
  if (attachments.some((file) => !['image/jpeg', 'image/png'].includes(file.type)) || attachments.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
    note.textContent = 'Please attach only JPG or PNG job photos, up to 10 MB total.';
    return;
  }
  const minimumSeconds = Number(settings.quoteMinSeconds || 5);
  const maximumLinks = Number(settings.quoteMaxLinks || 2);
  const cooldownMs = Number(settings.quoteCooldownMinutes || 1) * 60 * 1000;
  if (quote.companyWebsite || secondsOpen < minimumSeconds || linkCount > maximumLinks) {
    note.textContent = 'We could not submit that request. Please review the form and try again.';
    return;
  }
  if (Date.now() - lastRequest < cooldownMs) {
    note.textContent = 'Please wait before sending another quote request.';
    return;
  }
  if (!settings.quoteEmail) {
    note.textContent = 'The business has not set a quote request email yet.';
    return;
  }
  const submitButton = quoteForm.querySelector('button');
  const reference = quoteReference();
  const calculator = getQuoteEstimate();
  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';
  note.textContent = 'Sending your quote request and confirmation email…';
  const nextPage = new URL(window.location.href);
  nextPage.searchParams.set('quote', 'sent');
  nextPage.hash = 'contact';
  setFormField(quoteForm, 'email', quote.customerEmail);
  setFormField(quoteForm, 'phone', quote.customerPhone || 'Not provided');
  setFormField(quoteForm, 'property_type', quote.propertyType);
  setFormField(quoteForm, 'preferred_contact', quote.contactMethod);
  setFormField(quoteForm, 'best_time', quote.preferredTime || 'Not provided');
  setFormField(quoteForm, 'service_address_or_neighborhood', quote.serviceArea || 'Not provided');
  setFormField(quoteForm, 'requested_service_date', quote.bookingDate || 'Not requested');
  setFormField(quoteForm, 'requested_arrival_window', quote.bookingWindow || 'No preference');
  setFormField(quoteForm, 'message', quote.details || 'Not provided');
  setFormField(quoteForm, 'quote_reference', reference);
  setFormField(quoteForm, 'calculator_starting_estimate', calculator.label);
  setFormField(quoteForm, '_subject', `New B & E quote request ${reference} — ${quote.service}`);
  setFormField(quoteForm, '_replyto', quote.customerEmail);
  setFormField(quoteForm, '_autoresponse', `Thank you for contacting B & E Home Services. We received your quote request. Your reference number is ${reference}. Your calculator starting estimate is ${calculator.label}. This is not a final quote; B & E will review the job details and contact you soon.`);
  setFormField(quoteForm, '_template', 'table');
  setFormField(quoteForm, '_next', nextPage.href);
  quoteForm.action = `https://formsubmit.co/${encodeURIComponent(settings.quoteEmail)}`;
  localStorage.setItem(quoteRateLimitKey, String(Date.now()));
  saveQuoteForOwner({ ...quote, projectSize: calculator.size, calculatorEstimate: calculator.label }, reference);
  quoteForm.submit();
});

restoreSavedValues();

if (new URLSearchParams(window.location.search).get('quote') === 'sent') {
  const note = quoteForm.querySelector('.form-note');
  note.textContent = 'Thanks! Your quote request was sent. Please check your email for a confirmation copy.';
  history.replaceState({}, '', `${window.location.pathname}#contact`);
}

function openAdminLogin() {
  loginModal.hidden = false;
  document.querySelector('#adminPassword').focus();
}

function unlockAdminControls() {
  loginForm.reset();
  document.querySelector('.login-status').textContent = '';
  loginModal.hidden = true;
  adminSection.hidden = false;
  refreshAdminLock();
  loadQuoteInbox();
  adminSection.scrollIntoView({ behavior: 'smooth' });
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
  if (!/^\d{6}$/.test(pin)) {
    loginStatus.textContent = 'Enter your six-digit owner PIN.';
    return;
  }
  try {
    loginStatus.textContent = 'Unlocking owner controls…';
    const result = await signInWithEmailAndPassword(auth, ownerEmail, pin);
    if (result.user.email !== ownerEmail) throw new Error('Owner sign-in required');
    unlockAdminControls();
  } catch (error) {
    loginStatus.textContent = 'That owner PIN did not work. Please try again.';
    return;
  }
});
