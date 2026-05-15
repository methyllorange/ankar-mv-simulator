/**
 * dhondt-pipeline.js v2
 * D'Hondt MV dagitim senaryo motoru — browser-side end-to-end hesap.
 *
 * Yenilikler v2:
 *   - splitAlliances opts: MI ve MG ittifaklarini alt partilere bol (8 -> 11 liste)
 *   - nextSeatMargin: her cevre × parti icin "bir sonraki MV icin gereken ek oy"
 *   - barajPct ve barajExempt artik parametre
 *   - cevre seviyesi sonuc detayinda quotient bilgisi
 *
 * Birlesik mod (8 liste): CHP, AKP, MHP, MI, MG, DEM, SOL, DIGER
 * Ayri mod (11 liste): CHP, AKP, MHP, IYI, ZAFER, MEMLEKET, YRP, SAADET, DEM, SOL, DIGER
 */

// ============================================================
// 1. SAF D'HONDT (quotient'leri dondur)
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
 * Her parti icin: "bir sonraki MV almak icin gereken ek oy" hesabi.
 * Mantik: en yuksek rakip quotient'i geçmek için gereken oy artisi.
 * @returns { parti: { needVotes, needPct } }
 */
export function calcNextSeatMargin(votes, seats, dhondtRes, totalGecerli) {
  const parties = Object.keys(votes);
  const margins = {};

  // Her parti icin kazanmak isterse hangi rakip quotient'ı geçmesi lazım?
  // p eger 1 MV daha alirsa, quotient = votes[p] / (seats[p] + 1) olur
  // Bu quotient en yuksek olmali, yani diğer aktif partilerin (seats[p]+1)'inci quotient'ından büyük
  for (const p of parties) {
    if (dhondtRes.activeVotes[p] === 0) {
      margins[p] = { needVotes: null, needPct: null, eligible: false };
      continue;
    }
    // En yuksek "bir sonraki" rakip quotient (p haric)
    let maxRivalQ = 0;
    for (const r of parties) {
      if (r === p || dhondtRes.activeVotes[r] === 0) continue;
      const rivalNext = dhondtRes.activeVotes[r] / (dhondtRes.seats[r] + 1);
      if (rivalNext > maxRivalQ) maxRivalQ = rivalNext;
    }
    // p'nin bir sonraki MV almak icin gereken oy:
    // votes[p] / (seats[p] + 1) >= maxRivalQ
    // votes[p] >= maxRivalQ * (seats[p] + 1)
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
// 2. PARTI YAPI TANIMLAMA
// ============================================================

// Legacy (run() icin - swing-bazli)
const PARTIES_BIRLESIK_LEGACY = ['CHP', 'AKP', 'MHP', 'MI', 'MG', 'DEM', 'SOL', 'DIGER'];
const PARTIES_AYRI_LEGACY = ['CHP', 'AKP', 'MHP', 'IYI', 'ZAFER', 'MEMLEKET',
                              'YRP', 'SAADET', 'DEM', 'SOL', 'DIGER'];

// Matris modu (runFromMatrix() icin - ANK-AR oy gecisi matrisi)
export const PARTIES_MATRIX_AYRI = ['CHP', 'AKP', 'MHP', 'IYI', 'ANAHTAR', 'YRP', 'DEM', 'DIGER'];
export const PARTIES_MATRIX_BIRLESIK = ['CHP', 'AKP', 'MHP', 'MI', 'YRP', 'DEM', 'DIGER'];

// Matris source (2023 oyu) → ilce_baseline icindeki kolonlar (erit mapping)
//   ZAFER + MEMLEKET → IYI (2023 MI icindeydiler)
//   SAADET → YRP (2023 MG icindeydi)
//   SOL → DIGER (matriste ayri yok)
const MATRIX_SRC_TO_BASELINE = {
  AKP:   ['AKP'],
  CHP:   ['CHP'],
  MHP:   ['MHP'],
  IYI:   ['IYI', 'ZAFER', 'MEMLEKET'],
  YRP:   ['YRP', 'SAADET'],
  DEM:   ['DEM'],
  DIGER: ['DIGER', 'SOL']
};

const MATRIX_SRC_PARTIES = ['AKP', 'CHP', 'MHP', 'IYI', 'DEM', 'YRP', 'DIGER'];
const MATRIX_DEST_PARTIES = ['AKP', 'CHP', 'MHP', 'IYI', 'DEM', 'YRP', 'ANAHTAR', 'DIGER'];

/**
 * Senaryo paylarini 100'e normalize et.
 */
export function normalizeSenaryo(senaryo) {
  const sum = Object.values(senaryo).reduce((a, b) => a + b, 0);
  if (sum < 1e-9) return { ...senaryo };
  const out = {};
  for (const k of Object.keys(senaryo)) out[k] = (senaryo[k] * 100) / sum;
  return out;
}

/**
 * KARARSIZ sutununu row-wise oransal dagit.
 * matrix_norm[src][dst] = matrix_raw[src][dst] / (100 - matrix_raw[src].KARARSIZ) * 100
 *
 * @param {Object} matrixRaw — { src: { dst: %, ..., KARARSIZ: % } }
 * @returns {Object} matrixNorm — { src: { dst: %, ... } } (KARARSIZ yok, her satir 100'e normalize)
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
 * Mod-spesifik destToParti haritasi.
 * splitAlliances=true (ayri mod): 1:1 (ANAHTAR ayri parti)
 * splitAlliances=false (birlesik): IYI + ANAHTAR → MI; gerisi 1:1
 */
function destToParti(dst, splitAlliances) {
  if (splitAlliances) return dst;
  if (dst === 'IYI' || dst === 'ANAHTAR') return 'MI';
  return dst;
}

// ============================================================
// 3. PIPELINE
// ============================================================

export class Pipeline {
  constructor({ meta, cevreSeats, ilceBaseline }) {
    this.meta = meta;
    this.cevreSeats = cevreSeats;
    this.ilceBaseline = ilceBaseline;
  }

  static async load(dataDir = './data') {
    const fetchJson = async (name) => {
      const res = await fetch(`${dataDir}/${name}`);
      if (!res.ok) throw new Error(`Veri yuklenemedi: ${name} (${res.status})`);
      return res.json();
    };
    const [meta, cevreSeats, ilceBaseline] = await Promise.all([
      fetchJson('meta.json'),
      fetchJson('cevre_seats.json'),
      fetchJson('ilce_baseline.json')
    ]);
    const p = new Pipeline({ meta, cevreSeats, ilceBaseline });
    p.baseline = '2023';
    return p;
  }

  /**
   * Senaryo + opts ile pipeline calistir.
   * @param {Object} senaryo
   * @param {Object} opts
   * @param {boolean} opts.splitAlliances — true: 11 liste, false: 8 liste (default)
   * @param {string[]} opts.barajExempt
   * @param {number} opts.barajPct — 0-15
   */
  run(senaryo, opts = {}) {
    const splitAlliances = opts.splitAlliances ?? false;
    const PARTIES = splitAlliances ? PARTIES_AYRI_LEGACY : PARTIES_BIRLESIK_LEGACY;
    const barajExempt = opts.barajExempt ?? this.meta.default_baraj_exempt ?? ['MHP', 'SOL'];
    const barajPct = opts.barajPct ?? this.meta.baraj_pct ?? 7;
    // mgWeightMode: 'tarihsel' (default — Saadet+YRP ort) | 'klasik' (normal swing)
    const mgWeightMode = opts.mgWeightMode ?? 'tarihsel';

    // 1. Normalize senaryo
    const sen = normalizeSenaryo(senaryo);

    // 2. Baseline ulkesel paylar
    const baselineUlke = this._calcBaseline(PARTIES, splitAlliances);

    // 3. Swing katsayilari
    const katsayi = {};
    const eksikPartiler = [];  // baseline'da olmayan ama senaryo'da olan partiler
    for (const p of PARTIES) {
      const usesHistoric = (mgWeightMode === 'tarihsel') &&
                            ((splitAlliances && (p === 'YRP' || p === 'SAADET')) ||
                             (!splitAlliances && p === 'MG'));
      if (usesHistoric) { katsayi[p] = null; continue; }
      if (baselineUlke.paylar[p] > 1e-9) {
        katsayi[p] = sen[p] / baselineUlke.paylar[p];
      } else {
        katsayi[p] = null;  // null = uniform fallback (basePay yerine senaryo pay direkt)
        if (sen[p] > 0.01) eksikPartiler.push(p);
      }
    }

    // 4. Cevre seviye oylar
    const cevreOylar = this._calcCevreOylar(sen, katsayi, baselineUlke, PARTIES, splitAlliances, mgWeightMode);

    // 5. Ulke geneli toplam oylar (baraj icin)
    const ulkeToplam = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const cid of Object.keys(cevreOylar)) {
      for (const p of PARTIES) ulkeToplam[p] += cevreOylar[cid][p];
    }
    const ulkeGecerli = Object.values(ulkeToplam).reduce((a, b) => a + b, 0);

    // 6. D'Hondt cevre basina
    const cevreSonuc = [];
    const partiTotal = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const seat of this.cevreSeats) {
      const cid = seat.cevre_id;
      const oylar = cevreOylar[cid];
      if (!oylar) continue;
      const votes = Object.fromEntries(PARTIES.map(p => [p, oylar[p]]));
      const dRes = dhondt(votes, seat.mv, {
        thresholdPct: barajPct,
        totals: ulkeToplam,
        exempt: barajExempt
      });
      const margins = calcNextSeatMargin(votes, seat.mv, dRes, oylar.gecerli);
      let kazanan = PARTIES[0], maxMV = -1;
      for (const p of PARTIES) {
        if (dRes.seats[p] > maxMV) { maxMV = dRes.seats[p]; kazanan = p; }
      }
      const row = {
        cevre_id: cid, cevre_adi: seat.cevre_adi, mv: seat.mv,
        ...dRes.seats,
        kazanan,
        margins,
        gecerli: oylar.gecerli,
        votes: { ...votes }
      };
      cevreSonuc.push(row);
      for (const p of PARTIES) partiTotal[p] += dRes.seats[p];
    }

    // 7. Il agregati
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
        // Il bazinda margin: cevreler arasinda en kucuk gereken oy (en yakin)
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
      // Il margin'lerini % cinsinden yeniden hesapla (il gecerli'ye gore)
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

    // 8. Toplam
    const totalSeats = Object.values(partiTotal).reduce((a, b) => a + b, 0);
    const toplam = PARTIES.map(p => ({
      parti: p,
      mv: partiTotal[p],
      mv_pct: (100 * partiTotal[p]) / totalSeats,
      oy_pct: (100 * ulkeToplam[p]) / ulkeGecerli
    }));

    return {
      mode: splitAlliances ? 'ayri' : 'birlesik',
      partiler: PARTIES,
      senaryo_normalize: sen,
      katsayi,
      cevre: cevreSonuc,
      il: ilSonuc,
      toplam,
      warnings: eksikPartiler.length > 0
        ? [`${eksikPartiler.join(', ')} secili baseline'da yok, oyları her ilçeye uniform dağıtıldı (cografi koordinasyon eksik).`]
        : [],
      meta: {
        total_mv: totalSeats,
        baraj_pct: barajPct,
        baraj_exempt: barajExempt,
        split_alliances: splitAlliances
      }
    };
  }

  _calcBaseline(PARTIES, splitAlliances) {
    const totals = Object.fromEntries(PARTIES.map(p => [p, 0]));
    let totalGecerli = 0;
    for (const row of this.ilceBaseline) {
      totalGecerli += row.gecerli;
      for (const p of PARTIES) {
        if (splitAlliances && (p === 'YRP' || p === 'SAADET')) continue;
        if (!splitAlliances && p === 'MG') {
          // MG = YRP + SAADET (birlesik modda klasik swing icin gerekli)
          totals[p] += (row.YRP || 0) + (row.SAADET || 0);
          continue;
        }
        if (row[p] !== undefined) totals[p] += row[p];
      }
    }
    const paylar = {};
    for (const p of PARTIES) paylar[p] = (100 * totals[p]) / totalGecerli;
    return { totals, paylar, totalGecerli };
  }

  _calcCevreOylar(sen, katsayi, baseline, PARTIES, splitAlliances, mgWeightMode = 'tarihsel') {
    const mgUlkeAgirlik = this.meta.mg_ulke_agirlik;
    const cevreOylar = {};

    for (const row of this.ilceBaseline) {
      const gecerli = row.gecerli;
      const basePay = {};
      for (const p of PARTIES) {
        const usesHistoric = (mgWeightMode === 'tarihsel') &&
                              ((splitAlliances && (p === 'YRP' || p === 'SAADET')) ||
                               (!splitAlliances && p === 'MG'));
        if (usesHistoric) continue;
        if (!splitAlliances && p === 'MG') {
          // Klasik swing: MG ilce baseline = YRP + SAADET ilce toplami
          basePay[p] = gecerli > 0 ? (100 * ((row.YRP || 0) + (row.SAADET || 0))) / gecerli : 0;
        } else {
          basePay[p] = gecerli > 0 ? (100 * (row[p] || 0)) / gecerli : 0;
        }
      }

      const senRaw = {};
      const skipScale = {};   // normalize sirasinda scale edilmeyecek partiler (MG tarihsel + uniform fallback)
      for (const p of PARTIES) {
        const usesHistoric = (mgWeightMode === 'tarihsel') &&
                              ((splitAlliances && (p === 'YRP' || p === 'SAADET')) ||
                               (!splitAlliances && p === 'MG'));
        if (usesHistoric) {
          // Tarihsel MG: ilceden ilceye degisken ama normalize'da scale edilmez
          senRaw[p] = mgUlkeAgirlik > 1e-9
            ? sen[p] * ((row.mg_agirlik || 0) / mgUlkeAgirlik)
            : 0;
          skipScale[p] = true;
        } else if (katsayi[p] === null) {
          senRaw[p] = sen[p];      // uniform fallback (her ilcede sabit)
          skipScale[p] = true;
        } else {
          senRaw[p] = basePay[p] * katsayi[p];
          skipScale[p] = false;
        }
      }

      // Ilce ici normalize — skipScale partileri sabit kalir, kalanlar (100 - skipPay)'a oranlanir
      const skipPay = PARTIES.reduce((a, p) => a + (skipScale[p] ? senRaw[p] : 0), 0);
      const scaleRawSum = PARTIES.reduce((a, p) => a + (skipScale[p] ? 0 : senRaw[p]), 0);
      const scaleHedefPay = Math.max(0, 100 - skipPay);
      const senPay = {};
      for (const p of PARTIES) {
        if (skipScale[p]) {
          senPay[p] = senRaw[p];   // ilce icindeki MG/uniform sabit
        } else {
          senPay[p] = scaleRawSum > 1e-9 ? (scaleHedefPay * senRaw[p]) / scaleRawSum : 0;
        }
      }
      // Oy sayilari
      const oySayi = {};
      for (const p of PARTIES) oySayi[p] = (gecerli * senPay[p]) / 100;

      // Cevreye topla
      if (!cevreOylar[row.cevre]) {
        cevreOylar[row.cevre] = Object.fromEntries(PARTIES.map(p => [p, 0]));
        cevreOylar[row.cevre].gecerli = 0;
      }
      cevreOylar[row.cevre].gecerli += gecerli;
      for (const p of PARTIES) cevreOylar[row.cevre][p] += oySayi[p];
    }
    return cevreOylar;
  }

  // ============================================================
  // MATRIS MODU — ANK-AR oy gecisi matrisi (S161 / 2026-05-16)
  // ============================================================

  /**
   * transition_matrix.json'i yukle ve cache et.
   */
  async loadMatrix(dataDir = './data', file = 'transition_matrix.json') {
    const res = await fetch(`${dataDir}/${file}`);
    if (!res.ok) throw new Error(`Matris yuklenemedi: ${file} (${res.status})`);
    this.matrix = await res.json();
    this.matrixNorm = normalizeMatrix(this.matrix.matrix_raw);
    return this.matrix;
  }

  /**
   * Her ilce icin matris uygulanmis yarin paylari hesapla.
   * @param {Object} matrixNorm — KARARSIZ-cikartilmis 7×8 normalized matris
   * @returns {{ ilceYarin: Array, ulkePay: Object, ulkeGecerli: number }}
   *   ilceYarin: [{ ...row, _destPay: { 8 dst parti } }]
   *   ulkePay: { dst: % } — 8 dst parti ulkesel toplam
   */
  applyMatrixToBaseline(matrixNorm) {
    const ilceYarin = [];
    const ulkeOy = Object.fromEntries(MATRIX_DEST_PARTIES.map(d => [d, 0]));
    let ulkeGecerli = 0;

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
        const srcRow = matrixNorm[src];
        if (!srcRow) continue;
        for (const dst of MATRIX_DEST_PARTIES) {
          destPay[dst] += (pay2023[src] * (srcRow[dst] || 0)) / 100;
        }
      }

      // 3. Toplam ~100 olmali; tam normalize et (baseline coverage'a karsi savunma)
      const total = MATRIX_DEST_PARTIES.reduce((a, d) => a + destPay[d], 0);
      if (total > 1e-9) {
        for (const dst of MATRIX_DEST_PARTIES) destPay[dst] = (destPay[dst] * 100) / total;
      }

      ilceYarin.push({ ...row, _destPay: destPay });
      ulkeGecerli += gecerli;
      for (const dst of MATRIX_DEST_PARTIES) ulkeOy[dst] += (gecerli * destPay[dst]) / 100;
    }

    const ulkePay = {};
    for (const dst of MATRIX_DEST_PARTIES) {
      ulkePay[dst] = ulkeGecerli > 0 ? (100 * ulkeOy[dst]) / ulkeGecerli : 0;
    }
    return { ilceYarin, ulkePay, ulkeGecerli };
  }

  /**
   * Mode-spesifik PARTIES setine gore matrisin urettigi YARIN ulkesel paylar.
   * Display/info amacli (slider DEFAULT'u DEGIL — slider 2023 oyunu gosterir).
   * @returns { parti: % } — splitAlliances=false ise 7 parti, true ise 8 parti
   */
  matrixUlkesel(splitAlliances = false) {
    if (!this.matrix) throw new Error('matrix yuklenmedi — once loadMatrix() cagir');
    const { ulkePay } = this.applyMatrixToBaseline(this.matrixNorm);
    const PARTIES = splitAlliances ? PARTIES_MATRIX_AYRI : PARTIES_MATRIX_BIRLESIK;
    const out = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const dst of MATRIX_DEST_PARTIES) out[destToParti(dst, splitAlliances)] += ulkePay[dst];
    return out;
  }

  /**
   * Gercek 2023 ulkesel paylar (matris source 7-set: AKP, CHP, MHP, IYI, DEM, YRP, DIGER).
   * Erit mapping ile ZAFER+MEMLEKET → IYI, SAADET → YRP, SOL → DIGER.
   * Slider DEFAULT degerlerini hesaplamak icin kullanilir.
   */
  _actualUlkesel7() {
    const totals = Object.fromEntries(MATRIX_SRC_PARTIES.map(p => [p, 0]));
    let totalGecerli = 0;
    for (const row of this.ilceBaseline) {
      const g = row.gecerli;
      if (!g || g <= 0) continue;
      totalGecerli += g;
      for (const src of MATRIX_SRC_PARTIES) {
        const cols = MATRIX_SRC_TO_BASELINE[src];
        for (const c of cols) totals[src] += (row[c] || 0);
      }
    }
    const out = {};
    for (const src of MATRIX_SRC_PARTIES) {
      out[src] = totalGecerli > 0 ? (100 * totals[src]) / totalGecerli : 0;
    }
    return out;
  }

  /**
   * Slider keys icin gercek 2023 ulkesel paylar (mode-spesifik etiketler).
   * Birlesik mode: MI key (matris IYI src ile esles)
   * Ayri mode: IYI key (1:1)
   * Her iki modda 7 parti — ANAHTAR yok cunku 2023'te yoktu.
   * @returns { sliderKey: % }
   */
  actualUlkesel2023(splitAlliances = false) {
    const ulke7 = this._actualUlkesel7();
    const out = {
      CHP: ulke7.CHP, AKP: ulke7.AKP, MHP: ulke7.MHP,
      YRP: ulke7.YRP, DEM: ulke7.DEM, DIGER: ulke7.DIGER
    };
    if (splitAlliances) out.IYI = ulke7.IYI;
    else out.MI = ulke7.IYI;
    // 7 blok mapping ~%1.4 acigi birakir (HUDA-PAR vb. kapsam disi). Slider UX icin 100'e normalize.
    return normalizeSenaryo(out);
  }

  /**
   * Matris-bazli D'Hondt hesabi (S161 v2).
   * Akis: kullanici 2023 ulkesel paylari → uniform swing ile her ilcenin 2023 dagilimi
   *       kullanici hipotezine olceklenir → matris uygulanir → 2026 ilce dagilimi → D'Hondt.
   *
   * @param {Object|null} user2023 — slider girdisi: 2023 ulkesel paylar (mode-spesifik 7-key).
   *   null = gercek 2023 ulkesel paylar kullanilir (matris saf).
   *   Birlesik mode keys: CHP, AKP, MHP, MI, YRP, DEM, DIGER (7)
   *   Ayri mode keys:    CHP, AKP, MHP, IYI, YRP, DEM, DIGER (7) — ANAHTAR YOK (2023'te yoktu)
   * @param {Object} opts
   * @param {boolean} opts.splitAlliances — true: 8 parti (ANAHTAR ayri), false: 7 parti (MI=IYI+ANAHTAR)
   * @param {string[]} opts.barajExempt — default ['MHP']
   * @param {number} opts.barajPct — default 7
   */
  runFromMatrix(user2023 = null, opts = {}) {
    if (!this.matrixNorm) throw new Error('matrixNorm yuklenmedi — once loadMatrix() cagir');
    const splitAlliances = opts.splitAlliances ?? false;
    const PARTIES = splitAlliances ? PARTIES_MATRIX_AYRI : PARTIES_MATRIX_BIRLESIK;
    const barajExempt = opts.barajExempt ?? this.meta.default_baraj_exempt ?? ['MHP'];
    const barajPct = opts.barajPct ?? this.meta.baraj_pct ?? 7;

    // 1. Gercek 2023 ulkesel paylar (matris src 7 keys)
    const actualUlke7 = this._actualUlkesel7();

    // 2. User 2023 → matris src 7 keys
    let user7;
    let usingOverride = false;
    if (user2023 && Object.keys(user2023).length > 0) {
      const sliderKeyToSrc = (src) => (src === 'IYI' && !splitAlliances) ? 'MI' : src;
      const sen = normalizeSenaryo(user2023);
      user7 = {};
      for (const src of MATRIX_SRC_PARTIES) {
        user7[src] = sen[sliderKeyToSrc(src)] ?? 0;
      }
      // Override gercek 2023'ten farkli mi?
      for (const src of MATRIX_SRC_PARTIES) {
        if (Math.abs(user7[src] - actualUlke7[src]) > 0.05) { usingOverride = true; break; }
      }
    } else {
      user7 = { ...actualUlke7 };
    }

    // 3. Per-ilce: 2023'u user2023'e olcekle, sonra matris uygula
    const cevreOylar = {};
    const ulkeYarinDest8 = Object.fromEntries(MATRIX_DEST_PARTIES.map(d => [d, 0]));
    let ulkeGecerli = 0;

    // Ilce-bagimsiz src katsayilari (uniform swing on 2023)
    const swingKatsayi = {};
    for (const src of MATRIX_SRC_PARTIES) {
      swingKatsayi[src] = actualUlke7[src] > 1e-9 ? user7[src] / actualUlke7[src] : 0;
    }

    for (const row of this.ilceBaseline) {
      const gecerli = row.gecerli;
      if (!gecerli || gecerli <= 0) continue;
      ulkeGecerli += gecerli;

      // Ilce 2023 src paylar
      const ilce2023 = {};
      for (const src of MATRIX_SRC_PARTIES) {
        const cols = MATRIX_SRC_TO_BASELINE[src];
        const sum = cols.reduce((a, c) => a + (row[c] || 0), 0);
        ilce2023[src] = (100 * sum) / gecerli;
      }

      // Uniform swing → user 2023 hipotez ilce dagilimi
      const adjIlce2023 = {};
      for (const src of MATRIX_SRC_PARTIES) adjIlce2023[src] = ilce2023[src] * swingKatsayi[src];
      const total7 = MATRIX_SRC_PARTIES.reduce((a, p) => a + adjIlce2023[p], 0);
      if (total7 > 1e-9) {
        for (const src of MATRIX_SRC_PARTIES) adjIlce2023[src] = (adjIlce2023[src] * 100) / total7;
      }

      // Matris uygula → 8 dst pay
      const destPay = Object.fromEntries(MATRIX_DEST_PARTIES.map(d => [d, 0]));
      for (const src of MATRIX_SRC_PARTIES) {
        const srcRow = this.matrixNorm[src];
        if (!srcRow) continue;
        for (const dst of MATRIX_DEST_PARTIES) {
          destPay[dst] += (adjIlce2023[src] * (srcRow[dst] || 0)) / 100;
        }
      }
      const totalDst = MATRIX_DEST_PARTIES.reduce((a, d) => a + destPay[d], 0);
      if (totalDst > 1e-9) {
        for (const dst of MATRIX_DEST_PARTIES) destPay[dst] = (destPay[dst] * 100) / totalDst;
      }

      // Mode PARTIES'e collapse
      const ilcePay = Object.fromEntries(PARTIES.map(p => [p, 0]));
      for (const dst of MATRIX_DEST_PARTIES) {
        ilcePay[destToParti(dst, splitAlliances)] += destPay[dst];
      }

      if (!cevreOylar[row.cevre]) {
        cevreOylar[row.cevre] = Object.fromEntries(PARTIES.map(p => [p, 0]));
        cevreOylar[row.cevre].gecerli = 0;
      }
      cevreOylar[row.cevre].gecerli += gecerli;
      for (const p of PARTIES) cevreOylar[row.cevre][p] += (gecerli * ilcePay[p]) / 100;

      for (const dst of MATRIX_DEST_PARTIES) ulkeYarinDest8[dst] += (gecerli * destPay[dst]) / 100;
    }

    // Yarin ulke paylari (display amacli)
    const tomorrowUlkePay = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const dst of MATRIX_DEST_PARTIES) {
      const collapsed = destToParti(dst, splitAlliances);
      tomorrowUlkePay[collapsed] += ulkeGecerli > 0 ? (100 * ulkeYarinDest8[dst]) / ulkeGecerli : 0;
    }

    // 5. Ulke toplami (baraj icin)
    const ulkeToplam = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const cid of Object.keys(cevreOylar)) {
      for (const p of PARTIES) ulkeToplam[p] += cevreOylar[cid][p];
    }
    const ulkeGecerliFromCevre = Object.values(ulkeToplam).reduce((a, b) => a + b, 0);

    // 6. D'Hondt cevre basina
    const cevreSonuc = [];
    const partiTotal = Object.fromEntries(PARTIES.map(p => [p, 0]));
    for (const seat of this.cevreSeats) {
      const cid = seat.cevre_id;
      const oylar = cevreOylar[cid];
      if (!oylar) continue;
      const votes = Object.fromEntries(PARTIES.map(p => [p, oylar[p]]));
      const dRes = dhondt(votes, seat.mv, {
        thresholdPct: barajPct,
        totals: ulkeToplam,
        exempt: barajExempt
      });
      const margins = calcNextSeatMargin(votes, seat.mv, dRes, oylar.gecerli);
      let kazanan = PARTIES[0], maxMV = -1;
      for (const p of PARTIES) {
        if (dRes.seats[p] > maxMV) { maxMV = dRes.seats[p]; kazanan = p; }
      }
      cevreSonuc.push({
        cevre_id: cid, cevre_adi: seat.cevre_adi, mv: seat.mv,
        ...dRes.seats,
        kazanan, margins, gecerli: oylar.gecerli, votes: { ...votes }
      });
      for (const p of PARTIES) partiTotal[p] += dRes.seats[p];
    }

    // 7. Il agregati
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

    // 8. Toplam
    const totalSeats = Object.values(partiTotal).reduce((a, b) => a + b, 0);
    const toplam = PARTIES.map(p => ({
      parti: p,
      mv: partiTotal[p],
      mv_pct: (100 * partiTotal[p]) / totalSeats,
      oy_pct: (100 * ulkeToplam[p]) / ulkeGecerliFromCevre
    }));

    return {
      mode: splitAlliances ? 'ayri' : 'birlesik',
      method: 'matris',
      partiler: PARTIES,
      actual_2023_ulke: actualUlke7,         // gercek 2023 ulkesel (matris src 7-key)
      user_2023_ulke: user7,                  // kullanici hipotezi 2023 ulkesel (matris src 7-key)
      tomorrow_ulke_pay: tomorrowUlkePay,     // matris uygulanmis 2026 ulkesel (mode-spesifik)
      swing_katsayi: swingKatsayi,
      cevre: cevreSonuc,
      il: ilSonuc,
      toplam,
      warnings: [],
      meta: {
        total_mv: totalSeats,
        baraj_pct: barajPct,
        baraj_exempt: barajExempt,
        split_alliances: splitAlliances,
        slider_override: Boolean(usingOverride),
        matrix_source: this.matrix?.source ?? null
      }
    };
  }
}

export default Pipeline;
