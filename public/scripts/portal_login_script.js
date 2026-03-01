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
});
