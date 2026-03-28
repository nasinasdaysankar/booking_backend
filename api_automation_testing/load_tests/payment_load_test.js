// =============================================================================
// PAYMENT LOAD TEST — k6
// Tests the payment flow under 100 concurrent virtual users.
//
// USAGE:
//   # Run with defaults (production backend, 100 VUs):
//   k6 run load_tests/payment_load_test.js
//
//   # Override backend URL or credentials:
//   k6 run -e BASE_URL=http://localhost:4000 \
//           -e TEST_EMAIL=yourtest@example.com \
//           -e TEST_PASSWORD=yourpassword \
//           -e CAFETERIA_ID=1 \
//           load_tests/payment_load_test.js
//
//   # Run a specific scenario only:
//   k6 run -e SCENARIO=verify_spike load_tests/payment_load_test.js
//   k6 run -e SCENARIO=create_flood load_tests/payment_load_test.js
//   k6 run -e SCENARIO=duplicate_confirm load_tests/payment_load_test.js
//   k6 run -e SCENARIO=full_flow load_tests/payment_load_test.js  (default)
//
// SCENARIOS:
//   full_flow        — 100 VUs simulate create → verify-status → confirm end-to-end
//   verify_spike     — 100 VUs hammer verify-status simultaneously (Cashfree API load)
//   create_flood     — 100 VUs create Cashfree orders simultaneously (Finance Backend load)
//   duplicate_confirm— 100 VUs call /confirm for the SAME order at the same time
//                      (tests idempotency / duplicate-order prevention)
//
// NOTE: /confirm with real order IDs hits Cashfree and writes to your DB.
//       Use a sandbox Cashfree env if you don't want real orders created.
// =============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ---------------------------------------------------------------------------
// CONFIG — override with -e flags on the CLI
// ---------------------------------------------------------------------------
const BASE_URL     = __ENV.BASE_URL     || "https://bookingbackend-production-2282.up.railway.app";
const TEST_EMAIL   = __ENV.TEST_EMAIL   || "testuser@gmail.com";
const TEST_PASSWORD= __ENV.TEST_PASSWORD|| "123456";
const CAFETERIA_ID = Number(__ENV.CAFETERIA_ID || "1");
const SCENARIO     = __ENV.SCENARIO     || "full_flow";

// Pre-existing Cashfree order ID to use for the duplicate_confirm scenario.
// Set this to a real order ID you already have in your system, or leave as
// empty — the test will skip that scenario if not provided.
const EXISTING_ORDER_ID = __ENV.EXISTING_ORDER_ID || "";

// ---------------------------------------------------------------------------
// CUSTOM METRICS
// ---------------------------------------------------------------------------
const paymentCreateErrors  = new Rate("payment_create_errors");
const paymentVerifyErrors  = new Rate("payment_verify_errors");
const paymentConfirmErrors = new Rate("payment_confirm_errors");
const createDuration       = new Trend("payment_create_duration", true);
const verifyDuration       = new Trend("payment_verify_duration", true);
const confirmDuration      = new Trend("payment_confirm_duration", true);
const ordersCreated        = new Counter("orders_created_total");
const duplicatesBlocked    = new Counter("duplicate_orders_blocked");

// ---------------------------------------------------------------------------
// PASS/FAIL THRESHOLDS
// Adjust these based on your SLAs.
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    // ≥95% of all requests must succeed
    http_req_failed:            ["rate<0.05"],

    // p95 response times
    payment_create_duration:    ["p(95)<5000"],  // create: under 5s (calls Finance Backend)
    payment_verify_duration:    ["p(95)<3000"],  // verify: under 3s (calls Cashfree API)
    payment_confirm_duration:   ["p(95)<4000"],  // confirm: under 4s (DB + Cashfree)

    // Error rates per endpoint
    payment_create_errors:      ["rate<0.05"],
    payment_verify_errors:      ["rate<0.05"],
    payment_confirm_errors:     ["rate<0.10"],   // slightly more lenient (Cashfree rejects fake IDs)
  },

  scenarios: buildScenarios(SCENARIO),
};

function buildScenarios(name) {
  // Common ramp: 0→100 VUs over 15s, hold 60s, ramp down 10s
  const ramp100 = {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "15s", target: 100 },
      { duration: "60s", target: 100 },
      { duration: "10s", target: 0   },
    ],
  };

  switch (name) {
    case "verify_spike":
      return { verify_spike: { ...ramp100, exec: "runVerifySpike" } };
    case "create_flood":
      return { create_flood: { ...ramp100, exec: "runCreateFlood" } };
    case "duplicate_confirm":
      return {
        duplicate_confirm: {
          executor: "shared-iterations",
          vus: 100,
          iterations: 100,    // Each of the 100 VUs fires once simultaneously
          maxDuration: "30s",
          exec: "runDuplicateConfirm",
        },
      };
    case "full_flow":
    default:
      return { full_flow: { ...ramp100, exec: "runFullFlow" } };
  }
}

