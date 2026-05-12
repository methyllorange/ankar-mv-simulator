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

const PARTIES_BIRLESIK = ['CHP', 'AKP', 'MHP', 'MI', 'MG', 'DEM', 'SOL', 'DIGER'];
const PARTIES_AYRI = ['CHP', 'AKP', 'MHP', 'IYI', 'ZAFER', 'MEMLEKET',
                       'YRP', 'SAADET', 'DEM', 'SOL', 'DIGER'];

/**
 * Senaryo paylarini 100'e normalize et.
 */
export function normalizeSenaryo(senaryo) {
  const sum = Object.values(senaryo).reduce((a, b) => a + b, 0);
  const out = {};
  for (const k of Object.keys(senaryo)) out[k] = (senaryo[k] * 100) / sum;
  return out;
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

  static async load(dataDir = './data', baseline = '2023') {
    const fetchJson = async (name) => {
      const res = await fetch(`${dataDir}/${name}`);
      if (!res.ok) throw new Error(`Veri yuklenemedi: ${name} (${res.status})`);
      return res.json();
    };
    const baselineFile = `ilce_baseline_${baseline}.json`;
    const [meta, cevreSeats, ilceBaseline] = await Promise.all([
      fetchJson('meta.json'),
      fetchJson('cevre_seats.json'),
      fetchJson(baselineFile)
    ]);
    const p = new Pipeline({ meta, cevreSeats, ilceBaseline });
    p.baseline = baseline;
    return p;
  }

  async setBaseline(baseline, dataDir = './data') {
    const res = await fetch(`${dataDir}/ilce_baseline_${baseline}.json`);
    if (!res.ok) throw new Error(`Baseline yuklenemedi: ${baseline}`);
    this.ilceBaseline = await res.json();
    this.baseline = baseline;
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
    const PARTIES = splitAlliances ? PARTIES_AYRI : PARTIES_BIRLESIK;
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
}

export default Pipeline;
