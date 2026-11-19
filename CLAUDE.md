# StayProfit

**Slogan:** Know Your Real Rental Profit.

## Amaç ve kapsam
Tatil amaçlı kiralama yapan ev sahipleri ve profesyonel mülk yöneticileri için kira kârlılığı hesaplama platformu. Hedef: Türkiye ve global. Diller: Türkçe ve İngilizce. Tasarım: premium SaaS. İlk sürümde backend ve veritabanı yok.

## İletişim
- Kullanıcıyla her zaman Türkçe iletişim kur.
- Düşük token tüketimi: kısa yanıt ver, gereksiz açıklama/planlama yapma, yalnızca gereken dosyaları oku.

## Teknoloji
HTML5, CSS3, Vanilla JavaScript, JSON localization. Framework veya bağımlılık, açık gerekçe ve onay olmadan eklenmez.

## Kodlama standartları
- ES modülleri, `const`/`let`, `"use strict"` gerektiğinde; küçük ve tek amaçlı fonksiyonlar.
- CSS: değişkenler (custom properties), mobile-first, BEM benzeri sınıf adları.
- Kullanıcıya görünen tüm metinler JSON çeviri dosyalarından gelir; koda gömülmez. İstisnalar (yalnızca `src/index.html`, sabit TR+EN): `file://` uyarısı ve "iki dil dosyası da yüklenemedi" hata kutusu.
- Uygulama ES modülleri ve `fetch` kullandığından `npm start` (`scripts/dev-server.js`: Node.js, bağımlılıksız, `src` kökü, yalnızca localhost:8000) ile çalıştırılır; `file://` desteklenmez.
- `localStorage` yalnızca dil (`stayprofit.lang`) ve tema (`stayprofit.theme`: light/dark) tercihi için kullanılır; mali veriler asla saklanmaz.
- Renkler yalnızca `src/css/tokens.css` değişkenlerinden gelir (açık tema `:root`, koyu tema `:root[data-theme="dark"]`); diğer CSS dosyalarında ham renk yazılmaz. `<head>` içindeki küçük satır içi tema scripti (metinsiz) ilk boyamadaki titremeyi önler; `file://`/hata kutuları gibi bir istisnadır.
- Sayı girişi UI'da ayrıştırılır (`parse-number.js`); motor metni dönüştürmez. Belirsiz ayraçlı girdi hata verir.
- Dosya/klasör adları küçük harf; `calculateProfit.js` ve `calculateSeasonalProfit.js` bilinçli istisnadır (camelCase). Yeni dosyalarda kebab-case. Mevcut stile uy.

## Dosya yapısı (hedef)
```
StayProfit/
├─ .claude/agents/      # uzman agent tanımları
├─ package.json         # type: module, npm test (node:test), npm start (scripts/dev-server.js)
├─ scripts/             # dev-server.js (yerel geliştirme sunucusu)
├─ src/
│  ├─ index.html
│  ├─ calculator/       # hesaplama motoru (UI'dan bağımsız): calculateProfit.js, calculateSeasonalProfit.js, validation.js, seasonal-validation.js
│  ├─ css/
│  ├─ js/
│  │  └─ ui/
│  └─ locales/          # tr.json, en.json
├─ tests/
├─ CLAUDE.md
├─ README.md
└─ .gitignore
```

## Agent kullanım politikası
- Ana Claude Code görev yöneticisidir; işi ilgili agent'a devreder.
- Agent'lar: `architect`, `frontend`, `calculation`, `seo-localization`, `qa-reviewer`.
- Her görevde yalnızca gereken agent çalıştırılır; gereksiz paralel çalışma yapılmaz.
- Agent'lar alt agent oluşturmaz ve birbirlerinin alanına müdahale etmez.
- `qa-reviewer` varsayılan olarak salt okunurdur.

## Güvenlik ve kalite
- Kullanıcı girdisi `innerHTML` ile yazılmaz; `textContent` kullanılır.
- Gizli bilgi/anahtar repoya konmaz. Harici script/CDN gerekçesiz eklenmez.
- Erişilebilirlik (semantik HTML, kontrast, klavye) ve responsive zorunlu.
- Mevcut klasör dışındaki dosyalara dokunulmaz; dosyalar sorulmadan silinmez/üzerine yazılmaz.
- Commit ve push yalnızca kullanıcı onayıyla.

## Finansal hesaplama doğruluğu
- Hesaplama kodu UI'dan ayrı, saf fonksiyonlardan oluşur ve test edilir.
- Sıfır, negatif, boş ve NaN girdiler güvenle işlenir; sıfıra bölme yoktur.
- Yuvarlama yalnızca gösterimde yapılır; formüller ve varsayımlar kodda belgelenir.
- Para birimi ve sayı biçimi locale'e göre (`Intl.NumberFormat`).
