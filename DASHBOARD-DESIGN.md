# Seçim Dashboard Tasarımı — Araştırma + Önerilen Yapı

Bu dokuman, modern political election dashboard pattern'lerini analiz edip THINKER-CO `dhont-mv-senaryo` projesi için somut tasarım önerisi geliştirir. Kaynaklar: NYT 2024 Precinct Map, Bloomberg US Live Map, Guardian EU 2024 Parliament, Flourish Parliament Charts, 270toWin, Mapbox Elections.

**Ek arastirma:** [[projects/dhont-mv-senaryo/web-export/DASHBOARD-RESEARCH.md|DASHBOARD-RESEARCH]] — 12 benzer panelin (270toWin, ElectoSIM, Electoral Calculus, NYT, VoteHub, Flourish, BBC, Antony Green, Berly D'Hondt, IMF/WB, FT, Tilegrams) detayli UI/UX kiyasi + bizim panele 10 oncelikli iyileme onerisi.

---

## 1. Modern Dashboard Pattern Analizi

### 1.1 NYT 2024 Precinct Map
- **Yapı:** Tek büyük zoomlanabilir harita + side panel
- **Renkler:** Margin shading (kırmızı/mavi yoğunluğu = kazanma marjı)
- **Etkileşim:** Hover → tooltip; click → state/precinct detay panel
- **Veri katmanları:** Toggle ile state/county/precinct seviye
- **UX prensibi:** "Map is the dashboard" — harita ana element, diğer hepsi destekleyici

### 1.2 Bloomberg 2024 US Live Map
- **Yapı:** 3 panel: harita (sol-orta), live ticker (üst), state detay (sağ)
- **Renkler:** Bichromatic (Trump kırmızı / Harris mavi), nötr beyaz
- **Etkileşim:** Live update, hover detail, swing state highlight
- **UX prensibi:** "Density of information without overwhelm" — bilgi yoğun ama hiyerarşik

### 1.3 Guardian EU 2024 Parliament
- **Yapı:** Hemicycle parliament chart (yarım daire) + group bar chart altında
- **Renkler:** Her group için belirgin parti renkleri
- **Etkileşim:** Group click → o group'un member partileri listesi
- **UX prensibi:** "Story-driven" — şehir/ülke gezintisi anlatımla bütünleşmiş

### 1.4 Flourish Parliament Chart
- **Yapı:** Sade hemicycle + altında parti listesi
- **Etkileşim:** Dropdown ile farklı kategori subset göster (örnek: "Sadece muhalefet")
- **UX prensibi:** "Embeddable" — minimal frame, JS init bir satır

### 1.5 270toWin Interactive Map
- **Yapı:** ABD eyalet haritası + her state click ile parti atama
- **Etkileşim:** Drag/click state → kullanıcı kendi senaryosunu oluşturur
- **UX prensibi:** "What-if simulator" — kullanıcı senaryoyu kendisi inşa eder

---

## 2. Yaygın Tasarım İlkeleri (sentez)

### A) Görsel Hiyerarşi
1. **Üst (Hero):** Toplam dağılım — büyük rakam (örn. "184 CHP") + kazanan eşik göstergesi
2. **Orta-Sol (Map):** Çevre/il haritası — kazanan parti rengiyle dolu
3. **Orta-Sağ (Detail Panel):** Seçili parti veya çevre detayı
4. **Alt (Controls):** Parti slider'ları, baraj toggle, vs.

### B) Renk Sistemi
- **Parti renkleri** sabit, marka-uyumlu (CHP kırmızı, AKP turuncu vs.)
- **Boş/nötr alan** açık gri (`#F3F4F6`)
- **Hover state** parti renginin %20 opacity'sini, **active state** %40
- **Border** sadece çevre/il sınırlarında, beyaz veya açık gri 0.5px

### C) Etkileşim Pattern'leri
- **Slider** ile parti oyları (continuous değiştirme) → her input event'te yeniden hesap
- **Dropdown** ile odak parti seçimi → harita o partinin il-bazlı paylarına yeniden boyanır
- **Hover** → tooltip (parti, MV, oy %)
- **Click** → side panel detay (o ilin/çevrenin tam dökümü)
- **Toggle** baraj exempt, MHP/SOL → on/off

### D) Bilgi Yoğunluğu Kuralı
- **3-saniye kuralı:** Kullanıcı sayfayı açtığında ilk 3 saniyede "kim kazanıyor, kaç MV ile" görmeli
- **One-glance summary:** Üst bandda toplam dağılım her zaman görünür
- **Progressive disclosure:** Detay isteğe bağlı (dropdown, click, hover)

### E) Mobile/Responsive
- 768px altı: Tek kolon (harita üstte, kontroller altta)
- Slider'lar yerine numeric input + step buttons
- Harita zoomable, pinch-friendly

---

## 3. THINKER-CO için Önerilen Dashboard Yapısı

```
┌─────────────────────────────────────────────────────────────────┐
│ HERO BAR                                                        │
│ "Senaryo: CHP 184 · AKP 183 · MI 106 · DEM 62 · MG 44 · ..."   │
│ Çoğunluk eşiği: 301  ◊  Cumhur 200 (33%)  ◊  Muhalefet 400      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────────────┐
│ SOL PANEL (Kontroller)   │  │ ANA HARITA (Türkiye, kazanan)    │
│                          │  │                                  │
│ ▸ Parti Seçici (dropdown)│  │   [renk: kazanan parti]          │
│   ◯ Tümü (kazanan)       │  │   [hover: tooltip il+MV]         │
│   ● CHP                  │  │   [click: detay panel]           │
│   ◯ AKP                  │  │                                  │
│   ◯ ...                  │  │                                  │
│                          │  │                                  │
│ ▸ Senaryo Slider'lar     │  │                                  │
│   CHP   29.1% [████░░]   │  │                                  │
│   AKP   25.4% [███░░░]   │  │                                  │
│   ...                    │  │                                  │
│                          │  │                                  │
│ ▸ Baraj                  │  │                                  │
│   ☑ MHP baraj-exempt     │  │                                  │
│   ☑ SOL baraj-exempt     │  │                                  │
└──────────────────────────┘  └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ MECLIS HEMICYCLE (yarım daire — 600 koltuk)                     │
│              [parti renkleriyle noktalar]                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────────────┐
│ OY vs MV ORANI (Chart.js)│  │ DETAY TABLO (seçili partiye göre)│
│ [bar chart, 8 parti]     │  │ İl listesi: parti MV + oy %      │
└──────────────────────────┘  └──────────────────────────────────┘
```

### Komponentler

#### 3.1 Hero Bar (üst)
- Toplam dağılım badge'leri (parti rengiyle dolu pill'ler)
- Çoğunluk eşiği göstergesi (600/2+1 = 301)
- Cumhur eksen / Muhalefet eksen toplamları

