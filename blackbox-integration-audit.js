/**
 * BLACKBOX INTEGRATION / BEHAVIOUR AUDIT (Option B)
 * Behaviour-focused, auth-mechanism agnostic
 *
 * Requirements:
 * - API running
 * - Test user exists
 *
 * This script NEVER reads app code.
 */

import fs from "fs";
import fetch from "node-fetch";

const BASE = process.env.API_BASE_URL;
const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

if (!BASE || !EMAIL || !PASSWORD) {
  console.error("❌ Missing required environment variables.");
  console.error("Required: API_BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD");
  process.exit(1);
}

let token = null;
const REPORT = [];

const record = (section, result, note = "") => {
  REPORT.push(`- ${result ? "✅ PASS" : "❌ FAIL"} **${section}**${note ? ` — ${note}` : ""}`);
};

const api = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });

  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};

/* ===========================
   AUTH BEHAVIOUR (Option B)
   =========================== */

async function authAudit() {
  const login = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });

  if (login.status === 200) {
    token = login.body?.token || null;
    record("Login succeeds with valid credentials", true);
  } else {
    record("Login succeeds with valid credentials", false);
    return;
  }

  const me = await api("/auth/me");
  record("Authenticated request succeeds", me.status === 200);

  // Clear explicit credentials
  token = null;
  const meWithoutCreds = await api("/auth/me");

  record(
    "Auth requires explicit credentials",
    meWithoutCreds.status !== 200
  );
}

/* ===========================
   CREATE → VERIFY → REFRESH
   =========================== */

async function createVerifyAudit() {
  const login = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  token = login.body.token;

  const create = await api("/posts", {
    method: "POST",
    body: JSON.stringify({ content: "Integration audit post" })
  });

  record("Create action returns success", create.status === 201);

  const id = create.body?.id;
  if (!id) {
    record("Created object returns ID", false);
    return;
  }

  const fetchPost = await api(`/posts/${id}`);
  record("Created item exists after refresh", fetchPost.status === 200);

  const del = await api(`/posts/${id}`, { method: "DELETE" });
  record("Delete action acknowledged", del.status === 200);

  const refetch = await api(`/posts/${id}`);
  record("Deleted item does not reappear", refetch.status === 404);
}

/* ===========================
   PERMISSION TRUTH
   =========================== */

async function permissionAudit() {
  const otherUser = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "other@audit.local", password: PASSWORD })
  });

  if (!otherUser.body?.token) {
    record("Secondary user exists for permission audit", false);
    return;
  }

  const forbidden = await fetch(`${BASE}/admin/users`, {
    headers: {
      Authorization: `Bearer ${otherUser.body.token}`
    }
  });

  record("Admin routes blocked for non-admin", forbidden.status === 403);
}

/* ===========================
   QUIET / MODE / STATE
   =========================== */

async function stateAudit() {
  const toggle = await api("/users/me/settings", {
    method: "PATCH",
    body: JSON.stringify({ quietMode: true })
  });

  record("State change acknowledged", toggle.status === 200);

  const reload = await api("/users/me");
  record("State persists after refresh", reload.body?.quietMode === true);
}

/* ===========================
   RUN AUDIT
   =========================== */

(async () => {
  REPORT.push("# 🔍 INTEGRATION BEHAVIOUR AUDIT\n");

  try {
    await authAudit();
    await createVerifyAudit();
    await permissionAudit();
    await stateAudit();
  } catch (e) {
    REPORT.push(`❌ Fatal error: ${e.message}`);
  }

  fs.writeFileSync("INTEGRATION_BEHAVIOUR_AUDIT.md", REPORT.join("\n"));
  console.log("✅ Integration Behaviour Audit Complete → INTEGRATION_BEHAVIOUR_AUDIT.md");
})();
