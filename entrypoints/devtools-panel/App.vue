<template>
  <div class="ni">
    <header class="ni__bar">
      <div class="ni__brand">
        <img class="ni__logo" :src="logoUrl" alt="" width="22" height="22" />
        <div class="ni__brand-text">
          <div class="ni__brand-title">
            <span class="ni__name">Omniext</span>
            <span class="ni__version">v{{ version }}</span>
            <span class="ni__sep">·</span>
            <span class="ni__panel-name">Network Inspector</span>
          </div>
          <span class="ni__author">{{ author }}</span>
        </div>
      </div>
      <div class="ni__controls">
        <input
          v-model="search"
          class="ni__search"
          type="search"
          placeholder="Filter by URL, method, status, mime…"
          spellcheck="false"
        />
        <div class="ni__type-filter">
          <button
            v-for="t in TYPE_FILTERS"
            :key="t.key"
            class="ni__type-chip"
            :class="{ 'ni__type-chip--active': typeFilters.has(t.key) }"
            type="button"
            :title="t.label"
            @click="toggleType(t.key)"
          >
            {{ t.icon }} {{ t.label }}
          </button>
        </div>
        <div class="ni__method-filter">
          <button
            v-for="m in allMethods"
            :key="m"
            class="ni__method-chip"
            :class="{ 'ni__method-chip--active': selectedMethods.has(m) }"
            type="button"
            @click="toggleMethod(m)"
          >
            {{ m }}
          </button>
        </div>
        <button class="ni__btn ni__btn--ghost" type="button" @click="clearAll">Clear</button>
        <button class="ni__btn ni__btn--ghost" type="button" @click="exportPostman(false)">Export all</button>
        <button
          class="ni__btn ni__btn--primary"
          type="button"
          :disabled="!selected"
          @click="exportPostman(true)"
        >
          Send to Postman
        </button>
      </div>
    </header>

    <main class="ni__main">
      <section class="ni__list">
        <div class="ni__list-head">
          <span class="col col--method">Method</span>
          <span class="col col--status">Status</span>
          <span class="col col--url">Name / URL</span>
          <span class="col col--type">Type</span>
          <span class="col col--size">Size</span>
          <span class="col col--time">Time</span>
        </div>
        <div class="ni__rows">
          <button
            v-for="r in filtered"
            :key="r.id"
            class="ni__row"
            :class="{ 'ni__row--selected': r.id === selectedId }"
            type="button"
            @click="selectRow(r.id)"
          >
            <span class="col col--method">
              <span class="method" :style="{ color: METHOD_COLORS[r.method] ?? '#a3a3a3' }">{{ r.method }}</span>
            </span>
            <span class="col col--status">
              <span class="status" :class="`status--${statusTone(r.status)}`">{{ r.status || '—' }}</span>
            </span>
            <span class="col col--url" :title="r.url">
              <span class="url-name">{{ urlName(r.url) }}</span>
              <span class="url-host">{{ urlHost(r.url) }}</span>
            </span>
            <span class="col col--type">{{ r.resourceType || mimeShort(r.mimeType) }}</span>
            <span class="col col--size">{{ formatBytes(r.size) }}</span>
            <span class="col col--time">{{ formatTime(r.time) }}</span>
          </button>
          <div v-if="filtered.length === 0" class="ni__empty">
            <p>No requests captured yet.</p>
            <p class="ni__empty-hint">Open DevTools Network activity, then browse or trigger requests.</p>
          </div>
        </div>
      </section>

      <aside class="ni__detail">
        <div v-if="selected" class="detail">
          <div class="detail__head">
            <span class="method method--lg" :style="{ color: METHOD_COLORS[selected.method] ?? '#a3a3a3' }">
              {{ selected.method }}
            </span>
            <span class="detail__url" :title="selected.url">{{ selected.url }}</span>
            <span class="status status--lg" :class="`status--${statusTone(selected.status)}`">
              {{ selected.status }} {{ selected.statusText }}
            </span>
          </div>

          <nav class="detail__tabs">
            <button
              v-for="tab in ['overview', 'headers', 'payload', 'response', 'preview', 'timing']"
              :key="tab"
              class="detail__tab"
              :class="{ 'detail__tab--active': activeTab === tab }"
              type="button"
              @click="activeTab = tab as any"
            >
              {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
            </button>
          </nav>

          <div class="detail__body">
            <template v-if="activeTab === 'overview'">
              <div class="kv-grid">
                <div class="kv"><span class="kv__k">URL</span><span class="kv__v mono">{{ selected.url }}</span></div>
                <div class="kv"><span class="kv__k">Method</span><span class="kv__v">{{ selected.method }}</span></div>
                <div class="kv"><span class="kv__k">Status</span><span class="kv__v">{{ selected.status }} {{ selected.statusText }}</span></div>
                <div class="kv"><span class="kv__k">MIME</span><span class="kv__v mono">{{ selected.mimeType || '—' }}</span></div>
                <div class="kv"><span class="kv__k">Type</span><span class="kv__v">{{ selected.resourceType || '—' }}</span></div>
                <div class="kv"><span class="kv__k">Size</span><span class="kv__v">{{ formatBytes(selected.size) }}</span></div>
                <div class="kv"><span class="kv__k">Time</span><span class="kv__v">{{ formatTime(selected.time) }}</span></div>
                <div class="kv"><span class="kv__k">Started</span><span class="kv__v mono">{{ selected.startedDateTime }}</span></div>
              </div>
            </template>

            <template v-else-if="activeTab === 'headers'">
              <div class="header-section">
                <h3>Request headers</h3>
                <div v-if="selected.requestHeaders.length" class="header-list">
                  <div v-for="h in selected.requestHeaders" :key="h.name" class="header-row">
                    <span class="header-name mono">{{ h.name }}</span>
                    <span class="header-value mono">{{ h.value }}</span>
                  </div>
                </div>
                <p v-else class="muted">No request headers.</p>
              </div>
              <div class="header-section">
                <h3>Response headers</h3>
                <div v-if="selected.responseHeaders.length" class="header-list">
                  <div v-for="h in selected.responseHeaders" :key="h.name" class="header-row">
                    <span class="header-name mono">{{ h.name }}</span>
                    <span class="header-value mono">{{ h.value }}</span>
                  </div>
                </div>
                <p v-else class="muted">No response headers.</p>
              </div>
              <div v-if="selected.queryString" class="header-section">
                <h3>Query string</h3>
                <pre class="code-block" v-html="highlightCode(selected.queryString, 'text')"></pre>
              </div>
            </template>

            <template v-else-if="activeTab === 'payload'">
              <div v-if="selected.requestBody" class="code-wrap">
                <div class="code-toolbar">
                  <span>Request body</span>
                  <button class="mini-btn" type="button" @click="copyText(selected.requestBody)">Copy</button>
                </div>
                <pre class="code-block" v-html="highlightBody(selected.requestBody, selected.requestMimeType, true)"></pre>
              </div>
              <p v-else class="muted">No request body.</p>
            </template>

            <template v-else-if="activeTab === 'response'">
              <div v-if="bodyLoading" class="muted">Loading response body…</div>
              <div v-else-if="selected.responseBody" class="code-wrap">
                <div class="code-toolbar">
                  <span>Response body · {{ formatBytes(selected.responseBody.length) }}</span>
                  <button class="mini-btn" type="button" @click="copyText(selected.responseBody)">Copy</button>
                </div>
                <pre class="code-block" v-html="highlightBody(selected.responseBody, selected.mimeType, true)"></pre>
              </div>
              <p v-else class="muted">No response body (or not yet loaded).</p>
            </template>

            <template v-else-if="activeTab === 'preview'">
              <div class="preview">
                <template v-if="isImageMime(selected.mimeType)">
                  <img :src="dataUrl(selected)" class="preview__img" :alt="urlName(selected.url)" />
                </template>
                <template v-else-if="isTextMime(selected.mimeType) && selected.responseBody">
                  <pre class="code-block" v-html="highlightBody(selected.responseBody, selected.mimeType, true)"></pre>
                </template>
                <template v-else-if="selected.responseBody">
                  <p class="muted">Binary resource ({{ selected.mimeType || 'unknown' }}). Download via "Send to Postman" or copy.</p>
                  <pre class="code-block">{{ selected.responseBody.slice(0, 500) }}</pre>
                </template>
                <p v-else class="muted">No preview available.</p>
              </div>
            </template>

            <template v-else-if="activeTab === 'timing'">
              <div class="timing">
                <div v-for="(value, key) in selected.timings" :key="key" class="timing-row">
                  <span class="timing-name">{{ key }}</span>
                  <span class="timing-bar-wrap">
                    <span class="timing-bar" :style="{ width: timingWidth(value, selected.time) + '%' }"></span>
                  </span>
                  <span class="timing-value mono">{{ formatTime(Number(value)) }}</span>
                </div>
                <div v-if="!Object.keys(selected.timings).length" class="muted">No timing data.</div>
              </div>
            </template>
          </div>

          <footer class="detail__foot">
            <button class="ni__btn ni__btn--ghost" type="button" @click="copyCurl">Copy as cURL</button>
            <button class="ni__btn ni__btn--primary" type="button" @click="exportPostman(true)">Send to Postman</button>
          </footer>
        </div>
        <div v-else class="detail__placeholder">
          <div class="placeholder-icon">⬢</div>
          <p>Select a request to inspect headers, payload and response.</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
/// <reference types="chrome" />

import { computed, onMounted, ref, watch } from 'vue';
import { APP_AUTHOR, APP_VERSION } from '@/utils/app';
import { highlightToLines } from '@/features/code-viewer/highlight';

const version = APP_VERSION;
const author = APP_AUTHOR;
const logoUrl = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime.getURL('/icon/32.png') : '/icon/32.png';

interface Header {
  name: string;
  value: string;
}

interface NetRequest {
  id: string;
  startedDateTime: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  mimeType: string;
  resourceType: string;
  size: number;
  time: number;
  requestHeaders: Header[];
  responseHeaders: Header[];
  requestMimeType: string;
  queryString: string;
  requestBody: string;
  requestBodyEncoding: string;
  responseBody: string;
  responseBodyEncoding: string;
  timings: Record<string, number>;
  bodyLoaded: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
  TRACE: '#6b7280',
  CONNECT: '#6b7280',
};

const ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

const TYPE_FILTERS = [
  { key: 'all', icon: '🌐', label: 'All' },
  { key: 'xhr', icon: '🔄', label: 'XHR' },
  { key: 'fetch', icon: '📡', label: 'Fetch' },
  { key: 'script', icon: '📜', label: 'JS' },
  { key: 'stylesheet', icon: '🎨', label: 'CSS' },
  { key: 'image', icon: '🖼️', label: 'Img' },
  { key: 'font', icon: '🔤', label: 'Font' },
  { key: 'media', icon: '🎬', label: 'Media' },
  { key: 'document', icon: '📄', label: 'Doc' },
  { key: 'websocket', icon: '🔌', label: 'WS' },
  { key: 'other', icon: '📦', label: 'Other' },
];

function resourceTypeKey(r: NetRequest): string {
  const t = (r.resourceType || '').toLowerCase();
  if (t === 'xhr') return 'xhr';
  if (t === 'fetch') return 'fetch';
  if (t === 'script') return 'script';
  if (t === 'stylesheet') return 'stylesheet';
  if (t === 'image') return 'image';
  if (t === 'font') return 'font';
  if (t === 'media') return 'media';
  if (t === 'document') return 'document';
  if (t === 'websocket') return 'websocket';
  const mime = (r.mimeType || '').toLowerCase();
  if (mime.includes('javascript')) return 'script';
  if (mime.includes('css')) return 'stylesheet';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('font/') || mime.includes('font')) return 'font';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media';
  if (mime.includes('html')) return 'document';
  return 'other';
}

