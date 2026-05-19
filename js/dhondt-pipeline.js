/**
 * dhondt-pipeline.js v3 (S163)
 * D'Hondt MV senaryo motoru — ANK-AR oy gecisi matrisi + tek pipeline.
 *
 * Mantik (yoldas onayli, S163):
 *   1. Matris bir kez 2023 ilce baseline'ina uygulanir → 2026 ilce baseline (sabit)
 *   2. Slider 2026 ulkesel hipotezi olarak yorumlanir (default = matris cikti ulkesel)
 *   3. swing katsayisi = user_2026 / matris_uretimi_2026_ulkesel
 *   4. swing × 2026 ilce baseline → ilce hipotezi
 *   5. 87 cevre D'Hondt (baraj %7, MHP exempt)
 *
 * Modlar:
 *   Birlesik (7 parti): CHP, AKP, MHP, MI, YRP, DEM, DIGER
 *   Ayri (11 parti):    CHP, AKP, MHP, IYI, ZAFER, ANAHTAR, YRP, SAADET, DEM, SOL, DIGER
 *
 * Proxy pattern (sadece ayri mod):
 *   SAADET: matris dst yok + 2023 baseline yok → YRP'nin cografi sablonu kullanilir.
 *           ilce_pay[SAADET] = (ilce2026[YRP] / ulkesel2026[YRP]) × sen[SAADET]
 */

// ============================================================
// 1. SAF D'HONDT
// ============================================================

export function dhondt(votes, seats, opts = {}) {
  const { thresholdPct = 0, totals = null, exempt = [] } = opts;
  const parties = Object.keys(votes);
  const v = { ...votes };

  if (thresholdPct > 0) {
    if (!totals) throw new Error('totals required when thresholdPct > 0');
    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    for (const p of parties) {
      const pay = (totals[p] / totalSum) * 100;
      if (pay < thresholdPct && !exempt.includes(p)) {
        v[p] = 0;
      }
    }
  }

  const seatsWon = Object.fromEntries(parties.map(p => [p, 0]));
  const lastQuotient = Object.fromEntries(parties.map(p => [p, null]));
  const active = parties.filter(p => v[p] > 0);
  if (active.length === 0) return { seats: seatsWon, lastQuotient, activeVotes: v };

  for (let round = 0; round < seats; round++) {
    let bestParty = null;
    let bestQ = -Infinity;
    for (const p of active) {
      const q = v[p] / (seatsWon[p] + 1);
      if (q > bestQ) { bestQ = q; bestParty = p; }
    }
    seatsWon[bestParty] += 1;
    lastQuotient[bestParty] = bestQ;
  }
  return { seats: seatsWon, lastQuotient, activeVotes: v };
}

/**
 * Her parti icin "bir sonraki MV almak icin gereken ek oy" hesabi.
 */
export function calcNextSeatMargin(votes, seats, dhondtRes, totalGecerli) {
  const parties = Object.keys(votes);
  const margins = {};
  for (const p of parties) {
    if (dhondtRes.activeVotes[p] === 0) {
      margins[p] = { needVotes: null, needPct: null, eligible: false };
      continue;
    }
    let maxRivalQ = 0;
    for (const r of parties) {
      if (r === p || dhondtRes.activeVotes[r] === 0) continue;
      const rivalNext = dhondtRes.activeVotes[r] / (dhondtRes.seats[r] + 1);
      if (rivalNext > maxRivalQ) maxRivalQ = rivalNext;
    }
    const needed = maxRivalQ * (dhondtRes.seats[p] + 1);
    const ekOy = Math.max(0, needed - votes[p]);
    margins[p] = {
      needVotes: Math.round(ekOy),
      needPct: totalGecerli > 0 ? +(100 * ekOy / totalGecerli).toFixed(2) : null,
      eligible: true,
      currentSeats: dhondtRes.seats[p]
    };
  }
  return margins;
}

// ============================================================
// 2. PARTI YAPISI + MATRIS SABITLERI
// ============================================================

