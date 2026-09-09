import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js';

const firebaseApp = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(firebaseApp);
const database = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const settingsDocument = doc(database, 'siteSettings', 'main');
// This is an account identifier, not a secret. The owner PIN is verified by
// Firebase and is never kept in this website's files.
const ownerEmail = 'professionalhomeservices@behomeservices.art';
const storageKey = 'be-home-services-content';
const adminForm = document.querySelector('#adminForm');
const quoteForm = document.querySelector('#quoteForm');
const adminStatus = document.querySelector('.admin-status');
const loginModal = document.querySelector('#loginModal');
const loginForm = document.querySelector('#loginForm');
const adminSection = document.querySelector('#admin');
const quoteRateLimitKey = 'be-home-services-last-quote-request';
const quoteDuplicateKey = 'be-home-services-recent-quote';
const quoteRequests = collection(database, 'quoteRequests');
const quoteList = document.querySelector('#quoteList');
const jobPdfArchive = document.querySelector('#jobPdfArchive');
const appointmentCalendar = document.querySelector('#appointmentCalendar');
const calendarMonthTitle = document.querySelector('#calendarMonthTitle');
let appointmentCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const customerLoginForm = document.querySelector('#customerLoginForm');
const customerPortalStatus = document.querySelector('#customerPortalStatus');
const customerQuoteList = document.querySelector('#customerQuoteList');
let adminLockTimer;
let savedValues = {};
let quoteTrackingUnsubscribe;
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

function trackAnalytics(eventName, parameters = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters);
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  if (link.href.startsWith('tel:')) trackAnalytics('click_to_call', { link_text: link.textContent.trim() || 'Call B & E' });
  if (link.href.startsWith('sms:')) trackAnalytics('click_to_text', { link_text: link.textContent.trim() || 'Text B & E' });
});

function updatePage(values) {
  const sections = { showHero: 'heroSection', showTrust: 'why-us', showServices: 'services', showPromise: 'promiseSection', showPrices: 'priceSection', showGallery: 'gallerySection', showOffers: 'offersSection', showReviews: 'reviewsSection', showCustomerPortal: 'customerPortal', showContact: 'contact', showHeaderPhone: 'headerPhone', showQuickContact: 'quickContact' };
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
  if (typeof values.weatherEnabled === 'boolean') document.querySelector('#weatherSection').hidden = !values.weatherEnabled;
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
  savedValues = { ...savedValues, ...saved };
  Object.entries(saved).forEach(([name, value]) => {
    const field = adminForm.elements.namedItem(name);
    if (field) {
      if (field.type === 'checkbox') field.checked = value === true;
      else if (name === 'workerEmails' && Array.isArray(value)) field.value = value.join('\n');
      else field.value = value;
    }
  });
  updatePage(saved);
  renderControlHealth(saved);
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
  renderControlHealth();
}

adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = valuesFrom(adminForm);
  savedValues = { ...savedValues, ...values };
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

function renderControlHealth(values = valuesFrom(adminForm)) {
  const panel = document.querySelector('#controlHealth');
  if (!panel) return;
  const validInbox = /^\S+@\S+\.\S+$/.test(String(values.quoteEmail || ''));
  const set = (name, text, className) => {
    const item = panel.querySelector(`[data-health="${name}"]`);
    if (!item) return;
    item.textContent = text;
    item.className = className;
  };
  set('website', 'Online', 'is-good');
  set('quotes', values.quoteEnabled ? 'Open for requests' : 'Paused', values.quoteEnabled ? 'is-good' : 'is-warn');
  set('email', validInbox ? 'Ready' : 'Needs attention', validInbox ? 'is-good' : 'is-warn');
  set('notice', values.weatherEnabled ? 'Weather notice live' : values.announcementEnabled ? 'Website notice live' : 'No active notice', values.weatherEnabled || values.announcementEnabled ? 'is-warn' : 'is-good');
  set('lock', `${Number(values.lockMinutes || 15)} min auto-lock`, 'is-good');
}