const typeFilters = ref<Set<string>>(new Set(['all']));

function statusTone(status: number): string {
  if (status === 0) return 'muted';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'muted';
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function isJsonMime(mime: string): boolean {
  return /json/i.test(mime);
}

function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

function isTextMime(mime: string): boolean {
  const m = (mime || '').toLowerCase();
  return (
    m.startsWith('text/') ||
    m.includes('json') ||
    m.includes('xml') ||
    m.includes('javascript') ||
    m.includes('css') ||
    m.includes('html') ||
    m.includes('svg') ||
    m === ''
  );
}

function dataUrl(r: NetRequest): string {
  const body = r.responseBody || '';
  const mime = r.mimeType || 'application/octet-stream';
  const enc = r.responseBodyEncoding || '';
  if (enc === 'base64') return `data:${mime};base64,${body}`;
  try {
    const b64 = btoa(unescape(encodeURIComponent(body)));
    return `data:${mime};base64,${b64}`;
  } catch {
    return '';
  }
}

function decodeBody(text: string, encoding: string): string {
  if (encoding !== 'base64') return text;
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch {
    return text;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function highlightCode(text: string, lang: 'json' | 'js' | 'shell' | 'text'): string {
  if (lang === 'text' || !text) return escapeHtml(text);
  try {
    const lines = highlightToLines(text, lang as 'json' | 'js' | 'shell');
    return lines.join('\n');
  } catch {
    return escapeHtml(text);
  }
}

function detectHighlightLang(mime: string, text: string): 'json' | 'js' | 'shell' | 'text' {
  if (isJsonMime(mime)) return 'json';
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'text';
}

function highlightBody(text: string, mime: string, format = false): string {
  const lang = detectHighlightLang(mime, text);
  if (lang === 'text') return escapeHtml(text);
  let src = text;
  if (format && lang === 'json') {
    try {
      src = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // keep raw
    }
  }
  return highlightCode(src, lang);
}

const requests = ref<NetRequest[]>([]);
const selectedId = ref<string | null>(null);
const search = ref('');
const selectedMethods = ref<Set<string>>(new Set(['GET', 'POST']));
const activeTab = ref<'overview' | 'headers' | 'payload' | 'response' | 'preview' | 'timing'>('overview');
const bodyLoading = ref(false);

const allMethods = ALL_METHODS;

const selected = computed(() => requests.value.find((r) => r.id === selectedId.value) ?? null);

const filtered = computed(() => {
  return requests.value.filter((r) => {
    if (!selectedMethods.value.has(r.method)) return false;
    if (!typeFilters.value.has('all') && !typeFilters.value.has(resourceTypeKey(r))) return false;
    const q = search.value.trim().toLowerCase();
    if (!q) return true;
    return (
      r.url.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q) ||
      String(r.status).includes(q) ||
      r.mimeType.toLowerCase().includes(q)
    );
  });
});

const methods = computed(() => {
  const set = new Set(requests.value.map((r) => r.method));
  return ['ALL', ...Array.from(set).sort()];
});

let counter = 0;
const seen = new Set<string>();

function dedupKey(started: string, url: string, method: string): string {
  return `${started}|${method}|${url}`;
}

function fromHeaders(headers: any[]): Header[] {
  if (!Array.isArray(headers)) return [];
  return headers
    .map((h) => ({ name: String(h?.name ?? ''), value: String(h?.value ?? '') }))
    .filter((h) => h.name !== '');
}

function makeRequest(raw: any, source: 'har' | 'live'): NetRequest {
  const req = raw?.request ?? raw;
  const res = raw?.response ?? {};
  const url = String(req?.url ?? raw?.url ?? '');
  const started = String(raw?.startedDateTime ?? new Date().toISOString());
  const id = `req-${++counter}`;

  const requestHeaders = fromHeaders(req?.headers ?? raw?.request?.headers);
  const responseHeaders = fromHeaders(res?.headers ?? raw?.response?.headers);

  const postData = req?.postData ?? raw?.request?.postData;
  const requestBody = postData?.text ?? '';
  const requestBodyEncoding = postData?.encoding ?? '';

  const content = res?.content ?? raw?.response?.content ?? {};
  const responseBody = content?.text ?? '';
  const responseBodyEncoding = content?.encoding ?? '';

  const size = Number(content?.size ?? res?.bodySize ?? raw?.response?.bodySize ?? 0);
  const time = Number(raw?.time ?? res?.time ?? 0);

  return {
    id,
    startedDateTime: started,
    method: String(req?.method ?? raw?.method ?? 'GET'),
    url,
    status: Number(res?.status ?? raw?.status ?? 0),
    statusText: String(res?.statusText ?? raw?.statusText ?? ''),
    mimeType: String(content?.mimeType ?? res?.content?.mimeType ?? res?.mimeType ?? ''),
    resourceType: String(raw?._resourceType ?? raw?.resourceType ?? ''),
    size: size >= 0 ? size : 0,
    time: time >= 0 ? time : 0,
    requestHeaders,
    responseHeaders,
    requestMimeType: String(postData?.mimeType ?? req?.headers?.find?.((h: any) => /content-type/i.test(h?.name))?.value ?? ''),
    queryString: String(req?.queryString?.map?.((q: any) => `${q.name}=${q.value}`).join('&') ?? raw?.request?.queryString?.map?.((q: any) => `${q.name}=${q.value}`).join('&') ?? ''),
    requestBody,
    requestBodyEncoding,
    responseBody,
    responseBodyEncoding,
    timings: raw?.timings ?? res?.timings ?? {},
    bodyLoaded: source === 'har',
  };
}

function addRequest(raw: any, source: 'har' | 'live'): void {
  const req = raw?.request ?? raw;
  const url = String(req?.url ?? raw?.url ?? '');
  const method = String(req?.method ?? raw?.method ?? 'GET');
  const started = String(raw?.startedDateTime ?? new Date().toISOString());

  const key = dedupKey(started, url, method);
  if (seen.has(key)) return;
  seen.add(key);

  const item = makeRequest(raw, source);
  requests.value.push(item);

  if (requests.value.length > 3000) {
    const removed = requests.value.splice(0, requests.value.length - 3000);
    removed.forEach((r) => seen.delete(dedupKey(r.startedDateTime, r.url, r.method)));
  }
}

function loadBody(item: NetRequest, rawRequest: any): void {
  if (item.bodyLoaded) return;
  bodyLoading.value = true;
  try {
    rawRequest.getContent((body: string, encoding: string) => {
      item.responseBody = decodeBody(body ?? '', encoding ?? '');
      item.responseBodyEncoding = encoding ?? '';
      item.bodyLoaded = true;
      bodyLoading.value = false;
    });
  } catch {
    bodyLoading.value = false;
  }
}

const pendingRaw = new Map<string, any>();

onMounted(() => {
  const devtools = (globalThis as any).chrome?.devtools;
  if (!devtools?.network) return;

  devtools.network.onRequestFinished.addListener((request: any) => {
    addRequest(request, 'live');
    const item = requests.value[requests.value.length - 1];
    if (item && !item.bodyLoaded) {
      pendingRaw.set(item.id, request);
    }
  });

  devtools.network.getHAR((har: any) => {
    const entries = har?.entries ?? [];
    entries.forEach((entry: any) => addRequest(entry, 'har'));
  });
});

watch(selected, (item) => {
  if (!item) return;
  activeTab.value = 'overview';
  if (!item.bodyLoaded) {
    const raw = pendingRaw.get(item.id);
    if (raw) loadBody(item, raw);
  }
});

function clearAll(): void {
  requests.value = [];
  seen.clear();
  pendingRaw.clear();
  selectedId.value = null;
}

function toggleType(key: string): void {
  const next = new Set(typeFilters.value);
  if (key === 'all') {
    typeFilters.value = new Set(['all']);
    return;
  }
  next.delete('all');
  if (next.has(key)) next.delete(key);
  else next.add(key);
  if (next.size === 0) next.add('all');
  typeFilters.value = next;
}

function toggleMethod(m: string): void {
  const next = new Set(selectedMethods.value);
  if (next.has(m)) next.delete(m);
  else next.add(m);
  selectedMethods.value = next;
}

function exportPostman(selectedOnly: boolean): void {
  const list = selectedOnly && selected.value ? [selected.value] : filtered.value.length ? filtered.value : requests.value;
  const items = list.map((r) => {
    const headers = r.requestHeaders.map((h) => ({ key: h.name, value: h.value }));
    const body = r.requestBody
      ? { mode: 'raw', raw: r.requestBody, options: { raw: { language: isJsonMime(r.requestMimeType) ? 'json' : 'text' } } }
      : undefined;

    return {
      name: `${r.method} ${(() => { try { return new URL(r.url).pathname; } catch { return r.url; } })()}`,
      request: {
        method: r.method,
        header: headers,
        url: r.url,
        body,
      },
      response: [],
    };
  });

  const collection = {
    info: {
      name: selectedOnly && selected.value ? `Request: ${selected.value.method}` : 'Omniext Network Capture',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = selectedOnly ? 'request.postman_collection.json' : 'network-capture.postman_collection.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyCurl(): void {
  const r = selected.value;
  if (!r) return;
  const parts: string[] = [`curl -X ${r.method} '${r.url.replace(/'/g, "\\'")}'`];
  r.requestHeaders.forEach((h) => {
    parts.push(`  -H '${h.name}: ${h.value.replace(/'/g, "\\'")}'`);
  });
  if (r.requestBody) {
    parts.push(`  --data-raw '${r.requestBody.replace(/'/g, "\\'")}'`);
  }
  const text = parts.join(' \\\n');
  void navigator.clipboard?.writeText(text);
}

function selectRow(id: string): void {
  selectedId.value = id;
}

function timingWidth(value: any, total: number): number {
  const v = Number(value);
  if (!total || !v || v < 0) return 0;
  return Math.min(100, Math.max(2, (v / total) * 100));
}

function urlName(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname || '/';
    const name = path.split('/').filter(Boolean).pop();
    return name || u.host;
  } catch {
    return url;
  }
}

function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function mimeShort(mime: string): string {
  if (!mime) return '';
  return mime.split(';')[0].split('/').pop() || mime;
}

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text);
}
</script>

<style scoped>
.ni {
  --ni-bg: #0b0d10;
  --ni-surface: #111418;
  --ni-surface-2: #161a20;
  --ni-border: rgba(255, 255, 255, 0.08);
  --ni-border-strong: rgba(255, 255, 255, 0.16);
  --ni-text: #e6e9ef;
  --ni-muted: #9aa0a8;
  --ni-faint: #6b7280;
  --ni-accent: #00dc82;
  --ni-accent-soft: rgba(0, 220, 130, 0.12);
  --ni-danger: #f93e3e;
  --ni-warn: #fca130;
  --ni-info: #61affe;
  --ni-radius: 10px;
  --ni-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  --ni-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;

  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ni-bg);
  color: var(--ni-text);
  font-family: var(--ni-sans);
  font-size: 13px;
  overflow: hidden;
}

