/* Career Coach — mobile bottom tab bar "More" menu toggle. Desktop nav is
   untouched; this only wires up the phone-width tab bar's overflow sheet. */
(function () {
  const moreBtn = document.getElementById("tab-more-btn");
  const sheet = document.getElementById("mobile-more-sheet");
  if (!moreBtn || !sheet) return;

  function closeSheet() {
    sheet.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
    moreBtn.classList.remove("active");
  }
  function openSheet() {
    sheet.hidden = false;
    moreBtn.setAttribute("aria-expanded", "true");
    moreBtn.classList.add("active");
  }

  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sheet.hidden) openSheet();
    else closeSheet();
  });

  document.addEventListener("click", (e) => {
    if (!sheet.hidden && !sheet.contains(e.target) && e.target !== moreBtn) closeSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });
})();