// Birlesik mode 9 parti — IYI+ZAFER+ANAHTAR -> MI, DIGER+SOL -> DIGER hep birlesik
// MG, YRP, SAADET ayri — MG mode'a gore MG (ortak) veya YRP/SAADET (ayri) MV alir
export const PARTIES_MATRIX_BIRLESIK = ['CHP', 'AKP', 'MHP', 'MI', 'MG', 'YRP', 'SAADET', 'DEM', 'DIGER'];
// Ayri mode 12 parti — MG = YRP+SAADET ortak liste cevrelerinden gelen MV (S163+)
export const PARTIES_MATRIX_AYRI = ['CHP', 'AKP', 'MHP', 'IYI', 'ZAFER', 'ANAHTAR', 'MG', 'YRP', 'SAADET', 'DEM', 'SOL', 'DIGER'];

// MG (Milli Gorus Ittifaki) alt partileri — sadece ayri mode'da, ortak liste cevrelerinde toplanir
const MG_ALT_PARTILER = ['YRP', 'SAADET'];

// Matris source (2023 oyu) → ilce_baseline CSV kolonlari (erit mapping)
const MATRIX_SRC_TO_BASELINE = {
  AKP:   ['AKP'],
  CHP:   ['CHP'],
  MHP:   ['MHP'],
  IYI:   ['IYI', 'ZAFER', 'MEMLEKET'],   // 2023 Milliyetci Ittifak ic
  YRP:   ['YRP', 'SAADET'],               // 2023 Milli Gorus Ittifak ic
  DEM:   ['DEM'],
  DIGER: ['DIGER', 'SOL']                 // 2023 SOL Ittifak DIGER icine eritildi
};

const MATRIX_SRC_PARTIES = ['AKP', 'CHP', 'MHP', 'IYI', 'DEM', 'YRP', 'DIGER'];
const MATRIX_DEST_PARTIES = ['AKP', 'CHP', 'MHP', 'IYI', 'DEM', 'YRP', 'ANAHTAR', 'DIGER'];

// Ayri modda matris dst → 11 parti split (ilce 2023 tarihsel oran ile)
// MEMLEKET kullanici tarafindan istenmedi → IYI'ye dahil
const IC_ITTIFAK_SPLIT = {
  IYI:   { IYI: ['IYI', 'MEMLEKET'], ZAFER: ['ZAFER'] },
  YRP:   { YRP: ['YRP'], SAADET: ['SAADET'] },
  DIGER: { DIGER: ['DIGER'], SOL: ['SOL'] }
};

// Proxy pattern (sadece ayri mod): partinin matris dst'i + 2023 baseline'i yoksa
//   ilce dagilim icin baska bir partinin cografi sablonunu kullanir
// Birlesik mode'da SAADET ayri parti degil (YRP icinde MG ittifaki olarak gozukur)
const PROXY_MAP = {
  SAADET: 'YRP'   // SAADET Konya/Aksaray/Duzce gibi YRP-guclu yerlerde yogunlasir
};

// ============================================================
// 3. UTILITIES
// ============================================================

export function normalizeSenaryo(senaryo) {
  const sum = Object.values(senaryo).reduce((a, b) => a + b, 0);
  if (sum < 1e-9) return { ...senaryo };
  const out = {};
  for (const k of Object.keys(senaryo)) out[k] = (senaryo[k] * 100) / sum;
  return out;
}

/**
 * matrix_norm[src][dst] = matrix_raw[src][dst] / (100 - matrix_raw[src].KARARSIZ) * 100
 * KARARSIZ payi row-renormalize ile diger dst'lere orantili dagitilir.
 */
export function normalizeMatrix(matrixRaw) {
  const out = {};
  for (const [src, row] of Object.entries(matrixRaw)) {
    const kararsiz = row.KARARSIZ ?? 0;
    const denom = 100 - kararsiz;
    out[src] = {};
    for (const [dst, val] of Object.entries(row)) {
      if (dst === 'KARARSIZ') continue;
      out[src][dst] = denom > 1e-9 ? (val * 100) / denom : 0;
    }
  }
  return out;
}

/**
 * 8 dst → mode-spesifik parti.
 * Birlesik: IYI + ANAHTAR → MI
 * Ayri: dst aynen (ZAFER/SAADET/SOL split splitDestPayAyri ile yapilir)
 */
function destToParti(dst, splitAlliances) {
  if (splitAlliances) return dst;
  if (dst === 'IYI' || dst === 'ANAHTAR') return 'MI';
  return dst;
}

/**
 * Ayri modda ilce-bazli ic-ittifak split.
 * destPay (8 dst) → ilcePay (11 parti) — ilce 2023 tarihsel oran ile.
 *
 * Not: SAADET burada her zaman 0 doner (2023 CSV'de hep 0).
 *       SAADET icin YRP proxy mantigi runFromSenaryo2026'da uygulanir.
 */
