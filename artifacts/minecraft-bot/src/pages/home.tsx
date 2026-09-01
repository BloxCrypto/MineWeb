import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BotConnectInputAuth,
  getGetBotLogsQueryKey,
  getGetBotStatusQueryKey,
  useConnectBot,
  useDisconnectBot,
  useGetBotLogs,
  useGetBotStatus,
  useSendBotChat,
} from '@workspace/api-client-react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  AtSign,
  Cable,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  Cpu,
  Crosshair,
  ExternalLink,
  Gamepad2,
  HeartPulse,
  Layers3,
  MessageSquare,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  Unplug,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

type ConnectionState = 'offline' | 'connecting' | 'online' | 'error';

const stateCopy: Record<ConnectionState, { label: string; detail: string; color: string }> = {
  offline: { label: 'Offline', detail: 'Ready to connect', color: 'slate' },
  connecting: { label: 'Connecting', detail: 'Negotiating session', color: 'amber' },
  online: { label: 'Online', detail: 'Live on server', color: 'mint' },
  error: { label: 'Connection error', detail: 'Check target details', color: 'red' },
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const relativeTime = (value?: string | null) => {
  if (!value) return 'No signal yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
};

const errorText = (error: unknown) => {
  if (!error) return '';
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  if (error instanceof Error) return error.message;
  return 'The server rejected the request.';
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function SectionLabel({ icon: Icon, eyebrow, title }: { icon: typeof Activity; eyebrow: string; title: string }) {
  return (
    <div className="section-heading">
      <div className="section-icon"><Icon size={15} strokeWidth={2.2} /></div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: ConnectionState }) {
  const copy = stateCopy[state];
  return (
    <span className={`status-pill status-${copy.color}`} data-testid="status-connection">
      <span className="status-dot" />
      {copy.label}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function Home() {
  const queryClient = useQueryClient();
  const statusQuery = useGetBotStatus({
    query: {
      queryKey: getGetBotStatusQueryKey(),
      refetchInterval: 4000,
    },
  });
  const logsQuery = useGetBotLogs({
    query: {
      queryKey: getGetBotLogsQueryKey(),
      refetchInterval: 6000,
    },
  });
  const connectBot = useConnectBot();
  const disconnectBot = useDisconnectBot();
  const sendChat = useSendBotChat();

  const status = statusQuery.data;
  const logs = logsQuery.data;
  const state: ConnectionState = status?.state ?? 'offline';
  const currentState = stateCopy[state];

  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('25565');
  const [username, setUsername] = useState('OperatorBot');
  const [version, setVersion] = useState('');
  const [auth, setAuth] = useState<BotConnectInputAuth>(BotConnectInputAuth.offline);
  const [chatMessage, setChatMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const initializedFromStatus = useRef(false);

  useEffect(() => {
    if (!status || initializedFromStatus.current) return;
    initializedFromStatus.current = true;
    if (status.host) setHost(status.host);
    if (status.port) setPort(String(status.port));
    if (status.username) setUsername(status.username);
    if (status.version) setVersion(status.version);
  }, [status]);

  const connectionTarget = useMemo(() => {
    const safeHost = host.trim() || 'unconfigured target';
    return `${safeHost}:${port || '—'}`;
  }, [host, port]);

  const invalidateSession = () => {
    void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetBotLogsQueryKey() });
  };

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    connectBot.mutate(
      {
        data: {
          host: host.trim(),
          port: Number(port),
          username: username.trim(),
          version: version.trim() || null,
          auth,
        },
      },
      { onSuccess: invalidateSession },
    );
  };

  const handleDisconnect = () => {
    disconnectBot.mutate(undefined, { onSuccess: invalidateSession });
  };

  const handleSendChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message) return;
    sendChat.mutate({ data: { message } }, {
      onSuccess: () => {
        setChatMessage('');
        invalidateSession();
      },
    });
  };

  const copyTarget = async () => {
    try {
      await navigator.clipboard.writeText(connectionTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const isBusy = connectBot.isPending || disconnectBot.isPending;
  const displayLogs = logs?.slice(0, 7) ?? [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <div className="brand-name">redstone<span>/</span>deck</div>
            <div className="brand-subtitle">Mineflayer command console</div>
          </div>
        </div>

        <div className="side-rule" />
        <div className="workspace-label"><span>ACTIVE WORKSPACE</span><MoreHorizontal size={15} /></div>
        <div className="workspace-card">
          <div className="workspace-avatar"><Gamepad2 size={16} /></div>
          <div className="min-w-0">
            <div className="workspace-name">survival / primary</div>
            <div className="workspace-target">{connectionTarget}</div>
          </div>
          <span className={`tiny-signal signal-${currentState.color}`} />
        </div>

        <nav className="side-nav" aria-label="Console sections">
          <div className="nav-item nav-item-active" data-testid="nav-overview"><Activity size={17} /><span>Overview</span><span className="nav-key">01</span></div>
          <div className="nav-item" data-testid="nav-activity"><Terminal size={17} /><span>Activity log</span><span className="nav-count">{logs?.length ?? '—'}</span></div>
          <div className="nav-item" data-testid="nav-target"><Server size={17} /><span>Target config</span></div>
        </nav>

        <div className="sidebar-bottom">
          <div className="status-mini">
            <div className={`mini-pulse pulse-${currentState.color}`}><Radio size={15} /></div>
            <div>
              <div className="mini-title">SESSION LINK</div>
              <div className="mini-value" data-testid="text-sidebar-state">{currentState.detail}</div>
            </div>
          </div>
          <div className="side-footer">
            <span>RD / 0.8.4</span>
            <span className="live-indicator"><span /> polling live</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="crumbs"><span>CONTROL ROOM</span><ChevronDown size={13} /><strong>BOT OVERVIEW</strong></div>
          <div className="topbar-actions">
            <span className="polling-label"><span className="polling-dot" /> auto-refresh 4s</span>
            <button className="icon-button" type="button" onClick={() => void statusQuery.refetch()} aria-label="Refresh status" data-testid="button-refresh-status"><RefreshCw size={16} className={statusQuery.isFetching ? 'spin' : ''} /></button>
            <button className="avatar-button" type="button" aria-label="Operator menu" data-testid="button-operator-menu">OP</button>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-intro reveal">
            <div>
              <div className="overline"><span className="overline-line" /> LIVE BOT SESSION</div>
              <h1>Command your<br /><em>world.</em></h1>
              <p className="intro-copy">Keep one eye on the wire. Send the next instruction from here.</p>
            </div>
            <div className="intro-meta">
              <div className="meta-label">LAST TELEMETRY</div>
              <div className="meta-time" data-testid="text-last-updated">{statusQuery.isLoading ? '—' : relativeTime(status?.updatedAt)}</div>
              <div className="meta-date">{status?.updatedAt ? formatTimestamp(status.updatedAt) : 'Awaiting bot signal'}</div>
            </div>
          </div>

          <div className="status-banner reveal delay-1">
            <div className={`banner-state banner-${currentState.color}`}>
              <div className="large-signal"><span /></div>
              <div>
                <div className="banner-eyebrow">CONNECTION STATE</div>
                <div className="banner-title" data-testid="text-connection-state">{currentState.label}</div>
              </div>
            </div>
            <div className="banner-detail">
              <span className="detail-kicker">TARGET</span>
              <span className="detail-value" data-testid="text-target">{status?.host ? `${status.host}:${status.port ?? '—'}` : connectionTarget}</span>
            </div>
            <div className="banner-detail">
              <span className="detail-kicker">BOT IDENTITY</span>
              <span className="detail-value" data-testid="text-bot-identity">{status?.username ?? username}</span>
            </div>
            <StatusPill state={state} />
          </div>

          <div className="dashboard-grid">
            <section className="panel config-panel reveal delay-2">
              <div className="panel-head">
                <SectionLabel icon={Settings2} eyebrow="01 / CONNECTION" title="Target setup" />
                <span className="panel-tag">INPUT</span>
              </div>
              <form onSubmit={handleConnect} className="config-form">
                <label className="field">
                  <span>SERVER ADDRESS</span>
                  <div className="field-wrap"><Server size={15} /><input value={host} onChange={(event) => setHost(event.target.value)} placeholder="play.example.net" data-testid="input-host" required /></div>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>PORT</span>
                    <div className="field-wrap"><Cable size={15} /><input type="number" min="1" max="65535" value={port} onChange={(event) => setPort(event.target.value)} data-testid="input-port" required /></div>
                  </label>
                  <label className="field">
                    <span>VERSION <i>OPTIONAL</i></span>
                    <div className="field-wrap"><Layers3 size={15} /><input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="auto-detect" data-testid="input-version" /></div>
                  </label>
                </div>
                <label className="field">
                  <span>BOT USERNAME</span>
                  <div className="field-wrap"><AtSign size={15} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="OperatorBot" data-testid="input-username" required /></div>
                </label>
                <div className="auth-row">
                  <div>
                    <span className="field-label">AUTH MODE</span>
                    <div className="auth-options">
                      <button type="button" className={`auth-option ${auth === BotConnectInputAuth.offline ? 'auth-selected' : ''}`} onClick={() => setAuth(BotConnectInputAuth.offline)} data-testid="button-auth-offline"><span className="auth-radio" /> Offline</button>
                      <button type="button" className={`auth-option ${auth === BotConnectInputAuth.microsoft ? 'auth-selected' : ''}`} onClick={() => setAuth(BotConnectInputAuth.microsoft)} data-testid="button-auth-microsoft"><span className="auth-radio" /> Microsoft</button>
                    </div>
                  </div>
                  <button type="button" className="help-button" aria-label="About authentication modes" data-testid="button-auth-help"><CircleHelp size={16} /></button>
                </div>
                {connectBot.isError && <div className="inline-error" role="alert" data-testid="error-connect"><AlertTriangle size={15} /> {errorText(connectBot.error)}</div>}
                <div className="form-actions">
                  <button className="primary-button" type="submit" disabled={isBusy} data-testid="button-connect">
                    {connectBot.isPending ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
                    {connectBot.isPending ? 'Connecting…' : 'Connect bot'}
                    <ArrowUpRight size={15} className="button-arrow" />
                  </button>
                  <button className="secondary-button" type="button" onClick={handleDisconnect} disabled={isBusy || state === 'offline'} data-testid="button-disconnect">
                    <Unplug size={15} /> Disconnect
                  </button>
                </div>
              </form>
            </section>

            <section className="panel telemetry-panel reveal delay-3">
              <div className="panel-head">
                <SectionLabel icon={Crosshair} eyebrow="02 / TELEMETRY" title="Live readout" />
                <div className="telemetry-live"><span /> STREAMING</div>
              </div>
              {statusQuery.isLoading ? (
                <div className="telemetry-skeletons"><Skeleton className="h-28" /><div className="skeleton-row"><Skeleton /><Skeleton /></div><Skeleton /></div>
              ) : statusQuery.isError ? (
                <div className="state-empty state-error" data-testid="error-status"><AlertTriangle size={21} /><strong>Telemetry unavailable</strong><span>{errorText(statusQuery.error)}</span><button type="button" onClick={() => void statusQuery.refetch()} data-testid="button-retry-status">Retry readout</button></div>
              ) : (
                <div className="telemetry-content">
                  <div className="health-card">
                    <div className="health-orbit"><HeartPulse size={18} /><div className="health-value" data-testid="text-health">{status?.health == null ? '—' : Math.round(status.health)}</div><div className="health-unit">HP</div></div>
                    <div className="health-copy"><span>VITALS</span><strong>{status?.health == null ? 'No health signal' : status.health > 10 ? 'Stable condition' : 'Low health'}</strong><div className="health-bar"><span style={{ width: `${Math.min(100, Math.max(0, ((status?.health ?? 0) / 20) * 100))}%` }} /></div></div>
                  </div>
                  <div className="telemetry-pair">
                    <div className="readout">
                      <span className="readout-label"><Cpu size={14} /> VERSION</span>
                      <strong data-testid="text-version">{status?.version ?? '—'}</strong>
                      <small>protocol negotiated</small>
                    </div>
                    <div className="readout">
                      <span className="readout-label"><Crosshair size={14} /> POSITION</span>
                      <strong className="position-value" data-testid="text-position">{status?.position ? `${Math.round(status.position.x)}  ${Math.round(status.position.y)}  ${Math.round(status.position.z)}` : '—  —  —'}</strong>
                      <small>X &nbsp;&nbsp; Y &nbsp;&nbsp; Z</small>
                    </div>
                  </div>
                  <div className="last-event">
                    <div className="event-icon"><Activity size={15} /></div>
                    <div><span className="readout-label">LAST EVENT</span><p data-testid="text-last-event">{status?.lastEvent ?? 'No event recorded for this session.'}</p></div>
                    <Clock3 size={14} className="event-clock" />
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel logs-panel reveal delay-4">
              <div className="panel-head">
                <SectionLabel icon={Terminal} eyebrow="03 / EVENT STREAM" title="Recent logs" />
                <button type="button" className="text-button" onClick={() => void logsQuery.refetch()} data-testid="button-refresh-logs"><RefreshCw size={14} /> Refresh</button>
              </div>
              {logsQuery.isLoading ? (
                <div className="log-list">{[1, 2, 3, 4].map((item) => <div className="log-row" key={item}><Skeleton className="log-time-skeleton" /><Skeleton className="log-message-skeleton" /></div>)}</div>
              ) : logsQuery.isError ? (
                <div className="state-empty compact" data-testid="error-logs"><AlertTriangle size={18} /><span>Could not load event stream.</span><button type="button" onClick={() => void logsQuery.refetch()} data-testid="button-retry-logs">Retry</button></div>
              ) : displayLogs.length === 0 ? (
                <div className="state-empty compact" data-testid="empty-logs"><Terminal size={18} /><span>Events will appear after the bot starts talking.</span></div>
              ) : (
                <div className="log-list" data-testid="list-logs">
                  {displayLogs.map((log) => (
                    <div className="log-row" key={log.id} data-testid={`row-log-${log.id}`}>
                      <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                      <span className={`log-level level-${log.level}`}>{log.level}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel chat-panel reveal delay-5">
              <div className="panel-head">
                <SectionLabel icon={MessageSquare} eyebrow="04 / OPERATOR INPUT" title="Send chat" />
                <span className="panel-tag">MAX 256</span>
              </div>
              <div className="chat-context"><div className="chat-context-icon"><MessageSquare size={15} /></div><span>Message will be sent as <strong>{status?.username ?? username}</strong></span></div>
              {sendChat.isError && <div className="inline-error" role="alert" data-testid="error-chat"><AlertTriangle size={15} /> {errorText(sendChat.error)}</div>}
              <form className="chat-form" onSubmit={handleSendChat}>
                <textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value.slice(0, 256))} placeholder="Type a server message…" rows={3} maxLength={256} disabled={state !== 'online' || sendChat.isPending} data-testid="input-chat" />
                <div className="chat-form-bottom">
                  <span className="char-count">{chatMessage.length} / 256</span>
                  <button className="send-button" type="submit" disabled={!chatMessage.trim() || state !== 'online' || sendChat.isPending} data-testid="button-send-chat">
                    {sendChat.isPending ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
                    {sendChat.isPending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
              {state !== 'online' && <div className="chat-note"><WifiOff size={13} /> Connect the bot to enable operator chat.</div>}
            </section>
          </div>

          <footer className="content-footer">
            <span><ShieldCheck size={14} /> credentials stay in this session</span>
            <span className="footer-links"><button type="button" data-testid="button-copy-target" onClick={copyTarget}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied target' : 'Copy target'}</button><button type="button" data-testid="button-documentation"><ExternalLink size={13} /> API reference</button></span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default Home;