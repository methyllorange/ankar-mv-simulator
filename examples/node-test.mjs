// node-test.mjs — Matris-once-swing D'Hondt motoru testi (S163, 2026-05-18)
// Kullanim: cd projects/dhont-mv-senaryo/web-export && node examples/node-test.mjs
//
// Yeni metodoloji (S163):
//   1. Matris bir kez 2023 ilce baseline'a uygulanir → 2026 ilce baseline (sabit)
//   2. Slider 2026 ulkesel hipotezi (default = matris cikti)
//   3. swing = user_2026 / matris_uretimi_2026
//   4. ilce_pay = ilce_2026_baseline * swing (proxy partileri icin proxy sablonu)
//   5. D'Hondt
import { readFile } from 'node:fs/promises';
import {
  Pipeline, dhondt, normalizeMatrix, normalizeSenaryo,
  PARTIES_MATRIX_BIRLESIK, PARTIES_MATRIX_AYRI
} from '../js/dhondt-pipeline.js';

async function loadLocal(dataDir) {
  const j = async (n) => JSON.parse(await readFile(`${dataDir}/${n}`, 'utf8'));
  const [meta, cevreSeats, ilceBaseline, matrix] = await Promise.all([
    j('meta.json'), j('cevre_seats.json'), j('ilce_baseline.json'), j('transition_matrix.json')
  ]);
  const p = new Pipeline({ meta, cevreSeats, ilceBaseline });
  p.matrix = matrix;
  p.matrixNorm = normalizeMatrix(matrix.matrix_raw);
  return p;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } };

console.log('=== 1. dhondt() unit ===');
const t1 = dhondt({ A: 100000, B: 80000, C: 30000 }, 5);
ok(t1.seats.A === 3 && t1.seats.B === 2 && t1.seats.C === 0, '3-parti 5 MV klasik (A=3, B=2, C=0)');
const t2 = dhondt({ A: 100000, B: 80000, C: 30000, D: 5000 }, 10, {
  thresholdPct: 7, totals: { A: 100000, B: 80000, C: 30000, D: 5000 }
});
ok(t2.seats.A === 5 && t2.seats.B === 4 && t2.seats.C === 1 && t2.seats.D === 0, '4-parti 10 MV baraj (D filtered)');

console.log('\n=== 2. normalizeMatrix() unit ===');
const matrixSample = {
  AKP: { AKP: 66.7, CHP: 4.7, MHP: 0.9, IYI: 0.9, DEM: 1.7, YRP: 1.6, ANAHTAR: 2.7, DIGER: 1.3, KARARSIZ: 19.5 }
};
const norm = normalizeMatrix(matrixSample);
const akpRowSum = Object.values(norm.AKP).reduce((a, b) => a + b, 0);
ok(Math.abs(akpRowSum - 100) < 0.001, `AKP satir toplam ~100 (got ${akpRowSum.toFixed(4)})`);
ok(!('KARARSIZ' in norm.AKP), 'KARARSIZ field cikti');
const akpAkpExpected = (66.7 / (100 - 19.5)) * 100;
ok(Math.abs(norm.AKP.AKP - akpAkpExpected) < 0.001, `AKP→AKP normalize dogru (${akpAkpExpected.toFixed(2)})`);

console.log('\n=== 3. Pipeline yukleme ===');
const motor = await loadLocal('./data');
ok(motor.matrix !== undefined, 'Matrix yuklendi');
ok(motor.matrixNorm.AKP.AKP > 0, 'matrixNorm hazir');
ok(motor.cevreSeats.length === 87, '87 cevre');
ok(motor.ilceBaseline.length > 900, `${motor.ilceBaseline.length} ilce yuklendi`);

console.log('\n=== 4. buildIlceBaseline2026 — birlesik (9 parti) ===');
const ilce2026B = motor.buildIlceBaseline2026(false);
ok(ilce2026B.length === motor.ilceBaseline.length, `${ilce2026B.length} ilce 2026 baseline`);
// Her ilce toplami ~100
const sample = ilce2026B[0];
const sampleSum = PARTIES_MATRIX_BIRLESIK.reduce((a, p) => a + (sample[p] || 0), 0);
ok(Math.abs(sampleSum - 100) < 0.01, `ilk ilce 9-parti toplam ~100 (got ${sampleSum.toFixed(3)})`);
// Birlesik mode 9 parti: SAADET ve MG kolonlari var ama baseline'da ikisi de 0
ok((sample.SAADET ?? 0) < 0.01, `birlesik baseline SAADET ~0 (matris dst yok, got ${(sample.SAADET ?? 0).toFixed(4)})`);
ok((sample.MG ?? 0) < 0.01, `birlesik baseline MG ~0 (cevre seviyesinde dolar, got ${(sample.MG ?? 0).toFixed(4)})`);
ok(!('ANAHTAR' in sample), 'birlesik mod baseline\'da ANAHTAR yok (MI icinde)');