#### 3.2 Sol Panel (kontroller)
- **Parti Dropdown** — odak seçici:
  - "Tümü (kazanan)" → harita kazanan parti rengiyle
  - "CHP" → harita CHP oy % gradient (beyaz → CHP kırmızı)
  - Aynı şekilde 8 parti seçeneği
- **Senaryo Slider'lar** — 8 parti
- **Toplam göstergesi** — 100±0.5 yeşil, dışı kırmızı
- **Baraj toggle'lar** — MHP/SOL exempt

#### 3.3 Ana Harita
- **Mod 1 (Kazanan):** Her il kazanan parti rengiyle (kategorik palet)
- **Mod 2 (Tek parti odak):** Seçili parti oy % gradient (beyaz → parti rengi)
- Hover → tooltip: `<il adı>: <kazanan> · MV: <sayı> · CHP %X · AKP %Y...`
- Click → side panel'da il detayı

#### 3.4 Meclis Hemicycle (yarım daire)
- 600 koltuk yarım daire üzerinde, parti rengiyle nokta
- 301 çoğunluk çizgisi (vertical line)
- Üstte legend (parti × MV badge)

#### 3.5 Oy vs MV Oranı
- Chart.js bar (her parti için iki bar: oy % vs MV %)
- Sapma görsel olarak okunur: AKP %25.7 oy → %30.5 MV (+5pp avantaj)

#### 3.6 Detay Tablo
- Seçili partinin il-bazlı MV ve oy % tablosu, sıralanabilir
- "Tümü" modunda: il listesi + kazanan parti rengi

#### 3.7 Çıkarılan: Allokasyon Turları
- Yoldas isteği — bu grafik silinir (kullanıcı hipotezini değiştirebileceği için tur-tur akış informatik bir detay, dashboard kullanımı için fazla)

---

## 4. Veri Kaynağı Akışı

```
Browser yükleme
    │
    ▼
fetch('data/meta.json')         → renkler, default, baraj_exempt
fetch('data/cevre_seats.json')  → 87 çevre × MV
fetch('data/ilce_baseline.json')→ 979 ilçe × 8 parti + MG ağırlık
fetch('data/turkey_il.geojson') → 81 il poligon (haritalar için)
    │
    ▼
Pipeline.load()                  → motor hazır
    │
    ▼
Kullanıcı slider çekiyor →  motor.run(senaryo)  →  sonuç
                              ↓
                    render: hero, harita, hemicycle, chart, tablo
```

