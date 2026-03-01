/**
 * Login Page Animations — Dhamma Capital
 * WebGL shader on hero image + form entrance animations + micro-interactions
 *
 * Load in Webflow Page Settings → Before </body> tag (BEFORE the login script):
 *   <script src="<DEPLOY_URL>/scripts/login_animations.js"></script>
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. HERO IMAGE — WebGL liquid distortion + caustic shader
     ═══════════════════════════════════════════════════════ */

  var VERT_SRC = [
    'attribute vec2 a_position;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_position * 0.5 + 0.5;',
    '  v_uv.y = 1.0 - v_uv.y;',
    '  gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG_SRC = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_image;',
    'uniform float u_time;',
    'uniform vec2 u_mouse;',
    'uniform vec2 u_resolution;',
    'uniform float u_loaded;',
    '',
    '/* Simplex-style noise for organic distortion */',
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }',
    '',
    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
    '                     -0.577350269189626, 0.024390243902439);',
    '  vec2 i = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod289(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',
    '',
    '/* Water caustic light bands */',
    'float caustic(vec2 uv, float t) {',
    '  float TAU = 6.28318530718;',
    '  vec2 p = mod(uv * TAU * 2.0, TAU) - 250.0;',
    '  vec2 i = vec2(p);',
    '  float c = 1.0;',
    '  float inten = 0.005;',
    '  for (int n = 0; n < 4; n++) {',
    '    float tn = t * (1.0 - (3.5 / float(n + 1)));',
    '    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));',
    '    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));',
    '  }',
    '  c /= 4.0;',
    '  c = 1.17 - pow(c, 1.4);',
    '  return pow(abs(c), 8.0);',
    '}',
    '',
    'void main() {',
    '  vec2 uv = v_uv;',
    '  float t = u_time * 0.15;',
    '',
    '  /* Subtle wave distortion on the UVs */',
    '  float n1 = snoise(uv * 3.0 + t * 0.4);',
    '  float n2 = snoise(uv * 2.5 - t * 0.3 + 100.0);',
    '  float distortStr = 0.004;',
    '  vec2 distort = vec2(n1, n2) * distortStr;',
    '',
    '  /* Mouse ripple — gentle displacement near cursor */',
    '  vec2 mUV = u_mouse;',
    '  float mDist = length((uv - mUV) * vec2(u_resolution.x / u_resolution.y, 1.0));',
    '  float ripple = smoothstep(0.35, 0.0, mDist);',
    '  float rippleWave = sin(mDist * 25.0 - u_time * 2.5) * 0.003 * ripple;',
    '  distort += vec2(rippleWave);',
    '',
    '  /* Sample the image with distorted UVs */',
    '  vec4 img = texture2D(u_image, uv + distort);',
    '',
    '  /* Caustic light overlay — very subtle */',
    '  float c1 = caustic(uv * 1.5, t * 1.2);',
    '  float c2 = caustic(uv * 1.8 + 0.5, t * 0.9 + 2.0);',
    '  float causticVal = (c1 + c2) * 0.5;',
    '',
    '  /* Brand-tinted caustic light — cool blue-teal */',
    '  vec3 causticColor = vec3(0.35, 0.65, 0.78) * causticVal * 0.12;',
    '',
    '  /* Mouse glow — soft warm highlight near cursor */',
    '  float glow = smoothstep(0.4, 0.0, mDist) * 0.06;',
    '  vec3 glowColor = vec3(0.5, 0.7, 0.85) * glow;',
    '',
    '  /* Color grade — slight deepened shadows + brand tone */',
    '  vec3 color = img.rgb;',
    '  color += causticColor;',
    '  color += glowColor;',
    '',
    '  /* Subtle vignette */',
    '  float vig = 1.0 - smoothstep(0.4, 1.1, length(uv - 0.5) * 1.4);',
    '  color *= mix(1.0, vig, 0.35);',
    '',
    '  /* Dark overlay tint — brand navy */',
    '  color = mix(color, vec3(0.04, 0.085, 0.165), 0.22);',
    '',
    '  /* Fade in */',
    '  gl_FragColor = vec4(color, u_loaded);',
    '}'
  ].join('\n');

  function initShader() {
    var host = document.querySelector('.login-img_wrap');
    var img = document.querySelector('.login-hero_img');
    if (!host || !img) return;

    /* Create canvas */
    var canvas = document.createElement('canvas');
    canvas.id = 'dc-shader';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return; /* WebGL not supported — CSS fallback stays */

    /* Compile shaders */
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('DC Shader compile:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('DC Shader link:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    /* Full-screen quad */
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* Uniforms */
    var uTime = gl.getUniformLocation(prog, 'u_time');
    var uMouse = gl.getUniformLocation(prog, 'u_mouse');
    var uRes = gl.getUniformLocation(prog, 'u_resolution');
    var uImage = gl.getUniformLocation(prog, 'u_image');
    var uLoaded = gl.getUniformLocation(prog, 'u_loaded');

    /* Mouse tracking */
    var mouseX = 0.5, mouseY = 0.5;
    var targetX = 0.5, targetY = 0.5;

    host.addEventListener('mousemove', function (e) {
      var rect = host.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width;
      targetY = (e.clientY - rect.top) / rect.height;
    });

    host.addEventListener('mouseleave', function () {
      targetX = 0.5;
      targetY = 0.5;
    });

    /* Load image as texture — handle cross-origin */
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    /* Placeholder 1x1 pixel while loading */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([10, 22, 42, 255]));

    var loaded = 0;
    var fadeStart = 0;

    function loadTexture() {
      var texImg = new Image();
      texImg.crossOrigin = 'anonymous';
      texImg.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texImg);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        fadeStart = performance.now();
        /* Hide original img once shader takes over */
        img.style.opacity = '0';
      };
      texImg.onerror = function () {
        /* If CORS fails, try without crossOrigin as last resort */
        console.warn('DC Shader: cross-origin image load failed, trying same-origin');
        var retry = new Image();
        retry.onload = function () {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, retry);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          fadeStart = performance.now();
          img.style.opacity = '0';
        };
        /* Pick the best src from srcset or fallback to src */
        retry.src = getBestImageSrc(img);
      };
      texImg.src = getBestImageSrc(img);
    }

    /* Pick highest-res source from srcset or fallback to src */
    function getBestImageSrc(imgEl) {
      if (imgEl.currentSrc) return imgEl.currentSrc;
      var srcset = imgEl.getAttribute('srcset');
      if (srcset) {
        var parts = srcset.split(',');
        var best = '';
        var bestW = 0;
        for (var i = 0; i < parts.length; i++) {
          var pair = parts[i].trim().split(/\s+/);
          var w = parseInt(pair[1]) || 0;
          if (w > bestW) { bestW = w; best = pair[0]; }
        }
        if (best) return best;
      }
      return imgEl.src;
    }

    /* Resize canvas to match container */
    function resize() {
      var rect = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    /* Load image once it's ready */
    if (img.complete && img.naturalWidth > 0) {
      loadTexture();
    } else {
      img.addEventListener('load', loadTexture);
      /* Also try after a short delay in case the image is already cached */
      setTimeout(function () {
        if (img.complete && img.naturalWidth > 0 && !fadeStart) loadTexture();
      }, 500);
    }

    /* Render loop */
    var startTime = performance.now();
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function render() {
      if (reducedMotion) {
        /* Still render one frame to show the image with tint, but no animation */
        gl.uniform1f(uTime, 0);
        gl.uniform2f(uMouse, 0.5, 0.5);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uLoaded, fadeStart ? 1.0 : 0.0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(uImage, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return;
      }

      requestAnimationFrame(render);

      var now = performance.now();
      var t = (now - startTime) / 1000;

      /* Smooth mouse lerp */
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      /* Fade in over 1.5s after texture loads */
      if (fadeStart) {
        loaded = Math.min((now - fadeStart) / 1500, 1.0);
      }

      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uLoaded, loaded);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uImage, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    render();
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
     5. SECURE TEXT — encrypt / decrypt scramble effect
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
    initShader();
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
