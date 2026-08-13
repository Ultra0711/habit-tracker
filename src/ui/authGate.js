import { signUp, signInWithPassword, signOut, onAuthChange, getSession, resetPasswordForEmail, updatePassword } from '../lib/auth.js';
import { supabaseConfigured } from '../lib/supabaseClient.js';

/**
 * Gates the app behind a signed-in Supabase session (email + password auth).
 * Calls onSignedIn(session) whenever a normal session becomes available (initial
 * load, after sign-up, or after login), and onSignedOut() when there is none.
 *
 * Also handles the password-recovery flow: clicking a reset-password email link
 * signs the user into a temporary recovery session (Supabase fires a
 * PASSWORD_RECOVERY auth event for it) — that case is intercepted here and shown
 * a "set new password" form instead of being treated as a normal login, so a
 * forgotten password doesn't silently leave the old password in place.
 */
export function initAuthGate({ onSignedIn, onSignedOut }) {
  const gate = document.getElementById('authGate');
  const appContainer = document.getElementById('appContainer');
  const fab = document.getElementById('fabAdd');
  const userEmailLabel = document.getElementById('userEmailLabel');
  const signOutBtn = document.getElementById('signOutBtn');

  const loginCard = document.getElementById('authGate').querySelector('.auth-gate-card');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const signUpBtn = document.getElementById('authSignUpBtn');
  const loginBtn = document.getElementById('authLoginBtn');
  const status = document.getElementById('authStatus');
  const message = document.getElementById('authGateMessage');
  const forgotLink = document.getElementById('forgotPasswordLink');

  const resetRequestCard = document.getElementById('resetRequestCard');
  const resetRequestForm = document.getElementById('resetRequestForm');
  const resetEmailInput = document.getElementById('resetEmail');
  const resetRequestBtn = document.getElementById('resetRequestBtn');
  const resetRequestStatus = document.getElementById('resetRequestStatus');
  const resetCancelBtn = document.getElementById('resetCancelBtn');

  const resetConfirmCard = document.getElementById('resetConfirmCard');
  const resetConfirmForm = document.getElementById('resetConfirmForm');
  const newPasswordInput = document.getElementById('newPassword');
  const resetConfirmBtn = document.getElementById('resetConfirmBtn');
  const resetConfirmStatus = document.getElementById('resetConfirmStatus');

  if (!supabaseConfigured) {
    message.textContent = 'Supabase is not configured. Copy .env.example to .env.local, add your project URL/anon key, and restart the dev server.';
    form.style.display = 'none';
    return;
  }

  // Masks an email for display, e.g. "usmanabdulwasiu9@gmail.com" -> "usm*******9@gmail.com":
  // first 3 chars and last char of the local part are shown, the rest starred out.
  function maskEmail(email) {
    const at = email.indexOf('@');
    if (at <= 4) return email; // too short to usefully mask — show as-is
    const local = email.slice(0, at);
    const domain = email.slice(at);
    const visibleStart = local.slice(0, 3);
    const visibleEnd = local.slice(-1);
    const stars = '*'.repeat(Math.max(1, local.length - 4));
    return `${visibleStart}${stars}${visibleEnd}${domain}`;
  }

  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const showing = target.type === 'text';
      target.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? '&#128065;' : '&#128584;';
      btn.title = showing ? 'Show password' : 'Hide password';
    });
  });

  // Once a PASSWORD_RECOVERY event lands, stay on the "set new password" panel
  // regardless of any later SIGNED_IN events for the same (already-active)
  // recovery session — Supabase's client can emit SIGNED_IN again after
  // PASSWORD_RECOVERY (e.g. on an internal token refresh), and without this
  // guard that would silently bounce the user into the main app with their old
  // password still in place.
  let inRecovery = false;

  function showPanel(panel) {
    loginCard.style.display = panel === 'login' ? '' : 'none';
    resetRequestCard.style.display = panel === 'resetRequest' ? '' : 'none';
    resetConfirmCard.style.display = panel === 'resetConfirm' ? '' : 'none';
  }

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = 'form-hint' + (kind ? ' ' + kind : '');
  }

  function setBusy(busy) {
    signUpBtn.disabled = busy;
    loginBtn.disabled = busy;
  }

  // Both buttons submit the same email/password form; which one was clicked
  // decides sign-up vs. log-in.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    const isSignUp = e.submitter === signUpBtn;
    setBusy(true);
    setStatus(status, isSignUp ? 'Creating account…' : 'Logging in…');
    try {
      if (isSignUp) {
        const data = await signUp(email, password);
        if (data.session) {
          setStatus(status, 'Account created — you\'re signed in.', 'success');
        } else {
          setStatus(status, 'Account created. Check your email to confirm before logging in.', 'success');
        }
      } else {
        await signInWithPassword(email, password);
      }
    } catch (err) {
      setStatus(status, err.message || 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  });

  forgotLink.addEventListener('click', () => {
    resetEmailInput.value = emailInput.value.trim();
    setStatus(resetRequestStatus, '');
    showPanel('resetRequest');
  });

  resetCancelBtn.addEventListener('click', () => showPanel('login'));

  resetRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();
    if (!email) return;
    resetRequestBtn.disabled = true;
    setStatus(resetRequestStatus, 'Sending reset link…');
    try {
      await resetPasswordForEmail(email);
      setStatus(resetRequestStatus, `Reset link sent to ${email}. Check your inbox.`, 'success');
    } catch (err) {
      setStatus(resetRequestStatus, err.message || 'Failed to send reset link.', 'error');
    } finally {
      resetRequestBtn.disabled = false;
    }
  });

  resetConfirmForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = newPasswordInput.value;
    if (!newPassword) return;
    resetConfirmBtn.disabled = true;
    setStatus(resetConfirmStatus, 'Updating password…');
    try {
      await updatePassword(newPassword);
      inRecovery = false;
      setStatus(resetConfirmStatus, 'Password updated. You\'re signed in.', 'success');
      newPasswordInput.value = '';
      // Re-run the current session through the normal auth branch now that
      // recovery mode is over, so the app loads without waiting for the next
      // unrelated auth event.
      const session = await getSession();
      applyAuthState(session, session ? 'SIGNED_IN' : 'SIGNED_OUT');
    } catch (err) {
      setStatus(resetConfirmStatus, err.message || 'Failed to update password.', 'error');
    } finally {
      resetConfirmBtn.disabled = false;
    }
  });

  signOutBtn.addEventListener('click', async () => {
    signOutBtn.disabled = true;
    try {
      await signOut();
    } finally {
      signOutBtn.disabled = false;
    }
  });

  function applyAuthState(session, event) {
    if (event === 'PASSWORD_RECOVERY') {
      inRecovery = true;
    }

    if (inRecovery) {
      gate.style.display = '';
      appContainer.style.display = 'none';
      fab.style.display = 'none';
      userEmailLabel.style.display = 'none';
      signOutBtn.style.display = 'none';
      showPanel('resetConfirm');
      return;
    }

    if (session && session.user) {
      gate.style.display = 'none';
      appContainer.style.display = '';
      fab.style.display = '';
      userEmailLabel.style.display = '';
      userEmailLabel.textContent = session.user.email ? maskEmail(session.user.email) : '';
      userEmailLabel.title = session.user.email || '';
      signOutBtn.style.display = '';
      onSignedIn(session);
    } else {
      gate.style.display = '';
      appContainer.style.display = 'none';
      fab.style.display = 'none';
      userEmailLabel.style.display = 'none';
      signOutBtn.style.display = 'none';
      passwordInput.value = '';
      showPanel('login');
      setStatus(status, '');
      onSignedOut();
    }
  }

  onAuthChange(applyAuthState);
}
