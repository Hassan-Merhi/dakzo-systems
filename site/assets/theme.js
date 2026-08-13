(() => {
  const root = document.documentElement;
  const storageKey = 'dakzo-color-theme';
  const allowedPreferences = new Set(['system', 'light', 'dark']);
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const readPreference = () => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return allowedPreferences.has(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  };

  let preference = readPreference();

  const resolveTheme = (value = preference) => {
    if (value === 'system') return colorSchemeQuery.matches ? 'dark' : 'light';
    return value;
  };

  const syncThemeColor = (theme) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#080d19' : '#f7f9fc');
  };

  const syncControl = () => {
    const select = document.querySelector('[data-theme-select]');
    if (select instanceof HTMLSelectElement) select.value = preference;
  };

  const applyTheme = () => {
    const theme = resolveTheme();
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;
    syncThemeColor(theme);
    syncControl();
    return theme;
  };

  const setPreference = (value) => {
    if (!allowedPreferences.has(value)) return;
    preference = value;
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // The theme still works for this visit when storage is unavailable.
    }
    const theme = applyTheme();
    window.dispatchEvent(new CustomEvent('dakzo:themechange', { detail: { preference, theme } }));
  };

  applyTheme();

  const onSystemThemeChange = () => {
    if (preference === 'system') applyTheme();
  };
  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', onSystemThemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(onSystemThemeChange);
  }

  const mountThemeControl = () => {
    if (document.querySelector('[data-theme-control]')) return;
    const nav = document.querySelector('[data-nav]');
    if (!(nav instanceof HTMLElement)) return;

    const control = document.createElement('label');
    control.className = 'theme-control';
    control.dataset.themeControl = '';

    const label = document.createElement('span');
    label.className = 'theme-control-label';
    label.textContent = 'Theme';

    const select = document.createElement('select');
    select.className = 'theme-select';
    select.dataset.themeSelect = '';
    select.setAttribute('aria-label', 'Color theme');

    for (const [value, text] of [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }

    select.value = preference;
    select.addEventListener('change', () => setPreference(select.value));
    control.append(label, select);

    const cta = nav.querySelector('.nav-cta');
    nav.insertBefore(control, cta || null);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountThemeControl, { once: true });
  } else {
    mountThemeControl();
  }

  window.DakzoTheme = {
    getPreference: () => preference,
    getTheme: () => resolveTheme(),
    setPreference
  };
})();