export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "lumivo.theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

type ThemeRoot = {
  classList: Pick<DOMTokenList, "toggle">;
  style: Pick<CSSStyleDeclaration, "colorScheme">;
};

function resolveStorage(storage?: ThemeStorage): ThemeStorage | null {
  if (storage) return storage;
  return typeof window === "undefined" ? null : window.localStorage;
}

export function readTheme(storage?: ThemeStorage): Theme {
  try {
    return resolveStorage(storage)?.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function writeTheme(theme: Theme, storage?: ThemeStorage): void {
  try {
    resolveStorage(storage)?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Browser storage can be unavailable in privacy-restricted contexts.
  }
}

export function applyTheme(theme: Theme, root?: ThemeRoot): void {
  const target = root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return;

  target.classList.toggle("dark", theme === "dark");
  target.classList.toggle("light", theme === "light");
  target.style.colorScheme = theme;
}

export function getNextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
