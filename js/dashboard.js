document.addEventListener("DOMContentLoaded", async function () {
  if (document.body.dataset.page !== "dashboard") {
    return;
  }

  async function getDesignsSafe() {
    const fb = window.AjartivoFirebase || { connected: false };
    if (fb.connected) {
      try {
        return await fb.getDesigns();
      } catch (error) {
        return window.DataStore.getDesigns();
      }
    }
    return window.DataStore.getDesigns();
  }

  const designs = await getDesignsSafe();
  const users = window.DataStore.getUsers();
  const payments = window.DataStore.getPayments();

  const revenue = payments
    .filter(function (item) {
      return item.status === "Paid";
    })
    .reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);

  const stats = [
    { title: "Total Designs", value: designs.length, hint: "All uploaded assets" },
    { title: "Admin Users", value: users.length, hint: "Access panel users" },
    {
      title: "Revenue",
      value: window.AdminApp.formatCurrency(revenue),
      hint: "Paid payments"
    },
    {
      title: "Pending Payments",
      value: payments.filter(function (p) {
        return p.status === "Pending";
      }).length,
      hint: "Need follow-up"
    }
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

  const recentRows = document.getElementById("recentUploads");
  const recent = designs.slice(0, 5);
  if (recent.length === 0) {
    recentRows.innerHTML = "<tr><td colspan='4' class='empty'>No designs uploaded yet.</td></tr>";
  } else {
    recentRows.innerHTML = recent
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + item.name + "</td>" +
          "<td>" + item.category + "</td>" +
          "<td>" + window.AdminApp.formatCurrency(item.price) + "</td>" +
          "<td>" + window.AdminApp.formatDate(item.createdAt) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  const session = window.AdminApp.getSession();
  if (session) {
    document.getElementById("adminName").textContent = session.username;
  }
});
