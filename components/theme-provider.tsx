"use client";

import { useEffect, type ReactNode } from "react";

import {
  applyTheme,
  getNextTheme,
  readTheme,
  writeTheme,
} from "@/lib/theme";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(readTheme());
  }, []);

  function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains("light")
      ? "light"
      : "dark";
    const nextTheme = getNextTheme(currentTheme);
    applyTheme(nextTheme);
    writeTheme(nextTheme);
  }

  return (
    <>
      {children}
      <button
        aria-label="切换主题"
        className="theme-toggle"
        onClick={toggleTheme}
        title="切换主题"
        type="button"
      >
        <span aria-hidden="true" className="iconfont icon-shensemoshi theme-toggle-icon theme-toggle-icon-dark" />
        <span aria-hidden="true" className="iconfont icon-qiansemoshi theme-toggle-icon theme-toggle-icon-light" />
        主题
      </button>
    </>
  );
}
