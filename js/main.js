// ===== Mobile Navigation Toggle =====
(function() {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('active');
      nav.classList.toggle('open');
      document.body.classList.toggle('nav-open');
    });

    // Close nav when a link is clicked (mobile)
    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function() {
        toggle.classList.remove('active');
        nav.classList.remove('open');
        document.body.classList.remove('nav-open');
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

// ===== Expandable Person Bios =====
(function() {
  var cards = document.querySelectorAll('.person-card.expandable');
  if (!cards.length) return;

  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      var wasExpanded = card.classList.contains('expanded');
      // Close all other expanded cards
      cards.forEach(function(c) { c.classList.remove('expanded'); });
      // Toggle this card
      if (!wasExpanded) {
        card.classList.add('expanded');
      }
    });

    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
})();

// ===== Expandable LSC Panels =====
(function() {
  var panels = document.querySelectorAll('.lsc-panel');
  if (!panels.length) return;

  panels.forEach(function(panel) {
    var header = panel.querySelector('.lsc-panel-header');

    function toggle(e) {
      if (e.target.closest('.lsc-panel-body a')) return;
      panel.classList.toggle('expanded');
    }

    if (header) header.addEventListener('click', toggle);

    panel.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target === panel || e.target === header || (header && header.contains(e.target))) {
          e.preventDefault();
          panel.classList.toggle('expanded');
        }
      }
    });
  });
})();

// ===== Expandable irAEs Card =====
(function() {
  var card = document.querySelector('.iraes-expandable');
  if (!card) return;

  var header = card.querySelector('.iraes-expandable-header');
  var intro = card.querySelector('.iraes-intro');

  function toggle(e) {
    // Don't toggle if clicking a link inside the expanded body
    if (e.target.closest('.iraes-expandable-body a')) return;
    card.classList.toggle('expanded');
  }

  if (header) header.addEventListener('click', toggle);
  if (intro) intro.addEventListener('click', toggle);

  card.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target === card || e.target === header || header.contains(e.target)) {
        e.preventDefault();
        card.classList.toggle('expanded');
      }
    }
  });

  // Auto-expand if navigated to via #iraes hash
  if (window.location.hash === '#iraes') {
    setTimeout(function() {
      card.classList.add('expanded');
    }, 400);
  }
})();

// ===== Expandable START Clauses Card =====
(function() {
  var card = document.querySelector('.start-expandable');
  if (!card) return;

  var header = card.querySelector('.start-expandable-header');
  var intro = card.querySelector('.start-intro');

  function toggleCard(e) {
    if (e.target.closest('.start-expandable-body a')) return;
    if (e.target.closest('.start-module-header')) return;
    if (e.target.closest('.start-expandable-body') && card.classList.contains('expanded')) return;
    card.classList.toggle('expanded');
  }

  if (header) header.addEventListener('click', toggleCard);
  if (intro) intro.addEventListener('click', toggleCard);

  card.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target === card || e.target === header || header.contains(e.target)) {
        e.preventDefault();
        card.classList.toggle('expanded');
      }
    }
  });

  // Auto-expand if navigated to via #start-clauses hash
  if (window.location.hash === '#start-clauses') {
    setTimeout(function() {
      card.classList.add('expanded');
    }, 400);
  }

  // Accordion modules within START Clauses
  var modules = card.querySelectorAll('.start-module');
  modules.forEach(function(mod) {
    var btn = mod.querySelector('.start-module-header');
    if (!btn) return;

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var wasExpanded = mod.classList.contains('expanded');
      // Close all modules
      modules.forEach(function(m) { m.classList.remove('expanded'); });
      // Toggle clicked module
      if (!wasExpanded) {
        mod.classList.add('expanded');
      }
      // Update aria-expanded
      modules.forEach(function(m) {
        var b = m.querySelector('.start-module-header');
        if (b) b.setAttribute('aria-expanded', m.classList.contains('expanded'));
      });
    });
  });
})();

// ===== Expandable Annual Meeting Card =====
(function() {
  var card = document.querySelector('.am-expandable');
  if (!card) return;

  var header = card.querySelector('.am-card-header');

  function toggleCard(e) {
    // Don't toggle if clicking a link inside the expanded body
    if (e.target.closest('.am-expandable-body a')) return;
    // Don't toggle if clicking inside expanded body (except on header)
    if (e.target.closest('.am-expandable-body') && card.classList.contains('expanded')) return;
    card.classList.toggle('expanded');
  }

  // Toggle on header click
  if (header) header.addEventListener('click', toggleCard);

  // Toggle on banner click
  var banner = card.querySelector('.am-banner');
  if (banner) banner.addEventListener('click', toggleCard);

  // Keyboard accessibility
  card.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target === card || e.target === header || (header && header.contains(e.target))) {
        e.preventDefault();
        card.classList.toggle('expanded');
      }
    }
  });

  // Auto-expand if navigated to via hash
  if (window.location.hash === '#annual-meeting-2025') {
    setTimeout(function() {
      card.classList.add('expanded');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }
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
