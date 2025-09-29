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
})();