async function publishQuickCommand(command) {
  const status = document.querySelector('#operationsStatus');
  if (!auth.currentUser || auth.currentUser.email !== ownerEmail) {
    status.textContent = 'Unlock owner controls first.';
    return;
  }
  const field = (name) => adminForm.elements.namedItem(name);
  if (command === 'pause') {
    field('quoteEnabled').checked = false;
    field('announcementEnabled').checked = true;
    field('announcementText').value = 'New quote requests are temporarily paused. Please check back soon.';
  } else if (command === 'reopen') {
    field('quoteEnabled').checked = true;
    field('announcementEnabled').checked = false;
  } else if (command === 'weather') {
    field('weatherEnabled').checked = true;
  } else if (command === 'clear') {
    field('weatherEnabled').checked = false;
    field('announcementEnabled').checked = false;
  }
  const values = valuesFrom(adminForm);
  savedValues = { ...savedValues, ...values };
  localStorage.setItem(storageKey, JSON.stringify(values));
  updatePage(values);
  renderControlHealth(values);
  status.textContent = 'Publishing…';
  try {
    await setDoc(settingsDocument, values);
    status.textContent = 'Website update is live.';
  } catch (error) {
    status.textContent = 'Could not publish. Check owner sign-in and try again.';
  }
}

document.querySelector('#pauseLeads').addEventListener('click', () => publishQuickCommand('pause'));
document.querySelector('#reopenLeads').addEventListener('click', () => publishQuickCommand('reopen'));
document.querySelector('#activateWeatherNotice').addEventListener('click', () => publishQuickCommand('weather'));
document.querySelector('#clearNotices').addEventListener('click', () => publishQuickCommand('clear'));
document.querySelector('#previewQuoteForm').addEventListener('click', () => trackAnalytics('owner_preview_quote_form'));

let trackedQuotes = [];
function filteredTrackedQuotes(records) {
  const queryText = String(document.querySelector('#customerSearch')?.value || '').trim().toLowerCase();
  const selectedStatus = String(document.querySelector('#customerStatusFilter')?.value || 'All');
  return records.filter((quoteDoc) => {
    const quote = quoteDoc.data();
    const searchable = [quote.reference, quote.customerName, quote.customerEmail, quote.customerPhone, quote.service, quote.serviceArea].join(' ').toLowerCase();
    return (selectedStatus === 'All' || (quote.status || 'New') === selectedStatus) && (!queryText || searchable.includes(queryText));
  });
}

function renderCustomerSummary(records) {
  const summary = document.querySelector('#customerSummary');
  if (!summary) return;
  const customers = new Set(records.map((quoteDoc) => quoteDoc.data().customerEmail).filter(Boolean)).size;
  const scheduled = records.filter((quoteDoc) => quoteDoc.data().status === 'Scheduled').length;
  const followUps = records.filter((quoteDoc) => quoteDoc.data().nextFollowUp).length;
  const newLeads = records.filter((quoteDoc) => (quoteDoc.data().status || 'New') === 'New').length;
  summary.replaceChildren(...[['Customers', customers], ['New leads', newLeads], ['Scheduled', scheduled], ['Follow-ups set', followUps]].map(([label, value]) => {
    const card = document.createElement('article');
    const total = document.createElement('strong'); total.textContent = String(value);
    const title = document.createElement('span'); title.textContent = label;
    card.append(total, title);
    return card;
  }));
}

['customerSearch', 'customerStatusFilter'].forEach((id) => {
  const input = document.querySelector(`#${id}`);
  ['input', 'change'].forEach((eventName) => input.addEventListener(eventName, () => { if (trackedQuotes.length) loadQuoteInbox(); }));
});

quoteForm.elements.namedItem('service').addEventListener('change', updateQuoteEstimate);
quoteForm.elements.namedItem('projectSize').addEventListener('change', updateQuoteEstimate);

const accessibilityToggle = document.querySelector('#accessibilityToggle');
const accessibilityPanel = document.querySelector('#accessibilityPanel');
const accessibilityOptions = [['largeText', 'large-type'], ['highContrast', 'high-contrast'], ['reduceMotion', 'reduce-motion']];
const savedAccessibility = JSON.parse(localStorage.getItem('be-accessibility-options') || '{}');
accessibilityOptions.forEach(([inputId, className]) => {
  const input = document.querySelector(`#${inputId}`);
  input.checked = Boolean(savedAccessibility[inputId]);
  document.body.classList.toggle(className, input.checked);
  input.addEventListener('change', () => {
    savedAccessibility[inputId] = input.checked;
    document.body.classList.toggle(className, input.checked);
    localStorage.setItem('be-accessibility-options', JSON.stringify(savedAccessibility));
  });
});
accessibilityToggle.addEventListener('click', () => {
  accessibilityPanel.hidden = !accessibilityPanel.hidden;
  accessibilityToggle.setAttribute('aria-expanded', String(!accessibilityPanel.hidden));
});

