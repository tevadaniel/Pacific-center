'use client';

/**
 * Hook pour lire la configuration centralisée des horaires Forum.
 * Recharge automatiquement à chaque mount + expose une fonction refresh().
 *
 * Usage :
 *   const { settings, refresh, loading } = useEventSettings();
 *   if (loading) return null;
 *   const slots = generateStandSlots(settings, 'vendredi');
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/auth-client';
import { DEFAULT_EVENT_SETTINGS } from '@/lib/event-time-config';

// Cache module-level pour éviter de fetcher trop souvent
let _cachedSettings = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 30_000; // 30s
const _listeners = new Set();

function notifyListeners() {
  for (const fn of _listeners) {
    try { fn(_cachedSettings); } catch { /* ignore */ }
  }
}

export function useEventSettings() {
  const [settings, setSettings] = useState(_cachedSettings || DEFAULT_EVENT_SETTINGS);
  const [loading, setLoading] = useState(!_cachedSettings);

  const fetchSettings = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && _cachedSettings && (now - _cachedAt) < CACHE_TTL_MS) {
      setSettings(_cachedSettings);
      setLoading(false);
      return _cachedSettings;
    }
    try {
      const data = await api('/api/event-settings');
      _cachedSettings = { ...DEFAULT_EVENT_SETTINGS, ...data };
      _cachedAt = Date.now();
      setSettings(_cachedSettings);
      notifyListeners();
      return _cachedSettings;
    } catch {
      _cachedSettings = DEFAULT_EVENT_SETTINGS;
      setSettings(DEFAULT_EVENT_SETTINGS);
      return DEFAULT_EVENT_SETTINGS;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings(false);
    const listener = (s) => setSettings(s);
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, [fetchSettings]);

  const refresh = useCallback(() => fetchSettings(true), [fetchSettings]);

  return { settings, loading, refresh };
}

/**
 * Invalide le cache global (utile après un PUT depuis l'UI admin).
 */
export function invalidateEventSettings(newSettings) {
  if (newSettings) {
    _cachedSettings = { ...DEFAULT_EVENT_SETTINGS, ...newSettings };
    _cachedAt = Date.now();
  } else {
    _cachedSettings = null;
    _cachedAt = 0;
  }
  notifyListeners();
}
