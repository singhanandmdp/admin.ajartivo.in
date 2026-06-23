import { supabase as client } from "./supabase-auth.js";

window.AdminData = {
  connected: true,
  getDesigns: getDesigns,
  addDesign: addDesign,
  updateDesign: updateDesign,
  deleteDesign: deleteDesign,
  incrementDesignDownloads: incrementDesignDownloads,
  getPayments: getPayments,
  getPurchases: getPurchases,
  addPayment: addPayment,
  getUsers: getUsers,
  getPlans: getPlans,
  getUserUsage: getUserUsage,
  addUser: addUser,
  updateUser: updateUser,
  deleteUser: deleteUser,
  updateCurrentAdminProfile: updateCurrentAdminProfile,
  updateCurrentAdminPassword: updateCurrentAdminPassword
};

async function getDesigns() {
  let result = await client.from("designs").select("*");

  if (result.error || !Array.isArray(result.data) || !result.data.length) {
    const fallback = await client.from("designs").select("*");
    if (!fallback.error) {
      result = fallback;
    }
  }

  if (result.error) throw toReadableError(result.error);
  return (Array.isArray(result.data) ? result.data : []).map(normalizeDesign).sort(sortByCreatedAtDesc);
}

async function addDesign(payload) {
  await requireAuthenticatedUser();

  const normalized = normalizeDesign(payload);
  const fullRecord = buildDesignInsertRecord(normalized, false);
  console.log("[AJartivo Admin] Design insert payload", fullRecord);

  try {
    const inserted = await insertDesignRecord(fullRecord);
    return normalizeDesign(inserted);
  } catch (error) {
    console.error("[AJartivo Admin] Design insert failed", error);
    if (!isMissingColumnError(error)) {
      throw toReadableError(error);
    }
  }

  console.warn("Retrying design insert with compatible schema payload.");
  const fallbackRecord = buildDesignInsertRecord(normalized, true);
  console.log("[AJartivo Admin] Design insert fallback payload", fallbackRecord);
  const inserted = await insertDesignRecord(fallbackRecord);
  return normalizeDesign(inserted);
}

async function updateDesign(id, payload) {
  await requireAuthenticatedUser();

  const normalized = normalizeDesign(payload);
  const fullRecord = buildDesignUpdateRecord(normalized, false);
  console.log("[AJartivo Admin] Design update payload", { id: String(id || "").trim(), record: fullRecord });

  try {
    const updated = await updateDesignRecord(id, fullRecord);
    return normalizeDesign(updated);
  } catch (error) {
    console.error("[AJartivo Admin] Design update failed", error);
    if (!isMissingColumnError(error)) {
      throw toReadableError(error);
    }
  }

  console.warn("Retrying design update with compatible schema payload.");
  const fallbackRecord = buildDesignUpdateRecord(normalized, true);
  console.log("[AJartivo Admin] Design update fallback payload", { id: String(id || "").trim(), record: fallbackRecord });
  const updated = await updateDesignRecord(id, fallbackRecord);
  return normalizeDesign(updated);
}
async function deleteDesign(id) {
  await requireAuthenticatedUser();
  const { error } = await client.from("designs").delete().eq("id", id);
  if (error) throw toReadableError(error);
}

async function incrementDesignDownloads(id, quantity) {
  const { data, error } = await client.from("designs").select("downloads").eq("id", id).single();
  if (error) throw toReadableError(error);

  const nextCount = Number(data && data.downloads || 0) + Math.max(1, Number(quantity || 1));
  const payload = {
    downloads: nextCount
  };

  try {
    payload.updated_at = new Date().toISOString();
    const { error: updateError } = await client.from("designs").update(payload).eq("id", id);
    if (updateError) throw updateError;
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw toReadableError(error);
    }

    const { error: fallbackError } = await client
      .from("designs")
      .update({ downloads: nextCount })
      .eq("id", id);

    if (fallbackError) throw toReadableError(fallbackError);
  }
}

async function getPayments() {
  const { data, error } = await client.from("payments").select("*");
  if (error) throw toReadableError(error);
  return (Array.isArray(data) ? data : []).map(normalizePayment).sort(sortByCreatedAtDesc);
}

