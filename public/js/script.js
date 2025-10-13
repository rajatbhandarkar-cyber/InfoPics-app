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

  //share btn logic 
  document.addEventListener("DOMContentLoaded", () => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  document.querySelectorAll(".share-container").forEach(container => {
    const button = container.querySelector(".share-btn"); // ✅ define button here
    const postUrl = button.getAttribute("data-url");
    const postTitle = button.getAttribute("data-title");

    // rest of your share logic...
    button.addEventListener("click", async () => {
      // your code here
      if (!navigator.share || !isMobile) {
    const modal = new bootstrap.Modal(document.getElementById("custom-share-modal"));
    modal.show();

    // Set up share links
    document.getElementById("copy-link-btn").onclick = async () => {
      try {
        await navigator.clipboard.writeText(postUrl);
        document.getElementById("copy-link-btn").blur();
      } catch (err) {
        alert("Failed to copy link.");
      }
    };

    document.getElementById("facebook-share").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    document.getElementById("whatsapp-share").href = `https://web.whatsapp.com/send?text=${encodeURIComponent(postTitle + "\n" + postUrl)}`;
    document.getElementById("twitter-share").href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(postTitle)}`;
    document.getElementById("linkedin-share").href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(postTitle)}`;

    return;
    }

    // Mobile native share logic
    if (isSharing) return;
    isSharing = true;

    try {
      await navigator.share({ title: postTitle, url: postUrl });
      console.log("Successful share");
    } catch (error) {
      console.log("Share failed:", error);
      alert("Sharing failed or was cancelled.");
    } finally {
      isSharing = false;
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

  // Open comment modal and load comments
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

        new bootstrap.Modal(document.getElementById("comment-modal")).show();
      } catch (err) {
        console.error("Failed to load comments:", err);
      }
    });
  });

  // Submit new comment via AJAX
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

  //toggler
  document.addEventListener('DOMContentLoaded', () => {
  const menuIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');
  const navbarCollapse = document.getElementById('navbarNavAltMarkup');

  // Show cross icon when navbar is shown
  navbarCollapse.addEventListener('show.bs.collapse', () => {
    menuIcon.classList.add('d-none');
    closeIcon.classList.remove('d-none');
  });

  // Show hamburger icon when navbar is hidden
  navbarCollapse.addEventListener('hide.bs.collapse', () => {
    menuIcon.classList.remove('d-none');
    closeIcon.classList.add('d-none');
  });
});
})();