.ni__bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ni-border);
  background: linear-gradient(180deg, rgba(0, 220, 130, 0.06), transparent);
}

.ni__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.ni__logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex: none;
}

.ni__brand-text {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.ni__brand-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.ni__name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ni__version {
  font-family: var(--ni-mono);
  font-size: 10.5px;
  color: var(--ni-faint);
}

.ni__sep {
  color: var(--ni-faint);
  font-size: 11px;
}

.ni__panel-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ni-accent);
  letter-spacing: 0.02em;
}

.ni__author {
  font-size: 10.5px;
  color: var(--ni-faint);
  line-height: 1.3;
}

.ni__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
  min-width: 0;
  flex-wrap: wrap;
}

.ni__search {
  flex: 1;
  max-width: 300px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ni-border);
  border-radius: 8px;
  background: var(--ni-surface);
  color: var(--ni-text);
  font-size: 12.5px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.ni__search:focus {
  border-color: rgba(0, 220, 130, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.12);
}

.ni__method-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ni__method-chip {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ni-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--ni-muted);
  font-family: var(--ni-mono);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.ni__method-chip:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--ni-text);
}

.ni__method-chip--active {
  border-color: rgba(0, 220, 130, 0.4);
  background: var(--ni-accent-soft);
  color: var(--ni-accent);
}

