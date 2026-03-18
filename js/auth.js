import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth, ADMIN_EMAIL } from "./firebase-config.js";

const PROFILE_KEY = "ajartivo_admin_profile";
const NOTICE_KEY = "ajartivo_auth_notice";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function setProfile(user) {
  const email = normalizeEmail(user && user.email);
  if (!email) {
    localStorage.removeItem(PROFILE_KEY);
    return;
  }

  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      username: email,
      email: email,
      isLoggedIn: true,
      loggedInAt: new Date().toISOString()
    })
  );
}

function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function setNotice(message) {
  if (message) {
    sessionStorage.setItem(NOTICE_KEY, message);
  }
}

function consumeNotice() {
  const message = sessionStorage.getItem(NOTICE_KEY);
  if (message) {
    sessionStorage.removeItem(NOTICE_KEY);
  }
  return message || "";
}

function isAllowedAdmin(user) {
  return normalizeEmail(user && user.email) === normalizeEmail(ADMIN_EMAIL);
}

function mapAuthError(error) {
  const code = (error && error.code) || "";

  if (code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }
  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Try again after some time.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }

  return "Login failed. Please try again.";
}

async function logout() {
  clearProfile();
  try {
    await signOut(auth);
  } finally {
    window.location.href = "index.html";
  }
}

function bindLogoutButtons() {
  const buttons = document.querySelectorAll("[data-action='logout']");
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      logout();
    });
  });
}

function updateLoginMessage(node, message) {
  if (!node) {
    return;
  }

  if (message) {
    node.textContent = message;
    node.style.display = "block";
    return;
  }

  node.textContent = "";
  node.style.display = "none";
}

function setLoadingState(button, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? "Logging in..." : "Login to Dashboard";
}

function bindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) {
    return;
  }

  const errorBox = document.getElementById("loginError");
  const card = document.getElementById("loginCard");
  const submitButton = form.querySelector("button[type='submit']");

  const initialNotice = consumeNotice();
  if (initialNotice) {
    updateLoginMessage(errorBox, initialNotice);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    updateLoginMessage(errorBox, "");

    const email = normalizeEmail(form.email.value);
    const password = String(form.password.value || "");

    setLoadingState(submitButton, true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      if (!isAllowedAdmin(credential.user)) {
        await signOut(auth);
        clearProfile();
        updateLoginMessage(errorBox, "Access denied: this account is not authorized for admin panel.");
        card.classList.remove("is-error");
        void card.offsetWidth;
        card.classList.add("is-error");
        return;
      }

      setProfile(credential.user);
      window.location.href = "dashboard.html";
    } catch (error) {
      clearProfile();
      updateLoginMessage(errorBox, mapAuthError(error));
      card.classList.remove("is-error");
      void card.offsetWidth;
      card.classList.add("is-error");
    } finally {
      setLoadingState(submitButton, false);
    }
  });
}

function handleLoginPageAuthState() {
  if (document.body.dataset.page !== "login") {
    return;
  }

  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      clearProfile();
      return;
    }

    if (!isAllowedAdmin(user)) {
      await signOut(auth);
      clearProfile();
      setNotice("Access denied: only authorized admin email can login.");
      return;
    }

    setProfile(user);
    window.location.href = "dashboard.html";
  });
}

window.AjartivoAuth = {
  logout: logout
};

document.addEventListener("DOMContentLoaded", function () {
  bindLogoutButtons();
  bindLoginForm();
  handleLoginPageAuthState();
});