const responsiveDetails = document.querySelectorAll('.content-disclosure, .quote-details');
function setResponsiveDetails() {
  if (window.innerWidth > 700) responsiveDetails.forEach((panel) => { panel.open = true; });
}
setResponsiveDetails();
window.addEventListener('resize', setResponsiveDetails);

const quoteLanguageToggle = document.querySelector('#quoteLanguageToggle');
const quoteLanguageLabel = document.querySelector('#quoteLanguageLabel');
let quoteLanguage = 'en';
const labelText = new Map();
const translatedLabels = {
  customerName: 'Nombre completo', customerPhone: 'Número de teléfono', customerEmail: 'Correo electrónico', service: 'Servicio que necesita', propertyType: 'Tipo de propiedad (opcional)', projectSize: 'Tamaño del proyecto para estimado', contactMethod: 'Forma preferida de contacto', preferredTime: 'Mejor día / hora', serviceFrequency: 'Frecuencia del servicio', referralSource: 'Código o nombre de referencia (opcional)', bookingDate: 'Fecha preferida para el servicio', bookingWindow: 'Horario preferido de llegada', serviceArea: 'Dirección del servicio', details: 'Cuéntenos sobre el trabajo', attachment: 'Fotos del trabajo (opcional — máximo 10 MB)'
};
const translatedOptions = { service: ['Seleccione un servicio', 'Cuidado de césped y paisajismo', 'Recorte de setos', 'Poda de árboles', 'Mantillo', 'Lavado a presión', 'Limpieza residencial', 'Limpieza comercial', 'Limpieza profunda', 'Limpieza básica del hogar', 'Otra cosa'], propertyType: ['Seleccione uno', 'Casa', 'Apartamento / condominio', 'Negocio', 'Alquiler / mudanza', 'Otro'], projectSize: ['Seleccione un tamaño', 'Pequeño', 'Mediano', 'Grande'], contactMethod: ['Llamada', 'Texto', 'Correo electrónico'], serviceFrequency: ['Servicio único', 'Semanal', 'Cada dos semanas', 'Mensual'], bookingWindow: ['Sin preferencia', 'Mañana', 'Tarde', 'Noche'] };
function setFirstLabelText(fieldName, text) {
  const field = quoteForm.elements.namedItem(fieldName);
  const label = field?.closest('label');
  const textNode = [...(label?.childNodes || [])].find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
  if (!textNode) return;
  if (!labelText.has(fieldName)) labelText.set(fieldName, textNode.nodeValue);
  textNode.nodeValue = ` ${text}`;
}
function setQuoteLanguage(language) {
  quoteLanguage = language;
  const spanish = language === 'es';
  quoteForm.lang = spanish ? 'es' : 'en';
  Object.entries(translatedLabels).forEach(([field, spanishText]) => setFirstLabelText(field, spanish ? spanishText : labelText.get(field) || ''));
  Object.entries(translatedOptions).forEach(([fieldName, spanishOptions]) => {
    const options = quoteForm.elements.namedItem(fieldName)?.options;
    if (!options) return;
    [...options].forEach((option, index) => {
      if (!option.dataset.english) option.dataset.english = option.textContent;
      if (!option.dataset.value) option.dataset.value = option.value;
      option.textContent = spanish ? (spanishOptions[index] || option.dataset.english) : option.dataset.english;
      option.value = option.dataset.value;
    });
  });
  document.querySelector('.quote-details summary').childNodes[0].nodeValue = spanish ? 'Agregar horario, propiedad y detalles de precio ' : 'Add scheduling, property, and price details ';
  document.querySelectorAll('.quote-details summary')[1].childNodes[0].nodeValue = spanish ? 'Agregar fotos del trabajo ' : 'Add job photos ';
  document.querySelector('.booking-request strong').textContent = spanish ? 'Elija la fecha y hora que prefiera.' : 'Choose your preferred date and time.';
  document.querySelector('.booking-request small').textContent = spanish ? 'B & E confirmará la disponibilidad antes de programar el trabajo.' : 'B & E will confirm availability before your job is booked.';
  document.querySelector('.quote-form .button [data-field="quoteButtonText"]').textContent = spanish ? 'Solicitar mi cotización gratis' : (savedValues.quoteButtonText || 'Request my free quote');
  quoteLanguageLabel.textContent = spanish ? 'Idioma del formulario' : 'Quote form language';
  quoteLanguageToggle.textContent = spanish ? 'English' : 'Español';
  localStorage.setItem('be-quote-language', language);
}
quoteLanguageToggle.addEventListener('click', () => setQuoteLanguage(quoteLanguage === 'en' ? 'es' : 'en'));
if (localStorage.getItem('be-quote-language') === 'es') setQuoteLanguage('es');

