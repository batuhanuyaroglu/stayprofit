import { test } from "node:test";
import assert from "node:assert/strict";
import { keyboardInset, initKeyboardBar } from "../src/js/ui/keyboard-bar.js";

test("keyboardInset: klavye kapalı veya Android (düzen küçülür) için 0", () => {
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: 800, vvOffsetTop: 0, scale: 1 }), 0);
  assert.equal(keyboardInset({ innerHeight: 500, vvHeight: 500, vvOffsetTop: 0, scale: 1 }), 0);
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: 799.5, vvOffsetTop: 0, scale: 1 }), 0);
});

test("keyboardInset: iOS klavye yüksekliğini hesaplar (sayfa kaymış olsa da)", () => {
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: 500, vvOffsetTop: 0, scale: 1 }), 300);
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: 500, vvOffsetTop: 120, scale: 1 }), 180);
});

test("keyboardInset: yakınlaştırmada ve geçersiz değerde 0", () => {
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: 400, vvOffsetTop: 0, scale: 2 }), 0);
  assert.equal(keyboardInset({ innerHeight: NaN, vvHeight: 400, vvOffsetTop: 0, scale: 1 }), 0);
  assert.equal(keyboardInset({ innerHeight: 800, vvHeight: undefined, vvOffsetTop: 0 }), 0);
});

test("initKeyboardBar: visualViewport yoksa güvenli geri dönüş, hata yok", () => {
  assert.equal(typeof initKeyboardBar({ document: {} }), "function");
  assert.equal(typeof initKeyboardBar(undefined), "function");
});

function fakeWindow({ innerHeight, vv }) {
  const listeners = {};
  const style = {};
  const dataset = {};
  const queue = [];
  const win = {
    innerHeight,
    document: {
      activeElement: null,
      documentElement: { style: { setProperty: (k, v) => (style[k] = v) }, dataset },
    },
    visualViewport: {
      ...vv,
      addEventListener: (type, fn) => (listeners[type] = fn),
      removeEventListener: (type) => delete listeners[type],
    },
    requestAnimationFrame: (fn) => queue.push(fn), // gerçek rAF gibi sonraki karede çalışır
    cancelAnimationFrame() {},
  };
  const flush = () => queue.splice(0).forEach((fn) => fn());
  return { win, listeners, style, dataset, flush };
}

test("initKeyboardBar: klavye açılıp kapanınca --kb-offset ve data-keyboard güncellenir", () => {
  const f = fakeWindow({ innerHeight: 800, vv: { height: 800, offsetTop: 0, scale: 1 } });
  const stop = initKeyboardBar(f.win);
  assert.equal(f.style["--kb-offset"], "0px");
  assert.equal(f.dataset.keyboard, undefined);

  f.win.visualViewport.height = 480; // klavye açıldı
  f.listeners.resize();
  f.listeners.resize(); // peş peşe olaylar tek karede birleşir
  f.flush();
  assert.equal(f.style["--kb-offset"], "320px");
  assert.equal(f.dataset.keyboard, "open");

  f.win.visualViewport.height = 800; // klavye kapandı
  f.listeners.resize();
  f.flush();
  assert.equal(f.style["--kb-offset"], "0px");
  assert.equal(f.dataset.keyboard, undefined);

  stop();
  assert.equal(Object.keys(f.listeners).length, 0); // dinleyiciler temizlendi
});
