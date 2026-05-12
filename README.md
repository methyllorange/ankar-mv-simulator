# D'Hondt MV Dağıtım Motoru — Web Sürümü

Bu paket, varsayımsal Türkiye milletvekili seçimi senaryolarını D'Hondt yöntemiyle hesaplayan **browser-side** bir motor + statik baseline verilerini içerir. Web sitesinin arka planında interaktif hesap (kullanıcı parti oranlarını değiştirir → tarayıcıda anında MV dağılımı) için tasarlandı.

**Ilgili tasarim dokumanlari:** [[projects/dhont-mv-senaryo/web-export/DASHBOARD-DESIGN.md|DASHBOARD-DESIGN]] (ic tasarim onerisi) | [[projects/dhont-mv-senaryo/web-export/DASHBOARD-RESEARCH.md|DASHBOARD-RESEARCH]] (12 benzer panelin UI/UX kiyasi)

---

## Paket İçeriği

```
web-export/
├── data/                                # Statik veri (JSON, toplam ~400 KB)
│   ├── meta.json                        # Parti listesi, renkler, default senaryo
│   ├── cevre_seats.json                 # 87 seçim çevresi × MV (toplam 600)
│   ├── ilce_baseline.json               # 979 ilçe × parti oyu + MG ağırlığı (HESAP GIRDISI)
│   ├── ilce_cevre.json                  # Tüm ilçeler → çevre eşleşmesi
│   ├── senaryo_sonuc_cevre.json         # Default senaryo: 87 çevre × MV (statik gösterim)
│   ├── senaryo_sonuc_il.json            # Default: 81 il × MV
│   ├── senaryo_sonuc_toplam.json        # Default: toplam parti × MV + 2023 karşılaştırma
│   ├── senaryo_il_oy_pay.json           # Default: 81 il × 8 parti oy yüzdesi
│   └── validation.json                  # Algoritma doğrulama metrikleri (MAE %1)
├── js/
│   └── dhondt-pipeline.js               # ES Module: hesap motoru (yaklaşık 250 satır)
└── examples/
    ├── basic.html                       # Statik sonuç gösterimi
    └── interactive.html                 # Slider'lı interaktif örnek
```

---

## 1. Kavramsal Modeli — Pipeline

```
[Kullanıcı senaryo: %CHP, %AKP, ...]
            │
            ▼
[normalizeSenaryo]  →  toplam = 100
            │
            ▼
[applySwing]
   ├─ Klasik partiler (CHP/AKP/MHP/MI/DEM/SOL/DIGER):
   │     ilçe_senaryo_payı = ilçe_2023_payı × (senaryo_ulke / 2023_ulke)
   │
   └─ Milli Görüş İttifakı (özel):
         ilçe_MG_payı = senaryo_MG × (ilçe_Saadet_YRP_ağırlık / ulke_ortalama)
            │
            ▼
[İlçe içi normalize: 8 parti payları toplamı = 100]
            │
            ▼
[Çevre toplama: 979 ilçe → 87 çevre oy sayıları]
            │
            ▼
[Baraj %7 (MHP & SOL exempt)]
            │
            ▼
[D'Hondt: her çevrede 8 parti × MV iteratif]
            │
            ▼
[Sonuç: çevre, il, toplam]
```

### Yoldaş/Mert metodoloji kararları

1. **8 liste tek-blok** (her çevrede ortak liste):
   - CHP, AK Parti, MHP, Milliyetçi İttifak (İYİ+Zafer+Memleket), Milli Görüş İttifakı (YRP+Saadet), DEM, Sol İttifak (TIP+ufak sol), Diğer
2. **MHP & Sol İttifak baraj-exempt** (Cumhur ve Emek-Özgürlük İttifakı mantığı)
3. **Uniform proportional swing** — 2023 bölgesel desen korunur, sadece ulke ölçeği değişir
4. **MG ilçe ağırlığı** — Saadet 2015K + Saadet 2018 + YRP 2023 üç-seri ortalaması (her ilçede)

### Algoritma kalibrasyonu

