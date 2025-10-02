(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }

      form.classList.add('was-validated');
    }, 
    false);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // Select all share containers on the page
    document.querySelectorAll('.share-container').forEach(container => {
        const button = container.querySelector('.share-btn');
        const postUrl = button.getAttribute('data-url');
        const postTitle = button.getAttribute('data-title');

        // Handles click on the main share button
        button.addEventListener('click', () => {
            if (navigator.share) {
                // Use Web Share API for native sharing (best UX on mobile)
                navigator.share({
                    title: postTitle,
                    url: postUrl
                })
                .then(() => console.log('Successful share'))
                .catch((error) => {
                    console.log('Error/Fallback to manual:', error);
                    // If native sharing fails or is cancelled, fall back to showing manual links
                    container.classList.toggle('active');
                });
            } else {
                // Fallback: Toggle visibility of social links manually
                container.classList.toggle('active');
            }
        });
        
        // Closes the social links when the user clicks anywhere outside the container
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && container.classList.contains('active')) {
                container.classList.remove('active');
            }
        });
    });
  });

 document.querySelectorAll('.like-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const postId = btn.getAttribute('data-id');
    const icon = btn.querySelector('i');
    const badge = btn.querySelector('.badge');

    try {
      const res = await fetch(`/posts/${postId}/like`, { method: 'POST' });
      const data = await res.json();

      // Update badge count
      if (badge) {
        badge.textContent = data.likes;
      } else {
        const newBadge = document.createElement('span');
        newBadge.className = 'badge bg-danger';
        newBadge.textContent = data.likes;
        btn.appendChild(newBadge);
      }

      // Toggle icon color
      icon.classList.add('liked');
    } catch (err) {
      console.error("Like failed:", err);
      alert("You’ve already liked this post.");
    }
  });
});


 document.querySelectorAll('.comment-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const postId = btn.getAttribute('data-id');
    document.getElementById('comment-post-id').value = postId;

    const res = await fetch(`/posts/${postId}/comments`);
    const data = await res.json();

    const list = document.getElementById('comment-list');
    list.innerHTML = '';
    // data.comments.forEach(comment => {
    //   const li = document.createElement('li');
      // li.className = 'list-group-item';
      // li.textContent = `${comment.author}: ${comment.text}`;
      data.comments.forEach(comment => {
        const li = document.createElement('li');
        li.className = 'comment-item';

        const bubble = document.createElement('div');
        bubble.className = 'comment-bubble';

        const author = document.createElement('div');
        author.className = 'comment-author';
        author.textContent = comment.author;

        const text = document.createElement('div');
        text.className = 'comment-text';
        text.textContent = comment.text;

        bubble.appendChild(author);
        bubble.appendChild(text);
        li.appendChild(bubble);
        list.appendChild(li);
      });

    new bootstrap.Modal(document.getElementById('comment-modal')).show();
  });
 });

 document.getElementById('comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const postId = document.getElementById('comment-post-id').value;
  const text = document.getElementById('comment-text').value.trim();

  if (!text) {
    alert("Comment cannot be empty");
    return;
  }

  try {
    const res = await fetch(`/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author: "Anonymous" }) // ✅ Ensure text is sent
    });

    const data = await res.json();

    const list = document.getElementById('comment-list');
    list.innerHTML = '';
    
    data.comments.forEach(comment => {
    const li = document.createElement('li');
    li.className = 'comment-item';

    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';

    const author = document.createElement('div');
    author.className = 'comment-author';
    author.textContent = comment.author;

    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = comment.text;

    bubble.appendChild(author);
    bubble.appendChild(text);
    li.appendChild(bubble);
    list.appendChild(li);
    });
    document.getElementById('comment-text').value = '';
  } catch (err) {
    console.error("Comment submission failed:", err);
  }
 });
})();