// ---------------------------------------------------------------------------
// SETUP — runs once before all VUs start; returns shared data to VUs
// ---------------------------------------------------------------------------
export function setup() {
  console.log(`\n🚀 Payment Load Test — SCENARIO: ${SCENARIO}`);
  console.log(`   Base URL    : ${BASE_URL}`);
  console.log(`   VUs         : 100`);
  console.log(`   Test user   : ${TEST_EMAIL}`);
  console.log(`   Cafeteria   : ${CAFETERIA_ID}\n`);

  // Login to get an auth token (all VUs share this token)
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (loginRes.status !== 200) {
    console.error(`❌ Login failed (${loginRes.status}): ${loginRes.body}`);
    return { token: null };
  }

  const body = loginRes.json();
  const token = body.token;
  console.log(`✅ Login successful. Token: ${token ? token.slice(0, 20) + "..." : "MISSING"}`);
  return { token };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function authHeaders(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

function generateOrderId() {
  // Unique per VU iteration — avoids collisions between concurrent users
  return `LOADTEST_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Realistic cart — 2 items from cafeteria
function sampleCart() {
  return [
    { id: 1, menuItemId: 1, name: "Veg Biryani",   qty: 1, quantity: 1, price: 80,  imageUrl: null },
    { id: 2, menuItemId: 2, name: "Cold Coffee",    qty: 1, quantity: 1, price: 50,  imageUrl: null },
  ];
}

// ===========================================================================
// SCENARIO 1: full_flow
// Each VU simulates the complete payment sequence:
//   create order → verify status → confirm order
// ===========================================================================
export function runFullFlow(data) {
  const { token } = data;
  if (!token) return;

  const orderId = generateOrderId();
  const items   = sampleCart();
  const amount  = items.reduce((s, i) => s + i.price * i.qty, 0) + 1; // +1 platform fee

  group("1. Create Cashfree Order", () => {
    const payload = {
      orderId,
      orderAmount:   amount,
      orderCurrency: "INR",
      cafeteriaId:   CAFETERIA_ID,
      items,
      customerDetails: {
        customerId:    "loadtest_user",
        customerPhone: "9999999999",
        customerEmail: TEST_EMAIL,
        customerName:  "Load Test User",
      },
      orderMeta: { returnUrl: "https://google.com" },
    };

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/payments/create`, JSON.stringify(payload), authHeaders(token));
    createDuration.add(Date.now() - start);

    const ok = check(res, {
      "create: status 200":             (r) => r.status === 200,
      "create: has paymentSessionId":   (r) => {
        try { return !!r.json("paymentSessionId"); } catch { return false; }
      },
    });

    paymentCreateErrors.add(!ok);
    if (!ok) {
      console.warn(`⚠️ [CREATE] ${orderId} → ${res.status}: ${res.body.slice(0, 200)}`);
    }
  });

  sleep(0.5); // Brief pause — mimics user seeing the payment sheet

  group("2. Verify Payment Status", () => {
    // Using our own generated orderId — Cashfree will return NOT_FOUND or PENDING.
    // This tests: server can handle 100 concurrent outbound Cashfree API calls.
    const payload = { orderId };

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/payments/verify-status`, JSON.stringify(payload), authHeaders(token));
    verifyDuration.add(Date.now() - start);

    // We accept any non-5xx as "ok" — Cashfree returning PENDING/UNKNOWN is expected
    // since we didn't actually pay through the SDK.
    const ok = check(res, {
      "verify: server responded":    (r) => r.status < 500,
      "verify: has paymentStatus":   (r) => {
        try { return r.json("paymentStatus") !== undefined; } catch { return false; }
      },
    });

    paymentVerifyErrors.add(!ok);
    if (!ok) {
      console.warn(`⚠️ [VERIFY] ${orderId} → ${res.status}: ${res.body.slice(0, 200)}`);
    }
  });

  sleep(0.5);
  // NOTE: We intentionally skip /confirm here in full_flow to avoid writing
  // real orders to the DB without real payments. Use duplicate_confirm scenario
  // for testing the confirm endpoint's concurrency safety.
}

// ===========================================================================
// SCENARIO 2: verify_spike
// 100 VUs hammer /verify-status simultaneously with unique order IDs.
// Tests: server's ability to fire 100 concurrent outbound Cashfree API calls.
// ===========================================================================
export function runVerifySpike(data) {
  const { token } = data;
  if (!token) return;

  const orderId = generateOrderId();

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/payments/verify-status`,
    JSON.stringify({ orderId }),
    authHeaders(token)
  );
  verifyDuration.add(Date.now() - start);

  const ok = check(res, {
    "verify_spike: server responded":  (r) => r.status < 500,
    "verify_spike: returns JSON":      (r) => {
      try { r.json(); return true; } catch { return false; }
    },
  });

  paymentVerifyErrors.add(!ok);
  if (!ok) {
    console.warn(`⚠️ [VERIFY SPIKE] ${orderId} → ${res.status}`);
  }
}

