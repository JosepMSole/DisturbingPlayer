(() => {
  const IMG_ID = "openPlayerImg";
  const POPUP_NAME = "DisturbingPlayer";
  const FALLBACK_ID = "fallback";
  const FALLBACK_CLOSE_ID = "fallbackClose";

  function centerSpecs(w, h) {
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop  = window.screenTop  ?? window.screenY ?? 0;
    const width  = window.innerWidth  ?? document.documentElement.clientWidth  ?? screen.width;
    const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;

    const left = Math.max(0, dualScreenLeft + (width - w) / 2);
    const top  = Math.max(0, dualScreenTop  + (height - h) / 2);

    return `popup=yes,width=${w},height=${h},left=${Math.floor(left)},top=${Math.floor(top)}`;
  }

  function showFallback() {
    const fb = document.getElementById(FALLBACK_ID);
    if (fb) fb.style.display = "flex";
  }

  function hideFallback() {
    const fb = document.getElementById(FALLBACK_ID);
    if (fb) fb.style.display = "none";
  }

  function openPlayer() {
    // Call window.open synchronously from the click to preserve "user gesture"
    const specs = centerSpecs(980, 520);
    const win = window.open("player.html", POPUP_NAME, specs);
    if (!win) {
      showFallback();
      return;
    }
    win.focus();
  }

  window.addEventListener("DOMContentLoaded", () => {
    const img = document.getElementById(IMG_ID);
    if (img) {
      img.addEventListener("click", openPlayer);
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPlayer();
        }
      });
    }

    const closeBtn = document.getElementById(FALLBACK_CLOSE_ID);
    if (closeBtn) closeBtn.addEventListener("click", hideFallback);

    const fb = document.getElementById(FALLBACK_ID);
    if (fb) fb.addEventListener("click", (e) => {
      if (e.target === fb) hideFallback();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideFallback();
    });
  });
})();