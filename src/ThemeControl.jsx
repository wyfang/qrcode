import { useEffect, useState } from 'react';
import { Label, ListBox, Select } from '@heroui/react';

const STORAGE_KEY = 'qrcode-demo-theme';
const options = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '亮色' },
  { id: 'dark', label: '暗色' },
];

function normalizePreference(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function readPreference() {
  const initialized = document.documentElement.dataset.themePreference;
  if (initialized) return normalizePreference(initialized);
  try {
    return normalizePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function applyTheme(preference) {
  const root = document.documentElement;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

export default function ThemeControl() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (preference === 'system') applyTheme('system');
    };
    const handleStorage = event => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = normalizePreference(event.newValue);
        applyTheme(next);
        setPreference(next);
      }
    };
    media?.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      media?.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [preference]);

  const changePreference = value => {
    if (!options.some(option => option.id === value)) return;
    applyTheme(value);
    setPreference(value);
    try {
      if (value === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The current selection still works when browser storage is unavailable.
    }
  };

  return (
    <Select
      aria-label="外观"
      className="theme-control"
      variant="secondary"
      value={preference}
      onChange={changePreference}
    >
      <Select.Trigger className="theme-trigger">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="theme-popover">
        <ListBox>
          {options.map(option => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <Label>{option.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