console.log('\n=== 5. buildIlceBaseline2026 — ayri (11 parti) ===');
const ilce2026A = motor.buildIlceBaseline2026(true);
const sampleA = ilce2026A[0];
const sampleASum = PARTIES_MATRIX_AYRI.reduce((a, p) => a + (sampleA[p] || 0), 0);
ok(Math.abs(sampleASum - 100) < 0.01, `ilk ilce 11-parti toplam ~100 (got ${sampleASum.toFixed(3)})`);
ok('SAADET' in sampleA, 'ayri mod baseline\'da SAADET var');
// SAADET her ilcede 0 (2023 CSV'de 0)
const saadetMaxIlce = Math.max(...ilce2026A.map(r => r.SAADET));
ok(saadetMaxIlce < 0.01, `SAADET her ilcede ~0 (max=${saadetMaxIlce.toFixed(4)}, matris dst yok + 2023 baseline 0)`);
const anahtarMinIlce = Math.min(...ilce2026A.map(r => r.ANAHTAR));
ok(anahtarMinIlce > 0, `ANAHTAR her ilcede > 0 (min=${anahtarMinIlce.toFixed(2)}, matris dst veriyor)`);

console.log('\n=== 6. matrixUlkesel2026 — ulkesel paylar ===');
const ulkeB = motor.matrixUlkesel2026(false);
const ulkeBSum = PARTIES_MATRIX_BIRLESIK.reduce((a, p) => a + ulkeB[p], 0);
ok(Math.abs(ulkeBSum - 100) < 0.01, `birlesik ulkesel toplam ~100 (got ${ulkeBSum.toFixed(3)})`);
console.log('  Birlesik matris cikti 2026:');
for (const p of PARTIES_MATRIX_BIRLESIK) console.log(`    ${p.padEnd(6)} ${ulkeB[p].toFixed(2)}%`);

const ulkeA = motor.matrixUlkesel2026(true);
ok(ulkeA.ANAHTAR > 0, `ANAHTAR ulkesel > 0 (${ulkeA.ANAHTAR.toFixed(2)}%)`);
ok(ulkeA.SAADET < 0.01, `SAADET ulkesel ~0 (${ulkeA.SAADET.toFixed(4)}%, baseline 0)`);

console.log('\n=== 7. runFromSenaryo2026 — birlesik saf matris (null user) ===');
const sonucB = motor.runFromSenaryo2026(null, { splitAlliances: false });
ok(sonucB.meta.total_mv === 600, `birlesik toplam 600 MV (got ${sonucB.meta.total_mv})`);
ok(sonucB.meta.slider_override === false, 'slider_override=false (null user)');
ok(sonucB.method === 'matris-once-swing', 'method=matris-once-swing');
console.log('  Birlesik saf matris sonuc:');
for (const r of sonucB.toplam) {
  console.log(`    ${r.parti.padEnd(6)} MV=${String(r.mv).padStart(3)} (%${r.mv_pct.toFixed(1)}) oy=%${r.oy_pct.toFixed(2)}`);
}

console.log('\n=== 8. runFromSenaryo2026 — ayri saf matris ===');
const sonucA = motor.runFromSenaryo2026(null, { splitAlliances: true });
ok(sonucA.meta.total_mv === 600, `ayri toplam 600 MV (got ${sonucA.meta.total_mv})`);
const anahtarRow = sonucA.toplam.find(r => r.parti === 'ANAHTAR');
ok(anahtarRow.oy_pct > 0, `ANAHTAR oy_pct > 0 (${anahtarRow.oy_pct.toFixed(2)}%)`);
const saadetRow = sonucA.toplam.find(r => r.parti === 'SAADET');
ok(saadetRow.oy_pct < 0.01, `SAADET oy_pct ~0 (default, slider 0)`);