### Performans
- İlk yükleme: ~250 KB JSON + ~500 KB geojson = ~750 KB (gzipped ~200 KB)
- Slider input: 5-15 ms hesap + 30-50 ms render = <100 ms total → smooth UX

---

## 5. Teknik Stack Önerisi

### Minimum (vanilla — bizim mevcut yaklaşım)
- HTML + CSS + ES Module JS
- **Map:** D3.js v7 (sf geojson + path) — Leaflet gerekmiyor cunku zoom/pan opsiyonel
- **Charts:** Chart.js (Bloomberg/NYT tarzı)
- **Hemicycle:** SVG arc generator (D3.arc veya custom)

**Boyut:** Toplam ~120 KB JS (D3 + Chart.js + bizim pipeline)

### Production-grade (yoldas tercih ederse)
- **Astro 5 + Vue 3** (ankar-diyarbakir-2026 / pendik-secim-2024 patterni)
- **Tailwind CSS** — utility-first, hızlı iteration
- **GSAP** opsiyonel — geçişler için
- **Vercel/Cloudflare Pages** deployment

### Bizim mevcut paket
- Vanilla `dhondt-pipeline.js` (ES Module) → her stack ile uyumlu
- HTML örnek (`interactive.html`) → minimal
- Astro/Vue/React entegrasyonu için sadece import + reactive state'e bağla

---

## 6. Aksesibilite (a11y)

- `aria-label` her interaktif element
- Harita için `role="img"` + summary text (`<title>` SVG içinde)
- Renk-bagimsiz kavrayış: kazanan ilin partisi tooltip'te text olarak da gözüksün (renk-körü kullanıcılar için)
- Klavye navigasyonu: Tab ile parti dropdown, slider'lar gezilebilir
- Yüksek kontrast modu: parti renkleri 4.5:1 kontrast oranı sağlamalı

---

## 7. Implementasyon Önerisi (Phase'li)

### Phase 1 — MVP (bu paket teslim)
- ✅ JS pipeline + JSON veri (mevcut)
- ✅ Basit interaktif HTML (mevcut)
- 🔨 Dashboard layout (üst hero + sol panel + harita + alt grafikler)
- 🔨 Parti dropdown
- 🔨 Türkiye haritası (D3 + il geojson)
- 🔨 Meclis hemicycle (SVG yarım daire)

### Phase 2 — Refinements
- Çevre seviyesi harita (İstanbul 1/2/3 ayrı)
- Senaryo karşılaştırma (yan yana 2 senaryo)
- URL state (slider değerleri URL'e kayıt → paylaşılabilir)
- Export PNG/CSV

### Phase 3 — Production
- Astro 5 + Vue 3 portu
- Tailwind tasarımı
- Cloudflare Pages deploy

---

## 8. Yararlanılan Kaynaklar

| Kaynak | URL | Pattern öğrenimi |
|---|---|---|
| NYT 2024 Precinct Map | nytimes.com/interactive/2025/us/elections/2024-election-map-precinct-results.html | Zoom + side panel detay |
| Bloomberg US Live | bloomberg.com/graphics/2024-us-election-results/ | 3-panel layout + live ticker |
| Guardian EU 2024 | theguardian.com/world/ng-interactive/2024/jun/09/european-elections-results-2024-europe-eu-parliament | Hemicycle + group expand |
| Flourish | flourish.studio/visualisations/parliament-charts/ | Embeddable parliament chart |
| 270toWin | 270towin.com/ | "What-if" simülatör pattern'i |
| Mapbox Elections | mapbox.com/elections | Choropleth+thematic katmanlar |
| WA Community Alliance | wacommunityalliance.github.io/WashingtonElectionsDashboard/ | Free open dashboard örneği |

---

## 9. Final Karar — Bizim Dashboard

Aşağıdaki bileşenleri içeren tek `dashboard.html`:

1. **Hero bar** (üst, sticky)
2. **Sol panel** (slider'lar + parti dropdown + baraj toggle)
3. **Ana harita** (D3 + il geojson, mode = "kazanan" veya "tek parti odak")
4. **Hemicycle** (SVG, 600 koltuk yarım daire)
5. **Oy vs MV bar chart** (Chart.js)
6. **Detay tablo** (seçili partiye göre il listesi)
7. **Allokasyon turları YOK** (yoldas isteği)

Vanilla JS (no framework) — `dhondt-pipeline.js` motoruyla çalışır. Astro/Vue port'u sonraki phase'de.

Devam edip implementasyona başlıyorum.
