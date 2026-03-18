(function () {
  const PROFILE_KEY = "ajartivo_admin_profile";

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null;
    } catch (error) {
      return null;
    }
  }

  function bindLogout() {
    const buttons = document.querySelectorAll("[data-action='logout']");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (window.AjartivoAuth && typeof window.AjartivoAuth.logout === "function") {
          window.AjartivoAuth.logout();
          return;
        }
        window.location.href = "index.html";
      });
    });
  }

  function setActiveMenu() {
    const page = document.body.dataset.page;
    const links = document.querySelectorAll("[data-nav]");
    links.forEach(function (link) {
      if (link.dataset.nav === page) {
        link.classList.add("active");
      }
    });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function updateYear() {
    const yearNodes = document.querySelectorAll("[data-year]");
    yearNodes.forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  window.AdminApp = {
    bindLogout: bindLogout,
    setActiveMenu: setActiveMenu,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    getSession: getSession
  };

  document.addEventListener("DOMContentLoaded", function () {
    setActiveMenu();
    bindLogout();
    updateYear();
  });
})();