function splitDestPayAyri(destPay, row) {
  const out = {
    CHP: destPay.CHP ?? 0,
    AKP: destPay.AKP ?? 0,
    MHP: destPay.MHP ?? 0,
    DEM: destPay.DEM ?? 0,
    ANAHTAR: destPay.ANAHTAR ?? 0,
    MG: 0,    // MG cevre seviyesinde D'Hondt asamasinda toplanir (ortak liste cevreleri)
    IYI: 0, ZAFER: 0,
    YRP: 0, SAADET: 0,
    DIGER: 0, SOL: 0
  };
  for (const [dst, splitMap] of Object.entries(IC_ITTIFAK_SPLIT)) {
    const partsOy = {};
    let total = 0;
    for (const [part, cols] of Object.entries(splitMap)) {
      partsOy[part] = cols.reduce((a, c) => a + (row[c] || 0), 0);
      total += partsOy[part];
    }
    const dstPay = destPay[dst] ?? 0;
    if (total > 1e-9) {
      for (const part of Object.keys(splitMap)) {
        out[part] += dstPay * (partsOy[part] / total);
      }
    } else {
      // Ilcede tarihsel oy yoksa hepsi ana parti'ye git (fallback)
      const firstPart = Object.keys(splitMap)[0];
      out[firstPart] += dstPay;
    }
  }
  return out;
}

// ============================================================
// 4. PIPELINE
// ============================================================

export class Pipeline {
  constructor({ meta, cevreSeats, ilceBaseline }) {
    this.meta = meta;
    this.cevreSeats = cevreSeats;
    this.ilceBaseline = ilceBaseline;
    // Cache: ilce 2026 baseline (matris bir kez uygulanmis), mode-spesifik
    this._ilce2026 = {};       // { 'birlesik': [...], 'ayri': [...] }
    this._ulkesel2026 = {};    // { 'birlesik': {parti: %}, 'ayri': {parti: %} }
  }

  static async load(dataDir = './data') {
    const fetchJson = async (name) => {
      const res = await fetch(`${dataDir}/${name}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Veri yuklenemedi: ${name} (${res.status})`);
      return res.json();
    };
    const [meta, cevreSeats, ilceBaseline] = await Promise.all([
      fetchJson('meta.json'),
      fetchJson('cevre_seats.json'),
      fetchJson('ilce_baseline.json')
    ]);
    return new Pipeline({ meta, cevreSeats, ilceBaseline });
  }

  async loadMatrix(dataDir = './data', file = 'transition_matrix.json') {
    const res = await fetch(`${dataDir}/${file}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Matris yuklenemedi: ${file} (${res.status})`);
    this.matrix = await res.json();
    this.matrixNorm = normalizeMatrix(this.matrix.matrix_raw);
    // Cache'i invalidate et (matris degisirse yeni baseline gerek)
    this._ilce2026 = {};
    this._ulkesel2026 = {};
    return this.matrix;
  }

  // ----------------------------------------------------------
  // 4a. Ilce 2026 baseline (matris bir kez uygulanmis)
  // ----------------------------------------------------------

