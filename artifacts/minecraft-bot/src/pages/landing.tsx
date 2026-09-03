import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Cable, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';

function Landing() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setIsSignedIn(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const dashboardHref = isSignedIn ? '/dashboard' : '/signin';

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="brand-lockup landing-brand" aria-label="MineWeb home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span>
            <span className="brand-name">MINE<span>WEB</span></span>
            <span className="brand-subtitle">BOT OPERATIONS</span>
          </span>
        </Link>
        <nav className="landing-actions" aria-label="Main navigation">
          {!isSignedIn && <Link href="/signin" className="text-link">Sign in</Link>}
          <Link href={dashboardHref} className="landing-nav-button">Open dashboard <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy reveal">
          <p className="overline"><span className="overline-line" /> MINECRAFT CONTROL PLANE</p>
          <h1>Keep every bot<br /><em>in formation.</em></h1>
          <p className="landing-description">A focused command center for connecting, observing, and operating your Minecraft bots without losing the signal.</p>
          <div className="hero-actions">
            {!isSignedIn && <Link href="/signin" className="primary-button hero-button">Sign in to MineWeb <ArrowRight size={16} /></Link>}
            <Link href={dashboardHref} className="secondary-button hero-button">View dashboard</Link>
          </div>
        </div>

        <div className="landing-console reveal delay-2" aria-label="MineWeb dashboard preview">
          <div className="console-window-bar"><span /><span /><span /><strong>mineweb / command-center</strong><span className="window-status">LIVE</span></div>
          <div className="console-window-body">
            <div className="console-kicker"><Bot size={15} /> ACTIVE WORKSPACE</div>
            <div className="console-metric"><strong>01</strong><span>connected bot</span><i /></div>
            <div className="console-line"><span>SERVER TARGET</span><b>play.mineweb.network:25565</b></div>
            <div className="console-line"><span>SESSION STATE</span><b className="mint-text">ONLINE / STABLE</b></div>
            <div className="console-wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          </div>
        </div>
      </section>

      <section className="landing-features" aria-label="Platform capabilities">
        <div><Cable size={18} /><strong>Direct control</strong><span>Connect to a target and send commands from one calm surface.</span></div>
        <div><ShieldCheck size={18} /><strong>Account-aware</strong><span>Keep bot identities organized and ready for the next session.</span></div>
        <div><Sparkles size={18} /><strong>Live telemetry</strong><span>See the signal, logs, and player state as the world changes.</span></div>
      </section>
    </main>
  );
}

export default Landing;
