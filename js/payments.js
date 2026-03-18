document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page !== "payments") {
    return;
  }

  const form = document.getElementById("paymentForm");
  const table = document.getElementById("paymentsTable");
  const revenueBadge = document.getElementById("revenueBadge");

  function statusClass(status) {
    if (status === "Paid") {
      return "status-pill status-success";
    }
    if (status === "Pending") {
      return "status-pill status-warning";
    }
    return "status-pill status-danger";
  }

  function render() {
    const payments = window.DataStore.getPayments();
    if (payments.length === 0) {
      table.innerHTML = "<tr><td colspan='5' class='empty'>No payments available.</td></tr>";
      revenueBadge.textContent = "Revenue: INR 0";
      return;
    }

    table.innerHTML = payments
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + item.payer + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.amount) + "</td>" +
          "<td>" + item.method + "</td>" +
          "<td><span class='" + statusClass(item.status) + "'>" + item.status + "</span></td>" +
          "<td>" + window.AdminApp.formatDate(item.createdAt) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    const revenue = payments
      .filter(function (item) {
        return item.status === "Paid";
      })
      .reduce(function (sum, item) {
        return sum + Number(item.amount || 0);
      }, 0);
    revenueBadge.textContent = "Revenue: " + window.AdminApp.formatCurrency(revenue);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    window.DataStore.addPayment({
      payer: form.payer.value.trim(),
      amount: Number(form.amount.value || 0),
      method: form.method.value,
      status: form.paymentStatus.value
    });
    form.reset();
    render();
  });

  render();
});