  /**
   * Her ilce icin: 2023 src paylar → matris uygula → mode-spesifik parti pay.
   * Birlesik: 7 parti (IYI+ANAHTAR → MI birlestirilmis)
   * Ayri:     11 parti (ZAFER/SAADET/SOL ic-ittifak tarihsel ratio ile bolundu)
   *           — SAADET her ilcede 0 (matris dst yok, 2023 baseline 0)
   *
   * Cache: this._ilce2026[mode]
   *
   * @returns Array<{ cevre, gecerli, [parti]: pay% }>
   */
  buildIlceBaseline2026(splitAlliances) {
    if (!this.matrixNorm) throw new Error('matrixNorm yuklenmedi — once loadMatrix() cagir');
    const cacheKey = splitAlliances ? 'ayri' : 'birlesik';
    if (this._ilce2026[cacheKey]) return this._ilce2026[cacheKey];

    const PARTIES = splitAlliances ? PARTIES_MATRIX_AYRI : PARTIES_MATRIX_BIRLESIK;
    const out = [];

    for (const row of this.ilceBaseline) {
      const gecerli = row.gecerli;
      if (!gecerli || gecerli <= 0) continue;

      // 1. Ilce 2023 src paylari (erit mapping ile)
      const pay2023 = {};
      for (const src of MATRIX_SRC_PARTIES) {
        const cols = MATRIX_SRC_TO_BASELINE[src];
        const sum = cols.reduce((a, c) => a + (row[c] || 0), 0);
        pay2023[src] = (100 * sum) / gecerli;
      }

      // 2. Matris uygula → 8 dst pay
      const destPay = Object.fromEntries(MATRIX_DEST_PARTIES.map(d => [d, 0]));
      for (const src of MATRIX_SRC_PARTIES) {
        const srcRow = this.matrixNorm[src];
        if (!srcRow) continue;
        for (const dst of MATRIX_DEST_PARTIES) {
          destPay[dst] += (pay2023[src] * (srcRow[dst] || 0)) / 100;
        }
      }
      // Toplam ~100 olmali; tam normalize (baseline coverage'a karsi savunma)
      const total = MATRIX_DEST_PARTIES.reduce((a, d) => a + destPay[d], 0);
      if (total > 1e-9) {
        for (const dst of MATRIX_DEST_PARTIES) destPay[dst] = (destPay[dst] * 100) / total;
      }

      // 3. Mode-spesifik collapse → parti pay
      let partiPay;
      if (splitAlliances) {
        partiPay = splitDestPayAyri(destPay, row);
      } else {
        partiPay = Object.fromEntries(PARTIES.map(p => [p, 0]));
        for (const dst of MATRIX_DEST_PARTIES) {
          partiPay[destToParti(dst, false)] += destPay[dst];
        }
      }

      out.push({
        cevre: row.cevre,
        gecerli,
        ...partiPay
      });
    }

    this._ilce2026[cacheKey] = out;
    return out;
  }

  /**
   * Ilce 2026 baseline'lardan agirlikli ortalama ile ulkesel paylar.
   * Cache: this._ulkesel2026[mode]
   * @returns { parti: % }
   */
  matrixUlkesel2026(splitAlliances) {
    const cacheKey = splitAlliances ? 'ayri' : 'birlesik';
    if (this._ulkesel2026[cacheKey]) return this._ulkesel2026[cacheKey];

    const PARTIES = splitAlliances ? PARTIES_MATRIX_AYRI : PARTIES_MATRIX_BIRLESIK;
    const ilce2026 = this.buildIlceBaseline2026(splitAlliances);
    const totalOy = Object.fromEntries(PARTIES.map(p => [p, 0]));
    let totalGecerli = 0;
    for (const row of ilce2026) {
      totalGecerli += row.gecerli;
      for (const p of PARTIES) totalOy[p] += (row.gecerli * row[p]) / 100;
    }
    const out = {};
    for (const p of PARTIES) {
      out[p] = totalGecerli > 0 ? (100 * totalOy[p]) / totalGecerli : 0;
    }
    this._ulkesel2026[cacheKey] = out;
    return out;
  }

  /**
   * MG (Milli Gorus Ittifaki) icin il bazli "ortak liste" otomatik secimi.
   * Skor = il_MV × il_MG_oran (buyuk MV-kontenjanli + yogun MG-tabanli iller onde).
   *
   * @param {number} N — kac il "ortak" olarak secilsin (orn. 81 tumu, 40 B mod, 18 C mod)
   * @param {boolean} splitAlliances — sadece ayri mode'da anlamli (true bekleniyor)
   * @returns {Set<string>} il adlari ('KONYA', 'ISTANBUL' vs.)
   */
  autoMgOrtakIller(N, splitAlliances = true) {
    if (N <= 0) return new Set();
    const ilce2026 = this.buildIlceBaseline2026(splitAlliances);
    const cevreToIl = (cid) => cid.replace(/_[123]$/, '');

    // Per-cevre MG oy hesabi (YRP + SAADET pay × gecerli / 100)
    const cevreMG = {};
    for (const row of ilce2026) {
      const mgPay = (row.YRP ?? 0) + (row.SAADET ?? 0);
      const mgOy = (row.gecerli * mgPay) / 100;
      if (!cevreMG[row.cevre]) cevreMG[row.cevre] = { mgOy: 0, gecerli: 0 };
      cevreMG[row.cevre].mgOy += mgOy;
      cevreMG[row.cevre].gecerli += row.gecerli;
    }

    // Il bazinda aggregate
    const ilAgg = {};
    for (const seat of this.cevreSeats) {
      const il = cevreToIl(seat.cevre_id);
      const cm = cevreMG[seat.cevre_id] ?? { mgOy: 0, gecerli: 0 };
      if (!ilAgg[il]) ilAgg[il] = { mgOy: 0, gecerli: 0, mv: 0 };
      ilAgg[il].mgOy += cm.mgOy;
      ilAgg[il].gecerli += cm.gecerli;
      ilAgg[il].mv += seat.mv;
    }

    // Skor: il_MV × il_MG_oran
    const skorlar = Object.entries(ilAgg).map(([il, a]) => ({
      il,
      skor: a.gecerli > 0 ? a.mv * (a.mgOy / a.gecerli) : 0,
      mgOran: a.gecerli > 0 ? (100 * a.mgOy) / a.gecerli : 0,
      mv: a.mv
    }));
    skorlar.sort((a, b) => b.skor - a.skor);
    return new Set(skorlar.slice(0, N).map(r => r.il));
  }

