(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
  initShareLogic();
  initNavbarToggler();
  initLikeToggle();
  initCommentModal();
  initCommentSubmit();
  initFormValidation();

  // ✅ Blur focused elements after modal hides
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("hidden.bs.modal", () => {
      requestAnimationFrame(() => {
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      });
    });
  });

  // ✅ Blur close buttons immediately on click
  document.querySelectorAll(".modal .btn-close").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.blur();
    });
  });
  });


  function initShareLogic() {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  document.querySelectorAll(".share-btn").forEach(button => {
    const postUrl = button.getAttribute("data-url");
    const postTitle = button.getAttribute("data-title");

  button.addEventListener("click", async () => {
   console.log("✅ Share icon clicked for:", postTitle, postUrl);

   const modalEl = document.getElementById("custom-share-modal");
   if (!modalEl) {
    console.error("❌ Modal element not found.");
    return;
  }

  const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  modalInstance.show();
  modalEl.addEventListener("hidden.bs.modal", () => {
  if (document.activeElement && modalEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  });



 
  // ✅ Wire share buttons
  const copyBtn = document.getElementById("copy-link-btn");
  const fbBtn = document.getElementById("facebook-share");
  const waBtn = document.getElementById("whatsapp-share");
  const igBtn = document.getElementById("instagram-share");
  const twBtn = document.getElementById("twitter-share");
  const lnBtn = document.getElementById("linkedin-share");

  if (copyBtn && fbBtn && waBtn && igBtn && twBtn && lnBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(postUrl);
        alert("Link copied to clipboard!");
      } catch (err) {
        alert("Failed to copy link.");
      }
    };

    igBtn.onclick = () => {
    window.open("https://www.instagram.com/", "_blank");
    };

    fbBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    waBtn.href = `https://web.whatsapp.com/send?text=${encodeURIComponent(postTitle + "\n" + postUrl)}`;
    twBtn.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(postTitle)}`;
    lnBtn.href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(postTitle)}`;
  }
  });

  });
  }

  function initNavbarToggler() {
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');
    const navbarCollapse = document.getElementById('navbarNavAltMarkup');

    if (!navbarCollapse) return;

    navbarCollapse.addEventListener('show.bs.collapse', () => {
      menuIcon?.classList.add('d-none');
      closeIcon?.classList.remove('d-none');
    });

    navbarCollapse.addEventListener('hide.bs.collapse', () => {
      menuIcon?.classList.remove('d-none');
      closeIcon?.classList.add('d-none');
    });
  }

  function initLikeToggle() {
  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const postId = btn.getAttribute("data-id");
      const icon = btn.querySelector("i");
      const badge = btn.querySelector(".badge");

      // Prevent double-clicks
      if (btn.getAttribute("data-liked") === "true") return;

      try {
        const res = await fetch(`/posts/${postId}/like`, { method: "POST" });
        const data = await res.json();

        if (data.success) {
          icon.classList.add("liked");
          btn.setAttribute("data-liked", "true");

          if (badge) {
            badge.textContent = parseInt(badge.textContent) + 1;
          } else {
            const newBadge = document.createElement("span");
            newBadge.className = "badge bg-danger";
            newBadge.textContent = "1";
            btn.appendChild(newBadge);
          }

          // Optional: disable button after liking
          btn.setAttribute("disabled", true);
        }
      } catch (err) {
        console.error("Like failed:", err);
      }
    });
  });
}


  function initCommentModal() {
    document.querySelectorAll(".comment-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const postId = btn.getAttribute("data-id");
        document.getElementById("comment-post-id").value = postId;

        try {
          const res = await fetch(`/posts/${postId}/comments`);
          const data = await res.json();

          const list = document.getElementById("comment-list");
          list.innerHTML = "";

          data.comments.forEach(comment => {
            const li = document.createElement("li");
            li.className = "comment-item";

            const bubble = document.createElement("div");
            bubble.className = "comment-bubble";

            const author = document.createElement("div");
            author.className = "comment-author";
            author.textContent = `@${comment.author?.username || "Anonymous"}`;

            const text = document.createElement("div");
            text.className = "comment-text";
            text.textContent = comment.text;

            bubble.appendChild(author);
            bubble.appendChild(text);
            li.appendChild(bubble);
            list.appendChild(li);
          });

          bootstrap.Modal.getOrCreateInstance(document.getElementById("comment-modal")).show();
        } catch (err) {
          console.error("Failed to load comments:", err);
        }
      });
    });
  }

  function initCommentSubmit() {
    document.getElementById("comment-form").addEventListener("submit", async (e) => {
      e.preventDefault();

      const postId = document.getElementById("comment-post-id").value;
      const text = document.getElementById("modal-comment-text").value.trim();
      if (!text) return;

      try {
        const res = await fetch(`/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });

        const data = await res.json();
        if (!data.success) throw new Error("Comment failed");

        const list = document.getElementById("comment-list");
        list.innerHTML = "";

        [...data.comments].reverse().forEach(comment => {
          const li = document.createElement("li");
          li.className = "comment-item";

          const bubble = document.createElement("div");
          bubble.className = "comment-bubble";

          const author = document.createElement("div");
          author.className = "comment-author";
          author.textContent = `@${comment.author?.username || "Anonymous"}`;

          const text = document.createElement("div");
          text.className = "comment-text";
          text.textContent = comment.text;

          bubble.appendChild(author);
          bubble.appendChild(text);
          li.appendChild(bubble);
          list.appendChild(li);
        });

        const badge = document.querySelector(`.comment-btn[data-id="${postId}"] .badge`);
        if (badge) {
          badge.textContent = data.comments.length;
        } else {
          const newBadge = document.createElement("span");
          newBadge.className = "badge";
          newBadge.textContent = data.comments.length;
          document.querySelector(`.comment-btn[data-id="${postId}"]`).appendChild(newBadge);
        }

        document.getElementById("modal-comment-text").value = "";
      } catch (err) {
        console.error("Comment submission failed:", err);
      }
    });
  }

  function initFormValidation() {
    const forms = document.querySelectorAll(".needs-validation");
    Array.from(forms).forEach((form) => {
      form.addEventListener("submit", (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add("was-validated");
      }, false);
    });
  }
})();
