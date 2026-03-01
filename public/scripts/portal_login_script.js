/**
 * Webflow Login Integration Script
 * Add this script to the "Before </body> tag" section of the Login page settings in Webflow.
 *
 * Requirements:
 * 1. Email input must have `data-portal="email"`
 * 2. Password input must have `data-portal="password"`
 * 3. Submit button must have `data-portal="submit"`
 * 4. Optional: form wrapper can have `data-portal="login-form"`
 * 5. Optional: error block can have `data-portal="error"`
 */

document.addEventListener('DOMContentLoaded', () => {
    const portalConfig = window.PortalConfig || {};
    const FALLBACK_API_ORIGIN = 'https://nextjs-portal-psi.vercel.app';
    const API_ORIGIN = String(portalConfig.apiOrigin || FALLBACK_API_ORIGIN).replace(/\/$/, '');
    const API_BASE_URL = `${API_ORIGIN}/api`;
    const DASHBOARD_PATH = portalConfig.dashboardPath || '/dashboard';
    const AUTH_TOKEN_KEY = portalConfig.tokenStorageKey || 'dc_portal_token';

    const loginForm = document.querySelector('[data-portal="login-form"]');
    const emailInput = document.querySelector('[data-portal="email"]');
    const passwordInput = document.querySelector('[data-portal="password"]');
    const submitButton = document.querySelector('[data-portal="submit"]');
    const errorBlock = document.querySelector('[data-portal="error"]');
    let originalButtonText = 'Login';
    let isSubmitting = false;

    initLoginVisualEffects();

    if (submitButton) {
        // If button is an input element, save its value, otherwise save textContent
        originalButtonText = submitButton.value || submitButton.textContent || 'Login';
    }

    if (!emailInput || !passwordInput || !submitButton) {
        console.warn('Login inputs not found. Make sure email, password, and submit elements have data-portal attributes.');
        return;
    }

    // Hide error block initially if it exists
    if (errorBlock) {
        errorBlock.style.display = 'none';
    }

    async function handleLogin() {
        if (isSubmitting) return;
        isSubmitting = true;

        if (errorBlock) {
            errorBlock.style.display = 'none';
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Please enter both email and password.');
            isSubmitting = false;
            return;
        }

        setLoadingState(true);
        clearStoredToken();

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            let data;
            try {
                data = await response.json();
            } catch (err) {
                // Not JSON returned
                throw new Error('An unexpected error occurred. Please try again.');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Login failed. Please check your credentials.');
            }

            if (data && typeof data.token === 'string' && data.token) {
                setStoredToken(data.token);
            }

            // Redirect to dashboard page
            window.location.href = DASHBOARD_PATH;

        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'An error occurred during login. Please try again.');
        } finally {
            setLoadingState(false);
            isSubmitting = false;
        }
    }

    // Webflow blocks native form submissions that include password fields.
    // Capture submit early and force JS login flow instead.
    if (loginForm) {
        loginForm.setAttribute('novalidate', 'novalidate');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
            void handleLogin();
        }, true);
    }

    if (submitButton.getAttribute('type') === 'submit') {
        submitButton.setAttribute('type', 'button');
    }

    submitButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        }
        void handleLogin();
    });

    [emailInput, passwordInput].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void handleLogin();
            }
        });
    });

    function setLoadingState(isLoading) {
        if (!submitButton) return;
        
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.7';
            submitButton.style.cursor = 'not-allowed';
            if (submitButton.tagName === 'INPUT') {
                submitButton.value = 'Logging in...';
            } else {
                submitButton.textContent = 'Logging in...';
            }
        } else {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
            if (submitButton.tagName === 'INPUT') {
                submitButton.value = originalButtonText;
            } else {
                submitButton.textContent = originalButtonText;
            }
        }
    }

    function showError(message) {
        if (errorBlock) {
            errorBlock.style.display = 'block';
            const textElement = errorBlock.querySelector('div, span, p') || errorBlock;
            textElement.textContent = message;
        } else {
            alert(message);
        }
    }

    function setStoredToken(token) {
        try {
            window.localStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch (err) {
            console.warn('Could not persist auth token:', err);
        }
    }

    function clearStoredToken() {
        try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch (err) {
            console.warn('Could not clear auth token:', err);
        }
    }

    function initLoginVisualEffects() {
        injectVisualStyles();
        const visualHost = resolveVisualHost();
        if (!visualHost) return;
        if (visualHost.getAttribute('data-portal-visual-enhanced') === 'true') return;
        visualHost.setAttribute('data-portal-visual-enhanced', 'true');

        visualHost.classList.add('portal-login-visual-host');
        visualHost.style.setProperty('--portal-light-x', '52%');
        visualHost.style.setProperty('--portal-light-y', '36%');

        const computed = window.getComputedStyle(visualHost);
        if (computed.position === 'static') {
            visualHost.style.position = 'relative';
        }
        if (computed.overflow === 'visible') {
            visualHost.style.overflow = 'hidden';
        }

        const visualImage = resolveVisualImage(visualHost);
        if (visualImage) {
            visualImage.classList.add('portal-login-visual-image');
        }

        const shader = document.createElement('div');
        shader.className = 'portal-login-visual-shader';
        shader.setAttribute('aria-hidden', 'true');

        const aurora = document.createElement('div');
        aurora.className = 'portal-login-visual-aurora';
        aurora.setAttribute('aria-hidden', 'true');

        const grain = document.createElement('div');
        grain.className = 'portal-login-visual-grain';
        grain.setAttribute('aria-hidden', 'true');

        visualHost.appendChild(shader);
        visualHost.appendChild(aurora);
        visualHost.appendChild(grain);

        let rafId = 0;
        const updateLightPosition = (event) => {
            const rect = visualHost.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            visualHost.style.setProperty('--portal-light-x', `${Math.max(0, Math.min(100, x)).toFixed(2)}%`);
            visualHost.style.setProperty('--portal-light-y', `${Math.max(0, Math.min(100, y)).toFixed(2)}%`);
        };

        visualHost.addEventListener('pointermove', (event) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => updateLightPosition(event));
        });

        visualHost.addEventListener('pointerleave', () => {
            visualHost.style.setProperty('--portal-light-x', '52%');
            visualHost.style.setProperty('--portal-light-y', '36%');
        });
    }

    function resolveVisualHost() {
        const configuredSelector = String(portalConfig.loginVisualSelector || '').trim();
        if (configuredSelector) {
            const configuredElement = document.querySelector(configuredSelector);
            if (configuredElement) return configuredElement;
        }

        const candidateImages = Array.from(document.querySelectorAll('img')).filter((img) => {
            const rect = img.getBoundingClientRect();
            const area = rect.width * rect.height;
            return area > 140000 && rect.right > window.innerWidth * 0.45 && rect.bottom > 0;
        });

        candidateImages.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return (bRect.width * bRect.height) - (aRect.width * aRect.height);
        });

        const winner = candidateImages[0];
        if (!winner) return null;

        let host = winner.parentElement;
        while (host && host !== document.body) {
            const rect = host.getBoundingClientRect();
            if (rect.width >= 320 && rect.height >= 320) break;
            host = host.parentElement;
        }

        return host || winner.parentElement;
    }

    function resolveVisualImage(host) {
        const images = Array.from(host.querySelectorAll('img'));
        if (!images.length) return null;
        images.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            return (bRect.width * bRect.height) - (aRect.width * aRect.height);
        });
        return images[0];
    }

    function injectVisualStyles() {
        if (document.getElementById('portal-login-visual-styles')) return;
        const style = document.createElement('style');
        style.id = 'portal-login-visual-styles';
        style.textContent = `
            .portal-login-visual-host {
                isolation: isolate;
                transform: translateZ(0);
                --portal-light-x: 52%;
                --portal-light-y: 36%;
            }

            .portal-login-visual-host .portal-login-visual-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transform-origin: 50% 50%;
                animation: portalVisualImageDrift 18s ease-in-out infinite alternate;
            }

            .portal-login-visual-shader,
            .portal-login-visual-aurora,
            .portal-login-visual-grain {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .portal-login-visual-shader {
                background:
                    linear-gradient(126deg, rgba(8, 46, 86, 0.38) 0%, rgba(16, 78, 122, 0.14) 38%, rgba(240, 247, 255, 0.06) 64%, rgba(8, 38, 72, 0.3) 100%),
                    radial-gradient(circle at 14% 22%, rgba(255, 255, 255, 0.13), transparent 48%);
                mix-blend-mode: multiply;
                opacity: 0.82;
                animation: portalVisualShaderShift 16s ease-in-out infinite alternate;
            }

            .portal-login-visual-aurora {
                background:
                    radial-gradient(540px 360px at var(--portal-light-x) var(--portal-light-y), rgba(138, 195, 246, 0.28), transparent 65%),
                    radial-gradient(460px 300px at 72% 84%, rgba(255, 255, 255, 0.24), transparent 70%);
                mix-blend-mode: screen;
                filter: blur(2px);
                opacity: 0.7;
                animation: portalVisualAuroraPulse 11s ease-in-out infinite;
            }

            .portal-login-visual-grain {
                background-image:
                    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.11) 0 1px, transparent 1px 4px),
                    radial-gradient(circle at 74% 76%, rgba(7, 31, 59, 0.1) 0 1px, transparent 1px 4px);
                background-size: 170px 170px, 200px 200px;
                mix-blend-mode: soft-light;
                opacity: 0.22;
                animation: portalVisualGrainShift 2.8s steps(10) infinite;
            }

            @keyframes portalVisualImageDrift {
                0% { transform: scale(1.02) translate3d(-0.6%, -0.2%, 0); }
                50% { transform: scale(1.05) translate3d(0.4%, -1.1%, 0); }
                100% { transform: scale(1.03) translate3d(0.9%, 0.4%, 0); }
            }

            @keyframes portalVisualShaderShift {
                0% { transform: translate3d(-1.4%, 0.2%, 0) scale(1.02); opacity: 0.78; }
                100% { transform: translate3d(1.8%, -0.5%, 0) scale(1.05); opacity: 0.9; }
            }

            @keyframes portalVisualAuroraPulse {
                0%, 100% { opacity: 0.56; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.03); }
            }

            @keyframes portalVisualGrainShift {
                0% { transform: translate3d(0, 0, 0); }
                100% { transform: translate3d(3%, -3%, 0); }
            }

            @media (prefers-reduced-motion: reduce) {
                .portal-login-visual-host .portal-login-visual-image,
                .portal-login-visual-shader,
                .portal-login-visual-aurora,
                .portal-login-visual-grain {
                    animation: none !important;
                }
                .portal-login-visual-aurora {
                    opacity: 0.5;
                }
            }
        `;
        document.head.appendChild(style);
    }
});
