/**
 * Transport abstraction layer.
 *
 * Goal: keep the EXACT same call surface as `window.ipcRenderer` so that
 * business code can be migrated by a pure mechanical rename
 * (`window.ipcRenderer` -> `ipc`) without changing semantics.
 *
 * - In Electron (renderer): `window.ipcRenderer` is provided by preload.ts.
 *   We forward 1:1 with zero wrapping overhead, so behavior is identical
 *   to the legacy code path.
 * - In a browser (WebUI mode, phase 2): we fall back to HTTP for `invoke`
 *   and WebSocket for `on` / `removeListener`. The server side that
 *   handles these endpoints will be added in a follow-up; today the web
 *   branch only exists to keep types consistent and to fail loudly with a
 *   clear message if accidentally exercised outside Electron.
 */

type Listener = (...args: any[]) => void;

interface IpcLike {
  send(channel: string, ...args: any[]): void;
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, listener: Listener): () => void;
  off(channel: string, listener: Listener): void;
  removeAllListeners(channel: string): void;
  removeListener(channel: string, listener: Listener): void;
}

const electronIpc: IpcLike | undefined =
  typeof window !== 'undefined' ? (window as any).ipcRenderer : undefined;

export const isElectron: boolean = !!electronIpc;

// ---------- Web fallback (only used when not running inside Electron) ----------

const HTTP_BASE = '/api/ipc';
const WS_PATH = '/ws/events';

let ws: WebSocket | null = null;
let wsReady: Promise<void> | null = null;
const wsListeners = new Map<string, Set<Listener>>();

function ensureWebSocket(): Promise<void> {
  if (wsReady) return wsReady;
  wsReady = new Promise((resolve, reject) => {
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}${WS_PATH}`);
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
      ws.onclose = () => {
        ws = null;
        wsReady = null;
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const channel: string = msg.channel;
          const args: any[] = msg.args || [];
          const set = wsListeners.get(channel);
          if (!set) return;
          // Match Electron signature: listener(event, ...args)
          const fakeEvent = {};
          for (const l of set) {
            try { l(fakeEvent, ...args); } catch (err) { console.error('[ipc] listener error', err); }
          }
        } catch (err) {
          console.error('[ipc] failed to parse ws message', err);
        }
      };
    } catch (e) {
      reject(e);
    }
  });
  return wsReady;
}

function webInvoke(channel: string, ...args: any[]): Promise<any> {
  if (channel === 'dialog:openFile') {
    const options = args[0] || {};
    const title = options.title || 'Select server path';
    const value = window.prompt(`${title}\n\nWebUI cannot open the server file dialog directly. Paste an absolute path on the server machine:`);
    if (!value || !value.trim()) {
      return Promise.resolve({ canceled: true, filePaths: [] });
    }
    return Promise.resolve({ canceled: false, filePaths: [value.trim()] });
  }

  return fetch(`${HTTP_BASE}/${encodeURIComponent(channel)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then(async (r) => {
    let payload: any = null;
    try { payload = await r.json(); } catch { /* ignore */ }
    if (!r.ok) {
      const msg = (payload && payload.error) || `HTTP ${r.status}`;
      throw new Error(`ipc[${channel}] failed: ${msg}`);
    }
    if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
      throw new Error(`ipc[${channel}] error: ${payload.error}`);
    }
    return payload ? payload.data : undefined;
  });
}

function webSend(channel: string, ...args: any[]): void {
  // Fire-and-forget
  void webInvoke(channel, ...args).catch((err) => console.warn('[ipc.send]', channel, err));
}

function webOn(channel: string, listener: Listener): () => void {
  let set = wsListeners.get(channel);
  if (!set) { set = new Set(); wsListeners.set(channel, set); }
  set.add(listener);
  // Tell the server we want this channel (best-effort).
  ensureWebSocket().then(() => {
    try { ws?.send(JSON.stringify({ type: 'subscribe', channel })); } catch { /* ignore */ }
  }).catch(() => { /* ignore */ });
  return () => webOff(channel, listener);
}

function webOff(channel: string, listener: Listener): void {
  const set = wsListeners.get(channel);
  if (!set) return;
  set.delete(listener);
  if (set.size === 0) {
    wsListeners.delete(channel);
    try { ws?.send(JSON.stringify({ type: 'unsubscribe', channel })); } catch { /* ignore */ }
  }
}

const webIpc: IpcLike = {
  send: webSend,
  invoke: webInvoke,
  on: webOn,
  off: webOff,
  removeListener: webOff,
  removeAllListeners(channel: string) {
    wsListeners.delete(channel);
    try { ws?.send(JSON.stringify({ type: 'unsubscribe', channel })); } catch { /* ignore */ }
  },
};

// ---------- Exported facade ----------

/**
 * Drop-in replacement for `window.ipcRenderer`.
 *
 * In Electron this *is* `window.ipcRenderer` (bound), so all existing
 * call sites behave identically. In a browser it routes to HTTP / WS.
 */
export const ipc: IpcLike = electronIpc
  ? {
      send: electronIpc.send.bind(electronIpc),
      invoke: electronIpc.invoke.bind(electronIpc),
      on: electronIpc.on.bind(electronIpc),
      off: electronIpc.off.bind(electronIpc),
      removeAllListeners: electronIpc.removeAllListeners.bind(electronIpc),
      // Electron preload exposes `removeListener` too; fall back to `off` if missing.
      removeListener:
        (electronIpc as any).removeListener?.bind(electronIpc) ??
        electronIpc.off.bind(electronIpc),
    }
  : webIpc;