document.querySelector('#resetChanges').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  window.location.reload();
});

function lockAdmin() {
  clearTimeout(adminLockTimer);
  if (quoteTrackingUnsubscribe) {
    quoteTrackingUnsubscribe();
    quoteTrackingUnsubscribe = undefined;
  }
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
      serviceFrequency: quote.serviceFrequency || 'One-time service',
      referralSource: quote.referralSource || '',
      serviceArea: quote.serviceArea || '',
      details: quote.details,
      status: 'New',
      createdAt: Date.now()
    });
    return true;
  } catch (error) {
    // Email delivery can still work if private quote storage has not been enabled yet.
    return false;
  }
}

function loadQuoteInbox() {
  if (!auth.currentUser || auth.currentUser.email !== ownerEmail) return;
  quoteList.innerHTML = '<p class="quote-empty">Loading quote requests…</p>';
  if (quoteTrackingUnsubscribe) quoteTrackingUnsubscribe();
  quoteTrackingUnsubscribe = onSnapshot(query(quoteRequests, orderBy('createdAt', 'desc'), limit(50)), (results) => {
    trackedQuotes = results.docs;
    renderOwnerDashboard(results.docs.map((quoteDoc) => quoteDoc.data()));
    renderCustomerSummary(results.docs);
    renderJobPdfArchive(results.docs.map((quoteDoc) => quoteDoc.data()));
    renderAppointmentCalendar(results.docs.map((quoteDoc) => quoteDoc.data()));
    if (results.empty) {
      quoteList.innerHTML = '<p class="quote-empty">No tracked quote requests yet.</p>';
      return;
    }
    const visibleQuotes = filteredTrackedQuotes(results.docs);
    if (!visibleQuotes.length) {
      quoteList.innerHTML = '<p class="quote-empty">No customers match this tracking filter.</p>';
      return;
    }
    quoteList.replaceChildren(...visibleQuotes.map((quoteDoc) => {
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
      const lastContact = document.createElement('input');
      lastContact.placeholder = 'Last contact note (private)';
      lastContact.value = quote.lastContact || '';
      const nextFollowUp = document.createElement('input');
      nextFollowUp.type = 'date';
      nextFollowUp.value = quote.nextFollowUp || '';
      const sharedNotes = document.createElement('textarea');
      sharedNotes.rows = 3;
      sharedNotes.maxLength = 1000;
      sharedNotes.setAttribute('aria-label', 'Shared team and owner notes');
      sharedNotes.placeholder = 'Shared team & owner notes';
      sharedNotes.value = quote.sharedNotes || '';
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
      const saveTracking = document.createElement('button');
      saveTracking.type = 'button';
      saveTracking.textContent = 'Save customer tracking';
      saveTracking.addEventListener('click', async () => {
        try {
          await updateDoc(quoteDoc.ref, { lastContact: lastContact.value.trim(), nextFollowUp: nextFollowUp.value || '' });
          saveTracking.textContent = 'Tracking saved';
          setTimeout(() => { saveTracking.textContent = 'Save customer tracking'; }, 1500);
        } catch (error) { saveTracking.textContent = 'Could not save'; }
      });
      const saveSharedNotes = document.createElement('button');
      saveSharedNotes.type = 'button';
      saveSharedNotes.textContent = 'Save shared notes';
      saveSharedNotes.addEventListener('click', async () => {
        try {
          await updateDoc(quoteDoc.ref, { sharedNotes: sharedNotes.value.trim(), sharedNotesUpdatedAt: Date.now(), sharedNotesUpdatedBy: 'Owner' });
          saveSharedNotes.textContent = 'Notes saved';
          setTimeout(() => { saveSharedNotes.textContent = 'Save shared notes'; }, 1500);
        } catch (error) { saveSharedNotes.textContent = 'Could not save'; }
      });
      const requestPdf = document.createElement('button');
      requestPdf.type = 'button';
      requestPdf.textContent = 'Download request + calculator PDF';
      requestPdf.addEventListener('click', () => downloadQuotePdf('Customer quote request', quote));
      const estimatePdf = document.createElement('button');
      estimatePdf.type = 'button';
      estimatePdf.textContent = 'Download final estimate PDF';
      estimatePdf.addEventListener('click', () => downloadQuotePdf('B & E Home Services estimate', { ...quote, estimateAmount: estimateAmount.value.trim(), estimateNotes: estimateNotes.value.trim() }));
      actions.append(saveEstimate, saveTracking, saveSharedNotes, requestPdf, estimatePdf);
      const googleCalendarUrl = googleCalendarEventUrl(quote);
      if (googleCalendarUrl) {
        const addToCalendar = document.createElement('a');
        addToCalendar.className = 'reset-button';
        addToCalendar.href = googleCalendarUrl;
        addToCalendar.target = '_blank';
        addToCalendar.rel = 'noopener';
        addToCalendar.textContent = 'Add to Google Calendar';
        actions.append(addToCalendar);
      }
      const phoneDigits = String(quote.customerPhone || '').replace(/\D/g, '');
      if (phoneDigits.length >= 7) {
        const customerFirstName = String(quote.customerName || 'there').trim().split(/\s+/)[0] || 'there';
        const reviewUrl = String(savedValues.googleReviewUrl || 'https://g.page/r/CRU8GnuRuE1GECE/review').trim();
        const addTextButton = (label, message) => {
          const text = document.createElement('a');
          text.className = 'reset-button';
          text.href = `sms:${phoneDigits}?body=${encodeURIComponent(message)}`;
          text.textContent = label;
          text.addEventListener('click', () => trackAnalytics('job_status_text_started', { status_label: label }));
          actions.append(text);
        };
        const personalize = (template, fallback) => String(template || fallback).replaceAll('{firstName}', customerFirstName).replaceAll('{service}', quote.service || 'scheduled service').replaceAll('{reviewLink}', reviewUrl);
        addTextButton('Text: on our way', personalize(savedValues.onOurWayText, 'Hi {firstName}, this is B & E Home Services. We are on our way for your {service}. Thank you!'));
        addTextButton('Text: job complete', personalize(savedValues.jobCompleteText, 'Hi {firstName}, B & E Home Services has completed your {service}. Thank you for choosing us! Please let us know if there is anything else we can help with.'));
        addTextButton('Thank customer + review link', personalize(savedValues.reviewRequestText, 'Hi {firstName}, thank you for choosing B & E Home Services for your {service}. We truly appreciate your business! If you were happy with our work, would you kindly leave us a Google review? {reviewLink}'));
      }
      const deleteQuote = document.createElement('button');
      deleteQuote.type = 'button';
      deleteQuote.className = 'delete-quote-button';
      deleteQuote.textContent = quote.status === 'Completed' ? 'Delete completed project' : 'Delete quote';
      deleteQuote.addEventListener('click', async () => {
        const confirmed = window.confirm(`Permanently delete ${quote.status === 'Completed' ? 'completed project' : 'quote'} ${quote.reference || ''}? This cannot be undone.`);
        if (!confirmed) return;
        deleteQuote.disabled = true;
        deleteQuote.textContent = 'Deleting…';
        try {
          await deleteDoc(quoteDoc.ref);
          await loadQuoteInbox();
        } catch (error) {
          deleteQuote.disabled = false;
          deleteQuote.textContent = 'Could not delete';
        }
      });
      actions.append(deleteQuote);
      item.append(title, info, details, status, estimateAmount, estimateNotes, lastContact, nextFollowUp, sharedNotes, actions);
      return item;
    }));
  }, () => {
    quoteList.innerHTML = '<p class="quote-empty">Private quote tracking is not enabled yet.</p>';
    jobPdfArchive.innerHTML = '<p class="quote-empty">Job PDFs are unavailable until private quote tracking is enabled.</p>';
  });
}

