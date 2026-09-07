import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { collection, getDocs, getFirestore, orderBy, query, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const app = initializeApp({ apiKey: 'AIzaSyCV3E1Yx8QRCtk67FxLE9j56UJtAOZv5hI', authDomain: 'b-and-e-homeservices.firebaseapp.com', projectId: 'b-and-e-homeservices', storageBucket: 'b-and-e-homeservices.firebasestorage.app', messagingSenderId: '684500409058', appId: '1:684500409058:web:87ea0ba53810de570b5cbb' });
const auth = getAuth(app);
const database = getFirestore(app);
const form = document.querySelector('#workerLoginForm');
const status = document.querySelector('#workerStatus');
const jobs = document.querySelector('#workerJobs');
const signOutButton = document.querySelector('#workerSignOut');

function message(text) { status.textContent = text; }
function values() { return { email: form.elements.email.value.trim(), password: form.elements.password.value }; }

async function loadJobs() {
  jobs.innerHTML = '<p>Loading jobs…</p>';
  try {
    const result = await getDocs(query(collection(database, 'quoteRequests'), orderBy('createdAt', 'desc')));
    if (result.empty) { jobs.innerHTML = '<p>No jobs are waiting right now.</p>'; return; }
    jobs.replaceChildren(...result.docs.map((jobDoc) => {
      const job = jobDoc.data();
      const card = document.createElement('article');
      card.className = 'worker-job';
      const title = document.createElement('h2'); title.textContent = `${job.service || 'Service'} · ${job.customerName || 'Customer'}`;
      const details = document.createElement('p'); details.textContent = `Status: ${job.status || 'New'} · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`;
      const location = document.createElement('p'); location.textContent = `Location: ${job.serviceArea || 'Ask owner for location'}`;
      const notes = document.createElement('p'); notes.textContent = job.details || 'No job notes provided.';
      const actions = document.createElement('div'); actions.className = 'worker-actions';
      if (job.serviceArea) { const maps = document.createElement('a'); maps.className = 'reset-button'; maps.target = '_blank'; maps.rel = 'noopener'; maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.serviceArea)}`; maps.textContent = 'Open in maps'; actions.append(maps); }
      const complete = document.createElement('button'); complete.className = 'button button-small'; complete.type = 'button'; complete.textContent = job.status === 'Completed' ? 'Completed' : 'Mark completed'; complete.disabled = job.status === 'Completed';
      complete.addEventListener('click', async () => { try { await updateDoc(jobDoc.ref, { status: 'Completed' }); complete.textContent = 'Completed'; complete.disabled = true; details.textContent = `Status: Completed · Requested: ${job.bookingDate || 'Date to be confirmed'} ${job.bookingWindow || ''}`; } catch { message('We could not update that job. Please try again.'); } });
      actions.append(complete); card.append(title, details, location, notes, actions); return card;
    }));
  } catch { jobs.innerHTML = '<p>Your account is not approved for job access yet. Ask the owner to add your exact email under Worker access in Admin Controls.</p>'; }
}

async function finishSignIn() { message('Signed in. Loading jobs…'); signOutButton.hidden = false; await loadJobs(); }
form.addEventListener('submit', async (event) => { event.preventDefault(); const { email, password } = values(); try { await signInWithEmailAndPassword(auth, email, password); await finishSignIn(); } catch { message('Sign-in did not work. Check your email and password, or create your worker account.'); } });
document.querySelector('#createWorkerAccount').addEventListener('click', async () => { const { email, password } = values(); if (!email || password.length < 6) { message('Enter your approved email and choose a password with at least 6 characters.'); return; } try { await createUserWithEmailAndPassword(auth, email, password); await finishSignIn(); } catch (error) { if (error.code === 'auth/email-already-in-use') message('An account already exists. Use Sign in, or send a password reset link.'); else message('We could not create the account yet. Ask the owner to confirm your email is approved.'); } });
document.querySelector('#resetWorkerPassword').addEventListener('click', async () => { const { email } = values(); if (!email) { message('Enter your email first.'); return; } try { await sendPasswordResetEmail(auth, email); message('Reset link sent. Check your email and spam folder.'); } catch { message('We could not send that link yet. Double-check your email.'); } });
signOutButton.addEventListener('click', async () => { await signOut(auth); signOutButton.hidden = true; jobs.innerHTML = '<p>Sign in to view assigned B & E jobs.</p>'; message('Signed out.'); });
