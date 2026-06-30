// TS 필터 로직과 동일한 알고리즘으로 전체 조합을 카운트하여 3,091,431 검증
// (shared/lottoPool.ts의 inPool과 동일 로직을 JS로 인라인 재현 + winners.json 사용)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const winnersRaw = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../shared/data/winners.json"), "utf8"),
);
const WINNER_SET = new Set(
  winnersRaw.map((nums) => [...nums].sort((a, b) => a - b).join(",")),
);
const HIGH = new Set([39, 40, 41, 42, 43, 44, 45]);

function band(n) {
  if (n >= 1 && n <= 10) return 0;
  if (n >= 11 && n <= 20) return 1;
  if (n >= 21 && n <= 30) return 2;
  if (n >= 31 && n <= 40) return 3;
  return 4;
}
function maxRun(c) {
  let best = 1,
    cur = 1;
  for (let i = 1; i < c.length; i++) {
    if (c[i] === c[i - 1] + 1) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 1;
  }
  return best;
}
function leadRun(c) {
  const p = c[0] % 2;
  let r = 1;
  for (let i = 1; i < c.length; i++) {
    if (c[i] % 2 === p) r++;
    else break;
  }
  return r;
}
function inPool(combo) {
  const s = new Set(combo);
  if (WINNER_SET.has(combo.join(","))) return false;
  const odd = combo.reduce((a, n) => a + (n % 2), 0);
  if (odd === 6 || odd === 0) return false;
  const nb = new Set(combo.map(band)).size;
  if (nb === 1) return false;
  if (nb === 2) return false;
  if (maxRun(combo) >= 4) return false;
  if (odd >= 5 || odd <= 1) return false;
  if (s.has(1) && s.has(45)) return false;
  if ((s.has(3) && s.has(43)) || (s.has(2) && s.has(44))) return false;
  if (maxRun(combo) >= 3) return false;
  if (s.has(4) && s.has(42)) return false;
  if (
    (s.has(5) && s.has(41)) ||
    (s.has(6) && s.has(40)) ||
    (s.has(7) && s.has(39)) ||
    (s.has(7) && s.has(45))
  )
    return false;
  let hc = 0;
  for (const n of combo) if (HIGH.has(n)) hc++;
  if (hc >= 3) return false;
  if (s.has(45) && (s.has(2) || s.has(3) || s.has(4) || s.has(5) || s.has(44)))
    return false;
  if (s.has(1) && s.has(2)) return false;
  if (leadRun(combo) >= 3) return false;
  const par = combo.map((n) => n % 2).join("");
  if (par === "101010") return false;
  if (par === "010101") return false;
  const bc = [0, 0, 0, 0, 0];
  for (const n of combo) bc[band(n)]++;
  if (Math.max(...bc) >= 4) return false;
  if (s.has(45)) return false;
  if (s.has(44)) return false;
  return true;
}

let count = 0;
const c = [1, 2, 3, 4, 5, 6];
// 전체 C(45,6) 조합 순회
const a = [];
for (let i = 1; i <= 45; i++) a.push(i);
const idx = [0, 1, 2, 3, 4, 5];
const n = 45,
  k = 6;
while (true) {
  const combo = idx.map((i) => a[i]);
  if (inPool(combo)) count++;
  let i = k - 1;
  while (i >= 0 && idx[i] === i + n - k) i--;
  if (i < 0) break;
  idx[i]++;
  for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
}
console.log("TS-equivalent pool count:", count);
console.log("Expected:", 3091431, "match:", count === 3091431);
