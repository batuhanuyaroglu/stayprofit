// iOS Safari: ekran klavyesi açılınca düzen viewport'u küçülmez; klavye sayfanın üstüne biner ve
// alttaki sabit sonuç çubuğu klavyenin arkasında kalır. visualViewport ile klavyenin kapladığı
// yüksekliği ölçüp çubuğu klavyenin hemen üstüne taşırız (CSS değişkeni --kb-offset).
// Android Chrome (interactive-widget=resizes-content) düzen viewport'unu kendisi küçülttüğü için
// ölçülen fark ~0'dır; bu modül orada hiçbir şey değiştirmez.
// visualViewport yoksa hiçbir şey yapılmaz: yalnızca CSS davranışı geçerli kalır.

/** Klavyenin (veya benzeri bir arayüzün) alttan kapladığı piksel; yakınlaştırmada 0. */
export function keyboardInset({ innerHeight, vvHeight, vvOffsetTop, scale = 1 }) {
  const values = [innerHeight, vvHeight, vvOffsetTop, scale];
  if (!values.every((v) => Number.isFinite(v))) return 0;
  if (scale > 1.01) return 0; // pinch-zoom: ölçüm anlamsız
  const inset = innerHeight - vvHeight - vvOffsetTop;
  return inset > 1 ? Math.round(inset) : 0;
}

const FIELD_SELECTOR = "input, select, textarea";

export function initKeyboardBar(win = globalThis.window) {
  const vv = win?.visualViewport;
  if (!vv || !win.document) return () => {};

  const root = win.document.documentElement;
  let frame = 0;
  let open = false;

  function apply() {
    frame = 0;
    const inset = keyboardInset({
      innerHeight: win.innerHeight,
      vvHeight: vv.height,
      vvOffsetTop: vv.offsetTop,
      scale: vv.scale,
    });
    const nowOpen = inset > 0;
    root.style.setProperty("--kb-offset", `${inset}px`);
    if (nowOpen !== open) {
      open = nowOpen;
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
      // Klavye yeni açıldı: odaktaki alan çubuğun altında kalmasın.
      const active = win.document.activeElement;
      if (open && active?.matches?.(FIELD_SELECTOR)) active.scrollIntoView({ block: "nearest" });
    }
  }

  // resize ve scroll peş peşe çok sık gelir; kare başına en fazla bir kez çalış.
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(apply);
  };

  vv.addEventListener("resize", schedule, { passive: true });
  vv.addEventListener("scroll", schedule, { passive: true });
  apply();

  return () => {
    vv.removeEventListener("resize", schedule);
    vv.removeEventListener("scroll", schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
