/* ============================================================
   Dil (TR/EN) ve tema (açık/koyu) yönetimi — tüm sayfalarda ortak
   ============================================================ */
(function () {
  var root = document.documentElement;

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  /* ---------- Dil ---------- */
  function applyLang(lang) {
    root.lang = lang;
    var title = root.getAttribute("data-title-" + lang);
    if (title) document.title = title;
    var desc = root.getAttribute("data-desc-" + lang);
    var meta = document.querySelector('meta[name="description"]');
    if (desc && meta) meta.setAttribute("content", desc);
    document.querySelectorAll("[data-set-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-set-lang") === lang ? "true" : "false");
    });
    document.querySelectorAll("[data-aria-tr]").forEach(function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-aria-" + lang));
    });
  }

  /* ---------- Tema ---------- */
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function currentTheme() { return root.getAttribute("data-theme") || (mq.matches ? "dark" : "light"); }
  function syncThemeColor() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", currentTheme() === "dark" ? "#132523" : "#f7f2ea");
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLang(root.lang || "tr");
    syncThemeColor();

    document.querySelectorAll("[data-set-lang]").forEach(function (b) {
      b.addEventListener("click", function () {
        var lang = b.getAttribute("data-set-lang");
        applyLang(lang);
        store("lang", lang);
      });
    });

    var tBtn = document.getElementById("theme-toggle");
    if (tBtn) tBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("theme", next);
      syncThemeColor();
    });

    var y = document.querySelectorAll("[data-year]");
    y.forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });

  mq.addEventListener && mq.addEventListener("change", syncThemeColor);
})();
