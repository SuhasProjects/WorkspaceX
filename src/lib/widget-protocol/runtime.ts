import { LIMITS, STORAGE_KEY_PATTERN, WIDGET_CHANNEL, type WidgetTheme } from "./protocol";
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
  var KEY_PATTERN = new RegExp(CONFIG.keyPattern);
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

  var pending = {};
  var counter = 0;

  function makeError(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function request(action, key, value, hasValue) {
    return new Promise(function (resolve, reject) {
      if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
        reject(makeError("INVALID_INPUT",
          "Storage key must be 1-128 letters, digits, dots, underscores, or hyphens"));
        return;
      }
      var message = { kind: "request", requestId: "", action: action, key: key };
      if (hasValue) {
        var json;
        try { json = JSON.stringify(value === undefined ? null : value); } catch (err) { json = undefined; }
        if (json === undefined) {
          reject(makeError("INVALID_INPUT", "Value must be JSON-compatible"));
          return;
        }
        message.value = JSON.parse(json);
      }
      var requestId = "r" + (++counter) + "_" + Math.random().toString(36).slice(2, 10);
      message.requestId = requestId;
      var timer = setTimeout(function () {
        delete pending[requestId];
        reject(makeError("TIMEOUT", "WorkspaceZero did not respond in time"));
      }, CONFIG.timeoutMs);
      pending[requestId] = { resolve: resolve, reject: reject, timer: timer };
      post(message);
    });
  }

  window.addEventListener("message", function (e) {
    if (e.source !== parentWindow) return;
    var data = e.data;
    if (!data || typeof data !== "object" || data.channel !== CHANNEL) return;
    if (data.kind === "theme") { applyTheme(data.theme); return; }
    if (data.kind !== "response" || typeof data.requestId !== "string") return;
    var entry = pending[data.requestId];
    if (!entry) return;
    delete pending[data.requestId];
    clearTimeout(entry.timer);
    if (data.ok) {
      entry.resolve(data.value === undefined ? null : data.value);
    } else {
      var error = data.error || {};
      entry.reject(makeError(error.code || "INTERNAL_ERROR", error.message || "Storage request failed"));
    }
  });

  var api = {
    version: 1,
    getShared: function (key) { return request("getShared", key); },
    setShared: function (key, value) {
      return request("setShared", key, value, true).then(function () {});
    },
    getPersonal: function (key) { return request("getPersonal", key); },
    setPersonal: function (key, value) {
      return request("setPersonal", key, value, true).then(function () {});
    },
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
    keyPattern: STORAGE_KEY_PATTERN.source,
    // Longer than the parent's own timeout so the parent's specific error wins.
    timeoutMs: LIMITS.requestTimeoutMs + 2_000,
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return RUNTIME_SOURCE.replace("__WZ_CONFIG__", json);
}