2023 gerçek paylarıyla pipeline çalıştırıldığında:
- CHP −4, AKP −6, MHP −3, DEM 0 (4/8 partide ±6 MV)
- MAE = 5.5 MV/parti (toplam 600 üzerinden %1.0)
- MI/SOL sapmaları yapılanma farkından (2023'te Zafer/TIP başka ittifaklarda)

Detay: `data/validation.json`

---

## 2. JavaScript API

### Yükleme

```javascript
// ES Module
import { Pipeline } from './js/dhondt-pipeline.js';

// Veri klasörü URL'i verilir (relative veya absolute)
const motor = await Pipeline.load('./data');
```

### Hesap çalıştırma

```javascript
const senaryo = {
  CHP:   29.1,
  AKP:   25.4,
  MHP:   5.9,
  MI:    17.6,
  MG:    10.0,
  DEM:   9.0,
  SOL:   2.0,
  DIGER: 1.2
};

const sonuc = motor.run(senaryo);
// senaryo toplam 100 değilse otomatik normalize edilir (uniform scale)

// Opsiyonel parametreler
const sonuc2 = motor.run(senaryo, {
  barajExempt: ['MHP'],   // SOL'u exempt'ten çıkar
  barajPct: 7             // veya barajı %5'e indir
});
```

### Sonuç yapısı

```javascript
{
  senaryo_normalize: { CHP: 29.04, AKP: 25.35, ... },  // 100'e normalize edilmiş
  katsayi: { CHP: 1.154, AKP: 0.726, ... },            // swing katsayıları
  cevre: [                                              // 87 satır
    {
      cevre_id: "ADANA",
      cevre_adi: "Adana",
      mv: 15,
      CHP: 5, AKP: 4, MHP: 1, MI: 3, MG: 1, DEM: 1, SOL: 0, DIGER: 0,
      kazanan: "CHP"
    },
    // ...
  ],
  il: [                                                 // 81 satır (multi-çevre iller toplandı)
    { il: "ADANA", mv: 15, CHP: 5, ..., kazanan: "CHP" },
    // ...
  ],
  toplam: [                                             // 8 satır
    { parti: "CHP", mv: 184, mv_pct: 30.67, oy_pct: 28.66 },
    { parti: "AKP", mv: 183, mv_pct: 30.50, oy_pct: 25.64 },
    // ...
  ],
  meta: { total_mv: 600, baraj_pct: 7, baraj_exempt: ["MHP","SOL"] }
}
```

### Düşük seviye API

```javascript
import { dhondt, normalizeSenaryo, applySwing, calcUlkePaylar } from './js/dhondt-pipeline.js';

// Tek çevrede D'Hondt
const seats = dhondt(
  { CHP: 100, AKP: 80, MHP: 30 },
  5,
  { thresholdPct: 7, totals: { CHP: 100, AKP: 80, MHP: 30 }, exempt: ['MHP'] }
);
// → { CHP: 3, AKP: 2, MHP: 0 }

// Manuel normalize
const normalized = normalizeSenaryo({ CHP: 30, AKP: 25, MHP: 6 });
// → { CHP: 49.18, AKP: 40.98, MHP: 9.84 }
```

---

## 3. Veri Dosyaları Detayı

### `meta.json`
Sabitler — parti listesi, renkler, default senaryo, MG ulke ağırlığı.

```json
{
  "toplam_mv": 600,
  "cevre_sayisi": 87,
  "baraj_pct": 7,
  "partiler": ["CHP", "AKP", "MHP", "MI", "MG", "DEM", "SOL", "DIGER"],
  "renkler": { "CHP": "#E30A17", "AKP": "#FFB81C", ... },
  "default_senaryo": { "CHP": 29.1, "AKP": 25.4, ... },
  "default_baraj_exempt": ["MHP", "SOL"],
  "mg_ulke_agirlik": 1.624
}
```

### `cevre_seats.json`
87 seçim çevresi × MV sayısı.

```json
[
  { "cevre_id": "ADANA", "cevre_adi": "Adana", "mv": 15 },
  { "cevre_id": "ISTANBUL_1", "cevre_adi": "İstanbul 1", "mv": 35 },
  ...
]
```

**Multi-çevre iller:** İstanbul (3 çevre, 98 MV), Ankara (3, 36), İzmir (2, 28), Bursa (2, 20). Toplam 87 çevre, 600 MV.

### `ilce_baseline.json` (en kritik veri)
979 ilçe × {GECERLI, 8 parti baseline oyu, MG ağırlığı, cevre_id}.

```json
[
  {
    "il": "ADANA",
    "ilce": "ALADAG",
    "cevre": "ADANA",
    "gecerli": 5234,
    "CHP": 1820,
    "AKP": 2451,
    "MHP": 487,
    "MI": 312,
    "DEM": 84,
    "SOL": 31,
    "DIGER": 28,
    "mg_agirlik": 1.42
  },
  ...
]
```

`mg_agirlik` = (Saadet 2015 Kasım pay + Saadet 2018 pay + YRP 2023 pay) / 3 — her ilçede.

### `senaryo_sonuc_*.json`
Default senaryonun statik sonuçları (yeniden hesaba gerek olmadan harita/grafikte kullanılabilir).

### `validation.json`
Algoritmanın 2023 gerçek MV sonucuna göre sapma metrikleri.

---

## 4. Interaktif Örnek (kısa)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MV Senaryo Motoru</title>
</head>
<body>
  <h1>Senaryo Hesaplayıcı</h1>
  <form id="form">
    <label>CHP: <input name="CHP" type="number" value="29.1" step="0.1"></label><br>
    <label>AKP: <input name="AKP" type="number" value="25.4" step="0.1"></label><br>
    <label>MHP: <input name="MHP" type="number" value="5.9" step="0.1"></label><br>
    <label>MI:  <input name="MI"  type="number" value="17.6" step="0.1"></label><br>
    <label>MG:  <input name="MG"  type="number" value="10.0" step="0.1"></label><br>
    <label>DEM: <input name="DEM" type="number" value="9.0"  step="0.1"></label><br>
    <label>SOL: <input name="SOL" type="number" value="2.0"  step="0.1"></label><br>
    <label>Diğer: <input name="DIGER" type="number" value="1.2" step="0.1"></label><br>
    <button type="submit">Hesapla</button>
  </form>
  <table id="sonuc"></table>

  <script type="module">
    import { Pipeline } from './js/dhondt-pipeline.js';
    const motor = await Pipeline.load('./data');

    const form = document.getElementById('form');
    const tbody = document.getElementById('sonuc');
    const renkler = motor.meta.renkler;

    function render(sonuc) {
      tbody.innerHTML = '<tr><th>Parti</th><th>MV</th><th>MV %</th><th>Oy %</th></tr>';
      for (const row of sonuc.toplam) {
        const tr = tbody.insertRow();
        tr.style.backgroundColor = renkler[row.parti] + '33';
        tr.insertCell().textContent = row.parti;
        tr.insertCell().textContent = row.mv;
        tr.insertCell().textContent = row.mv_pct.toFixed(2) + '%';
        tr.insertCell().textContent = row.oy_pct.toFixed(2) + '%';
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const senaryo = {};
      for (const [k, v] of new FormData(form)) {
        senaryo[k] = parseFloat(v);
      }
      const sonuc = motor.run(senaryo);
      render(sonuc);
    });
    // Otomatik ilk hesap
    form.dispatchEvent(new Event('submit'));
  </script>
</body>
</html>
```

`examples/interactive.html` daha detaylı versiyon içeriyor (slider'lar + il listesi + canlı yenileme).

---

## 5. Harita ve Grafik Entegrasyonu

### Türkiye il GeoJSON'u
Bu pakette **dahil değil**. Workspace içinde mevcut: `packages/thinkercharts/inst/geodata/turkey_il.geojson` (81 il). Sitende kullanmak için kopyala veya kendi geojson'unu kullan.

Eşleştirme: GeoJSON'da `name` kolonu Türkçe karakterli (`"İstanbul"`, `"Ağrı"`). API'de il anahtarları ASCII uppercase (`"ISTANBUL"`, `"AGRI"`). Normalize:

```javascript
function ilKey(name) {
  return name
    .replace(/Â/g, 'A').replace(/Ç/g, 'C').replace(/Ğ/g, 'G')
    .replace(/İ/g, 'I').replace(/I/g, 'I').replace(/Ö/g, 'O')
    .replace(/Ş/g, 'S').replace(/Ü/g, 'U')
    .replace(/â/g, 'a').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/ı/g, 'i').replace(/î/g, 'i').replace(/ö/g, 'o')
    .replace(/ş/g, 's').replace(/ü/g, 'u').replace(/û/g, 'u')
    .toUpperCase()
    .replace('AFYON', 'AFYONKARAHISAR');  // alias
}
```

### Renk paleti (parti)
`meta.renkler` içinde — Tailwind/CSS-friendly hex:

```javascript
const renk = motor.meta.renkler[row.kazanan];
// CHP → #E30A17 (kırmızı)
// AKP → #FFB81C (turuncu)
// MHP → #A6192E (bordo)
// MI  → #1E40AF (mavi koyu)
// MG  → #16A34A (yeşil)
// DEM → #7C3AED (mor)
// SOL → #DC2626 (kırmızı koyu)
// Diğer → #6B7280 (gri)
```

### Çevre seviye (multi-bölge iller için)
İstanbul 1/2/3, Ankara 1/2/3, İzmir 1/2, Bursa 1/2 ayrı çizilmek istenirse, çevre poligon geojson'u gerekli. Şu an workspace'de bu geojson **yok** — eğer ihtiyaç olursa YSK çevre sınırlarından üretilebilir (ilçe sınırlarını çevreye göre union ile birleştirmek).

---

## 6. Performans Notları

- **İlk yükleme:** `Pipeline.load()` 3 JSON fetch eder, toplam ~250 KB transfer (gzipped ~80 KB).
- **Her `run()` çağrısı:** ~5-15 ms (979 ilçe × 8 parti hesap + 87 çevre D'Hondt). Browser'da gerçek-zamanlı slider kullanım için yeterli.
- **Bellekte:** ~2-3 MB heap (ilçe baseline + sonuç).

İsteğe bağlı optimizasyon — `ilce_baseline.json` ön-toplama (çevre seviye) yapıp `cevre_baseline.json` üretmek hesabı 87 satıra indirir (~2 ms). Şu an yapılmadı çünkü MG ağırlığı ilçe seviyesinde gerekli.

---

## 7. Yenidengen R Reproduce

Tüm JSON'ları yeniden üretmek:

```bash
cd projects/dhont-mv-senaryo
Rscript work/01_data_prep/01a_aggregate_ilce.R       # 2023+2018+2015K MV CSV → ilçe agregat
Rscript work/01_data_prep/01b_cevre_eslesme.R        # 87 çevre eşleşme + min 600 MV doğrulama
Rscript work/02_swing/02_swing.R                     # Uniform swing + MG ağırlığı + ilçe normalize
Rscript work/03_dhondt/03_dhondt_run.R               # D'Hondt 87 çevre × 8 parti
Rscript work/06_web_export/06_export_json.R          # CSV → JSON web export
```

---

## 8. Doğrulama Test

```javascript
import { Pipeline } from './js/dhondt-pipeline.js';
const motor = await Pipeline.load('./data');

