/* Career Coach — app mode. Registers the service worker and wires the
   "Install the app" links (footer + mobile More sheet). Chrome/Edge/Android
   get the native install prompt; iPhone gets Add-to-Home-Screen steps, since
   Safari has no install prompt. Links stay hidden once running as the app. */
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add("is-app");

  const links = document.querySelectorAll("[data-install-app]");
  if (standalone || !links.length) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferred = null;

  function show() { links.forEach((l) => { l.hidden = false; }); }
  function hide() { links.forEach((l) => { l.hidden = true; }); }

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", () => { deferred = null; hide(); });
  if (isIOS) show();

  function iosHelp() {
    const box = document.createElement("div");
    box.className = "install-help";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Install Career Coach");
    box.innerHTML =
      '<p><strong>Add Career Coach to your Home Screen</strong></p>' +
      '<ol><li>Tap the <strong>Share</strong> button in Safari.</li>' +
      '<li>Choose <strong>Add to Home Screen</strong>.</li>' +
      '<li>Tap <strong>Add</strong> — it opens like an app from then on.</li></ol>' +
      '<button type="button" class="btn btn-primary">Got it</button>';
    box.querySelector("button").addEventListener("click", () => box.remove());
    document.body.appendChild(box);
  }

  links.forEach((l) => l.addEventListener("click", async (e) => {
    e.preventDefault();
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      hide();
    } else if (isIOS) {
      iosHelp();
    }
  }));
})();
