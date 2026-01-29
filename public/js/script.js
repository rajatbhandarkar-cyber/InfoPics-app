(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    initShareLogic();
    initNavbarToggler();
    initLikeToggle();
    initCommentModal();
    initCommentSubmit();
    initFormValidation();
    initActiveFilterHighlight();

    // Blur focused elements after modal hides
    document.querySelectorAll(".modal").forEach(modal => {
      modal.addEventListener("hidden.bs.modal", () => {
        requestAnimationFrame(() => {
          if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
          }
        });
      });
    });

    // Blur close buttons immediately on click
    document.querySelectorAll(".modal .btn-close").forEach(btn => {
      btn.addEventListener("click", () => btn.blur());
    });
  });

  function initShareLogic() {
    document.querySelectorAll(".share-btn").forEach(button => {
      const postUrl = button.getAttribute("data-url");
      const postTitle = button.getAttribute("data-title");

      button.addEventListener("click", async () => {
        const modalEl = document.getElementById("custom-share-modal");
        if (!modalEl) return;

        bootstrap.Modal.getOrCreateInstance(modalEl).show();

        const copyBtn = document.getElementById("copy-link-btn");
        const fbBtn = document.getElementById("facebook-share");
        const waBtn = document.getElementById("whatsapp-share");
        const igBtn = document.getElementById("instagram-share");
        const twBtn = document.getElementById("twitter-share");
        const lnBtn = document.getElementById("linkedin-share");

        if (copyBtn) {
          copyBtn.onclick = async () => {
            try {
              await navigator.clipboard.writeText(postUrl);
            } catch (err) {
              console.error("Copy failed", err);
            }
          };
        }

        if (igBtn) igBtn.onclick = () => window.open("https://www.instagram.com/", "_blank");
        if (fbBtn) fbBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
        if (waBtn) waBtn.href = `https://web.whatsapp.com/send?text=${encodeURIComponent(postTitle + "\n" + postUrl)}`;
        if (twBtn) twBtn.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(postTitle)}`;
        if (lnBtn) lnBtn.href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(postTitle)}`;
      });
    });
  }

  function initNavbarToggler() {
    const menuIcon = document.getElementById("menu-icon");
    const closeIcon = document.getElementById("close-icon");
    const navbarCollapse = document.getElementById("navbarNavAltMarkup");
    if (!navbarCollapse) return;

    navbarCollapse.addEventListener("show.bs.collapse", () => {
      menuIcon?.classList.add("d-none");
      closeIcon?.classList.remove("d-none");
    });

    navbarCollapse.addEventListener("hide.bs.collapse", () => {
      menuIcon?.classList.remove("d-none");
      closeIcon?.classList.add("d-none");
    });
  }

  function initLikeToggle() {
    document.querySelectorAll(".like-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.liked === "true") return;

        const postId = btn.dataset.id;
        const badge = btn.querySelector(".badge");

        try {
          const res = await fetch(`/posts/${postId}/like`, { method: "POST" });
          const data = await res.json();

          if (data.success) {
            btn.dataset.liked = "true";
            btn.setAttribute("disabled", true);

            if (badge) {
              badge.textContent = Number(badge.textContent) + 1;
            } else {
              const span = document.createElement("span");
              span.className = "badge bg-danger";
              span.textContent = "1";
              btn.appendChild(span);
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function initCommentModal() {
    document.querySelectorAll(".comment-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const postId = btn.dataset.id;
        document.getElementById("comment-post-id").value = postId;

        try {
          const res = await fetch(`/posts/${postId}/comments`);
          const data = await res.json();

          const list = document.getElementById("comment-list");
          list.innerHTML = "";

          data.comments.forEach(comment => {
            const li = document.createElement("li");
            li.className = "comment-item";

            li.innerHTML = `
              <div class="comment-bubble">
                <div class="comment-author">@${comment.author?.username || "Anonymous"}</div>
                <div class="comment-text">${comment.text}</div>
              </div>
            `;
            list.appendChild(li);
          });

          bootstrap.Modal.getOrCreateInstance(
            document.getElementById("comment-modal")
          ).show();
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function initCommentSubmit() {
    const form = document.getElementById("comment-form");
    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();

      const postId = document.getElementById("comment-post-id").value;
      const textEl = document.getElementById("modal-comment-text");
      const text = textEl.value.trim();
      if (!text) return;

      try {
        const res = await fetch(`/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });

        const data = await res.json();
        if (!data.success) return;

        textEl.value = "";
      } catch (err) {
        console.error(err);
      }
    });
  }

  function initFormValidation() {
    document.querySelectorAll(".needs-validation").forEach(form => {
      form.addEventListener("submit", e => {
        if (!form.checkValidity()) {
          e.preventDefault();
          e.stopPropagation();
        }
        form.classList.add("was-validated");
      });
    });
  }

  function initActiveFilterHighlight() {
    const params = new URLSearchParams(window.location.search);
    const activeCategory = params.get("category");
    if (!activeCategory) return;

    document.querySelectorAll(".global-filter-bar .btn").forEach(btn => {
      if (btn.href.includes(`category=${encodeURIComponent(activeCategory)}`)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

})();