.ni__select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ni-border);
  border-radius: 8px;
  background: var(--ni-surface);
  color: var(--ni-text);
  font-size: 12.5px;
  cursor: pointer;
}

.ni__btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ni-border-strong);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ni-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 120ms ease;
  white-space: nowrap;
}

.ni__btn:hover {
  background: rgba(255, 255, 255, 0.09);
}

.ni__btn:active {
  transform: scale(0.98);
}

.ni__btn--primary {
  border-color: transparent;
  background: var(--ni-accent);
  color: #041611;
  font-weight: 600;
}

.ni__btn--primary:hover {
  background: #2fe89d;
}

.ni__btn--primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.ni__btn--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ni-muted);
}

.ni__btn--ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--ni-text);
}

.ni__main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.9fr);
  gap: 1px;
  background: var(--ni-border);
}

.ni__list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ni-bg);
}

.ni__list-head,
.ni__row {
  display: grid;
  grid-template-columns: 72px 64px minmax(0, 1fr) 96px 72px 72px;
  gap: 8px;
  align-items: center;
  padding: 0 12px;
}

.ni__list-head {
  flex: none;
  height: 30px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ni-faint);
  border-bottom: 1px solid var(--ni-border);
  background: var(--ni-surface);
}

.ni__rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ni__row {
  width: 100%;
  height: 34px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  background: transparent;
  color: var(--ni-text);
  text-align: left;
  cursor: pointer;
  transition: background 120ms ease;
  font-size: 12.5px;
}

