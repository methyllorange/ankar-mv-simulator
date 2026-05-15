// node-test.mjs — Matris-bazli D'Hondt motoru testi (S161, 2026-05-16)
// Kullanim: cd projects/dhont-mv-senaryo/web-export/examples && node node-test.mjs
//
// Yeni metodoloji: ANK-AR oy gecisi matrisi → 2023 ilce baseline → D'Hondt.
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
ok(Math.abs(norm.AKP.AKP - akpAkpExpected) < 0.001, `AKP→AKP normalize dogru (${akpAkpExpected.toFixed(2)} bekleniyor, got ${norm.AKP.AKP.toFixed(4)})`);

console.log('\n=== 3. Pipeline matris yukleme ===');
const motor = await loadLocal('../data');
ok(motor.matrix !== undefined, 'Matrix yuklendi');
ok(motor.matrixNorm.AKP.AKP > 0, 'matrixNorm hazir');
ok(motor.cevreSeats.length === 87, '87 cevre');
ok(motor.ilceBaseline.length > 900, `${motor.ilceBaseline.length} ilce yuklendi`);

console.log('\n=== 4. actualUlkesel2023() (slider DEFAULT degerleri) ===');
const ulke2023Birlesik = motor.actualUlkesel2023(false);
console.log('  Gercek 2023 ulkesel (birlesik 7 parti):');
let toplam2023 = 0;
for (const [p, v] of Object.entries(ulke2023Birlesik)) {
  console.log(`    ${p.padEnd(6)} ${v.toFixed(2)}%`);
  toplam2023 += v;
}
ok(Math.abs(toplam2023 - 100) < 0.5, `Toplam 2023 ulke pay ~100 (got ${toplam2023.toFixed(2)})`);
ok(!('ANAHTAR' in ulke2023Birlesik), 'ANAHTAR slider key DEGIL (2023te yoktu)');

const ulke2023Ayri = motor.actualUlkesel2023(true);
ok(!('ANAHTAR' in ulke2023Ayri), 'ANAHTAR ayri modda da slider key DEGIL');
ok('IYI' in ulke2023Ayri, 'IYI ayri modda var');
ok('MI' in ulke2023Birlesik, 'MI birlesik modda var');
ok(Math.abs(ulke2023Ayri.IYI - ulke2023Birlesik.MI) < 0.01, 'IYI (ayri) = MI (birlesik) — ayni 2023 src');

console.log('\n=== 5. runFromMatrix() — null user2023 = gercek 2023 (saf matris) ===');
const sonuc = motor.runFromMatrix(null, { splitAlliances: false });
ok(sonuc.meta.total_mv === 600, `Toplam 600 MV (got ${sonuc.meta.total_mv})`);
ok(sonuc.method === 'matris', 'method=matris');
ok(sonuc.meta.slider_override === false, 'slider_override=false (null user)');
console.log('  Toplam (birlesik, slider=actual2023):');
for (const r of sonuc.toplam) {
  console.log(`    ${r.parti.padEnd(6)} MV=${String(r.mv).padStart(3)} (%${r.mv_pct.toFixed(1)}) oy=%${r.oy_pct.toFixed(2)}`);
}

console.log('\n=== 6. runFromMatrix() — ayri mod (ANAHTAR dst) ===');
const sonucAyri = motor.runFromMatrix(null, { splitAlliances: true });
ok(sonucAyri.meta.total_mv === 600, '600 MV ayri modda da');
const anahtarRow = sonucAyri.toplam.find(r => r.parti === 'ANAHTAR');
ok(anahtarRow !== undefined, 'ANAHTAR satiri toplam tablosunda var');
console.log(`  ANAHTAR: oy=%${anahtarRow.oy_pct.toFixed(2)}, MV=${anahtarRow.mv}`);

console.log('\n=== 7. runFromMatrix() — kullanici 2023 hipotezi (CHP +5 puan) ===');
// Birlesik mode: CHP'ye 5 puan ver, AKP'den al
const ulkeMod = { ...ulke2023Birlesik };
ulkeMod.CHP = ulkeMod.CHP + 5;
ulkeMod.AKP = Math.max(0, ulkeMod.AKP - 5);
const sonucHipotez = motor.runFromMatrix(ulkeMod, { splitAlliances: false });
ok(sonucHipotez.meta.slider_override === true, 'slider_override=true (degisik user)');
const chpRow = sonucHipotez.toplam.find(r => r.parti === 'CHP');
const chpBaseRow = sonuc.toplam.find(r => r.parti === 'CHP');
ok(chpRow.oy_pct > chpBaseRow.oy_pct, `CHP yarin oy_pct artmis (${chpBaseRow.oy_pct.toFixed(2)} → ${chpRow.oy_pct.toFixed(2)})`);
console.log(`  CHP yarin oy: ${chpBaseRow.oy_pct.toFixed(2)}% (gercek 2023) → ${chpRow.oy_pct.toFixed(2)}% (CHP +5 hipotez)`);
ok(sonucHipotez.user_2023_ulke.CHP > sonucHipotez.actual_2023_ulke.CHP, 'user_2023_ulke.CHP > actual_2023_ulke.CHP');

console.log('\n=== 8. 7 il CHP-IYI ortak liste edge case ===');
const ortakIller = ['YOZGAT', 'AKSARAY', 'BAYBURT', 'BITLIS', 'CANKIRI', 'GUMUSHANE', 'MUS'];
const ilSonuclar = sonuc.il.filter(r => ortakIller.includes(r.il));
console.log('  Bu illerde matris uygulandiginda CHP MV (saf matris, birlesik):');
let chpZeroFails = 0;
for (const il of ilSonuclar) {
  console.log(`    ${il.il.padEnd(12)} CHP MV=${il.CHP} (${il.gecerli.toLocaleString()} gecerli)`);
}
// Note: CHP MV could be 0 in some illerde even with valid CHP votes, due to D'Hondt baraj or low share. Check oy_pct instead.
const ortakIllerCevreOy = sonuc.cevre
  .filter(c => ortakIller.some(il => c.cevre_id.startsWith(il)))
  .map(c => ({ id: c.cevre_id, chp_oy: c.votes.CHP, gecerli: c.gecerli }));
ok(ortakIllerCevreOy.every(r => r.chp_oy > 0), '7 il cevrelerinde CHP oyu > 0 (S159 fix korundu)');

console.log('\n=== Sonuc ===');
console.log(`PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exit(1);