console.log('\n=== 9. SAADET YRP proxy testi (slider %8) ===');
const senSAADET = { ...ulkeA };  // matris cikti default
senSAADET.SAADET = 8;
// Diger partilerden orantili dusur (toplam 100'e normalize edilecek zaten)
const sonucSAADET = motor.runFromSenaryo2026(senSAADET, { splitAlliances: true });
const saadetSAADETRow = sonucSAADET.toplam.find(r => r.parti === 'SAADET');
const yrpRow = sonucSAADET.toplam.find(r => r.parti === 'YRP');
console.log(`  SAADET ulkesel oy: ${saadetSAADETRow.oy_pct.toFixed(2)}% (slider hedef ~%7.4 — normalize sonrasi)`);
console.log(`  SAADET MV: ${saadetSAADETRow.mv}`);
ok(saadetSAADETRow.oy_pct > 5, `SAADET ulkesel > 5% (slider proxy calisti, got ${saadetSAADETRow.oy_pct.toFixed(2)}%)`);

// SAADET cografi sablonu YRP'ye benzemeli — YRP yogun illerde SAADET de yogun
// Konya, Aksaray, Duzce: YRP-guclu iller
const ortakIllerYrp = ['KONYA', 'AKSARAY', 'DUZCE'];
const yrpYogunSAADET = sonucSAADET.cevre
  .filter(c => ortakIllerYrp.some(il => c.cevre_id.startsWith(il)))
  .map(c => {
    const totalVotes = Object.values(c.votes).reduce((a, b) => a + b, 0);
    return {
      cid: c.cevre_id,
      saadetPct: 100 * c.votes.SAADET / totalVotes,
      yrpPct: 100 * c.votes.YRP / totalVotes
    };
  });
console.log('  YRP-guclu illerde SAADET vs YRP cografi oran:');
for (const r of yrpYogunSAADET) {
  console.log(`    ${r.cid.padEnd(15)} SAADET=%${r.saadetPct.toFixed(2)}  YRP=%${r.yrpPct.toFixed(2)}`);
}
// SAADET ortalama (Konya, Aksaray, Duzce) > ulkesel SAADET (cografi yogunluk dogrulanmali)
const avgSAADETYrpYogun = yrpYogunSAADET.reduce((a, r) => a + r.saadetPct, 0) / yrpYogunSAADET.length;
ok(avgSAADETYrpYogun > saadetSAADETRow.oy_pct,
   `YRP-guclu illerde SAADET cografi yogunlasiyor (avg=${avgSAADETYrpYogun.toFixed(2)}% > ulkesel=${saadetSAADETRow.oy_pct.toFixed(2)}%)`);

console.log('\n=== 10. CHP +5 hipotez testi (birlesik) ===');
const senCHP = { ...ulkeB };
senCHP.CHP = ulkeB.CHP + 5;
senCHP.AKP = Math.max(0, ulkeB.AKP - 5);
const sonucCHP = motor.runFromSenaryo2026(senCHP, { splitAlliances: false });
ok(sonucCHP.meta.slider_override === true, 'slider_override=true (CHP +5)');
const chpRow = sonucCHP.toplam.find(r => r.parti === 'CHP');
const chpBaseRow = sonucB.toplam.find(r => r.parti === 'CHP');
ok(chpRow.oy_pct > chpBaseRow.oy_pct, `CHP oy_pct artmis (${chpBaseRow.oy_pct.toFixed(2)} → ${chpRow.oy_pct.toFixed(2)})`);
console.log(`  CHP yarin oy: ${chpBaseRow.oy_pct.toFixed(2)}% (matris) → ${chpRow.oy_pct.toFixed(2)}% (+5 hipotez)`);

console.log('\n=== 11. 7 il CHP-IYI ortak liste edge case (S159 fix) ===');
const ortakIller = ['YOZGAT', 'AKSARAY', 'BAYBURT', 'BITLIS', 'CANKIRI', 'GUMUSHANE', 'MUS'];
const ortakIllerCevreOy = sonucB.cevre
  .filter(c => ortakIller.some(il => c.cevre_id.startsWith(il)))
  .map(c => ({ id: c.cevre_id, chp_oy: c.votes.CHP, gecerli: c.gecerli }));
ok(ortakIllerCevreOy.every(r => r.chp_oy > 0), '7 il cevrelerinde CHP oyu > 0 (S159 fix korundu)');

