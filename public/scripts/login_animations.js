/**
 * Login Page Animations — Dhamma Capital
 * Cinematic image overlays + form entrance animations + micro-interactions
 *
 * Load in Webflow Page Settings → Before </body> tag (BEFORE the login script):
 *   <script src="<DEPLOY_URL>/scripts/login_animations.js"></script>
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. HERO IMAGE — vignette overlay
     CSS handles: Ken Burns, color wash, light leak
     ═══════════════════════════════════════════════════════ */

  function initImageOverlays() {
    var host = document.querySelector('.login-img_wrap');
    if (!host) return;

    /* Vignette div — ::before and ::after already used by CSS overlays */
    var vignette = document.createElement('div');
    vignette.className = 'dc-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    host.appendChild(vignette);
  }

  /* ═══════════════════════════════════════════════════════
     2. FORM ENTRANCE — staggered fade-up for form children
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
     3. FORM CARD PARALLAX — subtle depth on mouse move
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
     4. BUTTON EFFECTS — ripple on click (targets wrapper, not input)
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
     BOOT
     ═══════════════════════════════════════════════════════ */

  function init() {
    initImageOverlays();
    initEntranceAnimations();
    initParallax();
    initButtonEffects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