  // ----------------------------------------------------------
  // 4b. Ana pipeline — user senaryosu (2026 ulkesel hipotezi) → D'Hondt
  // ----------------------------------------------------------

  /**
   * Senaryo hesabi (S163).
   * Slider'lar 2026 ulkesel hipotezi olarak yorumlanir, matris-uretimi 2026 default'a
   * karsi swing katsayisi uygulanir.
   *
   * @param {Object|null} user2026 — slider girdisi mode-spesifik PARTIES key'li ulkesel paylar
   *   null = matris-uretimi 2026 default'lar kullanilir (saf matris sonuc)
   * @param {Object} opts
   * @param {boolean} opts.splitAlliances — true: 11 parti ayri, false: 7 parti birlesik
   * @param {string[]} opts.barajExempt — default ['MHP']
   * @param {number} opts.barajPct — default 7
   */
  runFromSenaryo2026(user2026 = null, opts = {}) {
    const splitAlliances = opts.splitAlliances ?? false;
    const PARTIES = splitAlliances ? PARTIES_MATRIX_AYRI : PARTIES_MATRIX_BIRLESIK;
    const barajExempt = opts.barajExempt ?? this.meta.default_baraj_exempt ?? ['MHP'];
    const barajPct = opts.barajPct ?? this.meta.baraj_pct ?? 7;

    // Default 2026 ulkesel (matris cikti) + ilce 2026 baseline
    const ulkesel2026 = this.matrixUlkesel2026(splitAlliances);
    const ilce2026 = this.buildIlceBaseline2026(splitAlliances);

    // User senaryo: null ise default kullan, varsa normalize et
    let sen, usingOverride;
    if (user2026 && Object.keys(user2026).length > 0) {
      sen = normalizeSenaryo(user2026);
      usingOverride = false;
      for (const p of PARTIES) {
        if (Math.abs((sen[p] ?? 0) - (ulkesel2026[p] ?? 0)) > 0.05) {
          usingOverride = true; break;
        }
      }
    } else {
      sen = { ...ulkesel2026 };
      usingOverride = false;
    }

    // Swing katsayilari — PROXY_MAP her iki modda aktif
    // (SAADET 2023 baseline yok + matris dst yok → her zaman YRP cografi proxy uzerinden dagilir)
    const activeProxy = PROXY_MAP;
    const katsayi = {};
    for (const p of PARTIES) {
      if (activeProxy[p]) { katsayi[p] = null; continue; }
      const base = ulkesel2026[p] ?? 0;
      katsayi[p] = base > 1e-9 ? (sen[p] ?? 0) / base : 0;
    }

    // Per-ilce: swing × ilce 2026 baseline + proxy partiler icin proxy sablonu
    const cevreOylar = {};
    for (const row of ilce2026) {
      const gecerli = row.gecerli;
      const ilcePay = {};
      let scaleSum = 0;
      let proxyPay = 0;

      // Once non-proxy partiler
      for (const p of PARTIES) {
        if (activeProxy[p]) continue;
        ilcePay[p] = (row[p] ?? 0) * (katsayi[p] ?? 0);
        scaleSum += ilcePay[p];
      }

      // Sonra proxy partiler (kendi sablonu yok, proxy'sinin orantisinda)
      for (const [p, proxy] of Object.entries(activeProxy)) {
        const proxyBaseUlke = ulkesel2026[proxy] ?? 0;
        const proxyBaseIlce = row[proxy] ?? 0;
        // ilcePay[p] = (proxy_ilce / proxy_ulkesel) × sen[p]
        // Yani: proxy'nin cografi yogunluk haritasini kullan, p'nin ulkesel pay'iyla olcek
        const senP = sen[p] ?? 0;
        ilcePay[p] = proxyBaseUlke > 1e-9 ? (proxyBaseIlce / proxyBaseUlke) * senP : senP;
        proxyPay += ilcePay[p];
      }

      // Ilce ici 100'e normalize: non-proxy partiler (100 - proxyPay)'a oranlanir
      const scaleHedef = Math.max(0, 100 - proxyPay);
      for (const p of PARTIES) {
        if (activeProxy[p]) continue;
        ilcePay[p] = scaleSum > 1e-9 ? (scaleHedef * ilcePay[p]) / scaleSum : 0;
      }

      // Cevreye yaz (oy sayilari)
      if (!cevreOylar[row.cevre]) {
        cevreOylar[row.cevre] = Object.fromEntries(PARTIES.map(p => [p, 0]));
        cevreOylar[row.cevre].gecerli = 0;
      }
      cevreOylar[row.cevre].gecerli += gecerli;
      for (const p of PARTIES) cevreOylar[row.cevre][p] += (gecerli * ilcePay[p]) / 100;
    }

    // MG ortak liste cevre seti — her iki modda kullanilir (birlesik mode 9 parti, ayri mode 12 parti, ikisi de MG icerir)
    const mgOrtakIller = opts.mgOrtakIller ?? new Set();
    const cevreToIl = (cid) => cid.replace(/_[123]$/, '');

    // MG/YRP/SAADET her durumda baraj muaf — yoldas: "her türlü ittifak yaptıkları için baraj disi"
    // Cunku Milli Gorus ic ittifak akrabalari: ortak listede MG MV alir, ayri listede YRP/SAADET solo
    // Baraj ulkesel pay testi bunlari haksiz dezavantajli yapardi, ittifak gercekligi baraj muafiyetidir
    const ITTIFAK_AUTO_EXEMPT = ['MG', 'YRP', 'SAADET'];
    const effectiveBarajExempt = [...barajExempt];
    for (const p of ITTIFAK_AUTO_EXEMPT) {
      if (PARTIES.includes(p) && !effectiveBarajExempt.includes(p)) {
        effectiveBarajExempt.push(p);
      }
    }
    const mgAutoExempt = effectiveBarajExempt.includes('MG') && !barajExempt.includes('MG');

    // 1. PASS: Cevre seviyesinde votes hazirla (MG ortak liste transferi dahil)
    const cevreVotes = {};
    for (const seat of this.cevreSeats) {
      const cid = seat.cevre_id;
      const oylar = cevreOylar[cid];
      if (!oylar) continue;
      const votes = Object.fromEntries(PARTIES.map(p => [p, oylar[p]]));
      // S164: cevre_id ile direkt eslesme ya da il_adi ile (backward compat)
      const isOrtak = mgOrtakIller.has(cid) || mgOrtakIller.has(cevreToIl(cid));
      if (isOrtak) {
        votes.MG = (votes.YRP ?? 0) + (votes.SAADET ?? 0);
        votes.YRP = 0;
        votes.SAADET = 0;
      } else {
        votes.MG = 0;
      }
      cevreVotes[cid] = votes;
    }

    // 2. PASS: Ulke toplami (transfer sonrasi — baraj testi icin)
    const ulkeToplam = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const cid of Object.keys(cevreVotes)) {
      for (const p of PARTIES) ulkeToplam[p] += cevreVotes[cid][p];
    }
    const ulkeGecerli = Object.values(ulkeToplam).reduce((a, b) => a + b, 0);

