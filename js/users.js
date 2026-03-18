document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page !== "users") {
    return;
  }

  const form = document.getElementById("userForm");
  const table = document.getElementById("usersTable");

  function statusClass(status) {
    if (status === "Active") {
      return "status-pill status-success";
    }
    if (status === "Pending") {
      return "status-pill status-warning";
    }
    return "status-pill status-danger";
  }

  function render() {
    const users = window.DataStore.getUsers();
    if (users.length === 0) {
      table.innerHTML = "<tr><td colspan='5' class='empty'>No users found.</td></tr>";
      return;
    }

    table.innerHTML = users
      .map(function (user) {
        return (
          "<tr>" +
          "<td>" + user.name + "</td>" +
          "<td>" + user.email + "</td>" +
          "<td>" + user.role + "</td>" +
          "<td><span class='" + statusClass(user.status) + "'>" + user.status + "</span></td>" +
          "<td><button class='btn btn-soft' data-user-id='" + user.id + "'>Remove</button></td>" +
          "</tr>"
        );
      })
      .join("");

    const removeButtons = table.querySelectorAll("[data-user-id]");
    removeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        window.DataStore.deleteUser(button.dataset.userId);
        render();
      });
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    window.DataStore.addUser({
      name: form.userName.value.trim(),
      email: form.userEmail.value.trim(),
      role: form.userRole.value,
      status: form.userStatus.value
    });
    form.reset();
    render();
  });

  render();
});