async function getPurchases() {
  const { data, error } = await client.from("purchases").select("*");
  if (error) throw toReadableError(error);
  return (Array.isArray(data) ? data : []).map(normalizePurchase).sort(sortByCreatedAtDesc);
}

async function getUserUsage(userId) {
  const id = String(userId || "").trim();
  if (!id) return { downloads_used_month: 0, ai_generations_used_today: 0 };

  const now = new Date();
  const monthKey = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");
  const dayKey = now.toISOString().slice(0, 10);

  const { data, error } = await client.from("user_usage").select("*").eq("user_id", id).eq("month_key", monthKey);
  if (error) {
    if (isMissingRelationError(error)) {
      return { downloads_used_month: 0, ai_generations_used_today: 0 };
    }
    throw toReadableError(error);
  }

  const rows = Array.isArray(data) ? data : [];
  const downloadsUsedMonth = rows.reduce(function (total, row) {
    return total + (Number(row && row.downloads_used || 0) || 0);
  }, 0);
  const todayRow = rows.find(function (r) { return String(r && r.day_key || "") === dayKey; });
  const aiUsedToday = Number(todayRow && todayRow.ai_generations_used || 0) || 0;

  return {
    downloads_used_month: downloadsUsedMonth,
    ai_generations_used_today: aiUsedToday
  };
}

async function addPayment(payload) {
  await requireAuthenticatedUser();

  const { data, error } = await client
    .from("payments")
    .insert(mapPaymentForInsert(payload))
    .select("*")
    .single();

  if (error) throw toReadableError(error);
  return normalizePayment(data);
}

async function getUsers() {
  const { data, error } = await client
    .from("profiles")
    .select("*");

  if (error) {
    throw toReadableError(error);
  }

  return (Array.isArray(data) ? data : [])
    .map(normalizeUser)
    .sort(sortByCreatedAtDesc);
}

async function getPlans() {
  const { data, error } = await client.from("plans_master").select("*");
  if (error) throw toReadableError(error);
  return (Array.isArray(data) ? data : []).map(normalizePlan).sort(function (a, b) {
    return (a.plan_id || "").localeCompare(b.plan_id || "");
  });
}

function normalizePlan(record) {
  const item = record || {};
  return {
    id: String(item.id || "").trim(),
    plan_id: cleanText(item.plan_id || item.planId || item.id) || "",
    name: cleanText(item.name || item.title || item.plan_name) || "",
    duration_days: Number(item.duration_days || item.duration || 0) || 0,
    price: Number(item.price || item.amount || 0) || 0,
    currency: cleanText(item.currency || "USD")
  };
}

async function addUser(payload) {
  await requireAuthenticatedUser();

  const record = {
    id: crypto.randomUUID(),
    name: cleanText(payload && payload.name),
    email: cleanText(payload && payload.email).toLowerCase(),
    role: normalizeProfileRole(payload && payload.role),
    status: cleanText(payload && payload.status) || "Active",
    created_at: new Date().toISOString()
  };

  const { data, error } = await client.from("profiles").insert(record).select("*").single();
  if (error) throw toReadableError(error);
  return normalizeUser(data);
}

async function deleteUser(id) {
  await requireAuthenticatedUser();
  const { error } = await client.from("profiles").delete().eq("id", id);
  if (error) throw toReadableError(error);
}

async function updateUser(id, payload) {
  await requireAuthenticatedUser();
  const record = mapUserForUpdate(payload);
  if (!Object.keys(record).length) {
    throw new Error("No valid fields provided for user update.");
  }

  const { data, error } = await client.from("profiles").update(record).eq("id", id).select("*").maybeSingle();
  if (error) throw toReadableError(error);
  return normalizeUser(data || { id, ...payload });
}