console.log('\n=== 12. MG Liste Modu — autoMgOrtakIller ===');
const setTumu = motor.autoMgOrtakIller(81);
ok(setTumu.size === 81, `N=81 → 81 il (got ${setTumu.size})`);
const set40 = motor.autoMgOrtakIller(40);
ok(set40.size === 40, `N=40 → 40 il (got ${set40.size})`);
const set18 = motor.autoMgOrtakIller(18);
ok(set18.size === 18, `N=18 → 18 il (got ${set18.size})`);
ok(set18.has('KONYA') || set40.has('KONYA'), 'KONYA top illerde (MG yogun)');
console.log(`  C 18: ${Array.from(set18).sort().slice(0,10).join(', ')}${set18.size > 10 ? '...' : ''}`);

console.log('\n=== 13. MG ortak liste (tumu, 81 il) — MG etiketinde toplama ===');
const senOrtakTumu = { ...ulkeA, SAADET: 8 };
const sonucOrtakTumu = motor.runFromSenaryo2026(senOrtakTumu, {
  splitAlliances: true, mgOrtakIller: setTumu
});
ok(sonucOrtakTumu.meta.total_mv === 600, `Tumu ortak: 600 MV (got ${sonucOrtakTumu.meta.total_mv})`);
const mgRow = sonucOrtakTumu.toplam.find(r => r.parti === 'MG');
const yrpRowOrtak = sonucOrtakTumu.toplam.find(r => r.parti === 'YRP');
const saadetRowOrtak = sonucOrtakTumu.toplam.find(r => r.parti === 'SAADET');
ok(mgRow.mv > 0, `MG MV > 0 ortak listede (got ${mgRow.mv})`);
ok(yrpRowOrtak.mv === 0, `YRP MV=0 ortak listede (got ${yrpRowOrtak.mv})`);
ok(saadetRowOrtak.mv === 0, `SAADET MV=0 ortak listede (got ${saadetRowOrtak.mv})`);
ok(sonucOrtakTumu.meta.baraj_exempt.includes('MG'), `MG baraj muaf (auto-exempt)`);
ok(sonucOrtakTumu.meta.baraj_exempt.includes('YRP'), `YRP baraj muaf (ittifak)`);
ok(sonucOrtakTumu.meta.baraj_exempt.includes('SAADET'), `SAADET baraj muaf (ittifak)`);
console.log(`  MG: ${mgRow.mv} MV (oy %${mgRow.oy_pct.toFixed(2)})`);

console.log('\n=== 14. MG hicbiri ortak (empty set) ===');
const sonucAyriHepsi = motor.runFromSenaryo2026(senOrtakTumu, {
  splitAlliances: true, mgOrtakIller: new Set()
});
const mgRowAyri = sonucAyriHepsi.toplam.find(r => r.parti === 'MG');
ok(mgRowAyri.mv === 0, `MG MV=0 hicbiri ortak (got ${mgRowAyri.mv})`);
ok(sonucAyriHepsi.meta.total_mv === 600, `Hicbiri ortak: 600 MV`);
const yrpAyri = sonucAyriHepsi.toplam.find(r => r.parti === 'YRP').mv;
const saadetAyri = sonucAyriHepsi.toplam.find(r => r.parti === 'SAADET').mv;
console.log(`  YRP=${yrpAyri}, SAADET=${saadetAyri} (ayri yarisirlar; muhtemelen baraj alti)`);

console.log('\n=== 15. MG 40 il ortak (B mod) ===');
const sonucB40 = motor.runFromSenaryo2026(senOrtakTumu, {
  splitAlliances: true, mgOrtakIller: set40
});
ok(sonucB40.meta.total_mv === 600, `B 40: 600 MV`);
ok(sonucB40.meta.mg_ortak_count === 40, `mg_ortak_count = 40 (got ${sonucB40.meta.mg_ortak_count})`);
const mgB40 = sonucB40.toplam.find(r => r.parti === 'MG').mv;
console.log(`  B 40 sonuc: MG=${mgB40}, YRP=${sonucB40.toplam.find(r=>r.parti==='YRP').mv}, SAADET=${sonucB40.toplam.find(r=>r.parti==='SAADET').mv}`);

console.log('\n=== Sonuc ===');
console.log(`PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exit(1);
