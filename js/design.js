document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page !== "design") {
    return;
  }

  const searchInput = document.getElementById("searchQuery");
  const accessFilter = document.getElementById("accessFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const sortFilter = document.getElementById("sortFilter");
  const clearFiltersButton = document.getElementById("clearFiltersButton");
  const tableViewButton = document.getElementById("tableViewButton");
  const gridViewButton = document.getElementById("gridViewButton");
  const designCount = document.getElementById("designCount");
  const designTableBody = document.getElementById("designTableBody");
  const designGridBody = document.getElementById("designGridBody");
  const designTableSection = document.getElementById("designTableSection");
  const editPanel = document.getElementById("editPanel");
  const recordStatus = document.getElementById("recordStatus");
  const editForm = document.getElementById("designEditForm");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const editTitle = document.getElementById("editTitle");
  const editPrice = document.getElementById("editPrice");
  const editCategory = document.getElementById("editCategory");
  const editPremium = document.getElementById("editPremium");
  const editFileUrl = document.getElementById("editFileUrl");
  const editImageUrl = document.getElementById("editImageUrl");
  const editPreviewFile = document.getElementById("editPreviewFile");
  const editPreviewFileMeta = document.getElementById("editPreviewFileMeta");
  const editDescription = document.getElementById("editDescription");
  const editTags = document.getElementById("editTags");

  let designs = [];
  let activeDesign = null;
  let activeView = "table";
  let uploadedPreviewUrl = "";

  function getAdminStore() {
    return window.AdminData || { connected: false };
  }

  async function getDesignsSafe() {
    const store = getAdminStore();
    if (store.connected && typeof store.getDesigns === "function") {
      return await store.getDesigns();
    }
    throw new Error("Supabase designs data is not available.");
  }

  async function updateDesignSafe(id, payload) {
    const store = getAdminStore();
    if (store.connected && typeof store.updateDesign === "function") {
      return await store.updateDesign(id, payload);
    }
    throw new Error("Supabase design update is not available.");
  }

  function setStatus(message, type) {
    if (!recordStatus) {
      return;
    }

    recordStatus.textContent = message;
    recordStatus.hidden = !message;
    recordStatus.className = "status-pill";

    if (type === "success") {
      recordStatus.classList.add("status-success");
    } else if (type === "warning") {
      recordStatus.classList.add("status-warning");
    } else if (type === "danger") {
      recordStatus.classList.add("status-danger");
    }
  }

  function parseTags(value) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function formatCurrency(value) {
    return window.AdminApp && typeof window.AdminApp.formatCurrency === "function"
      ? window.AdminApp.formatCurrency(value)
      : "INR " + Number(value || 0);
  }

  function formatDate(value) {
    return window.AdminApp && typeof window.AdminApp.formatDate === "function"
      ? window.AdminApp.formatDate(value)
      : String(value || "");
  }

  function formatAccess(design) {
    return design.is_premium ? "Premium" : "Free";
  }

  function matchesFilter(design) {
    const searchQuery = normalizeText(searchInput.value).toLowerCase();
    const accessValue = normalizeText(accessFilter.value).toLowerCase();
    const categoryValue = normalizeText(categoryFilter.value).toLowerCase();

    if (searchQuery) {
      const haystack = [
        design.title,
        design.name,
        design.category,
        design.description,
        (design.tags || []).join(", ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchQuery)) {
        return false;
      }
    }

    if (accessValue === "free" && design.is_premium) {
      return false;
    }

    if (accessValue === "premium" && !design.is_premium) {
      return false;
    }

    if (categoryValue && categoryValue !== "all" && normalizeText(design.category).toLowerCase() !== categoryValue) {
      return false;
    }

    return true;
  }

  function sortDesigns(list) {
    const sortBy = normalizeText(sortFilter.value);
    return list.slice().sort(function (a, b) {
      if (sortBy === "priceAsc") {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortBy === "priceDesc") {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      if (sortBy === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }
      return new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime();
    });
  }

  function renderCategoryOptions() {
    const categories = designs
      .map(function (item) {
        return normalizeText(item.category).toUpperCase();
      })
      .filter(Boolean)
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      })
      .sort();

    categoryFilter.innerHTML = "<option value='all'>All categories</option>" +
      categories
        .map(function (category) {
          return "<option value='" + category.toLowerCase() + "'>" + category + "</option>";
        })
        .join("");
  }

  function renderDesigns() {
    const visibleDesigns = sortDesigns(designs.filter(matchesFilter));
    designCount.textContent = visibleDesigns.length + " designs found";

    if (visibleDesigns.length === 0) {
      designTableBody.innerHTML = "<tr><td colspan='7' class='empty'>No designs match the selected filters.</td></tr>";
      designGridBody.innerHTML = "<div class='empty'>No designs match the selected filters.</div>";
      return;
    }

    renderTableView(visibleDesigns);
    renderGridView(visibleDesigns);
  }

  function renderTableView(visibleDesigns) {
    designTableBody.innerHTML = visibleDesigns
      .map(function (design) {
        return (
          "<tr>" +
          "<td>" + escapeHtml(design.title || design.name || "Untitled") + "</td>" +
          "<td>" + escapeHtml(design.category || "Other") + "</td>" +
          "<td>" + escapeHtml(formatCurrency(design.price || 0)) + "</td>" +
          "<td>" + escapeHtml(formatAccess(design)) + "</td>" +
          "<td>" + escapeHtml(String(design.downloads || design.downloadCount || 0)) + "</td>" +
          "<td>" + escapeHtml(formatDate(design.createdAt || design.created_at)) + "</td>" +
          "<td><button class='btn btn-soft' type='button' data-action='edit' data-design-id='" + escapeHtml(design.id) + "'>Edit</button></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderGridView(visibleDesigns) {
    designGridBody.innerHTML = visibleDesigns
      .map(function (design) {
        const imageUrl = normalizeText(design.image_url || design.image || "");
        const imageContent = imageUrl
          ? "<img src='" + escapeHtml(imageUrl) + "' alt='" + escapeHtml(design.title || design.name || "Design preview") + "'>"
          : "<div class='placeholder'><span>No preview</span></div>";

        return (
          "<article class='design-card'>" +
          "<div class='card-image'>" + imageContent + "</div>" +
          "<div class='content'>" +
          "<strong>" + escapeHtml(design.title || design.name || "Untitled") + "</strong>" +
          "<span>" + escapeHtml(design.category || "Other") + "</span>" +
          "<span>" + escapeHtml(formatCurrency(design.price || 0)) + "</span>" +
          "<span>" + escapeHtml(formatAccess(design)) + "</span>" +
          "<span>Downloads: " + escapeHtml(String(design.downloads || design.downloadCount || 0)) + "</span>" +
          "<button class='btn btn-soft' type='button' data-action='edit' data-design-id='" + escapeHtml(design.id) + "'>Edit</button>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function attachEditButtons() {
    const buttons = designTableSection.querySelectorAll("[data-action='edit']");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        const designId = button.dataset.designId;
        const design = designs.find(function (item) {
          return String(item.id) === String(designId);
        });
        if (design) {
          openEditor(design);
        }
      });
    });
  }

  function openEditor(design) {
    activeDesign = design;
    editPanel.hidden = false;
    uploadedPreviewUrl = "";
    setStatus("Editing " + (design.title || design.name || "design"), "warning");

    editTitle.value = design.title || design.name || "";
    editPrice.value = String(Number(design.price || 0));
    editCategory.value = normalizeText(design.category).toUpperCase();
    editPremium.checked = Boolean(design.is_premium === true || design.is_premium === "true");
    editFileUrl.value = normalizeText(design.file_url || design.download_link || design.downloadUrl || design.download || "");
    editImageUrl.value = normalizeText(design.image_url || design.image || "");
    editDescription.value = normalizeText(design.description || "");
    editTags.value = Array.isArray(design.tags) ? design.tags.join(", ") : normalizeText(design.tags || "");
    editPreviewFile.value = "";
    editPreviewFileMeta.textContent = "No file selected. Allowed: PNG, JPG, JPEG, WEBP (max 10MB)";
    editPanel.querySelector("#editRecordBadge").textContent = "ID: " + (design.id || "-");
  }

  function closeEditor() {
    activeDesign = null;
    uploadedPreviewUrl = "";
    editPanel.hidden = true;
    editForm.reset();
    editPreviewFile.value = "";
    editPreviewFileMeta.textContent = "No file selected. Allowed: PNG, JPG, JPEG, WEBP (max 10MB)";
    setStatus("", "");
  }

  function buildUpdatePayload() {
    if (!activeDesign) {
      throw new Error("No design selected.");
    }

    const nextTitle = normalizeText(editTitle.value) || activeDesign.title || activeDesign.name || "Untitled Design";
    const nextCategory = normalizeText(editCategory.value).toUpperCase() || activeDesign.category || "OTHER";
    const nextFileUrl = normalizeText(editFileUrl.value) || normalizeText(activeDesign.file_url || activeDesign.download_link || activeDesign.downloadUrl || activeDesign.download || "");
    const nextImageUrl = uploadedPreviewUrl || normalizeText(editImageUrl.value) || normalizeText(activeDesign.image_url || activeDesign.image || "");
    const nextTags = parseTags(editTags.value);

    return {
      title: nextTitle,
      name: nextTitle,
      category: nextCategory,
      price: Number(editPrice.value || 0),
      is_premium: Boolean(editPremium.checked),
      description: normalizeText(editDescription.value) || normalizeText(activeDesign.description || ""),
      tags: nextTags.length > 0 ? nextTags : Array.isArray(activeDesign.tags) ? activeDesign.tags : [],
      download_link: nextFileUrl,
      file_url: nextFileUrl,
      image_url: nextImageUrl
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function refreshDesignList() {
    try {
      const result = await getDesignsSafe();
      designs = Array.isArray(result) ? result : [];
      renderCategoryOptions();
      renderDesigns();
    } catch (error) {
      designTableBody.innerHTML = "<tr><td colspan='7' class='empty'>Could not load design records.</td></tr>";
      designCount.textContent = "Unable to load designs";
      console.error(error);
    }
  }

  searchInput.addEventListener("input", renderDesigns);
  accessFilter.addEventListener("change", renderDesigns);
  categoryFilter.addEventListener("change", renderDesigns);
  sortFilter.addEventListener("change", renderDesigns);
  clearFiltersButton.addEventListener("click", function () {
    searchInput.value = "";
    accessFilter.value = "all";
    categoryFilter.value = "all";
    sortFilter.value = "createdAt";
    renderDesigns();
  });

  tableViewButton.addEventListener("click", function () {
    setViewMode("table");
  });

  gridViewButton.addEventListener("click", function () {
    setViewMode("grid");
  });

  function setViewMode(mode) {
    activeView = mode;
    const isTable = mode === "table";
    designTableBody.closest(".table-wrap").hidden = !isTable;
    designGridBody.hidden = isTable;
    tableViewButton.classList.toggle("active", isTable);
    gridViewButton.classList.toggle("active", !isTable);
  }

  function handlePreviewFileChange() {
    const file = editPreviewFile.files && editPreviewFile.files[0];
    if (!file) {
      editPreviewFileMeta.textContent = "No file selected. Allowed: PNG, JPG, JPEG, WEBP (max 10MB)";
      return;
    }

    const MAX_SIZE_MB = 10;
    const ALLOWED_TYPES = [".png", ".jpg", ".jpeg", ".webp"];
    const fileExt = "." + file.name.split(".").pop().toLowerCase();

    if (!ALLOWED_TYPES.includes(fileExt)) {
      editPreviewFileMeta.textContent = "Invalid file type. Allowed: PNG, JPG, JPEG, WEBP";
      editPreviewFile.value = "";
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      editPreviewFileMeta.textContent = "File too large. Max: 10MB. Your file: " + (file.size / 1024 / 1024).toFixed(1) + "MB";
      editPreviewFile.value = "";
      return;
    }

    editPreviewFileMeta.textContent = file.name + " (" + (file.size / 1024).toFixed(1) + "KB)";
  }

  async function uploadPreviewFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/upload", {
      method: "POST",
      headers: {
        "X-File-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Upload-Kind": "preview"
      },
      body: file
    });

    if (!response.ok) {
      const errorData = await response.json().catch(function () {
        return {};
      });
      throw new Error(String(errorData.error || `Upload failed with status ${response.status}.`).trim());
    }

    const result = await response.json();
    if (!result.file_url) {
      throw new Error("Upload completed but no file URL was returned.");
    }

    return result.file_url;
  }

  editPreviewFile.addEventListener("change", handlePreviewFileChange);

  cancelEditButton.addEventListener("click", function () {
    closeEditor();
  });

  editForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!activeDesign) {
      return;
    }

    setStatus("Saving changes...", "warning");

    try {
      const previewFile = editPreviewFile.files && editPreviewFile.files[0];
      
      // Upload preview file if provided
      if (previewFile) {
        setStatus("Uploading preview image...", "warning");
        uploadedPreviewUrl = await uploadPreviewFile(previewFile);
        console.log("[AJartivo Design Edit] Uploaded preview URL", uploadedPreviewUrl);
      }

      const payload = buildUpdatePayload();
      console.log("[AJartivo Design Edit] Update payload", payload);
      const updatedDesign = await updateDesignSafe(activeDesign.id, payload);
      console.log("[AJartivo Design Edit] Update response", updatedDesign);
      designs = designs.map(function (item) {
        return String(item.id) === String(updatedDesign.id) ? updatedDesign : item;
      });
      activeDesign = updatedDesign;
      renderCategoryOptions();
      renderDesigns();
      setStatus("Design updated successfully.", "success");
      uploadedPreviewUrl = "";
      editPreviewFile.value = "";
      editPreviewFileMeta.textContent = "No file selected. Allowed: PNG, JPG, JPEG, WEBP (max 10MB)";
    } catch (error) {
      console.error(error);
      setStatus(String(error.message || "Update failed."), "danger");
    }
  });

  refreshDesignList();
});