function mapUserForUpdate(payload) {
  const item = payload || {};
  const normalized = {
    name: cleanText(item.name),
    role: normalizeProfileRole(item.role),
    status: cleanText(item.status),
    plan_name: cleanText(item.plan_name || item.active_plan_name || item.planName || item.activePlanName),
    active_plan_name: cleanText(item.active_plan_name || item.plan_name || item.activePlanName || item.planName),
    plan_id: cleanText(item.plan_id || item.active_plan_id || item.planId || item.activePlanId),
    active_plan_id: cleanText(item.active_plan_id || item.plan_id || item.activePlanId || item.planId),
    premium_expiry: cleanText(item.premium_expiry),
    is_premium: typeof item.is_premium === "boolean" ? item.is_premium : undefined,
    premium_active: typeof item.premium_active === "boolean" ? item.premium_active : undefined
  };

  Object.keys(normalized).forEach(function (key) {
    if (normalized[key] === "" || normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return normalized;
}

async function updateCurrentAdminProfile(payload) {
  const user = await requireAuthenticatedUser();
  const nextName = cleanText(payload && payload.name);
  if (!nextName) {
    throw new Error("Please enter a valid name.");
  }

  const email = cleanText(user && user.email).toLowerCase();
  const existing = await findCurrentAdminRecord(user);
  const currentRole = normalizeProfileRole(existing && existing.role) || "admin";
  const currentStatus = cleanText(existing && existing.status) || "Active";

  const { error: authError } = await client.auth.updateUser({
    data: {
      display_name: nextName,
      full_name: nextName
    }
  });

  if (authError) {
    throw toReadableError(authError);
  }

  if (existing) {
    let query = client.from("profiles").update({ name: nextName });
    query = cleanText(existing.id)
      ? query.eq("id", cleanText(existing.id))
      : query.eq("email", email);

    const { data, error } = await query.select("*").maybeSingle();
    if (error) throw toReadableError(error);
    return normalizeUser(data || { ...existing, name: nextName });
  }

  const record = {
    id: String(user && user.id || crypto.randomUUID()),
    name: nextName,
    email: email,
    role: currentRole,
    status: currentStatus,
    created_at: new Date().toISOString()
  };

  const { data, error } = await client.from("profiles").insert(record).select("*").single();
  if (error) throw toReadableError(error);
  return normalizeUser(data);
}

async function updateCurrentAdminPassword(payload) {
  await requireAuthenticatedUser();

  const nextPassword = String(payload && payload.password || "");
  if (nextPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const { data, error } = await client.auth.updateUser({
    password: nextPassword
  });

  if (error) throw toReadableError(error);
  return data && data.user ? data.user : null;
}

function sanitizeDesignRecord(record) {
  const sanitized = { ...(record || {}) };
  delete sanitized.preview_url;
  delete sanitized.previewUrl;
  return sanitized;
}

async function insertDesignRecord(record) {
  const sanitizedRecord = sanitizeDesignRecord(record);
  console.log("[AJartivo Admin] Supabase insert payload", sanitizedRecord);

  const { data, error } = await client.from("designs").insert(sanitizedRecord).select("*").single();
  if (error) {
    console.error("[AJartivo Admin] Supabase insert error", error, sanitizedRecord);
    throw error;
  }
  console.log("[AJartivo Admin] Supabase insert response", data);
  return data;
}

async function updateDesignRecord(id, record) {
  const sanitizedRecord = sanitizeDesignRecord(record);
  console.log("[AJartivo Admin] Supabase update payload", { id: String(id || "").trim(), record: sanitizedRecord });

  const { data, error } = await client
    .from("designs")
    .update(sanitizedRecord)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[AJartivo Admin] Supabase update error", error, { id: String(id || "").trim(), record: sanitizedRecord });
    throw error;
  }
  console.log("[AJartivo Admin] Supabase update response", data);
  return data;
}

async function requireAuthenticatedUser() {
  const { data, error } = await client.auth.getUser();
  if (error) throw toReadableError(error);
  if (!data || !data.user) {
    throw new Error("Admin session expired. Please log in again.");
  }
  return data.user;
}

async function findCurrentAdminRecord(user) {
  const userId = cleanText(user && user.id);
  const email = cleanText(user && user.email).toLowerCase();

  if (userId) {
    const byId = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!byId.error && byId.data) {
      return byId.data;
    }
  }

  if (email) {
    const byEmail = await client.from("profiles").select("*").eq("email", email).maybeSingle();
    if (byEmail.error) throw toReadableError(byEmail.error);
    return byEmail.data || null;
  }

  return null;
}

function normalizeDesign(record) {
  const item = record || {};
  const resolvedImageUrl = cleanText(item.image_url || item.image);
  const resolvedImage = cleanText(item.image || item.image_url);

  return {
    ...item,
    id: String(item.id || "").trim(),
    name: cleanText(item.name || item.title) || "Untitled Design",
    title: cleanText(item.title || item.name) || "Untitled Design",
    category: cleanText(item.category).toUpperCase() || "OTHER",
    paymentMode: resolvePaymentMode(item),
    price: Number(item.price || item.Price || 0),
    Price: Number(item.Price || item.price || 0),
    description: cleanText(item.description),
    tags: normalizeTags(item.tags, item.title || item.name),
    image: resolvedImage || resolvedImageUrl,
    image_url: resolvedImageUrl || resolvedImage,
    downloadUrl: cleanText(item.downloadUrl || item.download_link || item.file_url || item.download),
    download: cleanText(item.download || item.downloadUrl || item.download_link || item.file_url),
    download_link: cleanText(item.download_link || item.file_url || item.downloadUrl || item.download),
    file_url: cleanText(item.file_url || item.download_link || item.downloadUrl || item.download),
    downloadCount: Number(item.downloadCount || item.downloads || 0),
    downloads: Number(item.downloads || item.downloadCount || 0),
    createdAt: cleanText(item.createdAt || item.created_at) || new Date().toISOString(),
    created_at: cleanText(item.created_at || item.createdAt) || new Date().toISOString()
  };
}

function buildDesignInsertRecord(payload, compatibleMode) {
  const normalized = normalizeDesign(payload);
  const timestamp = new Date().toISOString();
  const baseRecord = buildBaseDesignRecord(normalized);
  if (compatibleMode) {
    const fallbackRecord = {
      ...baseRecord,
      created_at: timestamp
    };
    return fallbackRecord;
  }

  return {
    ...baseRecord,
    name: normalized.name,
    payment_mode: normalized.paymentMode,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function buildDesignUpdateRecord(payload, compatibleMode) {
  const normalized = normalizeDesign(payload);
  const baseRecord = buildBaseDesignRecord(normalized);
  if (compatibleMode) {
    const fallbackRecord = { ...baseRecord };
    return fallbackRecord;
  }

  return {
    ...baseRecord,
    name: normalized.name,
    payment_mode: normalized.paymentMode,
    updated_at: new Date().toISOString()
  };
}

function buildBaseDesignRecord(normalized) {
  return {
    title: normalized.title,
    category: normalized.category,
    price: normalized.price,
    is_paid: normalized.paymentMode === "paid",
    description: normalized.description,
    tags: normalized.tags,
    image_url: cleanText(normalized.image_url || normalized.image),
    image: cleanText(normalized.image || normalized.image_url),
    download_link: normalized.downloadUrl,
    downloads: Number(normalized.downloadCount || 0)
  };
}

function normalizePayment(record) {
  const item = record || {};
  const rawStatus = cleanText(item.status).toLowerCase();
  return {
    ...item,
    id: String(item.id || "").trim(),
    payer: cleanText(item.payer),
    designId: cleanText(item.designId || item.design_id),
    designName: cleanText(item.designName || item.design_name) || "Manual",
    quantity: Math.max(1, Number(item.quantity || 1)),
    amount: Number(item.amount || 0),
    method: cleanText(item.method) || "UPI",
    status: rawStatus === "paid" ? "Paid" : rawStatus === "failed" ? "Failed" : "Pending",
    createdAt: cleanText(item.createdAt || item.created_at) || new Date().toISOString()
  };
}

function normalizePurchase(record) {
  const item = record || {};
  return {
    ...item,
    id: String(item.id || "").trim(),
    userId: cleanText(item.user_id || item.userId),
    designId: cleanText(item.design_id || item.designId),
    paymentId: cleanText(item.payment_id || item.paymentId),
    amount: Number(item.amount || 0),
    designName: cleanText(item.design_name || item.designName),
    createdAt: cleanText(item.created_at || item.createdAt) || new Date().toISOString()
  };
}

function mapPaymentForInsert(payload) {
  const item = normalizePayment(payload);
  return {
    payer: item.payer,
    design_id: item.designId,
    design_name: item.designName,
    quantity: item.quantity,
    amount: item.amount,
    method: item.method,
    status: item.status,
    created_at: new Date().toISOString()
  };
}

function normalizeUser(record) {
  const item = record || {};
  const premiumExpiry = cleanText(item.premium_expiry);
  const premiumExpiryMs = premiumExpiry ? new Date(premiumExpiry).getTime() : 0;
  const premiumActive = Boolean((item.is_premium === true || item.premium_active === true) && premiumExpiryMs && premiumExpiryMs > Date.now());
  const freeDownloadCount = Number(item.free_download_count || 0) || 0;
  const weeklyPremiumDownloadCount = Number(item.weekly_premium_download_count || 0) || 0;
  const freeDownloadRemaining = Number.isFinite(Number(item.free_download_remaining))
    ? Number(item.free_download_remaining)
    : Math.max(0, 5 - freeDownloadCount);
  const weeklyPremiumRemaining = Number.isFinite(Number(item.weekly_premium_remaining))
    ? Number(item.weekly_premium_remaining)
    : Math.max(0, 2 - weeklyPremiumDownloadCount);
  const isBanned = item.is_banned === true || String(item.status || "").trim().toLowerCase() === "blocked";
  const activePlanId = cleanText(item.active_plan_id || item.plan_id);
  const activePlanName = cleanText(item.active_plan_name || item.plan_name) || (premiumActive ? "Premium" : "Free");

  return {
    ...item,
    id: String(item.id || "").trim(),
    name: cleanText(item.name) || "User",
    email: cleanText(item.email).toLowerCase(),
    role: normalizeProfileRole(item.role),
    status: isBanned ? "Blocked" : (cleanText(item.status) || "Active"),
    is_banned: isBanned,
    is_premium: item.is_premium === true,
    premium_active: premiumActive,
    premium_expiry: premiumExpiry,
    plan_id: activePlanId,
    plan_name: activePlanName,
    active_plan_id: activePlanId,
    active_plan_name: activePlanName,
    free_download_count: freeDownloadCount,
    free_download_remaining: freeDownloadRemaining,
    weekly_premium_download_count: weeklyPremiumDownloadCount,
    weekly_premium_remaining: weeklyPremiumRemaining,
    weekly_reset_date: cleanText(item.weekly_reset_date),
    premium_badge: premiumActive ? "Premium Active" : "Free Member",
    createdAt: cleanText(item.createdAt || item.created_at) || new Date().toISOString()
  };
}

function normalizeProfileRole(role) {
  const normalized = cleanText(role).toLowerCase();
  if (normalized === "admin") {
    return "admin";
  }
  if (normalized === "moderator") {
    return "moderator";
  }
  return "user";
}

function resolvePaymentMode(item) {
  const mode = cleanText(item.paymentMode || item.payment_mode).toLowerCase();
  if (mode === "free") return "free";
  if (mode === "paid") return "paid";
  return Number(item.price || item.Price || 0) > 0 || item.is_paid === true ? "paid" : "free";
}

function sortByCreatedAtDesc(a, b) {
  return getCreatedAtMs(b) - getCreatedAtMs(a);
}

function getCreatedAtMs(item) {
  const value = cleanText(item && (item.createdAt || item.created_at));
  const date = new Date(value || 0);
  const millis = date.getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeTags(value, fallbackTitle) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [];

  const tags = source
    .map(function (item) {
      return cleanText(item);
    })
    .filter(Boolean)
    .filter(function (item, index, list) {
      return list.indexOf(item) === index;
    });

  if (tags.length) {
    return tags;
  }

  const fallback = cleanText(fallbackTitle);
  return fallback ? [fallback] : [];
}

function isMissingColumnError(error) {
  const message = getErrorMessage(error);
  const code = String(error && error.code || "").trim().toUpperCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    message.includes("column") && message.includes("does not exist") ||
    message.includes("could not find the") && message.includes("column")
  );
}

function toReadableError(error) {
  const message = getErrorMessage(error);
  const code = String(error && error.code || "").trim().toUpperCase();

  if (!message) {
    return new Error("Supabase request failed.");
  }

  if (message.includes("jwt") && message.includes("expired")) {
    return new Error("Admin session expired. Please log in again.");
  }

  if (message.includes("row-level security") || code === "42501" || message.includes("permission denied")) {
    return new Error("Supabase permission denied. Please check the admin policy or login session.");
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return new Error("Supabase connection failed. Please check the network and try again.");
  }

  return new Error(error && error.message ? error.message : "Supabase request failed.");
}

function getErrorMessage(error) {
  return String(error && (error.message || error.details || error.hint) || "").trim().toLowerCase();
}

