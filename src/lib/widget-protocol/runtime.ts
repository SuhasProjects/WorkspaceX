import { LIMITS, WIDGET_CHANNEL, type WidgetTheme } from "./protocol";
import { themeCss } from "./theme";

/**
 * Source of the script injected at the top of every widget document.
 * It runs inside the sandboxed iframe, so it is plain ES2017 in a string and
 * must never contain a closing script tag.
 */
const RUNTIME_SOURCE = `(function () {
  "use strict";
  var CONFIG = __WZ_CONFIG__;
  var CHANNEL = CONFIG.channel;
  var parentWindow = window.parent;
  var currentTheme = CONFIG.theme;
  var themeListeners = [];
  var errorReports = 0;

  function post(message) {
    message.channel = CHANNEL;
    try { parentWindow.postMessage(message, "*"); } catch (_) {}
  }

  function report(message) {
    if (errorReports >= CONFIG.maxErrorReports) return;
    errorReports++;
    post({ kind: "error", message: String(message).slice(0, CONFIG.maxErrorLength) });
  }

  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") return;
    currentTheme = theme;
    var style = document.getElementById("__wz_theme");
    if (style) style.textContent = CONFIG.themeCss[theme];
    document.documentElement.setAttribute("data-theme", theme);
    themeListeners.slice().forEach(function (cb) {
      try { cb(theme); } catch (err) { report(err && err.message ? err.message : err); }
    });
    try {
      window.dispatchEvent(new CustomEvent("workspacezero:themechange", { detail: { theme: theme } }));
    } catch (_) {}
  }

  window.addEventListener("error", function (e) {
    report(e && e.message ? e.message : "Script error");
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    report("Unhandled promise rejection: " + (r && r.message ? r.message : String(r)));
  });
  document.addEventListener("securitypolicyviolation", function (e) {
    report("Blocked by widget sandbox: " + e.effectiveDirective + " " + (e.blockedURI || ""));
  });

  window.addEventListener("message", function (e) {
    if (e.source !== parentWindow) return;
    var data = e.data;
    if (!data || typeof data !== "object" || data.channel !== CHANNEL) return;
    if (data.kind === "theme") applyTheme(data.theme);
  });

  var api = {
    version: 1,
    get theme() { return currentTheme; },
    onThemeChange: function (cb) {
      if (typeof cb !== "function") return function () {};
      themeListeners.push(cb);
      return function () {
        var i = themeListeners.indexOf(cb);
        if (i >= 0) themeListeners.splice(i, 1);
      };
    }
  };
  Object.freeze(api);
  Object.defineProperty(window, "workspace", {
    value: api, writable: false, configurable: true, enumerable: true
  });

  function sendReady() { post({ kind: "ready" }); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sendReady, { once: true });
  } else {
    sendReady();
  }
})();`;

export function buildRuntimeScript(theme: WidgetTheme): string {
  const config = {
    channel: WIDGET_CHANNEL,
    theme,
    themeCss: { light: themeCss("light"), dark: themeCss("dark") },
    maxErrorReports: LIMITS.maxErrorReportsPerDocument,
    maxErrorLength: LIMITS.maxErrorMessageLength,
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return RUNTIME_SOURCE.replace("__WZ_CONFIG__", json);
}
