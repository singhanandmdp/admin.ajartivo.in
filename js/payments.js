document.addEventListener("DOMContentLoaded", async function () {
  if (document.body.dataset.page !== "payments") {
    return;
  }

  const form = document.getElementById("paymentForm");
  const table = document.getElementById("paymentsTable");
  const purchasesTable = document.getElementById("purchasesTable");
  const revenueBadge = document.getElementById("revenueBadge");
  const designSelect = document.getElementById("designId");
  const quantityInput = document.getElementById("quantity");
  const amountInput = document.getElementById("amount");

  async function getDesignsSafe() {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.getDesigns === "function") {
      return await store.getDesigns();
    }
    throw new Error("Supabase designs data is not available.");
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

  async function addPaymentSafe(payload) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.addPayment === "function") {
      await store.addPayment(payload);
      return;
    }
    throw new Error("Supabase payment data is not available.");
  }

  async function incrementDesignDownloadsSafe(id, quantity) {
    const store = window.AdminData || { connected: false };
    if (store.connected && typeof store.incrementDesignDownloads === "function") {
      await store.incrementDesignDownloads(id, quantity);
      return;
    }

    throw new Error("Supabase download tracking is not available.");
  }

  function statusClass(status) {
    if (status === "Paid") {
      return "status-pill status-success";
    }
    if (status === "Pending") {
      return "status-pill status-warning";
    }
    return "status-pill status-danger";
  }

  function getSelectedDesign(designs) {
    return (
      designs.find(function (item) {
        return item.id === designSelect.value;
      }) || null
    );
  }

  function updateAmount(designs) {
    const selectedDesign = getSelectedDesign(designs);
    const quantity = Math.max(1, Number(quantityInput.value || 1));
    const unitPrice = Number(selectedDesign && selectedDesign.price ? selectedDesign.price : 0);
    amountInput.value = String(unitPrice * quantity);
  }

  function populateDesigns(designs) {
    if (designs.length === 0) {
      designSelect.innerHTML = "<option value=''>No designs available</option>";
      form.querySelector("button[type='submit']").disabled = true;
      return;
    }

    designSelect.innerHTML =
      "<option value=''>Select design</option>" +
      designs
        .map(function (item) {
          const label = item.name + " (" + window.AdminApp.formatCurrency(item.price || 0) + ")";
          return "<option value='" + item.id + "'>" + label + "</option>";
        })
        .join("");

    form.querySelector("button[type='submit']").disabled = false;
  }

  function render(payments) {
    if (payments.length === 0) {
      table.innerHTML = "<tr><td colspan='7' class='empty'>No payments available.</td></tr>";
      revenueBadge.textContent = "Revenue: INR 0 | Paid Orders: 0";
      return;
    }

    table.innerHTML = payments
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + (item.designName || "Manual") + "</td>" +
          "<td>" + item.payer + "</td>" +
          "<td>" + Number(item.quantity || 1) + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.amount) + "</td>" +
          "<td>" + item.method + "</td>" +
          "<td><span class='" + statusClass(item.status) + "'>" + item.status + "</span></td>" +
          "<td>" + window.AdminApp.formatDate(item.createdAt) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    const paidPayments = payments.filter(function (item) {
      return item.status === "Paid";
    });
    const revenue = paidPayments.reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    revenueBadge.textContent =
      "Revenue: " +
      window.AdminApp.formatCurrency(revenue) +
      " | Paid Orders: " +
      paidPayments.length;
  }

  function renderPurchases(purchases, designs) {
    if (!purchasesTable) {
      return;
    }

    const designMap = {};
    (Array.isArray(designs) ? designs : []).forEach(function (design) {
      designMap[String(design && design.id || "").trim()] = design && design.name ? design.name : "Design";
    });

    if (!Array.isArray(purchases) || purchases.length === 0) {
      purchasesTable.innerHTML = "<tr><td colspan='5' class='empty'>No live purchase records available.</td></tr>";
      return;
    }

    purchasesTable.innerHTML = purchases
      .map(function (item) {
        const designLabel = designMap[String(item.designId || "").trim()] || item.designName || item.designId || "Design";
        return (
          "<tr>" +
          "<td>" + designLabel + "</td>" +
          "<td>" + (item.userId || "-") + "</td>" +
          "<td>" + (item.paymentId || "-") + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.amount || 0) + "</td>" +
          "<td>" + window.AdminApp.formatDate(item.createdAt) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  let designs = [];
  let payments = [];
  let purchases = [];

  try {
    designs = await getDesignsSafe();
    payments = await getPaymentsSafe();
    purchases = await getPurchasesSafe();
  } catch (error) {
    console.error("[Admin Payments]", error);
  }

  populateDesigns(designs);
  render(payments);
  renderPurchases(purchases, designs);
  updateAmount(designs);

  designSelect.addEventListener("change", function () {
    updateAmount(designs);
  });

  quantityInput.addEventListener("input", function () {
    if (Number(quantityInput.value || 0) < 1) {
      quantityInput.value = "1";
    }
    updateAmount(designs);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const selectedDesign = getSelectedDesign(designs);
    if (!selectedDesign) {
      return;
    }

    const quantity = Math.max(1, Number(quantityInput.value || 1));
    const amount = Number(amountInput.value || 0);
    const status = form.paymentStatus.value;

    const payload = {
      payer: form.payer.value.trim(),
      designId: selectedDesign.id,
      designName: selectedDesign.name,
      quantity: quantity,
      amount: amount,
      method: form.method.value,
      status: status
    };

    await addPaymentSafe(payload);

    if (status === "Paid") {
      await incrementDesignDownloadsSafe(selectedDesign.id, quantity);
    }

    form.reset();
    quantityInput.value = "1";
    amountInput.value = "";
    updateAmount(designs);
    payments = await getPaymentsSafe();
    render(payments);
    purchases = await getPurchasesSafe();
    renderPurchases(purchases, designs);
  });
});
