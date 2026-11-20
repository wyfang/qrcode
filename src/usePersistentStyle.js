import { useCallback, useEffect, useRef, useState } from 'react';
import { createStyleSaver, readStyle } from './style-storage.js';

export default function usePersistentStyle(defaults) {
  const [initial] = useState(() => readStyle(defaults));
  const [settings, setSettings] = useState(initial.settings);
  const [storageError, setStorageError] = useState(initial.error);
  const latest = useRef(settings);
  const saver = useRef(null);
  if (!saver.current) saver.current = createStyleSaver(defaults, setStorageError);

  const update = useCallback(next => {
    const value = typeof next === 'function' ? next(latest.current) : next;
    latest.current = value;
    saver.current.schedule(value);
    setSettings(value);
  }, []);

  useEffect(() => {
    const flush = () => saver.current.flush();
    const onVisibilityChange = () => { if (document.hidden) flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      saver.current.dispose();
    };
  }, []);

  return [settings, update, storageError];
}