.ni__row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ni__row--selected {
  background: var(--ni-accent-soft);
  box-shadow: inset 2px 0 0 var(--ni-accent);
}

.col {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col--method {
  font-family: var(--ni-mono);
  font-weight: 600;
}

.col--status {
  text-align: center;
}

.col--url {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.url-name {
  font-weight: 500;
  color: var(--ni-text);
}

.url-host {
  font-size: 10.5px;
  color: var(--ni-faint);
  font-family: var(--ni-mono);
}

.col--type {
  color: var(--ni-muted);
  font-size: 11.5px;
}

.col--size,
.col--time {
  text-align: right;
  font-family: var(--ni-mono);
  font-size: 11.5px;
  color: var(--ni-muted);
}

.method {
  font-family: var(--ni-mono);
  font-size: 11.5px;
  font-weight: 700;
}

.method--lg {
  font-size: 13px;
}

.status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  font-family: var(--ni-mono);
  font-size: 11px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
  color: var(--ni-muted);
}

.status--success { background: rgba(73, 204, 144, 0.16); color: #49cc90; }
.status--redirect { background: rgba(252, 161, 48, 0.16); color: #fca130; }
.status--client-error { background: rgba(249, 62, 62, 0.16); color: #f93e3e; }
.status--server-error { background: rgba(249, 62, 62, 0.22); color: #ff6b6b; }
.status--muted { background: rgba(255, 255, 255, 0.06); color: var(--ni-faint); }

.status--lg {
  min-width: 46px;
  height: 24px;
  font-size: 12px;
}

.ni__detail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ni-surface);
  border-left: 1px solid var(--ni-border);
}

.detail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail__head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ni-border);
  background: var(--ni-surface-2);
}

.detail__url {
  flex: 1;
  min-width: 0;
  font-family: var(--ni-mono);
  font-size: 12px;
  color: var(--ni-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail__tabs {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--ni-border);
  background: var(--ni-surface);
}

.detail__tab {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--ni-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.detail__tab:hover {
  color: var(--ni-text);
  background: rgba(255, 255, 255, 0.04);
}

.detail__tab--active {
  color: var(--ni-accent);
  background: var(--ni-bg);
  box-shadow: inset 0 -1px 0 var(--ni-bg);
}

.detail__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
}

.detail__foot {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--ni-border);
  background: var(--ni-surface-2);
}

.kv-grid {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 6px 12px;
}

.kv {
  display: contents;
}

.kv__k {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ni-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-top: 2px;
}

.kv__v {
  font-size: 12.5px;
  color: var(--ni-text);
  word-break: break-all;
}

.mono {
  font-family: var(--ni-mono);
}

.header-section {
  margin-bottom: 18px;
}

.header-section h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ni-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.header-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-row {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  font-size: 12px;
}

.header-name {
  color: var(--ni-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-value {
  color: var(--ni-text);
  word-break: break-all;
}

.code-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--ni-muted);
}

.mini-btn {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--ni-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ni-muted);
  font-size: 11px;
  cursor: pointer;
}