function renderJobPdfArchive(quotes) {
  if (!quotes.length) {
    jobPdfArchive.innerHTML = '<p class="quote-empty">No saved jobs or quote PDFs yet.</p>';
    return;
  }
  jobPdfArchive.replaceChildren(...quotes.map((quote) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'job-pdf-button';
    const reference = quote.reference || 'Job record';
    button.textContent = `PDF · ${reference}`;
    button.title = `${quote.customerName || 'Customer'} — ${quote.service || 'Service'}`;
    button.addEventListener('click', () => downloadQuotePdf('B & E Home Services job record', quote));
    return button;
  }));
}

function dateFromBookingDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function googleCalendarEventUrl(quote) {
  const start = dateFromBookingDate(quote.bookingDate);
  if (!start) return '';
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const compactDate = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const parameters = new URLSearchParams({
    action: 'TEMPLATE',
    text: `B & E request — ${quote.customerName || 'Customer'} · ${quote.service || 'Service'}`,
    dates: `${compactDate(start)}/${compactDate(end)}`,
    details: `Requested arrival: ${quote.bookingWindow || 'No preference'}\nPhone: ${quote.customerPhone || 'Not provided'}\nEmail: ${quote.customerEmail || 'Not provided'}\nQuote reference: ${quote.reference || 'Not provided'}\nNotes: ${quote.details || 'None'}`,
    location: quote.serviceArea || ''
  });
  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

function renderAppointmentCalendar(quotes) {
  const year = appointmentCalendarMonth.getFullYear();
  const month = appointmentCalendarMonth.getMonth();
  calendarMonthTitle.textContent = appointmentCalendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const datedQuotes = quotes.filter((quote) => {
    const date = dateFromBookingDate(quote.bookingDate);
    return date && date.getFullYear() === year && date.getMonth() === month;
  });
  const byDay = new Map();
  datedQuotes.forEach((quote) => {
    const day = dateFromBookingDate(quote.bookingDate).getDate();
    byDay.set(day, [...(byDay.get(day) || []), quote]);
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nodes = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => {
    const heading = document.createElement('span');
    heading.className = 'calendar-weekday';
    heading.textContent = name;
    return heading;
  });
  for (let i = 0; i < firstDay; i += 1) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day';
    nodes.push(blank);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    const number = document.createElement('span');
    number.className = 'calendar-day-number';
    number.textContent = String(day);
    cell.append(number);
    (byDay.get(day) || []).forEach((quote) => {
      const job = document.createElement('span');
      job.className = `calendar-job${quote.status === 'Scheduled' ? ' is-scheduled' : ''}`;
      job.textContent = `${quote.status === 'Scheduled' ? 'Scheduled' : 'Requested'} · ${quote.customerName || quote.service || 'Job'}`;
      job.title = `${quote.service || 'Service'} — ${quote.bookingWindow || 'No preference'}`;
      cell.append(job);
    });
    nodes.push(cell);
  }
  appointmentCalendar.replaceChildren(...nodes);
}

document.querySelector('#previousCalendarMonth').addEventListener('click', () => {
  appointmentCalendarMonth = new Date(appointmentCalendarMonth.getFullYear(), appointmentCalendarMonth.getMonth() - 1, 1);
  renderAppointmentCalendar(trackedQuotes.map((quoteDoc) => quoteDoc.data()));
});
document.querySelector('#nextCalendarMonth').addEventListener('click', () => {
  appointmentCalendarMonth = new Date(appointmentCalendarMonth.getFullYear(), appointmentCalendarMonth.getMonth() + 1, 1);
  renderAppointmentCalendar(trackedQuotes.map((quoteDoc) => quoteDoc.data()));
});

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

document.querySelector('#sendTestQuote').addEventListener('click', async () => {
  if (!auth.currentUser || auth.currentUser.email !== ownerEmail) return;
  const status = document.querySelector('#testQuoteStatus');
  const settings = valuesFrom(adminForm);
  const recipient = String(settings.quoteEmail || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(recipient)) {
    status.textContent = 'Add a valid quote request email, then save your page changes first.';
    return;
  }
  if (!window.confirm(`Send a test quote email to ${recipient}?`)) return;
  const reference = `TEST-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const formData = new FormData();
  formData.set('customerName', 'B & E website test');
  formData.set('customerEmail', recipient);
  formData.set('customerPhone', 'Test only');
  formData.set('service', 'Website email delivery test');
  formData.set('quote_reference', reference);
  formData.set('calculator_starting_estimate', 'Test only — not a customer quote');
  formData.set('message', 'This is a test quote generated from the protected B & E owner controls. If you received this message, quote email delivery is working.');
  formData.set('_subject', `B & E TEST quote delivery — ${reference}`);
  formData.set('_template', 'table');
  status.textContent = 'Sending test quote email…';
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData
    });
    if (!response.ok) throw new Error('Email provider did not accept the test.');
    status.textContent = 'Test sent. Check the quote inbox, including spam, in a few minutes.';
  } catch (error) {
    status.textContent = 'The test could not be sent yet. Make sure FormSubmit has been activated for this inbox, then try again.';
  }
});

document.querySelector('#uploadGalleryPhoto').addEventListener('click', async () => {
  const status = document.querySelector('#galleryUploadStatus');
  const file = document.querySelector('#galleryUpload').files[0];
  const caption = document.querySelector('#galleryUploadCaption').value.trim();
  let slot = document.querySelector('#galleryUploadSlot').value;
  if (!auth.currentUser || auth.currentUser.email !== ownerEmail) return;
  if (!file) {
    status.textContent = 'Choose a photo first.';
    return;
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    status.textContent = 'Use a JPG, PNG, or WebP photo smaller than 10 MB.';
    return;
  }
  if (slot === 'auto') slot = ['One', 'Two', 'Three'].find((number) => !adminForm.elements.namedItem(`gallery${number}Image`).value) || 'Three';
  status.textContent = 'Uploading photo…';
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(-80);
  try {
    const uploadRef = ref(storage, `gallery/${Date.now()}-${safeName}`);
    await uploadBytes(uploadRef, file, { contentType: file.type });
    const imageUrl = await getDownloadURL(uploadRef);
    adminForm.elements.namedItem(`gallery${slot}Image`).value = imageUrl;
    if (caption) adminForm.elements.namedItem(`gallery${slot}Caption`).value = caption;
    updatePage(valuesFrom(adminForm));
    status.textContent = `Uploaded to gallery slot ${slot}. Select “Save page changes” to publish it.`;
  } catch (error) {
    status.textContent = 'Upload is not ready yet. Sign in with the Firebase project owner account, then try again.';
  }
});

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
      const frequency = document.createElement('p');
      frequency.textContent = `Service frequency: ${quote.serviceFrequency || 'One-time service'}`;
      const estimate = document.createElement('p');
      estimate.textContent = `Starting estimate: ${quote.calculatorEstimate || 'Custom quote needed'}`;
      item.append(heading, status, schedule, frequency, estimate);
      const paymentUrl = String(savedValues.paymentUrl || '').trim();
      if (/^https:\/\//i.test(paymentUrl) && quote.status === 'Estimate sent') { const pay = document.createElement('a'); pay.className = 'reset-button'; pay.href = paymentUrl; pay.target = '_blank'; pay.rel = 'noopener'; pay.textContent = 'Open secure payment page'; item.append(pay); }
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
  const normalizedEmail = String(quote.customerEmail || '').trim().toLowerCase();
  const normalizedPhone = String(quote.customerPhone || '').replace(/\D/g, '');
  const textForScreening = `${quote.customerName || ''} ${quote.details || ''}`.toLowerCase();
  const spamTerms = /\b(crypto|bitcoin|forex|casino|backlink|guest post|seo service|telegram|whatsapp|investment opportunity|viagra)\b/i;
  const recentQuote = JSON.parse(localStorage.getItem(quoteDuplicateKey) || 'null');
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedPhone.length < 10 || spamTerms.test(textForScreening)) {
    note.textContent = 'We could not submit that request. Please use a valid email and phone number, then review the form and try again.';
    return;
  }
  if (!quote.bookingDate || String(quote.serviceArea || '').trim().length < 5) {
    quoteForm.querySelector('.quote-details').open = true;
    note.textContent = 'Please enter your service address and preferred service date before sending your quote request.';
    return;
  }
  if (recentQuote && recentQuote.email === normalizedEmail && recentQuote.phone === normalizedPhone && Date.now() - recentQuote.time < 24 * 60 * 60 * 1000) {
    note.textContent = 'We already received a recent request with these contact details. Please wait for B & E to reply.';
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
  const originalSubmitButtonText = submitButton.textContent;
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
  setFormField(quoteForm, 'service_frequency', quote.serviceFrequency || 'One-time service');
  setFormField(quoteForm, 'referral_source', quote.referralSource || 'Not provided');
  setFormField(quoteForm, 'message', quote.details || 'Not provided');
  setFormField(quoteForm, 'quote_reference', reference);
  setFormField(quoteForm, 'calculator_starting_estimate', calculator.label);
  setFormField(quoteForm, 'add_to_google_calendar', googleCalendarEventUrl({ ...quote, reference }) || 'No requested date was provided');
  setFormField(quoteForm, '_subject', `New B & E quote request ${reference} — ${quote.service}`);
  setFormField(quoteForm, '_replyto', quote.customerEmail);
  setFormField(quoteForm, '_autoresponse', `Thank you for contacting B & E Home Services. We received your quote request. Your reference number is ${reference}. Your calculator starting estimate is ${calculator.label}. This is not a final quote; B & E will review the job details and contact you soon.\n\nIMPORTANT TERMS NOTICE: By submitting this request, you confirmed that you read and agreed to B & E Home Services’ Terms of Use, including the Property Condition, Damage, and Customer Responsibility section: https://behomeservices.art/terms.html\n\nYou are responsible for telling B & E about existing damage, fragile or loose items, hidden conditions, utilities, hazards, pets, and special care instructions, and for securing valuables and property that could be affected by the requested work. To the fullest extent permitted by law, B & E Home Services is not responsible for loss, damage, delays, or costs tied to pre-existing or hidden conditions, unsecured property, ordinary risks of the requested work, weather, third parties, or conditions outside our control. B & E works carefully to avoid damage and will review concerns reported as soon as possible. This notice does not waive any rights or responsibilities that cannot legally be waived.`);
  setFormField(quoteForm, '_template', 'table');
  setFormField(quoteForm, '_captcha', 'true');
  setFormField(quoteForm, '_next', nextPage.href);
  trackAnalytics('generate_lead', { service_type: quote.service, property_type: quote.propertyType, contact_method: quote.contactMethod });
  // Wait for the private record before navigating to the email service. Without
  // this wait, a browser redirect can cancel the save and make the dashboard
  // look as if a submitted quote disappeared.
  await saveQuoteForOwner({ ...quote, projectSize: calculator.size, calculatorEstimate: calculator.label }, reference);
  try {
    // Use the same delivery route as the owner test button. This returns a
    // clear success or failure response instead of navigating away mid-send.
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(settings.quoteEmail)}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(quoteForm)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === 'false') throw new Error(result.message || 'Email provider did not accept the request.');
    localStorage.setItem(quoteRateLimitKey, String(Date.now()));
    localStorage.setItem(quoteDuplicateKey, JSON.stringify({ email: normalizedEmail, phone: normalizedPhone, time: Date.now() }));
    quoteForm.reset();
    quoteForm.dataset.openedAt = String(Date.now());
    updateQuoteEstimate();
    note.textContent = 'Thanks! Your quote request and email confirmation were sent. Please check your inbox.';
    submitButton.textContent = originalSubmitButtonText;
  } catch (error) {
    note.textContent = 'Your quote could not be emailed yet. Please try again or call B & E directly.';
    submitButton.disabled = false;
    submitButton.textContent = originalSubmitButtonText;
  }
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
  renderControlHealth();
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
    loginStatus.textContent = 'That owner PIN did not work. Make sure you are using the current six-digit PIN, then try again.';
    return;
  }
});
