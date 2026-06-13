/* RESELLER TOOLKIT — merged Profit Calculator + Inventory Tracker.
   One app, one localStorage store, no backend. The calculator can push a deal
   straight into inventory, and "mark sold" reuses the saved fee math to compute
   true realized profit. */
(function () {
  "use strict";

  var KEY = "rt.inventory.v1";
  var $ = function (id) { return document.getElementById(id); };

  function money(n) { return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2); }
  function pct(n) { return (n * 100).toFixed(1) + "%"; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) && v >= 0 ? v : 0; }

  /* ========== shared store ========== */
  function getItems() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function setItems(x) { try { localStorage.setItem(KEY, JSON.stringify(x)); } catch (e) {} }
  function newId() { return "i" + Date.now().toString(36) + getItems().length; }

  var toastT;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("hidden"); }, 1900);
  }

  /* ========== CALCULATOR ========== */
  function calc(v) {
    var platformFee = v.salePrice * (v.feePct / 100);
    var totalFees = platformFee + v.fixedFee;
    var net = v.salePrice - platformFee - v.fixedFee - v.shipping - v.cogs - v.extra;
    var margin = v.salePrice > 0 ? net / v.salePrice : 0;
    var roi = v.cogs > 0 ? net / v.cogs : null;
    return { totalFees: totalFees, net: net, margin: margin, roi: roi };
  }
  function breakEven(v, m) {
    var denom = 1 - v.feePct / 100 - m;
    if (denom <= 0) return null;
    return (v.fixedFee + v.shipping + v.cogs + v.extra) / denom;
  }
  function calcInputs() {
    return { salePrice: num("salePrice"), cogs: num("cogs"), shipping: num("shipping"),
      feePct: num("feePct"), fixedFee: num("fixedFee"), extra: num("extra") };
  }
  function activePlatform() {
    var c = document.querySelector(".chip.is-active");
    return c ? c.textContent.trim() : "";
  }
  function renderCalc() {
    var v = calcInputs(), r = calc(v);
    var netEl = $("netProfit");
    netEl.textContent = money(r.net);
    netEl.className = "v-net " + (r.net < 0 ? "neg" : "");
    $("margin").textContent = pct(r.margin);
    $("roi").textContent = r.roi === null ? "—" : pct(r.roi);
    $("totalFees").textContent = money(r.totalFees);
    var be = breakEven(v, num("targetMargin") / 100);
    $("breakeven").textContent = be === null ? "N/A" : money(be);
  }
  function addCalcToInventory() {
    var v = calcInputs();
    var name = window.prompt("NAME THIS ITEM:", "Item " + (getItems().length + 1));
    if (name === null) return;
    var items = getItems();
    items.push({
      id: newId(), name: name || ("Item " + (items.length + 1)),
      cost: v.cogs, list: v.salePrice, date: todayISO(),
      platform: activePlatform() === "CUSTOM" ? "" : activePlatform(),
      feePct: v.feePct, fixedFee: v.fixedFee, shipping: v.shipping,
      status: "active", soldPrice: 0, soldDate: "", realizedNet: 0,
    });
    setItems(items);
    renderInventory();
    toast("Added to inventory");
    switchTab("inventory");
  }

  /* ========== INVENTORY ========== */
  var filter = "active";
  function daysBetween(fromISO, toISO) {
    var a = new Date(fromISO + "T00:00:00"), b = new Date((toISO || todayISO()) + "T00:00:00");
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function ageBucket(d) {
    if (d <= 30) return { k: "fresh", t: "0–30D" };
    if (d <= 90) return { k: "watch", t: "31–90D" };
    return { k: "dead", t: "90+D" };
  }
  function realizedNet(it, soldPrice) {
    return soldPrice - soldPrice * ((it.feePct || 0) / 100) - (it.fixedFee || 0) - (it.shipping || 0) - (it.cost || 0);
  }

  function renderSummary() {
    var items = getItems();
    var active = items.filter(function (i) { return i.status !== "sold"; });
    var sold = items.filter(function (i) { return i.status === "sold"; });
    var capital = active.reduce(function (s, i) { return s + (i.cost || 0); }, 0);
    var potential = active.reduce(function (s, i) { return s + (i.list || 0); }, 0);
    var dead = active.filter(function (i) { return daysBetween(i.date) > 90; });
    var deadVal = dead.reduce(function (s, i) { return s + (i.cost || 0); }, 0);
    var realized = sold.reduce(function (s, i) { return s + (i.realizedNet || 0); }, 0);
    var st = items.length ? sold.length / items.length : 0;
    var cards = [
      { n: active.length, l: "Active items" },
      { n: money(capital), l: "Capital tied up" },
      { n: money(potential), l: "Potential revenue" },
      { n: dead.length + " · " + money(deadVal), l: "Dead stock 90+d", cls: "dead" },
      { n: money(realized), l: "Realized profit", cls: "profit" },
      { n: Math.round(st * 100) + "%", l: "Sell-through" },
    ];
    $("summary").innerHTML = cards.map(function (c) {
      return "<div class='scard " + (c.cls || "") + "'><div class='n'>" + esc(c.n) + "</div><div class='l'>" + esc(c.l) + "</div></div>";
    }).join("");
  }

  function renderTable() {
    var items = getItems().filter(function (i) {
      if (filter === "all") return true;
      if (filter === "sold") return i.status === "sold";
      return i.status !== "sold";
    });
    items.sort(function (a, b) {
      if (a.status !== b.status) return a.status === "sold" ? 1 : -1;
      return (a.date || "").localeCompare(b.date || "");
    });
    $("itemsEmpty").classList.toggle("hidden", items.length > 0);
    $("itemsTable").classList.toggle("hidden", items.length === 0);
    $("itemsBody").innerHTML = items.map(function (it) {
      var sold = it.status === "sold";
      var days = daysBetween(it.date, sold ? it.soldDate : null);
      var b = ageBucket(days);
      var meta = [it.platform, sold ? ("SOLD " + money(it.soldPrice) + " · NET " + money(it.realizedNet)) : null].filter(Boolean).join(" · ");
      return "<tr>" +
        "<td class='nm'><b>" + esc(it.name) + "</b>" + (meta ? "<span class='meta'>" + esc(meta) + "</span>" : "") + "</td>" +
        "<td class='num'>" + money(it.cost || 0) + "</td>" +
        "<td class='num'>" + (it.list ? money(it.list) : "—") + "</td>" +
        "<td class='num'>" + days + "</td>" +
        "<td><span class='pill age-" + b.k + "'>" + b.t + "</span></td>" +
        "<td><span class='pill " + (sold ? "st-sold" : "st-active") + "'>" + (sold ? "SOLD" : "ACTIVE") + "</span></td>" +
        "<td class='num'>" + (sold ? "" : "<button class='rowbtn sold' data-act='sold' data-id='" + it.id + "'>SOLD</button>") +
          "<button class='rowbtn del' data-act='del' data-id='" + it.id + "'>✕</button></td>" +
        "</tr>";
    }).join("");
  }

  function renderInventory() {
    renderSummary(); renderTable();
    $("tabCount").textContent = getItems().filter(function (i) { return i.status !== "sold"; }).length;
  }

  function addItemManual(e) {
    e.preventDefault();
    var name = $("i_name").value.trim();
    var cost = parseFloat($("i_cost").value);
    if (!name || !isFinite(cost)) { toast("Name + cost required"); return; }
    var items = getItems();
    items.push({
      id: newId(), name: name, cost: cost, list: parseFloat($("i_list").value) || 0,
      date: $("i_date").value || todayISO(), platform: $("i_platform").value.trim(),
      feePct: 0, fixedFee: 0, shipping: 0, status: "active", soldPrice: 0, soldDate: "", realizedNet: 0,
    });
    setItems(items);
    e.target.reset(); $("i_date").value = todayISO();
    renderInventory(); $("i_name").focus(); toast("Item added");
  }

  function markSold(id) {
    var items = getItems(), it = items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var input = window.prompt("SOLD PRICE FOR \"" + it.name + "\":", it.list ? String(it.list) : "");
    if (input === null) return;
    var price = parseFloat(input);
    if (!isFinite(price)) { toast("Enter a valid price"); return; }
    it.status = "sold"; it.soldPrice = price; it.soldDate = todayISO();
    it.realizedNet = realizedNet(it, price);
    setItems(items); renderInventory();
    toast("Sold · net " + money(it.realizedNet));
  }
  function deleteItem(id) { setItems(getItems().filter(function (x) { return x.id !== id; })); renderInventory(); }

  /* ----- CSV ----- */
  function exportCsv() {
    var items = getItems();
    if (!items.length) { toast("Nothing to export"); return; }
    var head = ["name", "cost", "list", "date", "platform", "feePct", "fixedFee", "shipping", "status", "soldPrice", "soldDate", "realizedNet"];
    var escc = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = items.map(function (it) { return head.map(function (h) { return escc(it[h]); }).join(","); });
    var csv = [head.join(",")].concat(rows).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "reseller-inventory.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast("Exported " + items.length + " items");
  }
  function parseCsv(text) {
    var rows = [], row = [], f = "", i = 0, q = false, c;
    while (i < text.length) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else f += c;
      i++;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function importCsv(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var rows = parseCsv(String(reader.result));
        if (!rows.length) { toast("Empty CSV"); return; }
        var head = rows[0].map(function (h) { return h.trim(); }), idx = {};
        head.forEach(function (h, n) { idx[h] = n; });
        if (idx.name == null || idx.cost == null) { toast("CSV needs name,cost"); return; }
        var items = getItems(), added = 0;
        rows.slice(1).forEach(function (r) {
          var name = (r[idx.name] || "").trim(); if (!name) return;
          var g = function (k) { return idx[k] != null ? r[idx[k]] : ""; };
          items.push({
            id: newId(), name: name, cost: parseFloat(g("cost")) || 0, list: parseFloat(g("list")) || 0,
            date: (g("date") || todayISO()).trim(), platform: (g("platform") || "").trim(),
            feePct: parseFloat(g("feePct")) || 0, fixedFee: parseFloat(g("fixedFee")) || 0, shipping: parseFloat(g("shipping")) || 0,
            status: (g("status") || "active").trim() === "sold" ? "sold" : "active",
            soldPrice: parseFloat(g("soldPrice")) || 0, soldDate: (g("soldDate") || "").trim(), realizedNet: parseFloat(g("realizedNet")) || 0,
          });
          added++;
        });
        setItems(items); renderInventory(); toast("Imported " + added + " items");
      } catch (e) { toast("Bad CSV"); }
    };
    reader.readAsText(file);
  }

  /* ========== tabs ========== */
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("panel-calc").classList.toggle("hidden", name !== "calc");
    $("panel-inventory").classList.toggle("hidden", name !== "inventory");
  }

  /* ========== theme (default light; opt-in dark, persisted) ========== */
  var THEME_KEY = "rt.theme.v1";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var icon = $("themeIcon");
    if (icon) icon.textContent = t === "dark" ? "☾ DARK" : "☀ LIGHT";
  }
  function initTheme() {
    var saved;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved === "dark" ? "dark" : "light"); // default light, ignore OS
    var btn = $("themeToggle");
    if (btn) btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  /* ========== init ========== */
  function init() {
    initTheme();
    $("i_date").value = todayISO();
    // calculator
    ["salePrice", "cogs", "shipping", "feePct", "fixedFee", "extra", "targetMargin"].forEach(function (id) {
      $(id).addEventListener("input", renderCalc);
    });
    $("platformChips").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip"); if (!chip) return;
      document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
      chip.classList.add("is-active");
      $("feePct").value = chip.dataset.fee; $("fixedFee").value = chip.dataset.fixed;
      renderCalc();
    });
    $("addToInv").addEventListener("click", addCalcToInventory);
    // inventory
    $("addForm").addEventListener("submit", addItemManual);
    $("filterStatus").addEventListener("change", function (e) { filter = e.target.value; renderTable(); });
    $("exportBtn").addEventListener("click", exportCsv);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function (e) { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ""; });
    $("itemsBody").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.dataset.act === "sold") markSold(b.dataset.id); else deleteItem(b.dataset.id);
    });
    // tabs
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });

    renderCalc(); renderInventory();
  }

  window.RT = { calc: calc, breakEven: breakEven, ageBucket: ageBucket, realizedNet: realizedNet };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
