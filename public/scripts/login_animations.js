/**
 * Login Page Animations — Dhamma Capital
 * WebGL shader overlay on hero image + form entrance animations + micro-interactions
 *
 * Load in Webflow Page Settings → Before </body> tag (BEFORE the login script):
 *   <script src="<DEPLOY_URL>/scripts/login_animations.js"></script>
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. WebGL SHADER OVERLAY — applied to .login-img_wrap
     ═══════════════════════════════════════════════════════ */

  function initShader() {
    var host = document.querySelector('.login-img_wrap');
    if (!host) return;

    /* Canvas sized to the image container */
    var canvas = document.createElement('canvas');
    canvas.id = 'dc-shader';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    /* CSS fallback for no-WebGL devices */
    if (!gl) {
      host.classList.add('dc-shader-fallback');
      return;
    }

    /* Resize canvas to match container */
    function resize() {
      var rect = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    /* Shader helpers */
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    var VERT = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}';

    var FRAG = [
      'precision mediump float;',
      'uniform float u_t;',
      'uniform vec2 u_res;',
      'uniform vec2 u_mouse;',

      /* Hash noise */
      'vec2 h22(vec2 p){',
      '  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));',
      '  return -1.+2.*fract(sin(p)*43758.5453);',
      '}',
      'float gnoise(vec2 p){',
      '  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
      '  return mix(mix(dot(h22(i),f),dot(h22(i+vec2(1,0)),f-vec2(1,0)),u.x),',
      '             mix(dot(h22(i+vec2(0,1)),f-vec2(0,1)),dot(h22(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);',
      '}',

      /* FBM — 4 octaves for richer detail */
      'float fbm(vec2 p){',
      '  float v=0.,a=.5;',
      '  for(int i=0;i<4;i++){v+=a*gnoise(p);p*=2.1;a*=.48;}',
      '  return v;',
      '}',

      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res;',
      '  float t=u_t*.1;',

      /* Flowing organic warp */
      '  float n1=fbm(uv*3.5+vec2(t*.6,t*.4));',
      '  float n2=fbm(uv*5.+vec2(-t*.3,t*.5));',
      '  float warp=fbm(uv*2.5+n1*.5+vec2(t*.25));',

      /* Mouse interaction — light follows cursor */
      '  vec2 m=u_mouse;',
      '  float mDist=length(uv-m);',
      '  float mGlow=smoothstep(.45,.0,mDist)*.18;',

      /* Caustic / light-through-water bands */
      '  float caustic=abs(gnoise(uv*8.+warp*2.+t*1.5));',
      '  caustic=pow(caustic,2.5)*.35;',

      /* Color palette */
      '  vec3 deepNavy=vec3(.04,.08,.15);',
      '  vec3 navy=vec3(.10,.20,.32);',
      '  vec3 steel=vec3(.19,.33,.48);',
      '  vec3 teal=vec3(.12,.38,.45);',
      '  vec3 gold=vec3(.72,.62,.42);',
      '  vec3 light=vec3(.90,.92,.96);',

      /* Base: deep gradient */
      '  vec3 col=mix(navy,deepNavy,smoothstep(.2,.9,uv.y+warp*.2));',

      /* Steel blue mid-layer */
      '  col=mix(col,steel,smoothstep(.1,.5,n1)*.3);',

      /* Teal flowing accents */
      '  col=mix(col,teal,smoothstep(.2,.65,n2)*.2);',

      /* Caustic light bands — the "wow" effect */
      '  col+=light*caustic*(1.-.4*uv.y);',

      /* Mouse-driven light pool */
      '  col+=mix(steel,light,.5)*mGlow;',

      /* Subtle warm edge highlights */
      '  float edge=smoothstep(.35,.5,abs(gnoise(uv*15.+t*3.)));',
      '  col+=gold*edge*.04;',

      /* Top-edge light bleed for depth */
      '  col=mix(col,light,smoothstep(.15,.0,uv.y)*.12);',

      /* Vignette */
      '  float vig=1.-length((uv-.5)*vec2(.8,1.))*.6;',
      '  col*=smoothstep(0.,.6,vig);',

      '  gl_FragColor=vec4(col,1.);',
      '}',
    ].join('\n');

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    /* Full-screen quad */
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(prog, 'u_t');
    var uRes = gl.getUniformLocation(prog, 'u_res');
    var uMouse = gl.getUniformLocation(prog, 'u_mouse');
    var mouse = [0.5, 0.5];

    /* Track mouse position relative to canvas */
    host.addEventListener('mousemove', function (e) {
      var rect = host.getBoundingClientRect();
      mouse[0] = (e.clientX - rect.left) / rect.width;
      mouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
    });
    host.addEventListener('mouseleave', function () {
      mouse[0] = 0.5;
      mouse[1] = 0.5;
    });

    /* Render loop */
    var raf;
    function draw(now) {
      gl.uniform1f(uTime, now * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    /* Pause when tab hidden for perf */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(draw);
    });
  }

  /* ═══════════════════════════════════════════════════════
     2. FORM ENTRANCE — staggered fade-up for form children
     ═══════════════════════════════════════════════════════ */

  function initEntranceAnimations() {
    /* Animate form inner elements */
    var form = document.querySelector('.uui-contact01_form');
    if (!form) return;

    var children = form.children;
    for (var i = 0; i < children.length; i++) {
      children[i].style.setProperty('--dc-i', i);
    }

    /* Also set stagger on the secure wrap below the form */
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
     4. INPUT FOCUS — animated underline + glow
     ═══════════════════════════════════════════════════════ */

  function initInputEffects() {
    var fields = document.querySelectorAll('.formfieldwrapper');
    fields.forEach(function (wrapper) {
      var input = wrapper.querySelector('.w-input');
      if (!input) return;

      /* Add a pseudo-element container for the animated underline */
      var line = document.createElement('div');
      line.className = 'dc-focus-line';
      wrapper.appendChild(line);

      input.addEventListener('focus', function () {
        wrapper.classList.add('dc-field-focused');
      });
      input.addEventListener('blur', function () {
        wrapper.classList.remove('dc-field-focused');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     5. BUTTON EFFECTS — ripple on click
     ═══════════════════════════════════════════════════════ */

  function initButtonEffects() {
    var btn = document.querySelector('[data-portal="submit"]');
    if (!btn) return;

    /* input[type="submit"] can't have children — target wrapper instead */
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
     6. FLOATING PARTICLES — ambient dots in the image area
     ═══════════════════════════════════════════════════════ */

  function initParticles() {
    var host = document.querySelector('.login-img_wrap');
    if (!host || window.matchMedia('(max-width: 767px)').matches) return;

    var particleContainer = document.createElement('div');
    particleContainer.className = 'dc-particles';
    host.appendChild(particleContainer);

    for (var i = 0; i < 18; i++) {
      var p = document.createElement('div');
      p.className = 'dc-particle';
      p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      p.style.setProperty('--y', (Math.random() * 100).toFixed(1) + '%');
      p.style.setProperty('--d', (3 + Math.random() * 6).toFixed(1) + 's');
      p.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
      p.style.setProperty('--delay', (Math.random() * 5).toFixed(1) + 's');
      particleContainer.appendChild(p);
    }
  }

  /* ═══════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════ */

  function init() {
    initShader();
    initParticles();
    initEntranceAnimations();
    initParallax();
    initInputEffects();
    initButtonEffects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
