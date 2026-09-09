import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, orderBy, query, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const app = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(app);
const database = getFirestore(app);
// Account name only. The worker PIN is checked by Firebase and is never
// included in this page's source code.
const workerAccount = 'brandon@behomeservices.art';
const form = document.querySelector('#workerLoginForm');
const codeInput = document.querySelector('#workerCode');
const status = document.querySelector('#workerStatus');
const jobs = document.querySelector('#workerJobs');
const signOutButton = document.querySelector('#workerSignOut');
const workspace = document.querySelector('#workerWorkspace');
const summary = document.querySelector('#workerSummary');
const refreshButton = document.querySelector('#refreshJobs');
const appointmentForm = document.querySelector('#teamAppointmentForm');
const appointmentStatus = document.querySelector('#teamAppointmentStatus');
let lockTimer;
let reviewUrl = 'https://g.page/r/CRU8GnuRuE1GECE/review';

function calendarLink(job) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(job.bookingDate || '')) return '';
  const startTime = ({ Morning: '090000', Afternoon: '130000', Evening: '170000' })[job.bookingWindow] || '090000';
  const endTime = ({ Morning: '100000', Afternoon: '140000', Evening: '180000' })[job.bookingWindow] || '100000';
  const day = job.bookingDate.replaceAll('-', '');
  const details = [
    `Reference: ${job.reference || 'Not provided'}`,
    `Phone: ${job.customerPhone || 'Not provided'}`,
    `Email: ${job.customerEmail || 'Not provided'}`,
    job.details || ''
  ].filter(Boolean).join('\n');
  const parameters = new URLSearchParams({
    action: 'TEMPLATE',
    text: `B & E — ${job.service || 'Service'} — ${job.customerName || 'Customer'}`,
    dates: `${day}T${startTime}/${day}T${endTime}`,
    details,
    location: job.serviceArea || ''
  });
  return `https://calendar.google.com/calendar/render?${parameters.toString()}`;
}

