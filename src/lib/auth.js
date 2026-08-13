import { supabase, supabaseConfigured } from './supabaseClient.js';

/** Create a new account with email + password. */
export async function signUp(email, password) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in an existing account with email + password. */
export async function signInWithPassword(email, password) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sends a password-reset email with a link back to this app. */
export async function resetPasswordForEmail(email) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  if (error) throw error;
}

/** Sets a new password for the currently-active session (used right after the
 *  user follows a password-reset email link, which signs them into a temporary
 *  recovery session). */
export async function updatePassword(newPassword) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  if (!supabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Resolves with the current session (or null if signed out). supabase-js persists
 *  this to localStorage under its own key and restores it automatically on load,
 *  which is what keeps the user signed in across a browser refresh. */
export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** fn(session, event) is called once the initial session check resolves, then on
 *  every subsequent auth change. `event` is Supabase's auth event name (e.g.
 *  'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY') — callers use it to tell a
 *  normal sign-in apart from a password-recovery link, which also produces a
 *  session but should route to a "set new password" form instead of the app.
 *  Only onAuthStateChange drives fn — it fires once immediately with the current
 *  session and again on every future change, so it is the single source of
 *  truth. (A separate getSession() call would race it: both resolve
 *  asynchronously in an unspecified order, so whichever settled last could
 *  stomp the other's result — e.g. briefly showing the signed-in app and then
 *  snapping back to the sign-in gate.) */
export function onAuthChange(fn) {
  if (!supabaseConfigured) {
    fn(null, null);
    return () => {};
  }
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => fn(session, event));
  return () => sub.subscription.unsubscribe();
}