    // 3. PASS: D'Hondt cevre basina (transfer'li votes + ulkeToplam baraj)
    const cevreSonuc = [];
    const partiTotal = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const seat of this.cevreSeats) {
      const cid = seat.cevre_id;
      const oylar = cevreOylar[cid];
      if (!oylar) continue;
      const votes = cevreVotes[cid];
      const dRes = dhondt(votes, seat.mv, {
        thresholdPct: barajPct, totals: ulkeToplam, exempt: effectiveBarajExempt
      });

      // Cevre MV'leri olduğu gibi kalır:
      //   - Ortak liste cevrelerinde: MG MV alır (YRP/SAADET cevreOylar'da 0 zaten)
      //   - Ayri liste cevrelerinde: YRP ve SAADET kendi adlarıyla MV alır
      // Alt-bolme yok — yoldas tercih: "birlikte girerlerse MG, ayri girerlerse parti ismi"

      const margins = calcNextSeatMargin(votes, seat.mv, dRes, oylar.gecerli);
      let kazanan = PARTIES[0], maxMV = -1;
      for (const p of PARTIES) {
        if (dRes.seats[p] > maxMV) { maxMV = dRes.seats[p]; kazanan = p; }
      }
      cevreSonuc.push({
        cevre_id: cid, cevre_adi: seat.cevre_adi, mv: seat.mv,
        ...dRes.seats, kazanan, margins,
        gecerli: oylar.gecerli, votes: { ...votes }
      });
      for (const p of PARTIES) partiTotal[p] += dRes.seats[p];
    }

    // Il agregati (cevreden topla)
    const ilMap = {};
    for (const row of cevreSonuc) {
      const il = row.cevre_id.replace(/_[123]$/, '');
      if (!ilMap[il]) {
        ilMap[il] = { il, mv: 0, gecerli: 0,
                      ...Object.fromEntries(PARTIES.map(p => [p, 0])),
                      votes: Object.fromEntries(PARTIES.map(p => [p, 0])) };
        ilMap[il].margins = Object.fromEntries(PARTIES.map(p => [p,
          { needVotes: Infinity, needPct: Infinity, currentSeats: 0 }]));
      }
      ilMap[il].mv += row.mv;
      ilMap[il].gecerli += row.gecerli;
      for (const p of PARTIES) {
        ilMap[il][p] += row[p];
        ilMap[il].votes[p] += row.votes[p];
        const m = row.margins[p];
        if (m.eligible && m.needVotes < ilMap[il].margins[p].needVotes) {
          ilMap[il].margins[p] = { ...m };
        }
        ilMap[il].margins[p].currentSeats = (ilMap[il].margins[p].currentSeats || 0) + (row[p] || 0);
      }
    }
    const ilSonuc = Object.values(ilMap).map(r => {
      let kazanan = PARTIES[0], maxMV = -1;
      for (const p of PARTIES) {
        if (r[p] > maxMV) { maxMV = r[p]; kazanan = p; }
      }
      const ilMargins = {};
      for (const p of PARTIES) {
        const m = r.margins[p];
        ilMargins[p] = {
          needVotes: m.needVotes === Infinity ? null : m.needVotes,
          needPct: m.needVotes === Infinity ? null : +(100 * m.needVotes / r.gecerli).toFixed(2),
          currentMV: r[p]
        };
      }
      return { ...r, kazanan, margins: ilMargins };
    }).sort((a, b) => a.il.localeCompare(b.il));

    // Toplam
    const totalSeats = Object.values(partiTotal).reduce((a, b) => a + b, 0);
    const toplam = PARTIES.map(p => ({
      parti: p,
      mv: partiTotal[p],
      mv_pct: totalSeats > 0 ? (100 * partiTotal[p]) / totalSeats : 0,
      oy_pct: ulkeGecerli > 0 ? (100 * ulkeToplam[p]) / ulkeGecerli : 0
    }));

    return {
      mode: splitAlliances ? 'ayri' : 'birlesik',
      method: 'matris-once-swing',
      partiler: PARTIES,
      ulkesel_2026_default: ulkesel2026,    // matris cikti default 2026 paylari
      user_ulkesel_2026: sen,                // kullanici girdi (normalize sonrasi)
      swing_katsayi: katsayi,
      cevre: cevreSonuc, il: ilSonuc, toplam,
      warnings: [],
      meta: {
        total_mv: totalSeats,
        baraj_pct: barajPct,
        baraj_exempt: effectiveBarajExempt,
        baraj_exempt_user: barajExempt,
        mg_auto_exempt: mgAutoExempt,
        split_alliances: splitAlliances,
        slider_override: usingOverride,
        proxy_map: activeProxy,
        mg_ortak_iller: Array.from(mgOrtakIller),
        mg_ortak_count: mgOrtakIller.size,
        matrix_source: this.matrix?.source ?? null
      }
    };
  }
}

export default Pipeline;
