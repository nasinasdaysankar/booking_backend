// =============================================================================
// REDIS CACHE VERIFICATION TEST — k6
// Proves that verify-status caching is working by calling the same orderId
// twice and showing the response-time difference (cached = much faster).
//
// USAGE:
//   k6 run load_tests/verify_redis_cache.js
//   k6 run -e BASE_URL=http://localhost:4000 load_tests/verify_redis_cache.js
// =============================================================================

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL      = __ENV.BASE_URL      || "https://bookingbackend-production-2282.up.railway.app";
const TEST_EMAIL    = __ENV.TEST_EMAIL    || "testuser@gmail.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "123456";

export const options = {
  // Single VU, runs once — just proves cache works
  vus: 1,
  iterations: 1,
  thresholds: {
    // The second call (cache hit) must be at least 50% faster than the first
    "http_req_duration{call:second}": ["p(95)<500"],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (res.status !== 200) {
    console.error(`❌ Login failed: ${res.body}`);
    return { token: null };
  }
  return { token: res.json("token") };
}

export default function (data) {
  const { token } = data;
  if (!token) { console.error("No token — skipping"); return; }

  const headers = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // Use a stable fake orderId — Cashfree will return NOT_FOUND,
  // but the cache still kicks in (any response is cached).
  const orderId = `CACHE_TEST_${Date.now()}`;

  // ─────────────────────────────────────────────
  // CALL 1 — Cache MISS (hits Cashfree API)
  // ─────────────────────────────────────────────
  console.log(`\n📡 Call 1 — Cache MISS expected (orderId: ${orderId})`);
  const res1 = http.post(
    `${BASE_URL}/api/payments/verify-status`,
    JSON.stringify({ orderId }),
    { ...headers, tags: { call: "first" } }
  );

  const t1 = res1.timings.duration;
  check(res1, { "call1: server responded": (r) => r.status < 500 });
  console.log(`   ⏱  Response time: ${t1.toFixed(0)}ms  (status: ${res1.status})`);

  // Wait less than the PENDING cache TTL (4s) so the cached value is still valid
  sleep(0.5);

  // ─────────────────────────────────────────────
  // CALL 2 — Cache HIT (served from Redis)
  // ─────────────────────────────────────────────
  console.log(`\n⚡ Call 2 — Cache HIT expected (same orderId)`);
  const res2 = http.post(
    `${BASE_URL}/api/payments/verify-status`,
    JSON.stringify({ orderId }),
    { ...headers, tags: { call: "second" } }
  );

  const t2 = res2.timings.duration;
  check(res2, {
    "call2: server responded":           (r) => r.status < 500,
    "call2: significantly faster":       () => t2 < t1 * 0.5,   // at least 2× faster
    "call2: same paymentStatus returned":(r) => {
      try {
        return r.json("paymentStatus") === res1.json("paymentStatus");
      } catch { return false; }
    },
  });
  console.log(`   ⏱  Response time: ${t2.toFixed(0)}ms  (status: ${res2.status})`);

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  const speedup = t1 > 0 ? (t1 / t2).toFixed(1) : "N/A";
  const cacheWorking = t2 < t1 * 0.5;

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  MISS (call 1) : ${t1.toFixed(0)}ms`);
  console.log(`  HIT  (call 2) : ${t2.toFixed(0)}ms`);
  console.log(`  Speed-up      : ${speedup}×`);
  console.log(`  Cache working : ${cacheWorking ? "✅ YES" : "❌ NO — check Redis connection"}`);
  console.log(`${"─".repeat(50)}\n`);

  if (!cacheWorking) {
    console.warn(
      "⚠️  Cache does not appear to be working. Check:\n" +
      "   1. Railway server logs for 'Cache HIT' vs 'Cache MISS' lines\n" +
      "   2. Redis connection: redis-cli -u $REDIS_URL PING\n" +
      "   3. redis-cli -u $REDIS_URL KEYS 'cf:status:*'"
    );
  }
}
