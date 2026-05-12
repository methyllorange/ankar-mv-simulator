// node-test.mjs — Pipeline'i Node ile test et (R sonucu ile karsilastir).
// Kullanim: node node-test.mjs
//
// Beklenen: CHP 184, AKP 183, MHP 17, MI 106, MG 44, DEM 62, SOL 4, DIGER 0
import { readFile } from 'node:fs/promises';
import { Pipeline, dhondt } from '../js/dhondt-pipeline.js';

// Node fetch yerine fs ile yukle
async function loadLocal(dataDir) {
  const j = async (n) => JSON.parse(await readFile(`${dataDir}/${n}`, 'utf8'));
  const [meta, cevreSeats, ilceBaseline] = await Promise.all([
    j('meta.json'), j('cevre_seats.json'), j('ilce_baseline.json')
  ]);
  return new Pipeline({ meta, cevreSeats, ilceBaseline });
}

console.log('=== D\'Hondt unit test ===');
const t1 = dhondt({ A: 100000, B: 80000, C: 30000 }, 5);
console.assert(t1.A === 3 && t1.B === 2 && t1.C === 0, 'Test 1 FAIL');
console.log('Test 1 (3-parti 5 MV klasik): PASS', t1);

const t2 = dhondt({ A: 100000, B: 80000, C: 30000, D: 5000 }, 10, {
  thresholdPct: 7,
  totals: { A: 100000, B: 80000, C: 30000, D: 5000 }
});
console.assert(t2.A === 5 && t2.B === 4 && t2.C === 1 && t2.D === 0, 'Test 2 FAIL');
console.log('Test 2 (4-parti 10 MV baraj): PASS', t2);

console.log('\n=== Pipeline test ===');
const motor = await loadLocal('../data');
console.log('Veri yuklendi:', motor.cevreSeats.length, 'cevre,', motor.ilceBaseline.length, 'ilce');
console.log('MG ulke agirlik:', motor.meta.mg_ulke_agirlik?.toFixed(3) + '%');

const sonuc = motor.run(motor.meta.default_senaryo);
console.assert(sonuc.meta.total_mv === 600, 'Toplam != 600');
console.log('\nSenaryo sonucu:');
for (const r of sonuc.toplam) {
  console.log(`  ${r.parti.padEnd(6)} MV=${String(r.mv).padStart(3)} (${r.mv_pct.toFixed(2)}%) oy=${r.oy_pct.toFixed(2)}%`);
}

const beklenen = { CHP: 184, AKP: 183, MHP: 17, MI: 106, MG: 44, DEM: 62, SOL: 4, DIGER: 0 };
console.log('\nR sonucu ile karsilastirma (beklenen sapma 0):');
let fail = 0;
for (const r of sonuc.toplam) {
  const exp = beklenen[r.parti];
  const diff = r.mv - exp;
  const flag = diff === 0 ? 'OK' : `DIFF=${diff}`;
  console.log(`  ${r.parti.padEnd(6)} JS=${r.mv} R=${exp}  ${flag}`);
  if (diff !== 0) fail++;
}
if (fail === 0) {
  console.log('\nTum testler PASS — JS motor R ile bire bir tutuyor.');
} else {
  console.log(`\n${fail} parti R sonucundan sapti.`);
  process.exit(1);
}
