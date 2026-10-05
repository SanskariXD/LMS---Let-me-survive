'use client';

import { useEffect, useRef, useState, useId } from 'react';

type Entry = { view: string; overlays: string[] };
const STATE_KEY = '__lmsNavigation';
let initialized = false;
let pendingBack = false;
const queued: Array<() => void> = [];
const listeners = new Set<(view: string) => void>();
const overlays = new Map<string, () => void>();

function entry(): Entry {
  return window.history.state?.[STATE_KEY] || { view: 'overview', overlays: [] };
}

function write(next: Entry, push = false) {
  const state = { ...window.history.state, [STATE_KEY]: next };
  if (push) window.history.pushState(state, '', window.location.href);
  else window.history.replaceState(state, '', window.location.href);
  listeners.forEach((listener) => listener(next.view));
}

function schedule(action: () => void) {
  if (pendingBack) queued.push(action);
  else action();
}

function back() {
  pendingBack = true;
  window.history.back();
}

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  // A fresh portal mount starts on Dashboard; preserve Next.js history metadata.
  write({ view: 'overview', overlays: [] });
  window.addEventListener('popstate', () => {
    const current = entry();
    for (const [id, close] of overlays) {
      if (!current.overlays.includes(id)) {
        overlays.delete(id);
        close();
      }
    }
    listeners.forEach((listener) => listener(current.view));
    pendingBack = false;
    while (queued.length && !pendingBack) queued.shift()?.();
  });
}

export function navigatePortal(view: string) {
  initialize();
  schedule(() => {
    const current = entry();
    if (current.view === view) return;
    if (current.overlays.length) {
      // Close the top popup before moving to a different section.
      const id = current.overlays.at(-1)!;
      overlays.get(id)?.();
      overlays.delete(id);
      back();
      queued.push(() => navigatePortal(view));
      return;
    }
    if (view === 'overview' && current.view !== 'overview') back();
    else write({ view, overlays: [] }, current.view === 'overview');
  });
}

export function registerOverlay(id: string, close: () => void) {
  initialize();
  schedule(() => {
    overlays.set(id, close);
    const current = entry();
    if (!current.overlays.includes(id)) write({ ...current, overlays: [...current.overlays, id] }, true);
  });
}

export function unregisterOverlay(id: string) {
  schedule(() => {
    overlays.delete(id);
    const current = entry();
    if (current.overlays.at(-1) === id) back();
    else if (current.overlays.includes(id)) write({ ...current, overlays: current.overlays.filter((overlay) => overlay !== id) });
  });
}

export function usePortalNavigation() {
  const [view, setView] = useState('overview');
  useEffect(() => {
    initialize();
    listeners.add(setView);
    setView(entry().view);
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'registration') {
      navigatePortal('registration');
      url.searchParams.delete('view');
      window.history.replaceState(window.history.state, '', url);
    }
    return () => { listeners.delete(setView); };
  }, []);
  return [view, navigatePortal] as const;
}

export function useDialogNavigation(open: boolean, onClose: () => void, enabled = true) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !enabled) return;
    registerOverlay(id, () => closeRef.current());
    return () => unregisterOverlay(id);
  }, [open, enabled, id]);
}
