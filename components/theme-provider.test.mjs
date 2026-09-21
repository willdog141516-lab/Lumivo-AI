import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as themeProviderModule from "./theme-provider.tsx";

const ThemeProvider = themeProviderModule.default.default ?? themeProviderModule.default;

test("theme toggle renders both iconfont theme icons", () => {
  const html = renderToStaticMarkup(
      createElement(ThemeProvider, null, createElement("span")),
  );

  assert.match(html, /icon-shensemoshi/);
  assert.match(html, /icon-qiansemoshi/);
});