// Default senaryo çalıştır
const sonuc = motor.run(motor.meta.default_senaryo);

// Toplam = 600 olmalı
console.assert(sonuc.meta.total_mv === 600, 'Total MV != 600');

// Default sonuç beklenen değer (CHP 184, AKP 183, ...)
const beklenen = { CHP: 184, AKP: 183, MHP: 17, MI: 106, MG: 44, DEM: 62, SOL: 4, DIGER: 0 };
for (const r of sonuc.toplam) {
  console.assert(r.mv === beklenen[r.parti],
    `${r.parti}: model=${r.mv} beklenen=${beklenen[r.parti]}`);
}
console.log('Tum testler PASS ✓');
```

---

## 9. Lisans / Kaynak

- **Veri:** YSK 2023, 2018, 2015 Kasım sandık bazlı resmi sonuçlar.
- **Yöntem:** Mert Uzunsoy + Batuhan (Yoldaş) — Yalçın (Claude) implementasyonu.
- **Kullanım:** İç araştırma + politika analizi için serbest.

---

## 10. Sorular / Geliştirmeler

- Mevcut senaryo varyantları üretilebilir (örnek: AKP daha düşük, MHP normal baraj, vs.) — `motor.run()` çağrısı ile aynı motorla.
- Çevre seviye geojson eklenirse İstanbul 1/2/3 ayrı renklendirme yapılabilir.
- TUİK güncel nüfusla MV yeniden dağıtım (alternatif çevre_seats) için `work/01_data_prep/01d_cevre_secmen.R` çalıştırılabilir.

Detay sorular için: `projects/dhont-mv-senaryo/dhont-mv-senaryo-notes.md`
