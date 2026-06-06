document.addEventListener("DOMContentLoaded", async function () {
  if (document.body.dataset.page !== "dashboard") {
    return;
  }

  function getActiveSession() {
    return window.AdminApp && typeof window.AdminApp.getSession === "function"
      ? window.AdminApp.getSession()
      : null;
  }

  function getDisplayName(session) {
    if (window.AdminApp && typeof window.AdminApp.getDisplayName === "function") {
      return window.AdminApp.getDisplayName(session);
    }

    return String(session && (session.name || session.username || session.email) || "Admin").trim();
  }

  function setStatus(node, type, message) {
    if (!node) {
      return;
    }

    if (!message) {
      node.textContent = "";
      node.style.display = "none";
      node.className = "status-pill";
      return;
    }

    node.textContent = message;
    node.style.display = "inline-flex";
    node.className = "status-pill " + (
      type === "success" ? "status-success" :
      type === "danger" ? "status-danger" :
      "status-warning"
    );
  }

  function setButtonLoading(button, isLoading, idleText, loadingText) {
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : idleText;
  }

  function formatRoleLabel(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "admin") {
      return "Admin";
    }
    if (value === "moderator") {
      return "Moderator";
    }
    return "User";
  }

  function syncAdminIdentity(session) {
    const activeSession = session || getActiveSession();
    const displayName = getDisplayName(activeSession);
    const email = String(activeSession && activeSession.email || "-").trim();
    const role = String(activeSession && activeSession.role || "admin").trim();

    const nameNodes = [
      document.getElementById("adminName"),
      document.getElementById("adminDisplayName")
    ];

    nameNodes.forEach(function (node) {
      if (node) {
        node.textContent = displayName;
      }
    });

    const emailNode = document.getElementById("adminEmail");
    if (emailNode) {
      emailNode.textContent = email;
    }

    const roleNode = document.getElementById("adminRoleLabel");
    if (roleNode) {
      roleNode.textContent = formatRoleLabel(role);
    }

    const nameInput = document.getElementById("adminProfileName");
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = activeSession && activeSession.name ? activeSession.name : displayName;
    }
  }

  async function updateProfileSafe(payload) {
    const store = window.AdminData || { connected: false };

    if (store.connected && typeof store.updateCurrentAdminProfile === "function") {
      return await store.updateCurrentAdminProfile(payload);
    }

    throw new Error("Supabase profile update is not available right now.");
  }

  async function updatePasswordSafe(payload) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.updateCurrentAdminPassword === "function") {
      return await store.updateCurrentAdminPassword(payload);
    }

    throw new Error("Password change requires an active Supabase connection.");
  }

  function bindPasswordVisibilityToggles() {
    const toggleButtons = document.querySelectorAll("[data-password-toggle]");
    if (!toggleButtons.length) {
      return;
    }

    toggleButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const inputId = button.getAttribute("data-password-toggle");
        const input = inputId ? document.getElementById(inputId) : null;
        if (!input) {
          return;
        }

        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute("aria-pressed", shouldShow ? "true" : "false");
        button.setAttribute(
          "aria-label",
          (shouldShow ? "Hide " : "Show ") + inputId.replace(/([A-Z])/g, " $1").toLowerCase()
        );
      });
    });
  }

  function resetPasswordVisibility() {
    const toggleButtons = document.querySelectorAll("[data-password-toggle]");
    toggleButtons.forEach(function (button) {
      const inputId = button.getAttribute("data-password-toggle");
      const input = inputId ? document.getElementById(inputId) : null;
      if (!input) {
        return;
      }

      input.type = "password";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Show " + inputId.replace(/([A-Z])/g, " $1").toLowerCase());
    });
  }

  function bindProfileForms() {
    const profileForm = document.getElementById("profileForm");
    const passwordForm = document.getElementById("passwordForm");
    const profileStatus = document.getElementById("profileStatus");
    const passwordStatus = document.getElementById("passwordStatus");

    if (profileForm) {
      profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = profileForm.querySelector("button[type='submit']");
        const nextName = String(profileForm.adminProfileName.value || "").trim();

        if (!nextName) {
          setStatus(profileStatus, "danger", "Please enter a valid admin name.");
          return;
        }

        setStatus(profileStatus, "warning", "Saving profile...");
        setButtonLoading(submitButton, true, "Save Name", "Saving...");

        try {
          const updated = await updateProfileSafe({ name: nextName });
          if (window.AdminApp && typeof window.AdminApp.updateSession === "function") {
            window.AdminApp.updateSession({
              name: updated && updated.name ? updated.name : nextName
            });
          }
          syncAdminIdentity();
          setStatus(profileStatus, "success", "Admin name updated successfully.");
        } catch (error) {
          setStatus(profileStatus, "danger", error && error.message ? error.message : "Could not update admin name.");
        } finally {
          setButtonLoading(submitButton, false, "Save Name", "Saving...");
        }
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = passwordForm.querySelector("button[type='submit']");
        const nextPassword = String(passwordForm.newPassword.value || "");
        const confirmPassword = String(passwordForm.confirmPassword.value || "");

        if (nextPassword.length < 8) {
          setStatus(passwordStatus, "danger", "Password must be at least 8 characters long.");
          return;
        }

        if (nextPassword !== confirmPassword) {
          setStatus(passwordStatus, "danger", "Confirm password does not match.");
          return;
        }

        setStatus(passwordStatus, "warning", "Updating password...");
        setButtonLoading(submitButton, true, "Update Password", "Updating...");

        try {
          await updatePasswordSafe({ password: nextPassword });
          passwordForm.reset();
          resetPasswordVisibility();
          setStatus(passwordStatus, "success", "Password updated successfully.");
        } catch (error) {
          setStatus(passwordStatus, "danger", error && error.message ? error.message : "Could not update password.");
        } finally {
          setButtonLoading(submitButton, false, "Update Password", "Updating...");
        }
      });
    }
  }

  async function getDesignsSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getDesigns === "function") {
      return await store.getDesigns();
    }
    throw new Error("Supabase design data is not available.");
  }

  async function getPaymentsSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getPayments === "function") {
      return await store.getPayments();
    }
    throw new Error("Supabase payment data is not available.");
  }

  async function getPurchasesSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getPurchases === "function") {
      return await store.getPurchases();
    }
    return [];
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function aggregatePerformance(designs, purchases) {
    const designMap = {};

    designs.forEach(function (design) {
      designMap[design.id] = {
        id: design.id,
        name: design.name || "Untitled Design",
        downloads: 0,
        baseDownloads: Number(design.downloadCount || 0),
        revenue: 0
      };
    });

    purchases.forEach(function (purchase) {
      const designId = purchase.designId || "manual_" + (purchase.designName || "Manual");
      if (!designMap[designId]) {
        designMap[designId] = {
          id: designId,
          name: purchase.designName || "Manual Entry",
          downloads: 0,
          revenue: 0
        };
      }

      designMap[designId].downloads += 1;
      designMap[designId].revenue += Number(purchase.amount || 0);
    });

    return Object.values(designMap)
      .map(function (item) {
        return {
          id: item.id,
          name: item.name,
          downloads: item.downloads || item.baseDownloads || 0,
          revenue: item.revenue
        };
      })
      .sort(function (a, b) {
      return b.downloads - a.downloads || b.revenue - a.revenue;
      });
  }

  function renderStats(designs, users, purchases, performance) {
    const purchaseRecords = Array.isArray(purchases) ? purchases : [];
    const adminUsers = users.filter(function (item) {
      return String(item && item.role || "").trim().toLowerCase() === "admin";
    });
    const revenue = purchaseRecords.reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const totalDownloads = performance.reduce(function (sum, item) {
      return sum + Number(item.downloads || 0);
    }, 0);

    const stats = [
      { title: "Total Designs", value: designs.length, hint: "All uploaded assets" },
      { title: "Admin Users", value: adminUsers.length, hint: "Profiles with admin role" },
      { title: "Purchase Records", value: purchaseRecords.length, hint: "Live Supabase orders" },
      { title: "Revenue", value: window.AdminApp.formatCurrency(revenue), hint: "Completed purchases" },
      { title: "Total Downloads", value: totalDownloads, hint: "Design download count" }
    ];

    const statsRow = document.getElementById("statsRow");
    statsRow.innerHTML = stats
      .map(function (stat) {
        return (
          "<article class='panel stat-card'>" +
          "<h3>" + stat.title + "</h3>" +
          "<p>" + stat.value + "</p>" +
          "<small>" + stat.hint + "</small>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderRecentUploads(designs, performance) {
    const downloadsById = {};
    performance.forEach(function (item) {
      downloadsById[item.id] = item.downloads;
    });

    const recentRows = document.getElementById("recentUploads");
    const recent = designs.slice(0, 5);
    if (recent.length === 0) {
      recentRows.innerHTML = "<tr><td colspan='5' class='empty'>No designs uploaded yet.</td></tr>";
      return;
    }

    recentRows.innerHTML = recent
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + escapeHtml(item.name) + "</td>" +
          "<td>" + escapeHtml(item.category) + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.price) + "</td>" +
          "<td>" + Number(downloadsById[item.id] || item.downloadCount || 0) + "</td>" +
          "<td>" + window.AdminApp.formatDate(item.createdAt) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderBarChart(containerId, items, key, formatter, emptyText) {
    const container = document.getElementById(containerId);
    const filtered = items
      .filter(function (item) {
        return Number(item[key] || 0) > 0;
      })
      .slice(0, 5);

    if (filtered.length === 0) {
      container.innerHTML = "<p class='empty'>" + emptyText + "</p>";
      return;
    }

    const maxValue = Math.max.apply(
      null,
      filtered.map(function (item) {
        return Number(item[key] || 0);
      })
    );

    container.innerHTML =
      "<div class='chart-bars'>" +
      filtered
        .map(function (item) {
          const value = Number(item[key] || 0);
          const height = maxValue > 0 ? Math.max(16, Math.round((value / maxValue) * 160)) : 16;
          return (
            "<div class='chart-column'>" +
            "<span class='chart-value'>" + formatter(value) + "</span>" +
            "<div class='chart-bar-wrap'><div class='chart-bar' style='height:" + height + "px'></div></div>" +
            "<span class='chart-label'>" + escapeHtml(item.name) + "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderTopPerformance(performance) {
    const target = document.getElementById("topPerformance");
    const topItems = performance.slice(0, 6);

    if (topItems.length === 0) {
      target.innerHTML = "<tr><td colspan='3' class='empty'>No design performance data yet.</td></tr>";
      return;
    }

    target.innerHTML = topItems
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + escapeHtml(item.name) + "</td>" +
          "<td>" + Number(item.downloads || 0) + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.revenue || 0) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderPaymentSnapshot(purchases, payments) {
    const purchaseRecords = Array.isArray(purchases) ? purchases : [];
    const manualPayments = Array.isArray(payments) ? payments : [];
    const paidRevenue = purchaseRecords.reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const paidDownloads = purchaseRecords.length;

    document.getElementById("paymentSnapshot").innerHTML = [
      { label: "Purchase Records", value: purchaseRecords.length },
      { label: "Manual Payments", value: manualPayments.length },
      { label: "Sold Amount", value: window.AdminApp.formatCurrency(paidRevenue) },
      { label: "Purchased Designs", value: paidDownloads }
    ]
      .map(function (item) {
        return (
          "<div class='metric-item'>" +
          "<span>" + item.label + "</span>" +
          "<strong>" + item.value + "</strong>" +
          "</div>"
        );
      })
      .join("");
  }

  let designs = [];
  let users = [];
  let payments = [];
  let purchases = [];

  try {
    designs = await getDesignsSafe();
    users = window.AdminData && typeof window.AdminData.getUsers === "function"
      ? await window.AdminData.getUsers()
      : [];
    payments = await getPaymentsSafe();
    purchases = await getPurchasesSafe();
  } catch (error) {
    console.error("[Admin Dashboard]", error);
  }

  const performance = aggregatePerformance(designs, purchases);

  renderStats(designs, users, purchases, performance);
  renderRecentUploads(designs, performance);
  renderBarChart(
    "salesChart",
    performance.slice().sort(function (a, b) {
      return b.revenue - a.revenue;
    }),
    "revenue",
    function (value) {
      return window.AdminApp.formatCurrency(value);
    },
    "No paid sales data available yet."
  );
  renderBarChart(
    "downloadsChart",
    performance,
    "downloads",
    function (value) {
      return String(value);
    },
    "No downloads recorded yet."
  );
  renderTopPerformance(performance);
  renderPaymentSnapshot(purchases, payments);

  bindPasswordVisibilityToggles();
  bindProfileForms();
  syncAdminIdentity();
  window.addEventListener("ajartivo:session-updated", function (event) {
    syncAdminIdentity(event.detail);
  });
});
