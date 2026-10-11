/** Hand-written widgets for exercising the engine without Luminal. */
export interface TestWidget {
  id: string;
  title: string;
  html: string;
}

export const TEST_WIDGETS: TestWidget[] = [
  {
    id: "test-poll",
    title: "Team poll (shared storage)",
    html: `<h3 style="margin-top:0">Which project should we prioritize?</h3>
<div id="opts"></div><p id="msg" style="color:var(--wz-muted)">Loading votes…</p>
<script>
  const OPTIONS = ["Mobile app", "Billing revamp", "Onboarding"];
  let votes = {};
  function render() {
    const total = OPTIONS.reduce((s, o) => s + (votes[o] || 0), 0);
    document.getElementById("opts").innerHTML = "";
    for (const o of OPTIONS) {
      const row = document.createElement("div");
      row.style.margin = "8px 0";
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Vote: " + o + " (" + (votes[o] || 0) + ")";
      b.onclick = () => vote(o);
      row.appendChild(b);
      document.getElementById("opts").appendChild(row);
    }
    document.getElementById("msg").textContent = total + " total votes";
  }
  async function vote(option) {
    try {
      votes = (await workspace.getShared("votes")) || {};
      votes[option] = (votes[option] || 0) + 1;
      await workspace.setShared("votes", votes);
      render();
    } catch (e) {
      document.getElementById("msg").textContent = "Could not save vote: " + e.message;
    }
  }
  workspace.getShared("votes")
    .then((v) => { votes = v || {}; render(); })
    .catch((e) => { document.getElementById("msg").textContent = "Could not load votes: " + e.message; });
</script>`,
  },
  {
    id: "test-notes",
    title: "Personal notes (personal storage)",
    html: `<textarea id="n" rows="6" style="width:100%;box-sizing:border-box" placeholder="Your private notes"></textarea>
<p id="s" style="color:var(--wz-muted)">Loading…</p>
<script>
  const box = document.getElementById("n"), status = document.getElementById("s");
  let timer;
  workspace.getPersonal("notes").then((v) => { box.value = v || ""; status.textContent = "Saved in this browser only"; })
    .catch((e) => { status.textContent = "Could not load: " + e.message; });
  box.addEventListener("input", () => {
    clearTimeout(timer);
    status.textContent = "Saving…";
    timer = setTimeout(() => workspace.setPersonal("notes", box.value)
      .then(() => { status.textContent = "Saved"; })
      .catch((e) => { status.textContent = "Could not save: " + e.message; }), 400);
  });
</script>`,
  },
  {
    id: "test-expenses",
    title: "Expense tracker (shared list + personal filter + form)",
    html: `<!DOCTYPE html><html><head><title>Team Expenses</title><style>
  form{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  table{width:100%;border-collapse:collapse} td{padding:4px;border-bottom:1px solid var(--wz-border)}
  label{margin-right:8px;color:var(--wz-muted)}
</style></head><body>
<form id="f">
  <input name="desc" placeholder="Description" required>
  <input name="amount" type="number" step="0.01" min="0" placeholder="Amount" required>
  <select name="cat"><option>Food</option><option>Travel</option><option>Software</option></select>
  <button>Add</button>
</form>
<div id="filters"></div><table id="t"></table><p id="total"></p><p id="err" style="color:var(--wz-danger)"></p>
<script>
  const CATS = ["Food", "Travel", "Software"];
  let expenses = [], hidden = [];
  const err = (e) => { document.getElementById("err").textContent = e ? "Error: " + e.message : ""; };
  function render() {
    const shown = expenses.filter((x) => !hidden.includes(x.cat));
    document.getElementById("t").innerHTML = shown.map((x) =>
      "<tr><td>" + x.desc.replace(/</g, "&lt;") + "</td><td>" + x.cat + "</td><td>$" + x.amount.toFixed(2) + "</td></tr>").join("");
    document.getElementById("total").textContent =
      "Shown: $" + shown.reduce((s, x) => s + x.amount, 0).toFixed(2) + " of $" + expenses.reduce((s, x) => s + x.amount, 0).toFixed(2);
    document.getElementById("filters").innerHTML = CATS.map((c) =>
      '<label><input type="checkbox" data-cat="' + c + '"' + (hidden.includes(c) ? "" : " checked") + "> " + c + "</label>").join("");
  }
  document.getElementById("filters").addEventListener("change", async (e) => {
    const c = e.target.dataset.cat;
    hidden = e.target.checked ? hidden.filter((h) => h !== c) : [...hidden, c];
    render();
    try { await workspace.setPersonal("hiddenCategories", hidden); err(); } catch (e) { err(e); }
  });
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      expenses = (await workspace.getShared("expenses")) || [];
      expenses.push({ desc: String(fd.get("desc")), amount: Number(fd.get("amount")), cat: String(fd.get("cat")) });
      await workspace.setShared("expenses", expenses);
      e.target.reset(); err(); render();
    } catch (e2) { err(e2); }
  });
  (async () => {
    try {
      expenses = (await workspace.getShared("expenses")) || [];
      hidden = (await workspace.getPersonal("hiddenCategories")) || [];
    } catch (e) { err(e); }
    render();
  })();
</script></body></html>`,
  },
  {
    id: "test-sloppy",
    title: "Sloppy AI habits (alert + localStorage)",
    html: `<button id="b">Say hi</button><p id="o"></p>
<script>
  const visits = Number(localStorage.getItem("visits") || 0) + 1;
  localStorage.setItem("visits", String(visits));
  document.getElementById("o").textContent = "Started without crashing (visits this session: " + visits + ")";
  document.getElementById("b").onclick = () => alert("Hello from inside the sandbox!");
</script>`,
  },
  {
    id: "test-counter",
    title: "Counter (interaction + theme)",
    html: `<!DOCTYPE html><html><head><style>
  .card{background:var(--wz-surface);border:1px solid var(--wz-border);border-radius:10px;padding:16px;text-align:center}
  .n{font-size:40px;font-weight:700;color:var(--wz-accent)}
</style></head><body>
  <div class="card"><div class="n" id="n">0</div>
  <button id="b" type="button">Click me</button>
  <p>Theme: <span id="t"></span></p></div>
<script>
  let n = 0;
  document.getElementById("b").addEventListener("click", () => {
    document.getElementById("n").textContent = String(++n);
  });
  const t = document.getElementById("t");
  t.textContent = workspace.theme;
  workspace.onThemeChange((theme) => { t.textContent = theme; });
</script></body></html>`,
  },
  {
    id: "test-countdown",
    title: "Countdown to Friday 5 PM",
    html: `<div style="text-align:center"><h3>Launch in</h3><div id="c" style="font-size:28px;font-weight:700"></div></div>
<script>
  function target() {
    const d = new Date(); d.setHours(17, 0, 0, 0);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    if (d <= new Date()) d.setDate(d.getDate() + 7);
    return d;
  }
  const end = target();
  function tick() {
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    document.getElementById("c").textContent =
      Math.floor(s / 86400) + "d " + Math.floor(s % 86400 / 3600) + "h " + Math.floor(s % 3600 / 60) + "m " + s % 60 + "s";
  }
  tick(); setInterval(tick, 1000);
</script>`,
  },
  {
    id: "test-escape",
    title: "Sandbox escape attempts (all should be blocked)",
    html: `<ul id="out"></ul><script>
  const out = document.getElementById("out");
  function check(name, fn) {
    let result;
    try { fn(); result = "ALLOWED"; } catch (e) { result = "blocked"; }
    const li = document.createElement("li");
    li.textContent = name + ": " + result;
    li.dataset.result = result;
    out.appendChild(li);
  }
  check("read parent DOM", () => window.parent.document.body.innerHTML);
  check("read cookies", () => document.cookie);
  check("use localStorage", () => window.localStorage.getItem("x"));
  check("navigate top window", () => { window.top.location.href = "https://example.com"; });
  fetch("https://example.com").then(
    () => { const li = document.createElement("li"); li.textContent = "network fetch: ALLOWED"; li.dataset.result = "ALLOWED"; out.appendChild(li); },
    () => { const li = document.createElement("li"); li.textContent = "network fetch: blocked"; li.dataset.result = "blocked"; out.appendChild(li); }
  );
</script>`,
  },
  {
    id: "test-broken",
    title: "Broken widget (throws errors)",
    html: `<p>This widget is intentionally buggy.</p>
<button type="button" onclick="undefinedFunction()">Trigger error</button>
<script>throw new Error("Startup failure from generated code");</script>`,
  },
  {
    id: "test-navigate",
    title: "Navigates away (should be stopped)",
    html: `<button type="button" id="go">Leave WorkspaceZero</button>
<script>document.getElementById("go").onclick = () => { location.href = "https://example.com"; };</script>`,
  },
];
