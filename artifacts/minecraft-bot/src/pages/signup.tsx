import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, LogOut, Mail } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';

function SignUp() {
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
    const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
    setIsPending(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setPassword('');
    if (data.session) {
      setMessage('Account created successfully. Your dashboard is ready when you are.');
    } else {
      setMessage('Account created. Check your email to confirm your address, then sign in.');
    }
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
          <p className="overline"><span className="overline-line" /> START YOUR WORKSPACE</p>
          <h1>Build your<br /><em>next session.</em></h1>
          <p>Create a MineWeb account to keep your bot identities and live operations in one focused workspace.</p>
          <div className="auth-note"><CheckCircle2 size={17} /><span>Your account is secured by Supabase authentication.</span></div>
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
              <div className="auth-switch" aria-label="Authentication pages"><span>Already have an account?</span><Link href="/signin">Sign in</Link></div>
              <div className="signin-heading"><div className="auth-icon"><LockKeyhole size={20} /></div><p className="eyebrow">MINEWEB ACCOUNT</p><h2>Create account</h2><p className="signin-copy">Set up your email and password to get started.</p></div>
              <label className="signin-field"><span>Email address</span><div className="signin-input"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></div></label>
              <label className="signin-field"><span>Password</span><div className="signin-input"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" autoComplete="new-password" minLength={6} required /></div></label>
              {error && <p className="signin-error" role="alert">{error}</p>}
              {message && <p className="signin-message" role="status">{message}</p>}
              <button type="submit" className="primary-button signin-submit" disabled={isPending}>{isPending ? 'Creating account...' : 'Create account'} <ArrowRight size={15} /></button>
              <p className="signin-footnote">Use at least 6 characters for your password.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default SignUp;
