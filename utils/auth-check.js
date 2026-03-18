import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth, ADMIN_EMAIL } from "../js/firebase-config.js";

const PROFILE_KEY = "ajartivo_admin_profile";
const NOTICE_KEY = "ajartivo_auth_notice";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function setProfile(user) {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      username: normalizeEmail(user.email),
      email: normalizeEmail(user.email),
      isLoggedIn: true,
      loggedInAt: new Date().toISOString()
    })
  );
}

function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function denyAndRedirect() {
  sessionStorage.setItem(NOTICE_KEY, "Access Denied: unauthorized account.");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page === "login") {
    return;
  }

  onAuthStateChanged(auth, async function (user) {
    if (!user) {
      clearProfile();
      window.location.href = "index.html";
      return;
    }

    if (normalizeEmail(user.email) !== normalizeEmail(ADMIN_EMAIL)) {
      clearProfile();
      await signOut(auth);
      denyAndRedirect();
      return;
    }

    setProfile(user);
  });
});
