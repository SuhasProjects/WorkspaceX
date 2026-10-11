import { LIMITS, STORAGE_KEY_PATTERN, WIDGET_CHANNEL, type WidgetTheme } from "./protocol";
import { THEME_TOKENS } from "./theme";

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

  function themeCss(theme, tokens) {
    var merged = {}, base = CONFIG.themeTokens[theme] || {}, k;
    for (k in base) merged[k] = base[k];
    if (tokens && typeof tokens === "object") {
      for (k in tokens) {
        var v = tokens[k];
        if (/^--wz-[a-z-]{1,40}$/.test(k) && typeof v === "string" && v.length <= 300 && !/[{};<>]/.test(v)) merged[k] = v;
      }
    }
    var parts = [];
    for (k in merged) parts.push(k + ":" + merged[k]);
    return ":root{color-scheme:" + theme + ";" + parts.join(";") + "}";
  }

  function applyTheme(theme, tokens) {
    if (theme !== "light" && theme !== "dark") return;
    currentTheme = theme;
    var style = document.getElementById("__wz_theme");
    if (style) style.textContent = themeCss(theme, tokens);
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

  // --- Compatibility for habits common in generated code -------------------

  // The sandbox silently ignores alert(); show it inside the widget instead.
  function showToast(text) {
    var el = document.createElement("div");
    el.textContent = String(text);
    el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);" +
      "max-width:90%;z-index:2147483647;padding:8px 14px;border-radius:8px;" +
      "background:var(--wz-text);color:var(--wz-background);font:13px system-ui,sans-serif;" +
      "box-shadow:0 4px 12px rgba(0,0,0,.25)";
    (document.body || document.documentElement).appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }
  try { window.alert = function (m) { showToast(m === undefined ? "" : m); }; } catch (_) {}
  // confirm() always returns false in a sandbox, which silently blocks actions
  // like "change your vote?". Auto-confirm and tell the user.
  try {
    window.confirm = function (m) { showToast((m === undefined ? "Confirmed" : String(m)) + " (auto-confirmed)"); return true; };
  } catch (_) {}

  // Opaque-origin frames throw on localStorage access, which would crash the
  // widget at startup. Substitute a memory store (not persisted).
  function makeMemoryStorage() {
    var data = {};
    return {
      getItem: function (k) {
        k = String(k);
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (k, v) { data[String(k)] = String(v); },
      removeItem: function (k) { delete data[String(k)]; },
      clear: function () { data = {}; },
      key: function (i) { var keys = Object.keys(data); return i < keys.length ? keys[i] : null; },
      get length() { return Object.keys(data).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    var works = false;
    try { works = !!window[name]; } catch (_) {}
    if (!works) {
      try { Object.defineProperty(window, name, { value: makeMemoryStorage(), configurable: true }); } catch (_) {}
    }
  });

  // Without allow-forms the browser never fires "submit". Recreate the event so
  // widgets written with <form onsubmit> still work; real submission stays blocked.
  function fireSubmit(form, submitter) {
    if (typeof form.reportValidity === "function" && !form.reportValidity()) return;
    var event;
    try {
      event = new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: submitter || null });
    } catch (_) {
      event = new Event("submit", { bubbles: true, cancelable: true });
    }
    form.dispatchEvent(event);
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("button, input[type=submit], input[type=image]") : null;
    if (!t || !t.form || t.disabled || e.defaultPrevented) return;
    var type = (t.getAttribute("type") || "submit").toLowerCase();
    if (t.tagName === "BUTTON" && type !== "submit") return;
    fireSubmit(t.form, t);
  });
  // Enter in a field: with a submit button the browser clicks it for us (handled
  // above), so only forms without one need help here.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
    var t = e.target;
    if (!t || t.tagName !== "INPUT" || !t.form) return;
    var skip = ["button", "checkbox", "radio", "reset", "file", "color", "range", "submit", "image"];
    if (skip.indexOf((t.type || "").toLowerCase()) >= 0) return;
    if (t.form.querySelector("button:not([type]), button[type=submit], input[type=submit], input[type=image]")) return;
    e.preventDefault();
    fireSubmit(t.form, null);
  });
  try {
    HTMLFormElement.prototype.requestSubmit = function (submitter) { fireSubmit(this, submitter); };
  } catch (_) {}

  // --- Storage requests ------------------------------------------------------

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
    if (data.kind === "theme") { applyTheme(data.theme, data.tokens); return; }
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
    themeTokens: THEME_TOKENS,
    maxErrorReports: LIMITS.maxErrorReportsPerDocument,
    maxErrorLength: LIMITS.maxErrorMessageLength,
    keyPattern: STORAGE_KEY_PATTERN.source,
    // Longer than the parent's own timeout so the parent's specific error wins.
    timeoutMs: LIMITS.requestTimeoutMs + 2_000,
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return RUNTIME_SOURCE.replace("__WZ_CONFIG__", json);
}
