(() => {
  "use strict";

  // Bootstrap form validation
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

  // Share button logic
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".share-container").forEach(container => {
      const button = container.querySelector(".share-btn");
      const postUrl = button.getAttribute("data-url");
      const postTitle = button.getAttribute("data-title");

      button.addEventListener("click", () => {
        if (navigator.share) {
          navigator.share({ title: postTitle, url: postUrl })
            .then(() => console.log("Successful share"))
            .catch((error) => {
              console.log("Error/Fallback to manual:", error);
              container.classList.toggle("active");
            });
        } else {
          container.classList.toggle("active");
        }
      });

      document.addEventListener("click", (e) => {
        if (!container.contains(e.target) && container.classList.contains("active")) {
          container.classList.remove("active");
        }
      });
    });
  });

  // Like/Dislike toggle
  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const postId = btn.getAttribute("data-id");
      const icon = btn.querySelector("i");
      const badge = btn.querySelector(".badge");
      const isLiked = icon.classList.contains("liked");

      try {
        const res = await fetch(`/posts/${postId}/like`, { method: "POST" });
        const data = await res.json();

        if (data.success) {
          if (isLiked) {
            icon.classList.remove("liked");
            if (badge) {
              let count = parseInt(badge.textContent);
              count = Math.max(count - 1, 0);
              badge.textContent = count;
              if (count === 0) badge.remove();
            }
          } else {
            icon.classList.add("liked");
            if (badge) {
              badge.textContent = parseInt(badge.textContent) + 1;
            } else {
              const newBadge = document.createElement("span");
              newBadge.className = "badge bg-danger";
              newBadge.textContent = "1";
              btn.appendChild(newBadge);
            }
          }
        }
      } catch (err) {
        console.error("Like toggle failed:", err);
      }
    });
  });

  // Open comment modal
  document.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const postId = btn.getAttribute("data-id");
      document.getElementById("comment-post-id").value = postId;

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
        author.textContent = comment.author;

        const text = document.createElement("div");
        text.className = "comment-text";
        text.textContent = comment.text;

        bubble.appendChild(author);
        bubble.appendChild(text);
        li.appendChild(bubble);
        list.appendChild(li);
      });

      new bootstrap.Modal(document.getElementById("comment-modal")).show();
    });
  });

  // Submit new comment
  document.getElementById("comment-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const postId = document.getElementById("comment-post-id").value;
    const text = document.getElementById("comment-text").value.trim();

    if (!text) {
      alert("Comment cannot be empty");
      return;
    }

    try {
      const res = await fetch(`/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: "Anonymous" })
      });

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
        author.textContent = comment.author;

        const text = document.createElement("div");
        text.className = "comment-text";
        text.textContent = comment.text;

        bubble.appendChild(author);
        bubble.appendChild(text);
        li.appendChild(bubble);
        list.appendChild(li);
      });

      // ✅ Update comment badge on post card
      const badge = document.querySelector(`.comment-btn[data-id="${postId}"] .badge`);
      if (badge) {
        badge.textContent = data.comments.length;
      } else {
        const newBadge = document.createElement("span");
        newBadge.className = "badge";
        newBadge.textContent = data.comments.length;
        document.querySelector(`.comment-btn[data-id="${postId}"]`).appendChild(newBadge);
      }

      document.getElementById("comment-text").value = "";
    } catch (err) {
      console.error("Comment submission failed:", err);
    }
  });
})();