async function loadReviewLink() {
  try {
    const settings = await getDoc(doc(database, 'siteSettings', 'main'));
    const savedLink = String(settings.data()?.googleReviewUrl || '').trim();
    if (/^https:\/\//i.test(savedLink)) reviewUrl = savedLink;
  } catch { /* The current official review link remains available offline. */ }
}

function lockJobBoard(message = 'Job board locked.') {
  clearTimeout(lockTimer);
  signOut(auth).catch(() => {});
  signOutButton.hidden = true;
  workspace.hidden = true;
  codeInput.value = '';
  jobs.innerHTML = '<p>Enter your code to view B & E jobs.</p>';
  status.textContent = message;
}

function refreshWorkerLock() {
  clearTimeout(lockTimer);
  lockTimer = window.setTimeout(() => lockJobBoard('Job board locked after 15 minutes of inactivity.'), 15 * 60 * 1000);
}

document.querySelectorAll('[data-key]').forEach((button) => button.addEventListener('click', () => {
  if (codeInput.value.length < 6) codeInput.value += button.dataset.key;
}));
document.querySelector('#clearWorkerCode').addEventListener('click', () => { codeInput.value = ''; });
document.querySelector('#deleteWorkerCode').addEventListener('click', () => { codeInput.value = codeInput.value.slice(0, -1); });

document.querySelector('#teamAppointmentDate').min = new Date().toISOString().slice(0, 10);

function appointmentReference() {
  return `TEAM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function loadJobs() {
  jobs.innerHTML = '<p>Loading jobs…</p>';
  try {
    const result = await getDocs(query(collection(database, 'quoteRequests'), orderBy('createdAt', 'desc')));
    if (result.empty) { summary.textContent = 'No jobs are waiting right now.'; jobs.innerHTML = '<p>No jobs are waiting right now.</p>'; return; }
    const completed = result.docs.filter((item) => item.data().status === 'Completed').length;
    const openCount = result.docs.length - completed;
    summary.textContent = `${openCount} open job${openCount === 1 ? '' : 's'} · ${completed} completed`;
    jobs.replaceChildren(...result.docs.map((jobDoc) => {
      const job = jobDoc.data();
      const card = document.createElement('article'); card.className = 'worker-job';
      const title = document.createElement('h2'); title.textContent = `${job.service || 'Service'} · ${job.customerName || 'Customer'}`;
      const details = document.createElement('p'); details.textContent = `Status: ${job.status || 'New'} · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`;
      const location = document.createElement('p'); location.textContent = `Location: ${job.serviceArea || 'Ask owner for location'}`;
      const phone = document.createElement('p'); phone.textContent = `Phone: ${job.customerPhone || 'Not provided'}`;
      const email = document.createElement('p'); email.textContent = `Email: ${job.customerEmail || 'Not provided'}`;
      const notes = document.createElement('p'); notes.textContent = job.details || 'No job notes provided.';
      const sharedNotesLabel = document.createElement('label'); sharedNotesLabel.className = 'worker-shared-notes'; sharedNotesLabel.textContent = 'Shared team & owner notes';
      const sharedNotes = document.createElement('textarea'); sharedNotes.rows = 3; sharedNotes.maxLength = 1000; sharedNotes.placeholder = 'Add a note for the owner or team…'; sharedNotes.value = job.sharedNotes || ''; sharedNotesLabel.append(sharedNotes);
      const checklist = document.createElement('fieldset'); checklist.className = 'worker-checklist';
      const checklistTitle = document.createElement('legend'); checklistTitle.textContent = 'Job checklist'; checklist.append(checklistTitle);
      const checklistValues = job.workerChecklist || {};
      [['arrived', 'Arrived / customer updated'], ['beforeAfter', 'Before & after photos taken'], ['workFinished', 'Work completed and area checked']].forEach(([key, label]) => {
        const row = document.createElement('label'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = Boolean(checklistValues[key]); check.addEventListener('change', async () => { try { checklistValues[key] = check.checked; await updateDoc(jobDoc.ref, { workerChecklist: checklistValues }); } catch { check.checked = !check.checked; status.textContent = 'Checklist could not be saved. Please try again.'; } }); row.append(check, document.createTextNode(label)); checklist.append(row);
      });
      const actions = document.createElement('div'); actions.className = 'worker-actions';
      const saveSharedNotes = document.createElement('button'); saveSharedNotes.className = 'reset-button'; saveSharedNotes.type = 'button'; saveSharedNotes.textContent = 'Save shared notes';
      saveSharedNotes.addEventListener('click', async () => {
        try {
          await updateDoc(jobDoc.ref, { sharedNotes: sharedNotes.value.trim(), sharedNotesUpdatedAt: Date.now(), sharedNotesUpdatedBy: 'Team' });
          saveSharedNotes.textContent = 'Notes saved';
          setTimeout(() => { saveSharedNotes.textContent = 'Save shared notes'; }, 1500);
        } catch { saveSharedNotes.textContent = 'Could not save'; }
      });
      actions.append(saveSharedNotes);
      if (job.serviceArea) { const maps = document.createElement('a'); maps.className = 'reset-button'; maps.target = '_blank'; maps.rel = 'noopener'; maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.serviceArea)}`; maps.textContent = 'Open in maps'; actions.append(maps); }
      const calendar = calendarLink(job);
      if (calendar) { const addToCalendar = document.createElement('a'); addToCalendar.className = 'reset-button'; addToCalendar.target = '_blank'; addToCalendar.rel = 'noopener'; addToCalendar.href = calendar; addToCalendar.textContent = 'Add to calendar'; actions.append(addToCalendar); }
      if (job.customerPhone) {
        const phoneNumber = String(job.customerPhone).replace(/[^+\d]/g, '');
        const customerFirstName = String(job.customerName || 'there').trim().split(/\s+/)[0] || 'there';
        const call = document.createElement('a'); call.className = 'reset-button'; call.href = `tel:${phoneNumber}`; call.textContent = 'Call customer'; actions.append(call);
        const text = document.createElement('a'); text.className = 'reset-button'; text.href = `sms:${phoneNumber}`; text.textContent = 'Text customer'; actions.append(text);
        const thankYou = document.createElement('a'); thankYou.className = 'reset-button'; thankYou.href = `sms:${phoneNumber}?body=${encodeURIComponent(`Hi ${customerFirstName}, thank you for choosing B & E Home Services for your ${job.service || 'service'}. We truly appreciate your business! If you were happy with our work, would you kindly leave us a Google review? ${reviewUrl}`)}`; thankYou.textContent = 'Thank customer + review link'; actions.append(thankYou);
      }
      const complete = document.createElement('button'); complete.className = 'button worker-complete'; complete.type = 'button'; complete.textContent = job.status === 'Completed' ? 'Job completed ✓' : 'Job complete'; complete.disabled = job.status === 'Completed';
      complete.addEventListener('click', async () => { if (!window.confirm(`Mark ${job.customerName || 'this customer'}’s job complete?`)) return; try { await updateDoc(jobDoc.ref, { status: 'Completed', completedAt: new Date().toISOString() }); complete.textContent = 'Job completed ✓'; complete.disabled = true; details.textContent = `Status: Completed · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`; status.textContent = 'Job marked completed.'; await loadJobs(); } catch { status.textContent = 'We could not update that job. Please try again.'; } });
      actions.append(complete); card.append(title, details, location, phone, email, notes, sharedNotesLabel, checklist, actions); return card;
    }));
  } catch { jobs.innerHTML = '<p>Job access is not ready yet. Please ask the owner to check worker access.</p>'; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!/^\d{6}$/.test(codeInput.value)) { status.textContent = 'Enter all 6 numbers in your personal code.'; return; }
  status.textContent = 'Opening job board…';
  try {
    await signInWithEmailAndPassword(auth, workerAccount, codeInput.value);
    codeInput.value = '';
    status.textContent = 'Signed in. Your jobs are below.';
    signOutButton.hidden = false;
    workspace.hidden = false;
    await loadReviewLink();
    await loadJobs();
    refreshWorkerLock();
  } catch {
    status.textContent = 'That code did not work. Please try again.';
  }
});
appointmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth.currentUser) return;
  const appointment = Object.fromEntries(new FormData(appointmentForm).entries());
  const button = appointmentForm.querySelector('button[type="submit"]');
  const phone = String(appointment.customerPhone || '').replace(/\D/g, '');
  if (phone.length < 10) { appointmentStatus.textContent = 'Enter a valid client phone number.'; return; }
  button.disabled = true;
  appointmentStatus.textContent = 'Saving appointment…';
  try {
    await addDoc(collection(database, 'quoteRequests'), {
      reference: appointmentReference(),
      customerName: String(appointment.customerName || '').trim(),
      customerPhone: String(appointment.customerPhone || '').trim(),
      customerEmail: '',
      service: appointment.service,
      serviceArea: String(appointment.serviceArea || '').trim(),
      bookingDate: appointment.bookingDate,
      bookingWindow: appointment.bookingWindow || '',
      details: String(appointment.details || '').trim(),
      status: 'Scheduled',
      source: 'Team appointment',
      createdAt: Date.now()
    });
    appointmentForm.reset();
    appointmentStatus.textContent = 'Appointment saved. Use “Add to calendar” on the new job card if needed.';
    await loadJobs();
  } catch {
    appointmentStatus.textContent = 'The appointment could not be saved. Ask the owner to enable team appointment access.';
  } finally {
    button.disabled = false;
  }
});
refreshButton.addEventListener('click', () => { loadJobs(); refreshWorkerLock(); });
signOutButton.addEventListener('click', () => lockJobBoard());
['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => document.addEventListener(eventName, () => {
  if (!signOutButton.hidden) refreshWorkerLock();
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !signOutButton.hidden) lockJobBoard('Job board locked for privacy.');
});