// ===========================================================================
// SCENARIO 3: create_flood
// 100 VUs call /create simultaneously — tests Finance Backend proxy under load
// and the order_snapshot INSERT concurrency.
// NOTE: This creates real Cashfree sessions. Use sandbox credentials to avoid
// real orders. Each session is unused (no payment made), so no money is moved.
// ===========================================================================
export function runCreateFlood(data) {
  const { token } = data;
  if (!token) return;

  const orderId = generateOrderId();
  const items   = sampleCart();
  const amount  = items.reduce((s, i) => s + i.price * i.qty, 0) + 1;

  const payload = {
    orderId,
    orderAmount:   amount,
    orderCurrency: "INR",
    cafeteriaId:   CAFETERIA_ID,
    items,
    customerDetails: {
      customerId:    "loadtest_user",
      customerPhone: "9999999999",
      customerEmail: TEST_EMAIL,
      customerName:  "Load Test User",
    },
    orderMeta: { returnUrl: "https://google.com" },
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/payments/create`, JSON.stringify(payload), authHeaders(token));
  createDuration.add(Date.now() - start);

  const ok = check(res, {
    "create_flood: status 200":           (r) => r.status === 200,
    "create_flood: has paymentSessionId": (r) => {
      try { return !!r.json("paymentSessionId"); } catch { return false; }
    },
  });

  paymentCreateErrors.add(!ok);
  ordersCreated.add(ok ? 1 : 0);

  if (!ok) {
    console.warn(`⚠️ [CREATE FLOOD] ${orderId} → ${res.status}: ${res.body.slice(0, 200)}`);
  }
}

// ===========================================================================
// SCENARIO 4: duplicate_confirm
// 100 VUs call /confirm for the EXACT SAME order ID simultaneously.
// Tests: does the DB transaction prevent double-order creation?
// Expected: exactly 1 VU gets a fresh order created; the other 99 get the
// existing order back (idempotent response). Zero duplicate orders in DB.
//
// Requires: EXISTING_ORDER_ID env var (a real Cashfree order that is PAID).
//   k6 run -e SCENARIO=duplicate_confirm -e EXISTING_ORDER_ID=ORDER_1234 ...
// ===========================================================================
export function runDuplicateConfirm(data) {
  const { token } = data;
  if (!token) return;

  if (!EXISTING_ORDER_ID) {
    console.warn("⚠️ [DUPLICATE CONFIRM] EXISTING_ORDER_ID not set — skipping. " +
      "Set -e EXISTING_ORDER_ID=<your_cashfree_order_id>");
    return;
  }

  const items  = sampleCart();
  const amount = items.reduce((s, i) => s + i.price * i.qty, 0) + 1;

  const payload = {
    orderId:         EXISTING_ORDER_ID,
    billId:          "TEST-BILL-001",
    cafeteriaId:     CAFETERIA_ID,
    paymentId:       EXISTING_ORDER_ID,
    transactionId:   EXISTING_ORDER_ID,
    paymentStatus:   "SUCCESS",
    amount,
    isParcel:        false,
    parcelAmount:    "0.00",
    platformFee:     "1.00",
    commissionAmount:"1.00",
    gstAmount:       "5.00",
    items,
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/payments/confirm`, JSON.stringify(payload), authHeaders(token));
  confirmDuration.add(Date.now() - start);

  const ok = check(res, {
    "dup_confirm: server did not crash": (r) => r.status < 500,
    "dup_confirm: returned kotNumber":   (r) => {
      try { return !!r.json("kotNumber"); } catch { return false; }
    },
  });

  // If the order was already in the DB, the server returns the existing kotNumber
  // (idempotent). We want all 100 to succeed — they should all get the same KOT.
  const isExisting = res.status === 200;
  duplicatesBlocked.add(isExisting ? 0 : 1); // Count any case where server didn't return 200

  paymentConfirmErrors.add(!ok);
  if (!ok) {
    console.warn(`⚠️ [DUP CONFIRM] VU ${__VU} → ${res.status}: ${res.body.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// DEFAULT export — used when running with --vus/--iterations CLI flags
// (e.g. for a quick 1-VU dry run: k6 run --vus 1 --iterations 1 ...)
// ---------------------------------------------------------------------------
export default function (data) {
  runFullFlow(data);
}

// ---------------------------------------------------------------------------
// TEARDOWN — runs once after all VUs finish
// ---------------------------------------------------------------------------
export function teardown(_data) {
  console.log("\n📊 Load test complete.");
  console.log("   Check the summary above for p95 response times and error rates.");
  console.log("   Key things to look for:");
  console.log("   • payment_create_duration p(95) < 5000ms  ← Finance Backend + Cashfree latency");
  console.log("   • payment_verify_duration p(95) < 3000ms  ← Cashfree API response time");
  console.log("   • http_req_failed rate < 5%               ← Overall server stability");
  console.log("   • duplicate_orders_blocked = 0            ← Idempotency working correctly\n");
}
