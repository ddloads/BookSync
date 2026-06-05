import { useState, useMemo, useEffect } from 'react'
import { Activity, Library, LogIn, LogOut, Settings, Terminal, Smartphone, User, Globe, HardDrive, Share2, Search, X, Trash2, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useLogStore } from '../stores/useLogStore'
import { CompanionAppTab } from './CompanionAppTab'

export function SettingsTab() {
  const [subTab, setSubTab] = useState<'accounts' | 'general' | 'integrations' | 'mobile' | 'logs'>('accounts')
  const isWebRuntime = !navigator.userAgent.toLowerCase().includes('electron')
  const [azureLibraries, setAzureLibraries] = useState<Array<{ id: string; name: string; description?: string | null; books?: number; sources?: number }>>([])
  const [azureLibrariesLoading, setAzureLibrariesLoading] = useState(false)
  const [azureLibrariesError, setAzureLibrariesError] = useState<string | null>(null)
  
  const nasPath = useLibraryStore(s => s.nasPath)
  const setNasPath = useLibraryStore(s => s.setNasPath)
  const activationBytes = useLibraryStore(s => s.activationBytes)
  const setActivationBytes = useLibraryStore(s => s.setActivationBytes)
  const azureUrl = useLibraryStore(s => s.azureUrl)
  const setAzureUrl = useLibraryStore(s => s.setAzureUrl)
  const azureUsername = useLibraryStore(s => s.azureUsername)
  const setAzureUsername = useLibraryStore(s => s.setAzureUsername)
  const azurePassword = useLibraryStore(s => s.azurePassword)
  const setAzurePassword = useLibraryStore(s => s.setAzurePassword)
  const azureLibraryId = useLibraryStore(s => s.azureLibraryId)
  const setAzureLibraryId = useLibraryStore(s => s.setAzureLibraryId)
  const exportFormat = useLibraryStore(s => s.exportFormat)
  const setExportFormat = useLibraryStore(s => s.setExportFormat)
  const logLevel = useLibraryStore(s => s.logLevel)
  const setLogLevel = useLibraryStore(s => s.setLogLevel)
  const closeBehavior = useLibraryStore(s => s.closeBehavior)
  const setCloseBehavior = useLibraryStore(s => s.setCloseBehavior)
  const saveSettings = useLibraryStore(s => s.saveSettings)
  const testAzureConnection = useLibraryStore(s => s.testAzureConnection)
  const handleLogin = useLibraryStore(s => s.handleLogin)
  const handleLogout = useLibraryStore(s => s.handleLogout)
  const accounts = useLibraryStore(s => s.accounts)
  const handleDeleteAccount = useLibraryStore(s => s.handleDeleteAccount)

  // --- Log hooks ---
  const logs = useLogStore(s => s.logs)
  const fetchLogs = useLogStore(s => s.fetchLogs)
  const clearLogs = useLogStore(s => s.clearLogs)
  const logsLoading = useLogStore(s => s.isLoading)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'success' | 'error' | 'info'>('all')

  useEffect(() => {
    if (subTab === 'logs') fetchLogs()
  }, [subTab])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = filterType === 'all' || log.type === filterType
      return matchesSearch && matchesType
    })
  }, [logs, searchTerm, filterType])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const tabClass = (active: boolean) => `
    flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all
    ${active ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.05]'}
  `

  const handleFetchAzureLibraries = async () => {
    setAzureLibrariesLoading(true)
    setAzureLibrariesError(null)
    try {
      const result = await window.api.settings.listAzureLibraries(azureUrl, azureUsername, azurePassword)
      if (!result.success) {
        setAzureLibraries([])
        setAzureLibrariesError(result.error || 'Failed to load Azure libraries')
        return
      }
      setAzureLibraries(result.libraries || [])
    } catch (err: any) {
      setAzureLibraries([])
      setAzureLibrariesError(String(err?.message ?? err ?? 'Failed to load Azure libraries'))
    } finally {
      setAzureLibrariesLoading(false)
    }
  }

  return (
    <div className="flex h-full max-w-5xl flex-col p-4 pb-24 md:p-8 lg:p-10">
      <div className="mb-8">
        <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">Settings</h2>
        <p className="text-slate-500 font-bold">Manage your accounts, storage, and integrations.</p>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => setSubTab('accounts')} className={tabClass(subTab === 'accounts')}>
          <User size={14} />
          Accounts
        </button>
        <button onClick={() => setSubTab('general')} className={tabClass(subTab === 'general')}>
          <Settings size={14} />
          General
        </button>
        <button onClick={() => setSubTab('integrations')} className={tabClass(subTab === 'integrations')}>
          <Share2 size={14} />
          Integrations
        </button>
        <button onClick={() => setSubTab('mobile')} className={tabClass(subTab === 'mobile')}>
          <Smartphone size={14} />
          Mobile
        </button>
        <button onClick={() => setSubTab('logs')} className={tabClass(subTab === 'logs')}>
          <Terminal size={14} />
          Logs
        </button>
      </div>

      <div className="-mr-2 flex-1 space-y-8 overflow-y-auto pr-2 md:-mr-4 md:pr-4 scrollbar-thin scrollbar-thumb-slate-800">
        {subTab === 'accounts' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-8 rounded-[2rem] border border-slate-800/60 bg-[#0f172a]/40 p-5 backdrop-blur-xl sm:p-6 md:p-8">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Audible Accounts</h3>
                <p className="text-xs text-slate-500 font-bold">Connect multiple profiles from any Audible marketplace.</p>
              </div>

              {accounts && accounts.length > 0 && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Connected Profiles</label>
                  <div className="grid gap-3">
                    {accounts.map((acc: any) => (
                      <div key={acc.id} className="group flex flex-col gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5 transition-all hover:border-amber-500/20 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-sm border border-amber-500/10">
                            {acc.region.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-black text-white">{acc.name}</div>
                            <div className="text-[10px] text-slate-500 font-bold">Region: {acc.region} • Last sync: {acc.last_sync ? new Date(acc.last_sync).toLocaleString() : 'Never'}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                          title="Remove Account"
                        >
                          <LogOut size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Add New Account</label>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/10 uppercase">
                    Select Region
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {['us', 'uk', 'ca', 'de', 'fr', 'au', 'jp', 'it', 'in', 'es'].map(reg => (
                    <button
                      key={reg}
                      onClick={() => handleLogin(reg)}
                      className="group relative h-14 rounded-2xl bg-white/[0.02] hover:bg-amber-500 text-slate-400 hover:text-black border border-white/[0.05] hover:border-amber-500 text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center overflow-hidden"
                    >
                      <Globe size={14} className="absolute left-3 opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      {reg}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 font-bold leading-relaxed pt-2">
                  Click a region to open the login window. You can add as many accounts as you like, even from the same region.
                </p>
              </div>

              {accounts && accounts.length > 0 && (
                <div className="pt-4 border-t border-slate-800/40">
                  <button
                    onClick={handleLogout}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <LogOut size={16} />
                    Disconnect All Accounts
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {subTab === 'general' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-8 rounded-[2rem] border border-slate-800/60 bg-[#0f172a]/40 p-5 backdrop-blur-xl sm:p-6 md:p-8">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">General Configuration</h3>
                <p className="text-xs text-slate-500 font-bold">Manage storage paths and application behavior.</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">NAS Export Path</label>
                <div className="relative group">
                  <HardDrive className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    type="text"
                    value={nasPath}
                    onChange={e => setNasPath(e.target.value)}
                    placeholder={isWebRuntime ? "/downloads" : "e.g. \\\\SERVER\\Media\\Audiobooks"}
                    className="w-full bg-black/20 border border-slate-800/80 rounded-2xl pl-14 pr-6 py-4 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-600 font-bold ml-1">
                  {isWebRuntime
                    ? 'In Docker, use the container path mapped to your audiobook storage, usually '
                    : 'Audiobooks are organized into folders: '}
                  <span className="text-slate-500">
                    {isWebRuntime ? '/downloads' : 'Author/Series/Title (Year) [ASIN].m4b'}
                  </span>
                </p>
              </div>

              <div className="space-y-4 p-6 rounded-2xl bg-amber-500/[0.03] border border-amber-500/10">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 flex items-center gap-2">
                    <Terminal size={14} />
                    Decryption Key
                  </label>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 border border-amber-500/10 uppercase">
                    Auto-Retrieved
                  </span>
                </div>
                <input
                  type="text"
                  value={activationBytes}
                  onChange={e => setActivationBytes(e.target.value)}
                  placeholder="Automatic (Sync to populate)"
                  className="w-full bg-[#020617]/80 border border-slate-800/80 rounded-xl px-5 py-3.5 text-sm text-amber-400 placeholder-amber-900/40 focus:outline-none focus:border-amber-500/40 transition-all font-mono shadow-inner"
                />
                <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                  Required for DRM-free conversion. This is fetched automatically from your connected accounts during sync.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800/40">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Export Preferences</h4>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Default Format</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { id: 'm4b', label: 'M4B (Lossless Copy)', desc: 'Original AAC stream, fast, chapters supported.' },
                      { id: 'mp3', label: 'MP3 (High Quality VBR)', desc: 'Re-encoded, universal compatibility.' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setExportFormat(f.id as 'm4b' | 'mp3')}
                        className={`flex-1 p-4 rounded-2xl border text-left transition-all ${
                          exportFormat === f.id 
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-lg shadow-amber-500/5' 
                            : 'bg-black/20 border-slate-800/80 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black uppercase tracking-tight mb-1">{f.label}</div>
                        <div className="text-[10px] font-bold opacity-60 leading-relaxed">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800/40">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Logging</h4>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Log Level</label>
                  <select
                    value={logLevel}
                    onChange={e => setLogLevel(e.target.value as 'error' | 'standard' | 'verbose')}
                    className="w-full bg-black/20 border border-slate-800/80 rounded-xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-all appearance-none cursor-pointer"
                  >
                    <option value="error">Errors Only</option>
                    <option value="standard">Standard</option>
                    <option value="verbose">Verbose</option>
                  </select>
                </div>
              </div>

              {!isWebRuntime && (
                <div className="space-y-4 pt-4 border-t border-slate-800/40">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Window Close Behavior</h4>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">When Closing The Window</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { id: 'exit', label: 'Quit App', desc: 'Close BookSync completely when the window is closed.' },
                        { id: 'tray', label: 'Minimize To Tray', desc: 'Hide BookSync near the clock and keep it running in the background.' }
                      ].map(option => (
                        <button
                          key={option.id}
                          onClick={() => setCloseBehavior(option.id as 'exit' | 'tray')}
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            closeBehavior === option.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/5'
                              : 'bg-black/20 border-slate-800/80 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-black uppercase tracking-tight mb-1">{option.label}</div>
                          <div className="text-[10px] font-bold opacity-60 leading-relaxed">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={saveSettings}
                className="w-full bg-white text-black hover:bg-amber-400 font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6 rounded-2xl transition-all duration-500 shadow-xl active:scale-95"
              >
                Save General Settings
              </button>
            </div>
          </section>
        )}

        {subTab === 'integrations' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-8 rounded-[2rem] border border-slate-800/60 bg-[#0f172a]/40 p-5 backdrop-blur-xl sm:p-6 md:p-8">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Azure Server</h3>
                <p className="text-xs text-slate-500 font-bold">Auto-trigger library scans after successful exports.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Server URL</label>
                  <input
                    type="text"
                    value={azureUrl}
                    onChange={e => setAzureUrl(e.target.value)}
                    placeholder="https://azure.yourdomain.com"
                    className="w-full bg-black/20 border border-slate-800/80 rounded-xl px-5 py-4 text-sm text-white placeholder-slate-800 focus:outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Library ID</label>
                  <input
                    type="text"
                    value={azureLibraryId}
                    onChange={e => setAzureLibraryId(e.target.value)}
                    placeholder="e.g. bdc148cb-2880-4ac7-86f5-..."
                    className="w-full bg-black/20 border border-slate-800/80 rounded-xl px-5 py-4 text-sm text-white placeholder-slate-800 focus:outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Username</label>
                  <input
                    type="text"
                    value={azureUsername}
                    onChange={e => setAzureUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="off"
                    className="w-full bg-black/20 border border-slate-800/80 rounded-xl px-5 py-4 text-sm text-white placeholder-slate-800 focus:outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Password</label>
                  <input
                    type="password"
                    value={azurePassword}
                    onChange={e => setAzurePassword(e.target.value)}
                    placeholder="Azure account password"
                    autoComplete="new-password"
                    className="w-full bg-black/20 border border-slate-800/80 rounded-xl px-5 py-4 text-sm text-white placeholder-slate-800 focus:outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>
              </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <button
                    onClick={handleFetchAzureLibraries}
                    disabled={!azureUrl || !azureUsername || !azurePassword || azureLibrariesLoading}
                    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-40 disabled:hover:bg-blue-500/10 text-blue-400 border border-blue-500/10 font-black text-[10px] uppercase tracking-widest py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group"
                  >
                    <Library size={14} className={azureLibrariesLoading ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
                    {azureLibrariesLoading ? 'Checking Azure...' : 'Show Available Libraries'}
                  </button>
                  <button
                    onClick={testAzureConnection}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/10 font-black text-[10px] uppercase tracking-widest py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group"
                  >
                  <Activity size={14} className="group-hover:scale-110 transition-transform" />
                  Test Azure Connection
                  </button>
                </div>

                {(azureLibrariesError || azureLibraries.length > 0) && (
                  <div className="space-y-3 rounded-2xl border border-slate-800/60 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available Azure Libraries</h4>
                      {azureLibraries.length > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                          {azureLibraries.length} found
                        </span>
                      )}
                    </div>
                    {azureLibrariesError ? (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
                        {azureLibrariesError}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {azureLibraries.map(library => (
                          <div key={library.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-white">{library.name}</div>
                              <div className="mt-1 break-all font-mono text-[11px] text-slate-500">{library.id}</div>
                              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                {library.books ?? 0} books · {library.sources ?? 0} sources
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAzureLibraryId(library.id)}
                              className="shrink-0 rounded-xl bg-amber-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-amber-400 active:scale-95"
                            >
                              Use This ID
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                onClick={saveSettings}
                className="w-full bg-white text-black hover:bg-amber-400 font-black text-[10px] uppercase tracking-[0.2em] py-5 px-6 rounded-2xl transition-all duration-500 shadow-xl active:scale-95"
              >
                Save Integration Settings
              </button>
            </div>
          </section>
        )}

        {subTab === 'mobile' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[#0f172a]/40 p-5 md:p-8 rounded-[2.5rem] border border-slate-800/60 backdrop-blur-xl">
              <CompanionAppTab />
            </div>
          </section>
        )}

        {subTab === 'logs' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 h-full flex flex-col min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">Activity Logs</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Activity size={12} className="text-amber-500" />
                  {logs.length} Total Events
                </p>
              </div>
              
              <button
                onClick={() => {
                  if (confirm('Clear all persistent logs?')) clearLogs()
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 group w-fit"
              >
                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                Clear Logs
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/20 border border-slate-800/80 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex bg-black/20 border border-slate-800/80 rounded-2xl p-1 w-fit">
                {(['all', 'success', 'error', 'info'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      filterType === type 
                        ? 'bg-white/10 text-white' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[400px] overflow-y-auto bg-[#0f172a]/40 border border-slate-800/60 rounded-[2rem] backdrop-blur-xl scrollbar-thin scrollbar-thumb-slate-800">
              {logsLoading && logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 animate-pulse py-20">
                  <Activity size={40} className="mb-4 text-amber-500" />
                  <p className="text-sm font-black uppercase tracking-widest">Loading Logs...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                  <Activity size={40} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">No matching logs</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/40">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-5 flex gap-5 hover:bg-white/[0.02] transition-colors group">
                      <div className={`mt-1 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                        log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        log.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-500'
                      }`}>
                        {log.type === 'success' ? <CheckCircle2 size={18} /> :
                         log.type === 'error' ? <AlertCircle size={18} /> :
                         <Info size={18} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <h4 className="text-sm font-black text-slate-200 truncate group-hover:text-white transition-colors">{log.title}</h4>
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter shrink-0">{formatDate(log.timestamp)}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold leading-relaxed group-hover:text-slate-400 transition-colors">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