.mini-btn:hover {
  color: var(--ni-text);
  background: rgba(255, 255, 255, 0.06);
}

.code-block {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--ni-border);
  border-radius: var(--ni-radius);
  background: var(--ni-bg);
  color: var(--ni-text);
  font-family: var(--ni-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60vh;
  overflow: auto;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.preview__img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: var(--ni-radius);
  border: 1px solid var(--ni-border);
  background: #fff;
}

/* syntax highlight tokens (reused from code viewer) */
.code-block :deep(.oe-t-key) { color: #7dd3fc; }
.code-block :deep(.oe-t-string) { color: #a5f3a0; }
.code-block :deep(.oe-t-number) { color: #fbbf24; }
.code-block :deep(.oe-t-literal) { color: #c084fc; }
.code-block :deep(.oe-t-keyword) { color: #f472b6; }
.code-block :deep(.oe-t-comment) { color: #6b7280; font-style: italic; }
.code-block :deep(.oe-t-regex) { color: #f87171; }
.code-block :deep(.oe-t-variable) { color: #93c5fd; }
.code-block :deep(.oe-t-operator) { color: #94a3b8; }

.timing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timing-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 70px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.timing-name {
  color: var(--ni-muted);
  text-transform: capitalize;
}

.timing-bar-wrap {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.timing-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--ni-accent), #2fe89d);
  border-radius: 999px;
  transition: width 200ms ease;
}

.timing-value {
  text-align: right;
  color: var(--ni-muted);
}

.muted {
  color: var(--ni-faint);
  font-size: 12.5px;
  padding: 8px 0;
}

.detail__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ni-muted);
  text-align: center;
  padding: 24px;
}

.placeholder-icon {
  font-size: 36px;
  color: var(--ni-accent);
  opacity: 0.7;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>
