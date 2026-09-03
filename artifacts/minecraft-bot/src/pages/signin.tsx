import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, LogOut, Mail } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSessionEmail(currentSession?.user.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) {
      setError('Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.');
      return;
    }
    setIsPending(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsPending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage('Signed in successfully. Your dashboard is ready when you are.');
    setPassword('');
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setError('');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else setMessage('You have been signed out.');
  };

  return (
    <main className="auth-page">
      <header className="auth-nav">
        <Link href="/" className="brand-lockup" aria-label="MineWeb home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span><span className="brand-name">MINE<span>WEB</span></span><span className="brand-subtitle">BOT OPERATIONS</span></span>
        </Link>
        <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to home</Link>
      </header>
      <section className="auth-layout">
        <div className="auth-aside reveal">
          <p className="overline"><span className="overline-line" /> SECURE ACCESS</p>
          <h1>Good to have<br /><em>you back.</em></h1>
          <p>Sign in to pick up where your bot sessions left off. Nothing moves you to the dashboard automatically.</p>
          <div className="auth-note"><CheckCircle2 size={17} /><span>Session state is managed securely by Supabase.</span></div>
        </div>
        <div className="signin-panel reveal delay-1">
          {sessionEmail ? (
            <div className="signed-in-state">
              <div className="auth-icon"><CheckCircle2 size={22} /></div>
              <p className="eyebrow">SESSION ACTIVE</p>
              <h2>You are signed in.</h2>
              <p className="signin-copy">{sessionEmail}</p>
              <Link href="/dashboard" className="primary-button signin-submit">Open dashboard <ArrowRight size={15} /></Link>
              <button type="button" className="text-button" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="signin-form">
              <div className="signin-heading"><div className="auth-icon"><LockKeyhole size={20} /></div><p className="eyebrow">MINEWEB ACCOUNT</p><h2>Sign in</h2><p className="signin-copy">Use your email and password to access your workspace.</p></div>
              <label className="signin-field"><span>Email address</span><div className="signin-input"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div></label>
              <label className="signin-field"><span>Password</span><div className="signin-input"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></div></label>
              {error && <p className="signin-error" role="alert">{error}</p>}
              {message && <p className="signin-message" role="status">{message}</p>}
              <button type="submit" className="primary-button signin-submit" disabled={isPending}>{isPending ? 'Signing in...' : 'Sign in'} <ArrowRight size={15} /></button>
              <p className="signin-footnote">Your session stays on this device until you sign out.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default SignIn;
