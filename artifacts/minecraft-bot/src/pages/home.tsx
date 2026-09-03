import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BotAccountInputAuth,
  BotConnectInputAuth,
  getGetBotAccountsQueryKey,
  getGetBotLogsQueryKey,
  getGetBotPlayersQueryKey,
  getGetBotStatusQueryKey,
  useConnectBot,
  useCreateBotAccount,
  useDeleteBotAccount,
  useDisconnectBot,
  useGetBotAccounts,
  useGetBotLogs,
  useGetBotPlayers,
  useGetBotStatus,
  useRunBotCommand,
  useSendBotChat,
  type BotAccount,
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
  Compass,
  ExternalLink,
  Gamepad2,
  HeartPulse,
  Layers3,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  Unplug,
  Users,
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

function SectionLabel({ icon: Icon, eyebrow, title }: { icon: typeof Activity; eyebrow?: string; title: string }) {
  return (
    <div className="section-heading">
      <div className="section-icon"><Icon size={15} strokeWidth={2.2} /></div>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
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
  const accountsQuery = useGetBotAccounts({
    query: {
      queryKey: getGetBotAccountsQueryKey(),
      refetchInterval: 5000,
    },
  });
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
  const createAccount = useCreateBotAccount();
  const deleteAccount = useDeleteBotAccount();
  const disconnectBot = useDisconnectBot();
  const sendChat = useSendBotChat();
  const runCommand = useRunBotCommand();

  const status = statusQuery.data;
  const logs = logsQuery.data;
  const state: ConnectionState = status?.state ?? 'offline';
  const currentState = stateCopy[state];
  const playersQuery = useGetBotPlayers({
    query: {
      queryKey: getGetBotPlayersQueryKey(),
      refetchInterval: 7000,
      enabled: state === 'online',
    },
  });

  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('25565');
  const [version, setVersion] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountAuth, setAccountAuth] = useState<BotAccountInputAuth>(BotAccountInputAuth.offline);
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [cachedAccounts, setCachedAccounts] = useState<BotAccount[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [command, setCommand] = useState('');
  const [copied, setCopied] = useState(false);
  const initializedFromStatus = useRef(false);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem('minecraft-console:accounts');
      const selected = window.localStorage.getItem('minecraft-console:selected-account');
      if (cached) {
        const parsed = JSON.parse(cached) as BotAccount[];
        if (Array.isArray(parsed)) setCachedAccounts(parsed);
      }
      if (selected) setSelectedAccountId(selected);
    } catch {
      // Local storage is an enhancement; the server remains the source of truth.
    }
  }, []);

  useEffect(() => {
    if (!Array.isArray(accountsQuery.data)) return;
    setCachedAccounts(accountsQuery.data);
    try {
      window.localStorage.setItem('minecraft-console:accounts', JSON.stringify(accountsQuery.data));
    } catch {
      // Continue using the server-backed list when browser storage is unavailable.
    }
  }, [accountsQuery.data]);

  useEffect(() => {
    try {
      if (selectedAccountId) {
        window.localStorage.setItem('minecraft-console:selected-account', selectedAccountId);
      } else {
        window.localStorage.removeItem('minecraft-console:selected-account');
      }
    } catch {
      // Selection still works for the current session when storage is unavailable.
    }
  }, [selectedAccountId]);

  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : cachedAccounts;

  useEffect(() => {
    if (!status || initializedFromStatus.current) return;
    initializedFromStatus.current = true;
    if (status.host) setHost(status.host);
    if (status.port) setPort(String(status.port));
    if (status.version) setVersion(status.version);
  }, [status]);

  const connectionTarget = useMemo(() => {
    const safeHost = host.trim() || 'unconfigured target';
    return `${safeHost}:${port || '—'}`;
  }, [host, port]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  const invalidateSession = () => {
    void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetBotLogsQueryKey() });
  };

  const connectSelectedAccount = () => {
    if (!selectedAccount) return;
    connectBot.mutate(
      {
        data: {
          host: host.trim(),
          port: Number(port),
          username: selectedAccount.username.trim(),
          version: version.trim() || null,
          auth: selectedAccount.auth,
          accountId: selectedAccount.id,
        },
      },
      { onSuccess: invalidateSession },
    );
  };

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    connectSelectedAccount();
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
  };

  const handleCreateAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accountName = accountUsername.trim();
    if (!accountName) return;
    createAccount.mutate(
      {
        data: {
          label: accountName,
          username: accountName,
          auth: accountAuth,
          ...(accountAuth === BotAccountInputAuth.offline && accountPassword.trim() ? { password: accountPassword.trim() } : {}),
        },
      },
      {
        onSuccess: (account) => {
          void queryClient.invalidateQueries({ queryKey: getGetBotAccountsQueryKey() });
          setSelectedAccountId(account.id);
          setAccountUsername('');
          setAccountPassword('');
        },
      },
    );
  };

  const handleDeleteAccount = (accountId: string, label: string) => {
    if (!window.confirm(`Delete saved identity “${label}”?`)) return;
    deleteAccount.mutate(
      { accountId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetBotAccountsQueryKey() });
          if (selectedAccountId === accountId) {
            setSelectedAccountId('');
          }
        },
      },
    );
  };

  const handleDisconnect = () => {
    disconnectBot.mutate(undefined, { onSuccess: invalidateSession });
  };

  const handleReconnect = () => {
    if (!selectedAccount || isBusy) return;
    if (state === 'offline') {
      connectSelectedAccount();
      return;
    }
    disconnectBot.mutate(undefined, {
      onSuccess: () => {
        invalidateSession();
        connectSelectedAccount();
      },
    });
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

  const handleRunCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    runCommand.mutate(
      { data: { command: value } },
      {
        onSuccess: () => {
          setCommand('');
          invalidateSession();
          void playersQuery.refetch();
        },
      },
    );
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
  const displayLogs = Array.isArray(logs) ? logs.slice(0, 7) : [];

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
          <div className="nav-item" data-testid="nav-activity"><Terminal size={17} /><span>Activity log</span><span className="nav-count">{Array.isArray(logs) ? logs.length : '—'}</span></div>
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
        <div className="content-wrap">
          <div className="page-intro reveal">
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
                  <span className="detail-value" data-testid="text-bot-identity">{status?.username ?? selectedAccount?.username ?? '—'}</span>
            </div>
            <StatusPill state={state} />
          </div>

          <section className="panel accounts-panel reveal delay-2">
            <div className="panel-head">
              <SectionLabel icon={LockKeyhole} title="Account library" />
              <span className="panel-tag" data-testid="text-account-count">{accounts.length} SAVED</span>
            </div>
            <div className="accounts-layout">
              <div className="accounts-list" data-testid="list-accounts">
                {accountsQuery.isLoading && accounts.length === 0 ? (
                  <div className="account-loading" data-testid="loading-accounts">
                    <Skeleton /><Skeleton /><Skeleton />
                  </div>
                ) : accountsQuery.isError && accounts.length === 0 ? (
                  <div className="state-empty state-error accounts-error" role="alert" data-testid="error-accounts">
                    <AlertTriangle size={18} />
                    <strong>Identity library unavailable</strong>
                    <span>{errorText(accountsQuery.error)}</span>
                    <button type="button" onClick={() => void accountsQuery.refetch()} data-testid="button-retry-accounts">Retry library</button>
                  </div>
                ) : accounts.length ? (
                  accounts.map((account) => (
                    <div className={`account-row ${selectedAccountId === account.id ? 'account-row-selected' : ''}`} key={account.id} data-testid={`row-account-${account.id}`}>
                      <button
                        type="button"
                        className="account-select"
                        onClick={() => handleAccountSelect(account.id)}
                        aria-pressed={selectedAccountId === account.id}
                        data-testid={`button-select-account-${account.id}`}
                      >
                        <span className="account-glyph">{account.auth === 'microsoft' ? <Smartphone size={15} /> : <AtSign size={15} />}</span>
                        <span className="account-copy">
                          <span className="account-username" data-testid={`text-account-username-${account.id}`}>{account.username}</span>
                        </span>
                        <span className="account-badge" data-testid={`text-account-auth-${account.id}`}>{account.auth}</span>
                        {selectedAccountId === account.id && <Check size={15} className="account-selected-mark" />}
                      </button>
                      <button
                        type="button"
                        className="account-delete"
                        onClick={() => handleDeleteAccount(account.id, account.label)}
                        disabled={deleteAccount.isPending}
                        aria-label={`Delete ${account.label}`}
                        data-testid={`button-delete-account-${account.id}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="accounts-empty" data-testid="empty-accounts">
                    <LockKeyhole size={18} />
                    <strong>No saved identities yet</strong>
                    <span>Add an account for one-tap connection.</span>
                  </div>
                )}
              </div>
              <form className="account-create" onSubmit={handleCreateAccount}>
                <div className="account-form">
                  <label className="field">
                    <span>MINECRAFT USERNAME</span>
                    <div className="field-wrap"><AtSign size={14} /><input value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} maxLength={120} placeholder="OperatorBot" autoComplete="username" required data-testid="input-account-username" /></div>
                  </label>
                  <label className="field">
                    <span>OFFLINE PASSWORD <i>OPTIONAL</i></span>
                    <div className="field-wrap"><ShieldCheck size={14} /><input type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} maxLength={128} placeholder="Optional server password (AuthMe)" autoComplete="new-password" data-testid="input-account-password" /></div>
                  </label>
                  <div className="account-security-copy" data-testid="text-offline-security">
                    <ShieldCheck size={14} />
                    <span>Stored only as a protected credential for this bot service. Use a dedicated offline password, not a personal password.</span>
                  </div>
                  {createAccount.isError && <div className="inline-error account-form-error" role="alert" data-testid="error-create-account"><AlertTriangle size={14} /> {errorText(createAccount.error)}</div>}
                  <button className="primary-button account-create-submit" type="submit" disabled={createAccount.isPending} data-testid="button-create-account">
                    {createAccount.isPending ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                    {createAccount.isPending ? 'Saving account…' : 'Save account'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="panel config-panel reveal delay-2">
              <div className="panel-head">
                <SectionLabel icon={Settings2} eyebrow="01 / CONNECTION" title="Target setup" />
                <span className="panel-tag">INPUT</span>
              </div>
              <form onSubmit={handleConnect} className="config-form">
                <label className="field">
                  <span>SAVED IDENTITY</span>
                  <div className="select-account-wrap">
                    <select value={selectedAccountId} onChange={(event) => handleAccountSelect(event.target.value)} required data-testid="select-account">
                      <option value="">Select an account</option>
                      {accounts.map((account) => <option value={account.id} key={account.id}>{account.username}</option>)}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                  <span className="field-hint">{selectedAccount ? `${selectedAccount.auth} identity selected for this connection.` : 'Select an account from the library before connecting.'}</span>
                </label>
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
                {connectBot.isError && <div className="inline-error" role="alert" data-testid="error-connect"><AlertTriangle size={15} /> {errorText(connectBot.error)}</div>}
                <div className="form-actions">
                  <button className="primary-button" type="submit" disabled={isBusy || !selectedAccount} data-testid="button-connect">
                    {connectBot.isPending ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
                    {connectBot.isPending ? 'Connecting…' : 'Connect bot'}
                    <ArrowUpRight size={15} className="button-arrow" />
                  </button>
                  <button className="secondary-button" type="button" onClick={handleReconnect} disabled={isBusy || !selectedAccount} data-testid="button-reconnect">
                    <RefreshCw size={15} /> Reconnect
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

          <section className="panel viewer-panel reveal delay-4">
            <div className="panel-head">
              <SectionLabel icon={Gamepad2} eyebrow="03 / WORLD VIEW" title="Prismarine viewer" />
              <div className="viewer-head-actions">
                <span className={`viewer-status ${state === 'online' ? 'viewer-status-live' : ''}`} data-testid="status-viewer"><span /> {state === 'online' ? 'LIVE FEED' : 'WAITING FOR BOT'}</span>
                {state === 'online' && <a className="text-button" href="/api/viewer/" target="_blank" rel="noreferrer" data-testid="link-open-viewer"><ExternalLink size={14} /> Open</a>}
              </div>
            </div>
            <div className="viewer-note" data-testid="text-viewer-mobile-note"><Smartphone size={14} /> Mobile render profile active: the server adapts viewport density and controls for smaller screens.</div>
            <div className="viewer-shell">
              {state === 'online' ? (
                <iframe className="viewer-frame" src="/api/viewer/" title="Live Minecraft world viewer" data-testid="iframe-viewer" />
              ) : (
                <div className="viewer-empty">
                  <div className="viewer-empty-icon"><Gamepad2 size={22} /></div>
                  <strong>World view is on standby</strong>
                  <span>Connect the bot to stream its nearby terrain and position here.</span>
                </div>
              )}
            </div>
          </section>

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
              <div className="command-divider" />
              <div className="command-heading">
                <div>
                  <span className="readout-label"><Compass size={14} /> LOCAL COMMANDS</span>
                  <p>Run movement and utility commands from your script.</p>
                </div>
                <span className="panel-tag">SAFE SET</span>
              </div>
              {runCommand.isError && <div className="inline-error" role="alert" data-testid="error-command"><AlertTriangle size={15} /> {errorText(runCommand.error)}</div>}
              <form className="command-form" onSubmit={handleRunCommand}>
                <div className="command-input-wrap">
                  <Command size={15} />
                  <input value={command} onChange={(event) => setCommand(event.target.value.slice(0, 256))} placeholder="!goto 120 64 -30" maxLength={256} disabled={state !== 'online' || runCommand.isPending} data-testid="input-command" />
                </div>
                <button className="send-button command-submit" type="submit" disabled={!command.trim() || state !== 'online' || runCommand.isPending} data-testid="button-run-command">
                  {runCommand.isPending ? <RefreshCw size={15} className="spin" /> : <Zap size={15} />}
                  {runCommand.isPending ? 'Running…' : 'Run'}
                </button>
              </form>
              <div className="quick-commands">
                {['!serverlist', '!help'].map((quickCommand) => (
                  <button key={quickCommand} type="button" onClick={() => setCommand(quickCommand)} disabled={state !== 'online'} data-testid={`button-quick-command-${quickCommand.slice(1)}`}>{quickCommand}</button>
                ))}
              </div>
              <div className="players-strip">
                <div className="players-strip-heading"><span className="readout-label"><Users size={14} /> VISIBLE PLAYERS</span><span>{playersQuery.isFetching ? 'syncing' : `${Array.isArray(playersQuery.data) ? playersQuery.data.length : 0} online`}</span></div>
                {state !== 'online' ? <span className="players-empty">Connect to synchronize the lobby.</span> : playersQuery.isLoading ? <span className="players-empty">Reading player map…</span> : Array.isArray(playersQuery.data) && playersQuery.data.length ? <div className="player-chips">{playersQuery.data.slice(0, 8).map((player) => <span key={player.username}>{player.username}</span>)}</div> : <span className="players-empty">No players synchronized yet.</span>}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;