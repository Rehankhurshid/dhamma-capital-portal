/**
 * Login Page Animations — Dhamma Capital
 * Form entrance animations + micro-interactions
 *
 * Load in Webflow Page Settings → Before </body> tag (BEFORE the login script):
 *   <script src="<DEPLOY_URL>/scripts/login_animations.js"></script>
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. FORM ENTRANCE — staggered fade-up for form children
     ═══════════════════════════════════════════════════════ */

  function initEntranceAnimations() {
    var form = document.querySelector('.uui-contact01_form');
    if (!form) return;

    var children = form.children;
    for (var i = 0; i < children.length; i++) {
      children[i].style.setProperty('--dc-i', i);
    }

    var secureWrap = document.querySelector('.login-secure_wrap');
    if (secureWrap) secureWrap.style.setProperty('--dc-i', children.length);

    requestAnimationFrame(function () {
      form.classList.add('dc-animate-in');
      if (secureWrap) secureWrap.classList.add('dc-child-animate');
    });
  }

  /* ═══════════════════════════════════════════════════════
     2. FORM CARD PARALLAX — subtle depth on mouse move
     ═══════════════════════════════════════════════════════ */

  function initParallax() {
    var card = document.querySelector('.login-form_content');
    if (!card || window.matchMedia('(max-width: 991px)').matches) return;

    var ticking = false;
    card.addEventListener('mousemove', function (e) {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var rect = card.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
        var y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
        card.style.transform =
          'perspective(800px) rotateX(' + (-y * 0.4) + 'deg) rotateY(' + (x * 0.4) + 'deg) translateZ(4px)';
        ticking = false;
      });
    });

    card.addEventListener('mouseleave', function () {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateZ(0)';
    });
  }

  /* ═══════════════════════════════════════════════════════
     3. BUTTON EFFECTS — ripple on click (targets wrapper, not input)
     ═══════════════════════════════════════════════════════ */

  function initButtonEffects() {
    var btn = document.querySelector('[data-portal="submit"]');
    if (!btn) return;

    var wrapper = btn.closest('.submitbuttonwrapper') || btn.parentElement;

    btn.addEventListener('click', function (e) {
      var rect = wrapper.getBoundingClientRect();
      var ripple = document.createElement('span');
      ripple.className = 'dc-ripple';
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top = (e.clientY - rect.top) + 'px';
      wrapper.appendChild(ripple);
      ripple.addEventListener('animationend', function () {
        ripple.remove();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     4. SECURE TEXT — encrypt / decrypt scramble effect
     ═══════════════════════════════════════════════════════ */

  function initSecureTextEffect() {
    var el = document.querySelector('.secure-text');
    if (!el) return;

    var original = el.textContent;
    var chars = '⣿⡿⣻⢟⡛⠿⣽⢯⡷⣯░▒▓█▀▄■□◆◇●○◌⌐¬¤§¶×÷±≈∞∑∏∫≠≤≥⊕⊗⊞⊟';
    var len = original.length;

    /* Scramble a percentage of characters (0 = fully clear, 1 = fully scrambled) */
    function scramble(amount) {
      var result = '';
      for (var i = 0; i < len; i++) {
        if (original[i] === ' ') {
          result += ' ';
        } else if (Math.random() < amount) {
          result += chars[Math.floor(Math.random() * chars.length)];
        } else {
          result += original[i];
        }
      }
      el.textContent = result;
    }

    /* Animate from one scramble level to another over duration ms */
    function animate(fromAmt, toAmt, duration, cb) {
      var start = performance.now();
      function tick(now) {
        var t = Math.min((now - start) / duration, 1);
        /* Ease in-out */
        var ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        var amt = fromAmt + (toAmt - fromAmt) * ease;
        scramble(amt);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          if (cb) cb();
        }
      }
      requestAnimationFrame(tick);
    }

    /* Cycle: decrypt → hold clear → encrypt → hold scrambled → repeat */
    function cycle() {
      /* Start scrambled, decrypt over 1.2s */
      animate(0.85, 0, 1200, function () {
        el.textContent = original; /* ensure clean */
        /* Hold clear for 5s */
        setTimeout(function () {
          /* Encrypt over 0.8s */
          animate(0, 0.85, 800, function () {
            /* Hold scrambled for 1.5s */
            setTimeout(cycle, 1500);
          });
        }, 5000);
      });
    }

    /* Initial state: scrambled */
    scramble(0.85);
    /* Wait for entrance animation to finish, then start cycle */
    setTimeout(cycle, 1800);
  }

  /* ═══════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════ */

  function init() {
    initEntranceAnimations();
    initParallax();
    initButtonEffects();
    initSecureTextEffect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
