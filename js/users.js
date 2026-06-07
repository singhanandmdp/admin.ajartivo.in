document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page !== "users") {
    return;
  }

  const upgradeForm = document.getElementById("upgradeForm");
  const upgradeEmail = document.getElementById("upgradeEmail");
  const emailSuggestions = document.getElementById("emailSuggestions");
  const upgradePlan = document.getElementById("upgradePlan");
  const upgradeDuration = document.getElementById("upgradeDuration");
  const upgradeButton = document.getElementById("upgradeButton");
  const searchInput = document.getElementById("userSearch");
  const table = document.getElementById("usersTable");
  let cachedPlans = [];

  function statusClass(status) {
    if (status === "Active") {
      return "status-pill status-success";
    }
    if (status === "Pending") {
      return "status-pill status-warning";
    }
    return "status-pill status-danger";
  }

  function formatRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "admin") {
      return "Admin";
    }
    if (value === "moderator") {
      return "Moderator";
    }
    return "User";
  }

  function normalizeManageableRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "moderator") {
      return "moderator";
    }
    return "user";
  }

  function formatPlan(user) {
    const plan = String(user && (user.active_plan_name || user.plan_name || user.planName || user.activePlanName) || "").trim();
    if (plan) {
      return plan;
    }
    return user && (user.premium_active === true || user.is_premium === true) ? "Premium" : "Free";
  }

  function formatPremiumCycle(user) {
    const expiry = String(user && (user.premium_expiry || user.premiumExpiry) || "").trim();
    if (expiry) {
      return window.AdminApp && typeof window.AdminApp.formatDate === "function"
        ? window.AdminApp.formatDate(expiry)
        : expiry;
    }
    return user && (user.premium_active === true || user.is_premium === true) ? "Active" : "Free";
  }

  function isPremiumUser(user) {
    const normalizedPlan = String(user && (user.active_plan_name || user.plan_name || user.planName || user.activePlanName) || "").trim().toLowerCase();
    return normalizedPlan === "premium" || user && (user.premium_active === true || user.is_premium === true);
  }

  async function getUsersSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getUsers === "function") {
      return await store.getUsers();
    }
    throw new Error("Supabase users data is not available.");
  }

  async function getPlansSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getPlans === "function") {
      return await store.getPlans();
    }
    return [];
  }

  function formatDurationLabel(days) {
    const d = Number(days || 0) || 0;
    if (d <= 0) return "";
    if (d % 365 === 0) {
      const yrs = d / 365;
      return yrs === 1 ? "1 year" : yrs + " years";
    }
    if (d % 30 === 0) {
      const months = d / 30;
      return months === 1 ? "1 month" : months + " months";
    }
    return d + " days";
  }

  function showEmailSuggestions(users, query) {
    if (!emailSuggestions || !query) {
      emailSuggestions.hidden = true;
      emailSuggestions.innerHTML = "";
      return;
    }

    const matching = users
      .filter(function (user) {
        const email = String(user.email || "").toLowerCase();
        const name = String(user.name || "").toLowerCase();
        return email.indexOf(query) !== -1 || name.indexOf(query) !== -1;
      })
      .slice(0, 6);

    if (!matching.length) {
      emailSuggestions.hidden = true;
      emailSuggestions.innerHTML = "";
      return;
    }

    emailSuggestions.hidden = false;
    emailSuggestions.innerHTML = matching
      .map(function (user) {
        return "<button type='button' class='suggestion-item' data-email='" +
          escapeHtml(String(user.email || "")) +
          "'>" +
          escapeHtml(user.email || "") +
          " <span>" + escapeHtml(user.name || "") + "</span>" +
          "</button>";
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function addUserSafe(payload) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.addUser === "function") {
      await store.addUser(payload);
      return;
    }
    throw new Error("Supabase users data is not available.");
  }

  async function updateUserSafe(id, payload) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.updateUser === "function") {
      return await store.updateUser(id, payload);
    }
    throw new Error("Supabase user update is not available.");
  }

  async function deleteUserSafe(id) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.deleteUser === "function") {
      await store.deleteUser(id);
      return;
    }
    throw new Error("Supabase users data is not available.");
  }

  async function render() {
    try {
      const [users, plans] = await Promise.all([getUsersSafe(), getPlansSafe()]);
      const plansById = {};
      (plans || []).forEach(function (p) {
        if (p && p.plan_id) plansById[String(p.plan_id).toLowerCase()] = p;
      });

      const query = String(searchInput && searchInput.value || "").trim().toLowerCase();
      const visibleUsers = (users || []).filter(function (user) {
        const normalizedRole = String(user && user.role || "").trim().toLowerCase();
        const normalizedName = String(user && user.name || "").trim().toLowerCase();
        const normalizedEmail = String(user && user.email || "").trim().toLowerCase();
        const normalizedStatus = String(user && user.status || "").trim().toLowerCase();

        const matchesSearch = !query || [normalizedName, normalizedEmail, normalizedRole, normalizedStatus].some(function (value) {
          return value.indexOf(query) !== -1;
        });

        return normalizedRole !== "admin" && matchesSearch;
      });

      if (!visibleUsers.length) {
        table.innerHTML = "<tr><td colspan='6' class='empty'>No users found.</td></tr>";
        return;
      }

      table.innerHTML = visibleUsers
        .map(function (user) {
          const planId = String(user && (user.active_plan_id || user.plan_id || "") || "").trim().toLowerCase();
          const plan = plansById[planId] || null;
          const planLabel = plan && plan.name ? escapeHtml(plan.name) : escapeHtml(formatPlan(user));
          const planCycle = plan && plan.duration_days ? (String(plan.duration_days) + " days") : formatPremiumCycle(user);
          const planPrice = plan && typeof plan.price === 'number' && !isNaN(plan.price) ? (" - " + (new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency || 'USD' }).format(plan.price))) : "";

          return (
            "<tr>" +
            "<td>" + escapeHtml(user.name || "") + "</td>" +
            "<td>" + escapeHtml(user.email || "") + "</td>" +
            "<td>" + planLabel + (plan ? ("<div class='muted small'>" + escapeHtml(planCycle) + escapeHtml(planPrice) + "</div>") : "") + "</td>" +
            "<td><span class='" + statusClass(user.status) + "'>" + escapeHtml(user.status || "") + "</span></td>" +
            "<td>" + escapeHtml(formatPremiumCycle(user)) + "</td>" +
            "<td>" +
              "<button class='btn btn-soft' data-action='remove-user' data-user-id='" + user.id + "'>Remove</button>" +
            "</td>" +
            "</tr>"
          );
        })
        .join("");

      const removeButtons = table.querySelectorAll("[data-action='remove-user']");
      removeButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          deleteUserSafe(button.dataset.userId).then(render);
        });
      });
    } catch (err) {
      console.error(err);
      table.innerHTML = "<tr><td colspan='6' class='empty'>Could not load users.</td></tr>";
    }
  }

  function clearSuggestions() {
    if (!emailSuggestions) {
      return;
    }
    emailSuggestions.hidden = true;
    emailSuggestions.innerHTML = "";
  }

  function setEmailFromSuggestion(email) {
    if (!upgradeEmail) {
      return;
    }
    upgradeEmail.value = email;
    clearSuggestions();
    loadSelectedUserByEmail(email).catch(function (err) {
      console.error(err);
    });
  }

  async function loadSelectedUserByEmail(email) {
    if (!email) return;
    const users = await getUsersSafe();
    const user = (users || []).find(function (u) { return String(u.email || "").trim().toLowerCase() === String(email || "").trim().toLowerCase(); });
    if (!user) return;
    renderSelectedUser(user);
  }

  async function renderSelectedUser(user) {
    const panel = document.getElementById("selectedUserPanel");
    if (!panel) return;
    panel.hidden = false;

    document.getElementById("su_name").textContent = user.name || "User";
    document.getElementById("su_email").textContent = user.email || "";
    document.getElementById("su_created").textContent = (window.AdminApp && typeof window.AdminApp.formatDate === 'function') ? window.AdminApp.formatDate(user.createdAt || user.created_at) : (user.createdAt || user.created_at || "-");
    document.getElementById("su_status").textContent = user.status || "-";
    document.getElementById("su_plan").textContent = formatPlan(user) || "Free";

    // fetch usage and purchases
    const [usage, purchases] = await Promise.all([getUserUsageSafe(user.id), getPurchasesSafe()]);

    document.getElementById("su_downloads_month").textContent = String((usage && usage.downloads_used_month) || 0);
    document.getElementById("su_ai_today").textContent = String((usage && usage.ai_generations_used_today) || 0);

    const userPurchases = (purchases || []).filter(function (p) { return String(p.userId || p.user_id || "").trim() === String(user.id).trim() || String(p.payer || "").toLowerCase() === String(user.email || "").toLowerCase(); });
    const totalSpent = userPurchases.reduce(function (sum, p) { return sum + (Number(p.amount || p.amount || 0) || 0); }, 0);
    document.getElementById("su_total_spent").textContent = (new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(totalSpent));

    const purchasesTbody = document.getElementById("su_purchases");
    purchasesTbody.innerHTML = (userPurchases || []).slice(0, 12).map(function (p) {
      return "<tr>" +
        "<td>" + escapeHtml(p.designName || p.design_name || p.designName || "Purchase") + "</td>" +
        "<td>" + escapeHtml(String(p.amount || p.amount || 0)) + "</td>" +
        "<td>" + (window.AdminApp && typeof window.AdminApp.formatDate === 'function' ? window.AdminApp.formatDate(p.createdAt || p.created_at) : (p.createdAt || p.created_at || "-")) + "</td>" +
        "</tr>";
    }).join("");
  }

  async function getPurchasesSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getPurchases === "function") {
      return await store.getPurchases();
    }
    return [];
  }

  async function getUserUsageSafe(userId) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getUserUsage === "function") {
      return await store.getUserUsage(userId);
    }
    return { downloads_used_month: 0, ai_generations_used_today: 0 };
  }

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  upgradeEmail.addEventListener("input", async function () {
    const query = String(upgradeEmail.value || "").trim().toLowerCase();
    const users = await getUsersSafe();
    showEmailSuggestions(users, query);
  });

  if (emailSuggestions) {
    emailSuggestions.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-email]");
      if (!button) {
        return;
      }
      setEmailFromSuggestion(button.dataset.email || "");
    });
  }

  // Populate plan select and cards from Supabase plans_master
  async function populatePlans() {
    const plans = await getPlansSafe();
    if (!plans || !plans.length) return;

    cachedPlans = plans;

    // populate select
    if (upgradePlan) {
      upgradePlan.innerHTML = "";
      plans.forEach(function (p) {
        const opt = document.createElement('option');
        opt.value = String(p.plan_id || p.id || p.name || p.plan_id);
        opt.textContent = String(p.name || p.plan_id || opt.value) + (p.price ? (" — " + (new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'INR' }).format(p.price))) : "");
        upgradePlan.appendChild(opt);
      });
    }

    // populate cards
    const cards = document.getElementById('planCards');
    if (cards) {
      cards.innerHTML = plans.map(function (p, idx) {
        const price = (typeof p.price === 'number' && !isNaN(p.price)) ? (new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'INR' }).format(p.price)) : '';
        const days = p.duration_days ? (String(p.duration_days) + " days") : '';
        const html = "<div class='plan-card' data-plan-id='" + escapeHtml(p.plan_id || p.id || p.name) + "' data-gradient='" + ((idx % 4) + 1) + "'>" +
          "<div><div class='plan-title'>" + escapeHtml(p.name || p.plan_id) + "</div>" +
          (price ? "<div class='plan-price'>" + escapeHtml(price) + "</div>" : "") +
          (days ? "<div class='plan-meta'>" + escapeHtml(days) + "</div>" : "") +
          "</div></div>";
        return html;
      }).join('');

      // attach click handlers
      cards.querySelectorAll('.plan-card').forEach(function (card) {
        card.addEventListener('click', function () {
          cards.querySelectorAll('.plan-card').forEach(function (c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          const planId = card.dataset.planId;
          if (upgradePlan) upgradePlan.value = planId;
          applyPlanSelection(planId);
        });
      });
      cards.setAttribute('aria-hidden','false');
    }

    // apply initial selection
    if (upgradePlan && upgradePlan.value) {
      applyPlanSelection(upgradePlan.value);
    } else if (plans[0]) {
      applyPlanSelection(plans[0].plan_id || plans[0].id || plans[0].name);
    }
  }

  function findPlanById(id) {
    if (!id) return null;
    const needle = String(id).trim().toLowerCase();
    return (cachedPlans || []).find(function (p) {
      return String(p.plan_id || p.id || p.name || "").trim().toLowerCase() === needle;
    }) || null;
  }

  function applyPlanSelection(planId) {
    const plan = findPlanById(planId);
    const priceNode = document.getElementById('upgradePrice');
    if (!plan) {
      if (priceNode) priceNode.textContent = 'Price: —';
      return;
    }

    // set price label
    const priceText = (typeof plan.price === 'number' && !isNaN(plan.price)) ? (new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency || 'INR' }).format(plan.price)) : 'Free';
    if (priceNode) priceNode.textContent = 'Price: ' + priceText;

    // update duration select with a meaningful option
    if (upgradeDuration) {
      const durationDays = Number(plan.duration_days || plan.duration || 0) || 0;
      upgradeDuration.innerHTML = '';
      if (durationDays > 0) {
        const opt = document.createElement('option');
        opt.value = String(durationDays);
        opt.textContent = formatDurationLabel(durationDays);
        upgradeDuration.appendChild(opt);
      } else {
        // fallback options
        const opts = [365, 180, 30];
        opts.forEach(function (d) {
          const o = document.createElement('option');
          o.value = String(d);
          o.textContent = formatDurationLabel(d);
          upgradeDuration.appendChild(o);
        });
      }
    }
  }

  populatePlans().catch(function (err) { console.error(err); });

  if (upgradePlan) {
    upgradePlan.addEventListener('change', function () {
      applyPlanSelection(upgradePlan.value);
    });
  }

  if (upgradeButton) {
    upgradeButton.addEventListener("click", async function () {
      const email = String(upgradeEmail.value || "").trim().toLowerCase();
      const selectedPlanId = String(upgradePlan.value || "").trim();
      const planObj = findPlanById(selectedPlanId);
      const duration = Number(upgradeDuration.value || (planObj && planObj.duration_days) || 365);

      if (!email) return;

      const users = await getUsersSafe();
      const user = users.find(function (item) {
        return String(item.email || "").trim().toLowerCase() === email;
      });

      if (!user) {
        alert("User not found. Please select an existing profile from suggestions.");
        return;
      }

      const expiry = duration > 0 ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString() : "";

      const payload = {};
      if (planObj) {
        payload.plan_name = planObj.name || String(planObj.plan_id || selectedPlanId);
        payload.active_plan_name = payload.plan_name;
        payload.plan_id = String(planObj.plan_id || selectedPlanId);
        payload.active_plan_id = payload.plan_id;
        const paid = typeof planObj.price === 'number' && !isNaN(planObj.price) && Number(planObj.price) > 0;
        payload.is_premium = paid;
        payload.premium_active = paid && !!expiry;
        payload.premium_expiry = expiry;
      } else {
        // fallback to raw value
        payload.plan_name = selectedPlanId || "Free";
        payload.active_plan_name = payload.plan_name;
        payload.plan_id = String(selectedPlanId || "free");
        payload.active_plan_id = payload.plan_id;
        payload.is_premium = payload.plan_id.toLowerCase() !== "free";
        payload.premium_active = payload.is_premium && !!expiry;
        payload.premium_expiry = expiry;
      }

      await updateUserSafe(user.id, payload);

      upgradeForm.reset();
      clearSuggestions();
      render();
    });
  }

  render();
});
