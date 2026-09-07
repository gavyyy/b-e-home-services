import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { collection, getDocs, getFirestore, orderBy, query, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const app = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(app);
const database = getFirestore(app);
const workerAccount = 'brandon.gipson@behomeservices.workers';
const form = document.querySelector('#workerLoginForm');
const codeInput = document.querySelector('#workerCode');
const status = document.querySelector('#workerStatus');
const jobs = document.querySelector('#workerJobs');
const signOutButton = document.querySelector('#workerSignOut');

document.querySelectorAll('[data-key]').forEach((button) => button.addEventListener('click', () => {
  if (codeInput.value.length < 6) codeInput.value += button.dataset.key;
}));
document.querySelector('#clearWorkerCode').addEventListener('click', () => { codeInput.value = ''; });
document.querySelector('#deleteWorkerCode').addEventListener('click', () => { codeInput.value = codeInput.value.slice(0, -1); });

async function loadJobs() {
  jobs.innerHTML = '<p>Loading jobs…</p>';
  try {
    const result = await getDocs(query(collection(database, 'quoteRequests'), orderBy('createdAt', 'desc')));
    if (result.empty) { jobs.innerHTML = '<p>No jobs are waiting right now.</p>'; return; }
    jobs.replaceChildren(...result.docs.map((jobDoc) => {
      const job = jobDoc.data();
      const card = document.createElement('article'); card.className = 'worker-job';
      const title = document.createElement('h2'); title.textContent = `${job.service || 'Service'} · ${job.customerName || 'Customer'}`;
      const details = document.createElement('p'); details.textContent = `Status: ${job.status || 'New'} · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`;
      const location = document.createElement('p'); location.textContent = `Location: ${job.serviceArea || 'Ask owner for location'}`;
      const notes = document.createElement('p'); notes.textContent = job.details || 'No job notes provided.';
      const actions = document.createElement('div'); actions.className = 'worker-actions';
      if (job.serviceArea) { const maps = document.createElement('a'); maps.className = 'reset-button'; maps.target = '_blank'; maps.rel = 'noopener'; maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.serviceArea)}`; maps.textContent = 'Open in maps'; actions.append(maps); }
      const complete = document.createElement('button'); complete.className = 'button button-small'; complete.type = 'button'; complete.textContent = job.status === 'Completed' ? 'Completed' : 'Mark completed'; complete.disabled = job.status === 'Completed';
      complete.addEventListener('click', async () => { try { await updateDoc(jobDoc.ref, { status: 'Completed' }); complete.textContent = 'Completed'; complete.disabled = true; details.textContent = `Status: Completed · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`; } catch { status.textContent = 'We could not update that job. Please try again.'; } });
      actions.append(complete); card.append(title, details, location, notes, actions); return card;
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
    await loadJobs();
  } catch {
    status.textContent = 'That code did not work. Please try again.';
  }
});
signOutButton.addEventListener('click', async () => { await signOut(auth); signOutButton.hidden = true; codeInput.value = ''; jobs.innerHTML = '<p>Enter your code to view B & E jobs.</p>'; status.textContent = 'Job board locked.'; });
