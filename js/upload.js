document.addEventListener("DOMContentLoaded", function () {
  if (document.body.dataset.page !== "upload") {
    return;
  }

  const form = document.getElementById("designForm");
  const cards = document.getElementById("designCards");
  const statusBadge = document.getElementById("uploadStatus");
  const addImageBtn = document.getElementById("addImageBtn");
  const additionalImageInputs = document.getElementById("additionalImageInputs");
  const previewUrlInput = document.getElementById("previewUrl");
  const previewFileInput = document.getElementById("previewFile");
  const priceField = document.getElementById("priceField");
  const priceInput = document.getElementById("price");
  const paymentModeInputs = form.querySelectorAll("input[name='paymentMode']");
  const submitButton = form.querySelector("button[type='submit']");

  let editingId = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(text, type) {
    statusBadge.textContent = text;
    statusBadge.classList.remove("status-success", "status-warning", "status-danger");
    if (type === "success") {
      statusBadge.classList.add("status-success");
    }
    if (type === "warning") {
      statusBadge.classList.add("status-warning");
    }
    if (type === "danger") {
      statusBadge.classList.add("status-danger");
    }
  }

  function getSelectedPaymentMode() {
    const selected = form.querySelector("input[name='paymentMode']:checked");
    return selected ? selected.value : "paid";
  }

  function setPaymentMode(mode) {
    paymentModeInputs.forEach(function (input) {
      input.checked = input.value === mode;
    });
    applyPaymentModeUI();
  }

  function applyPaymentModeUI() {
    const mode = getSelectedPaymentMode();
    if (mode === "free") {
      priceInput.value = "0";
      priceInput.required = false;
      priceInput.disabled = true;
      priceField.style.display = "none";
      priceField.style.opacity = "0.6";
      return;
    }

    priceInput.disabled = false;
    priceInput.required = true;
    priceField.style.display = "";
    priceField.style.opacity = "1";
  }

  function toDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (event) {
        resolve(String(event.target.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Image read failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  async function resolveImageValue(urlInput, fileInput) {
    const typedUrl = String(urlInput.value || "").trim();
    if (typedUrl) {
      return typedUrl;
    }

    if (fileInput && fileInput.files && fileInput.files[0]) {
      return await toDataUrl(fileInput.files[0]);
    }

    return "";
  }

  function createAdditionalImageRow(value) {
    const row = document.createElement("div");
    row.className = "image-input-row";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "https://image-link";
    urlInput.className = "additional-image-url";
    urlInput.value = value || "";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "image-file-input";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-btn";
    removeButton.textContent = "x";

    removeButton.addEventListener("click", function () {
      row.remove();
    });

    row.appendChild(urlInput);
    row.appendChild(fileInput);
    row.appendChild(removeButton);

    additionalImageInputs.appendChild(row);
  }

  function resetAdditionalImageRows(values) {
    additionalImageInputs.innerHTML = "";
    (values || []).forEach(function (item) {
      createAdditionalImageRow(item);
    });
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

  async function addDesignSafe(payload) {
    const fb = window.AjartivoFirebase || { connected: false };
    if (fb.connected) {
      try {
        await fb.addDesign(payload);
      } catch (error) {
        window.DataStore.addDesign(payload);
      }
      return;
    }

    window.DataStore.addDesign(payload);
  }

  async function updateDesignSafe(id, payload) {
    const fb = window.AjartivoFirebase || { connected: false };
    if (fb.connected && typeof fb.updateDesign === "function") {
      try {
        await fb.updateDesign(id, payload);
      } catch (error) {
        window.DataStore.updateDesign(id, payload);
      }
      return;
    }

    window.DataStore.updateDesign(id, payload);
  }

  async function deleteDesignSafe(id) {
    const fb = window.AjartivoFirebase || { connected: false };
    if (fb.connected && typeof fb.deleteDesign === "function") {
      try {
        await fb.deleteDesign(id);
      } catch (error) {
        window.DataStore.deleteDesign(id);
      }
      return;
    }

    window.DataStore.deleteDesign(id);
  }

  function setEditMode(design) {
    editingId = design.id;

    form.name.value = design.name || "";
    form.category.value = design.category || "PSD";
    const mode = design.paymentMode || (Number(design.price || 0) === 0 ? "free" : "paid");
    setPaymentMode(mode);
    form.price.value = String(design.price || "");
    form.downloadUrl.value = design.downloadUrl || design.download || "";
    form.previewUrl.value = design.previewUrl || design.image || "";
    form.description.value = design.description || "";
    form.previewFile.value = "";

    const extraImages = Array.isArray(design.extraImages)
      ? design.extraImages
      : Array.isArray(design.gallery)
      ? design.gallery
      : [];
    resetAdditionalImageRows(extraImages);

    submitButton.textContent = "Update Design";
    setStatus("Edit mode: " + (design.name || "Design"), "warning");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFormState(message) {
    editingId = null;
    form.reset();
    setPaymentMode("paid");
    resetAdditionalImageRows([]);
    submitButton.textContent = "Save Design";
    setStatus(message || "Ready to upload", "");
  }

  async function buildPayload() {
    const paymentMode = getSelectedPaymentMode();
    const previewUrl = await resolveImageValue(previewUrlInput, previewFileInput);

    const rows = additionalImageInputs.querySelectorAll(".image-input-row");
    const images = [];

    for (const row of rows) {
      const rowUrlInput = row.querySelector(".additional-image-url");
      const rowFileInput = row.querySelector(".image-file-input");
      const value = await resolveImageValue(rowUrlInput, rowFileInput);
      if (value) {
        images.push(value);
      }
    }

    return {
      name: String(form.name.value || "").trim(),
      category: String(form.category.value || "PSD").trim(),
      paymentMode: paymentMode,
      price: paymentMode === "free" ? 0 : Number(form.price.value || 0),
      downloadCount: 0,
      downloadUrl: String(form.downloadUrl.value || "").trim(),
      previewUrl: previewUrl,
      extraImages: images,
      description: String(form.description.value || "").trim()
    };
  }

  async function renderCards() {
    const designs = await getDesignsSafe();

    if (designs.length === 0) {
      cards.innerHTML = "<p class='empty'>No designs uploaded yet.</p>";
      return;
    }

    cards.innerHTML = designs
      .map(function (item) {
        const preview = item.previewUrl || item.image || "";
        const mode = item.paymentMode || (Number(item.price || 0) === 0 ? "free" : "paid");
        const priceText = mode === "free" ? "Free" : window.AdminApp.formatCurrency(item.price);
        const totalImages = [preview]
          .concat(Array.isArray(item.extraImages) ? item.extraImages : item.gallery || [])
          .filter(Boolean).length;

        return (
          "<article class='design-card'>" +
          (preview
            ? "<img src='" + escapeHtml(preview) + "' alt='" + escapeHtml(item.name) + "'>"
            : "<img alt='No image'>") +
          "<div class='content'>" +
          "<strong>" + escapeHtml(item.name) + "</strong>" +
          "<span class='muted'>" + escapeHtml(item.category) + " | " + priceText + "</span>" +
          "<span class='muted'>Images: " + totalImages + "</span>" +
          "<span class='muted'>Downloads: " + Number(item.downloadCount || 0) + "</span>" +
          "<div class='row'>" +
          "<button type='button' class='btn btn-soft' data-edit-id='" + escapeHtml(item.id) + "'>Edit</button>" +
          "<button type='button' class='btn btn-outline btn-danger-outline' data-delete-id='" + escapeHtml(item.id) + "'>Remove</button>" +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    cards.querySelectorAll("[data-edit-id]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const id = button.dataset.editId;
        const designsList = await getDesignsSafe();
        const design = designsList.find(function (item) {
          return item.id === id;
        });

        if (!design) {
          setStatus("Design not found", "danger");
          return;
        }

        setEditMode(design);
      });
    });

    cards.querySelectorAll("[data-delete-id]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const id = button.dataset.deleteId;
        const confirmed = window.confirm("Is design ko remove karna hai?");
        if (!confirmed) {
          return;
        }

        await deleteDesignSafe(id);
        if (editingId === id) {
          clearFormState("Edit canceled");
        }
        setStatus("Design removed", "success");
        await renderCards();
      });
    });
  }

  addImageBtn.addEventListener("click", function () {
    createAdditionalImageRow("");
  });

  previewFileInput.addEventListener("change", function () {
    if (previewFileInput.files && previewFileInput.files[0]) {
      setStatus("Preview image file selected", "warning");
    }
  });

  paymentModeInputs.forEach(function (input) {
    input.addEventListener("change", applyPaymentModeUI);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const payload = await buildPayload();
    if (!payload.name) {
      setStatus("Design name required", "danger");
      return;
    }

    submitButton.disabled = true;

    try {
      if (editingId) {
        await updateDesignSafe(editingId, payload);
        setStatus("Design updated successfully", "success");
      } else {
        await addDesignSafe(payload);
        setStatus("Design uploaded successfully", "success");
      }

      clearFormState(statusBadge.textContent);
      await renderCards();
    } catch (error) {
      setStatus("Save failed. Try again.", "danger");
    } finally {
      submitButton.disabled = false;
    }
  });

  clearFormState("Ready to upload");
  applyPaymentModeUI();
  renderCards();
});
