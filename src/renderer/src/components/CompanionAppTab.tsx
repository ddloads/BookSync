import React, { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Save, Shield, Globe, Copy, Check, Smartphone, Wifi } from 'lucide-react'
import { notifyError, notifySuccess } from '../stores/useNotificationStore'

const DEFAULT_MOBILE_PUBLIC_URL = 'https://booksync.ddsplayground.com'

type MobileConnectionInfo = {
  enabled: boolean
  port: number
  publicUrl?: string
  apiKey: string
  hosts: string[]
  primaryHost: string
  httpUrl: string
  wsUrl: string
  qrPayload: string
}

export function CompanionAppTab() {
  const [enabled, setEnabled] = useState(false)
  const [port, setPort] = useState('3000')
  const [publicUrl, setPublicUrl] = useState(DEFAULT_MOBILE_PUBLIC_URL)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [connectionInfo, setConnectionInfo] = useState<MobileConnectionInfo | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (!connectionInfo?.qrPayload || !enabled) {
      setQrCodeDataUrl('')
      return
    }

    QRCode.toDataURL(connectionInfo.qrPayload, {
      width: 320,
      margin: 1,
      color: {
        dark: '#f8fafc',
        light: '#09090b'
      }
    })
      .then(setQrCodeDataUrl)
      .catch((err: unknown) => {
        console.error('Failed to generate QR code:', err)
        setQrCodeDataUrl('')
      })
  }, [connectionInfo?.qrPayload, enabled])

  const connectionSummary = useMemo(() => {
    if (!connectionInfo) return ''
    let text = `Local: ${connectionInfo.httpUrl}`
    if (connectionInfo.publicUrl) {
      text += `\nRemote: ${connectionInfo.publicUrl}`
    }
    text += `\nAPI Key: ${connectionInfo.apiKey}`
    return text
  }, [connectionInfo])

  const loadSettings = async () => {
    try {
      const [e, p, pub, info] = await Promise.all([
        window.api.settings.get('mobileServerEnabled', 'false'),
        window.api.settings.get('mobileServerPort', '3000'),
        window.api.settings.get('mobileServerPublicUrl', ''),
        window.api.settings.getMobileConnectionInfo()
      ])

      setEnabled(e === 'true')
      setPort(p)
      setPublicUrl(pub || DEFAULT_MOBILE_PUBLIC_URL)
      setApiKey(info.apiKey)
      setConnectionInfo(info)
    } catch (err) {
      console.error('Failed to load mobile server settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      await window.api.settings.set('mobileServerEnabled', String(enabled))
      await window.api.settings.set('mobileServerPort', port)
      await window.api.settings.set('mobileServerPublicUrl', (publicUrl.trim() || DEFAULT_MOBILE_PUBLIC_URL).replace(/\/+$/, ''))
      await window.api.settings.restartServer()

      const info = await window.api.settings.getMobileConnectionInfo()
      setApiKey(info.apiKey)
      setConnectionInfo(info)

      notifySuccess('Companion API settings saved')
    } catch (err: any) {
      notifyError(`Failed to save settings: ${err.message}`)
    }
  }

  const copyValue = (value: string, successMessage: string) => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    notifySuccess(successMessage)
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-blue-400 mt-1" />
          <div>
            <h3 className="text-sm font-medium text-zinc-200">Mobile Companion Server</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Enable this to allow the BookSync Mobile app to connect to this desktop instance.
              After saving, scan the QR code from the mobile app to import the connection details and API key.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-zinc-300">{enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Server Port
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="3000"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
          <p className="text-[10px] text-zinc-500 italic">
            Default is 3000. Save to restart the mobile server on the new port.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-3 h-3" />
            API Key
          </label>
          <div className="relative flex gap-2">
            <input
              type="text"
              value={apiKey || 'Click Save to generate...'}
              readOnly
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-400 font-mono focus:outline-none"
            />
            <button
              onClick={() => copyValue(apiKey, 'API Key copied to clipboard')}
              disabled={!apiKey}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-md transition-colors flex items-center gap-2"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 italic">
            Required for the mobile app to authenticate.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-3 h-3" />
          Public Remote URL (Optional)
        </label>
        <input
          type="text"
          value={publicUrl}
          onChange={(e) => setPublicUrl(e.target.value)}
          placeholder="https://booksync.ddsplayground.com"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
        <p className="text-[10px] text-zinc-500 italic">
          Set this if you use a <strong>Cloudflare Tunnel</strong> or reverse proxy. The QR code will include this for remote access.
        </p>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
        >
          <Save className="w-4 h-4" />
          Save & Restart Server
        </button>
      </div>

      {enabled && connectionInfo && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <div className="w-full flex items-center gap-2 text-zinc-200 font-medium mb-4">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Scan To Connect</span>
            </div>
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="BookSync mobile pairing QR code" className="w-80 h-80 rounded-xl border border-zinc-800 bg-zinc-950 p-4" />
            ) : (
              <div className="w-80 h-80 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-500 text-xs p-6">
                Save and enable the server to generate a QR code.
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-500">
              The QR encodes a `booksync://connect` URI containing the local server URL, public tunnel address, and API key.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                <Wifi className="w-3 h-3" />
                Local Connection
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Primary LAN URL</div>
                  <div className="flex gap-2">
                    <input value={connectionInfo.httpUrl} readOnly className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-300 font-mono text-xs" />
                    <button onClick={() => copyValue(connectionInfo.httpUrl, 'Server URL copied to clipboard')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Detected LAN Addresses</div>
                  <div className="flex flex-wrap gap-2">
                    {connectionInfo.hosts.length > 0 ? connectionInfo.hosts.map(host => (
                      <code key={host} className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300">
                        {host}:{connectionInfo.port}
                      </code>
                    )) : (
                      <span className="text-xs text-zinc-500">No LAN IPv4 addresses detected. The QR will fall back to 127.0.0.1.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {connectionInfo.publicUrl && (
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Remote Connection
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Public URL</div>
                    <div className="flex gap-2">
                      <input value={connectionInfo.publicUrl} readOnly className="flex-1 bg-emerald-950/20 border border-emerald-900/30 rounded-md px-3 py-2 text-emerald-300 font-mono text-xs" />
                      <button onClick={() => copyValue(connectionInfo.publicUrl!, 'Public URL copied to clipboard')} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Manual Fallback</h4>
              <textarea
                value={connectionSummary}
                readOnly
                className="w-full min-h-24 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-300 font-mono text-xs resize-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => copyValue(connectionSummary, 'Connection details copied to clipboard')}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors flex items-center gap-2 text-xs"
                >
                  <Copy className="w-4 h-4" />
                  Copy Connection Details
                </button>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg border-dashed">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Cloudflare Tunnel Guide</h4>
              <ol className="text-xs text-zinc-500 space-y-2 list-decimal ml-4">
                <li>Open your Cloudflare Zero Trust dashboard.</li>
                <li>Create or update a Tunnel on your Unraid NAS.</li>
                <li>Add a Public Hostname (for example <code className="text-zinc-400">booksync.yourdomain.com</code>).</li>
                <li>Service Type: <code className="text-zinc-400">HTTP</code>, URL: <code className="text-zinc-400">http://{connectionInfo.primaryHost}:{connectionInfo.port}</code>.</li>
                <li>Ensure you have set the <strong>Public Remote URL</strong> above to your subdomain.</li>
                <li>Scanning the QR code will now automatically configure both local and remote access.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
