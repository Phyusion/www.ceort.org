// ===== Mobile Navigation Toggle =====
(function() {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('active');
      nav.classList.toggle('open');
    });

    // Close nav when a link is clicked (mobile)
    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function() {
        toggle.classList.remove('active');
        nav.classList.remove('open');
      });
    }
  }
})();

// ===== Header Shadow on Scroll =====
(function() {
  var header = document.getElementById('header');
  if (!header) return;

  function onScroll() {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ===== Scroll Animations (Intersection Observer) =====
(function() {
  var elements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
  if (!elements.length) return;

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show all elements immediately
    elements.forEach(function(el) {
      el.classList.add('visible');
    });
  }
})();

// ===== Contact Form Handler =====
(function() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.innerHTML;

    btn.innerHTML = 'Sending...';
    btn.disabled = true;

    // Simulate form submission (replace with actual endpoint)
    setTimeout(function() {
      btn.innerHTML = 'Message Sent!';
      btn.style.background = 'var(--color-sage)';

      setTimeout(function() {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.disabled = false;
        form.reset();
      }, 2500);
    }, 1000);
  });
})();

// ===== Smooth Scroll for Hash Links =====
(function() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="#"]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href || href === '#') return;

    // Only handle same-page hash links
    var hashIndex = href.indexOf('#');
    var path = href.substring(0, hashIndex);
    var hash = href.substring(hashIndex);

    if (path && path !== window.location.pathname.split('/').pop()) return;

    var target = document.querySelector(hash);
    if (!target) return;

    e.preventDefault();
    var headerHeight = document.getElementById('header').offsetHeight || 72;
    var top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

    window.scrollTo({
      top: top,
      behavior: 'smooth'
    });
  });
})();
