(function() {
  const portalConfig = window.PortalConfig || {};
  const FALLBACK_API_ORIGIN = 'https://nextjs-portal-psi.vercel.app';
  const API_ORIGIN = String(portalConfig.apiOrigin || FALLBACK_API_ORIGIN).replace(/\/$/, '');
  const API_URL = API_ORIGIN + '/api';
  const LOGIN_PATH = portalConfig.loginPath || '/login';
  const AUTH_TOKEN_KEY = portalConfig.tokenStorageKey || 'dc_portal_token';
  const LAST_SEEN_KEY = portalConfig.lastSeenStorageKey || 'dc_portal_last_seen_at';
  const gridContainer = document.querySelector('[data-portal="document-grid"]');
  const listContainer = document.querySelector('[data-portal="document-vertical-list"]');
  const searchInput = document.querySelector('[data-portal="search-input"]');
  const countBadge = document.querySelector('[data-portal="total-docs"]');
  const emptyStates = document.querySelectorAll('[data-portal="empty-state"]');
  const loadingStates = document.querySelectorAll('[data-portal="loading-state"]');
  const layoutButtons = document.querySelectorAll('[data-layout="grid"], [data-layout="flex"]');
  let allDocuments = [];
  let currentSearchTerm = '';
  let currentVisibleCount = 0;
  let currentSortOrder = 'newest';
  let currentReportFilter = 'all';
  let customDateStart = '';
  let customDateEnd = '';
  let searchClearButton = null;
  let sortSelect = null;
  let sortDropdown = null;
  let sortOptionLinks = [];
  let reportFilterButtons = [];
  let customDateControls = null;
  let customDateStartInput = null;
  let customDateEndInput = null;
  let customDateApplyButton = null;
  let customDateRangeInput = null;
  let customDateOpenButton = null;
  let customDateOpenButtons = [];
  let customDatePicker = null;
  let customDatePickerReady = false;
  let customDateHostIsGenerated = false;
  let mobileDateStartPicker = null;
  let mobileDateEndPicker = null;
  let mobilePendingDateStart = '';
  let filtersResetButton = null;
  let activeLayout = 'grid';
  let loadingStateHandled = false;
  let lastSeenAt = getLastSeenAt();

  function getStoredToken() {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  function clearStoredToken() {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (err) {
      console.warn('Could not clear auth token:', err);
    }
  }

  function getLastSeenAt() {
    try {
      const raw = window.localStorage.getItem(LAST_SEEN_KEY);
      const ts = raw ? Number(raw) : 0;
      return Number.isFinite(ts) && ts > 0 ? ts : 0;
    } catch {
      return 0;
    }
  }

  function setLastSeenAt(ts) {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, String(ts || Date.now()));
    } catch (err) {
      console.warn('Could not persist last seen timestamp:', err);
    }
  }

  function authFetch(url, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || undefined);
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', 'Bearer ' + token);
    }

    return fetch(url, Object.assign({}, opts, {
      headers,
      credentials: opts.credentials || 'include'
    }));
  }

  function redirectToLogin(clearToken) {
    if (clearToken) {
      clearStoredToken();
    }
    window.location.href = LOGIN_PATH;
  }
  
  // 1. Session Check
  authFetch(API_URL + '/auth/session')
    .then(function(r) {
      if (r.status === 401) {
        redirectToLogin(true);
        return null;
      }
      return r.json();
    })
    .then(function(data) {
      if (!data) return;
      if (!data.authenticated) {
        redirectToLogin(true);
        return;
      }
      
      const inv = data.investor;
      
      // Update User Name (Header profile & Welcome heading)
      const userNames = document.querySelectorAll('[data-portal="user-name"], [data-portal="investor-name"]');
      userNames.forEach(function(el) {
        if (el.children.length === 0 || el.tagName === 'SPAN') {
            el.textContent = inv.name || 'Investor';
        } else {
            el.innerHTML = 'Welcome, <span>' + (inv.name || 'Investor') + '</span>';
        }
      });
      
      // Update Breadcrumb profile type
      const breadcrumbType = document.querySelector('[data-portal="investor-type-breadcrumb"]');
      if (breadcrumbType) {
        const typeStr = inv.investor_type === 'dii' ? 'Domestic Institutional' : 
                       inv.investor_type === 'fii' ? 'Foreign Institutional' : 
                       'Valued Investor';
        breadcrumbType.textContent = typeStr + ' - Documents';
      }

      setupLayoutSwitcher();
      setupSearch();
      setupFilters();
      setupLastSeenTracking();
      
      // Fetch Documents
      loadDocuments();
    })
    .catch(function(err) {
      console.error('Session check failed:', err);
      redirectToLogin(false);
    });
    
  function loadDocuments() {
    authFetch(API_URL + '/documents')
      .then(function(r) {
        if (r.status === 401) {
          redirectToLogin(true);
          return null;
        }
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        if (data.documents) {
          allDocuments = Array.isArray(data.documents) ? data.documents : [];
          applyFiltersAndRender();
        }
      })
      .catch(function(err) {
        console.error('Documents fetch failed:', err);
      });
  }
  
  function applyFiltersAndRender() {
    const term = currentSearchTerm.trim().toLowerCase();
    const range = getCustomDateRangeState();
    const filtered = allDocuments
      .filter(function(doc) {
        const matchesSearch = !term || (
          String(doc.title || '').toLowerCase().includes(term) ||
          String(doc.category || '').toLowerCase().includes(term) ||
          String(doc.file_type || '').toLowerCase().includes(term)
        );
        if (!matchesSearch) return false;

        if (!matchesReportFilter(doc)) return false;
        if (range.hasActiveRange && !matchesDateRange(doc, range.startTs, range.endTs)) return false;

        return true;
      })
      .sort(function(a, b) {
        if (currentSortOrder === 'titleasc') {
          return String(a.title || '').localeCompare(String(b.title || ''));
        }
        if (currentSortOrder === 'titledesc') {
          return String(b.title || '').localeCompare(String(a.title || ''));
        }
        const dateDiff = getDocumentTimestamp(a) - getDocumentTimestamp(b);
        return currentSortOrder === 'oldest' ? dateDiff : -dateDiff;
      });

    currentVisibleCount = filtered.length;
    renderDocuments(filtered);
    updateSearchClearButtonState();
    updateFilterSummary(range);
    updateAppliedStateIndicators(range, filtered.length);
  }

  function renderDocuments(docs) {
    renderDocumentsIntoContainer(gridContainer, docs);
    renderDocumentsIntoContainer(listContainer, docs);
    updateCountBadge(docs.length);
    updateEmptyState(docs.length);
    updateLayoutVisibility();
    hideLoadingStates();
  }

  function renderDocumentsIntoContainer(container, docs) {
    if (!container) return;
    const template = getContainerTemplate(container);
    if (!template) return;

    container.innerHTML = '';
    docs.forEach(function(doc) {
      const card = template.cloneNode(true);
      applyDocumentDataToCard(card, doc);
      container.appendChild(card);
    });
  }

  function getContainerTemplate(container) {
    if (!container) return null;
    if (container.__portalTemplate) return container.__portalTemplate;

    const firstCard = container.querySelector('[data-portal="document-item"]');
    if (!firstCard) return null;

    container.__portalTemplate = firstCard.cloneNode(true);
    return container.__portalTemplate;
  }

  function applyDocumentDataToCard(card, doc) {
    const title = card.querySelector('[data-portal="doc-title"]');
    if (title) title.textContent = doc.title || 'Untitled';

    const fileType = card.querySelector('[data-portal="doc-type"]');
    if (fileType) fileType.textContent = String(doc.file_type || 'PDF').toUpperCase();

    const fileSize = card.querySelector('[data-portal="doc-size"]');
    if (fileSize) {
      fileSize.textContent = doc.file_size_label || '';
    }

    const dateEl = card.querySelector('[data-portal="doc-date"]');
    if (dateEl) {
      const d = new Date(doc.published_date || doc.created_on);
      if (!isNaN(d.getTime())) {
        dateEl.textContent = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      } else {
        dateEl.textContent = doc.published_date || '';
      }
    }

    const fileUrlParam = encodeURIComponent(doc.file_url || '');
    const titleParam = encodeURIComponent(doc.title || 'Document');
    const downloadUrl = fileUrlParam
      ? (API_URL + '/proxy/file?url=' + fileUrlParam + '&action=download&filename=' + titleParam)
      : '#';
    const viewUrl = fileUrlParam
      ? (API_URL + '/proxy/file?url=' + fileUrlParam + '&action=view&filename=' + titleParam)
      : '#';

    const newMarkers = card.querySelectorAll('[data-portal="document-item-new-marker"]');
    const showNew = isDocumentNew(doc);
    newMarkers.forEach(function(marker) {
      marker.style.display = showNew ? '' : 'none';
    });

    if (card.tagName === 'A') {
      card.href = downloadUrl;
      card.removeAttribute('target');
    } else {
      const innerLink = card.querySelector('[data-portal="doc-link"]');
      if (innerLink && innerLink.tagName === 'A') {
        innerLink.href = downloadUrl;
        innerLink.removeAttribute('target');
      }
    }

    const viewButton = card.querySelector('[data-portal="doc-view-button"]');
    if (viewButton) {
      viewButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (viewUrl === '#') return;
        void openDocumentViewer(viewUrl, doc.title || 'Document');
      });
    }

    card.addEventListener('click', function(e) {
      const clickedViewButton = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-portal="doc-view-button"]')
        : null;
      if (clickedViewButton) {
        return;
      }

      const isCardAnchor = card.tagName === 'A';
      const clickedLink = e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
      const isLinkClick = isCardAnchor || Boolean(clickedLink);
      const hasToken = Boolean(getStoredToken());

      if (isLinkClick && hasToken && downloadUrl !== '#') {
        e.preventDefault();
        void logDocumentAccess(doc.id);
        void downloadWithAuthToken(downloadUrl, doc.title || 'Document');
        return;
      }

      if (isLinkClick) {
        void logDocumentAccess(doc.id);
      }
    });
  }

  function updateCountBadge(count) {
    if (countBadge) {
      countBadge.textContent = count + ' documents';
    }
  }

  function updateEmptyState(count) {
    emptyStates.forEach(function(el) {
      el.style.display = count === 0 ? '' : 'none';
    });
  }

  function hideLoadingStates() {
    if (loadingStateHandled) return;
    loadingStateHandled = true;

    loadingStates.forEach(function(el) {
      el.style.transition = 'opacity 0.6s ease';
      el.style.opacity = '0';
      setTimeout(function() {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 600);
    });
  }

  function setupLayoutSwitcher() {
    activeLayout = getInitialLayout();
    layoutButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        setActiveLayout(btn.getAttribute('data-layout'));
      });
    });
    setActiveLayout(activeLayout);
  }

  function getInitialLayout() {
    const activeBtn = document.querySelector('[data-layout].is-active');
    if (activeBtn) {
      const preferred = activeBtn.getAttribute('data-layout');
      if (preferred === 'flex' || preferred === 'grid') return preferred;
    }
    return 'grid';
  }

  function setActiveLayout(layout) {
    activeLayout = layout === 'flex' ? 'flex' : 'grid';
    layoutButtons.forEach(function(btn) {
      const isActive = btn.getAttribute('data-layout') === activeLayout;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    updateLayoutVisibility();
  }

  function updateLayoutVisibility() {
    const hasDocs = currentVisibleCount > 0;
    const useGrid = activeLayout === 'grid' || !listContainer;
    const useList = activeLayout === 'flex' && !!listContainer;

    if (gridContainer) {
      gridContainer.style.display = hasDocs && useGrid ? '' : 'none';
    }
    if (listContainer) {
      listContainer.style.display = hasDocs && useList ? '' : 'none';
    }
  }

  function setupSearch() {
    if (!searchInput) return;
    searchClearButton = getSearchClearButton();
    updateSearchClearButtonState();

    searchInput.addEventListener('input', function(e) {
      currentSearchTerm = e.target.value || '';
      applyFiltersAndRender();
    });

    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      if (e.key === 'Escape' && searchInput.value) {
        e.preventDefault();
        searchInput.value = '';
        currentSearchTerm = '';
        applyFiltersAndRender();
      }
    });

    if (searchClearButton) {
      searchClearButton.addEventListener('click', function(e) {
        e.preventDefault();
        searchInput.value = '';
        currentSearchTerm = '';
        applyFiltersAndRender();
        searchInput.focus();
      });
    }
  }

  function setupFilters() {
    ensureFiltersUI();

    sortSelect = document.querySelector('select[data-portal="sort-select"], input[data-portal="sort-select"]');
    sortDropdown = document.querySelector('[data-portal="sort-select"]:not(select):not(input):not(textarea)');
    sortOptionLinks = getSortOptionLinks();
    reportFilterButtons = getReportFilterButtons();
    customDateControls = document.querySelector('[data-portal="custom-date-controls"]');
    customDateHostIsGenerated = customDateControls ? customDateControls.getAttribute('data-portal-generated-host') === 'true' : false;
    customDateStartInput = document.querySelector('[data-portal="custom-date-start"]');
    customDateEndInput = document.querySelector('[data-portal="custom-date-end"]');
    customDateApplyButton = document.querySelector('[data-portal="custom-date-apply"]');
    customDateRangeInput = document.querySelector('[data-portal="custom-date-range"]');
    customDateOpenButtons = getCustomDateOpenButtons();
    customDateOpenButton = customDateOpenButtons.length ? customDateOpenButtons[0] : null;
    filtersResetButton = document.querySelector('[data-portal="filters-reset"]');
    setupEmbeddedDateRangePicker();

    if (sortSelect) {
      currentSortOrder = normalizeSortOrder(sortSelect.value);
      sortSelect.addEventListener('change', function() {
        setSortOrder(sortSelect.value, null, false);
      });
    } else if (sortDropdown) {
      const activeSortOption = sortOptionLinks.find(function(link) {
        return link.classList.contains('is-active') || link.classList.contains('w--current');
      });
      const initialValue = sortDropdown.getAttribute('data-sort-value') || (activeSortOption ? getSortOptionValue(activeSortOption) : '');
      currentSortOrder = normalizeSortOrder(initialValue);
    }

    if (sortOptionLinks.length) {
      sortOptionLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          setSortOrder(getSortOptionValue(link), link, true);
        });
      });
    }
    syncSortUI();

    if (reportFilterButtons.length) {
      const activeButton = reportFilterButtons.find(function(btn) {
        return btn.classList.contains('is-active');
      });
      currentReportFilter = normalizeReportFilter(activeButton ? activeButton.getAttribute('data-filter-value') : 'all');

      reportFilterButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const value = normalizeReportFilter(btn.getAttribute('data-filter-value'));
          if (btn.getAttribute('data-filter-value') === 'custom') {
            openCustomDatePicker();
            return;
          }
          setReportFilter(value);
        });
      });

      syncReportFilterButtons();
    }

    if (customDateStartInput) {
      customDateStart = String(customDateStartInput.value || '').trim();
    }
    if (customDateEndInput) {
      customDateEnd = String(customDateEndInput.value || '').trim();
    }

    if (customDateApplyButton) {
      customDateApplyButton.addEventListener('click', function(e) {
        e.preventDefault();
        customDateStart = customDateStartInput ? String(customDateStartInput.value || '').trim() : '';
        customDateEnd = customDateEndInput ? String(customDateEndInput.value || '').trim() : '';
        applyFiltersAndRender();
      });
    }

    [customDateStartInput, customDateEndInput].forEach(function(input) {
      if (!input) return;
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          customDateStart = customDateStartInput ? String(customDateStartInput.value || '').trim() : '';
          customDateEnd = customDateEndInput ? String(customDateEndInput.value || '').trim() : '';
          applyFiltersAndRender();
        }
      });
      input.addEventListener('input', function() {
        updateCustomDateApplyState();
      });
    });

    if (customDateRangeInput) {
      customDateRangeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && customDateApplyButton && !customDateApplyButton.disabled) {
          e.preventDefault();
          customDateApplyButton.click();
        }
      });
    }

    customDateOpenButtons.forEach(function(button) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        openCustomDatePicker();
      });
    });

    if (filtersResetButton) {
      filtersResetButton.addEventListener('click', function(e) {
        e.preventDefault();
        resetFilters();
      });
    }

    updateCustomDateControlsVisibility();
    syncDatePickerTriggerState();
    updateCustomDateApplyState();
  }

  function ensureFiltersUI() {
    const hasExistingControls =
      document.querySelector('[data-portal="sort-select"]') ||
      document.querySelector('[data-portal="report-filter"]');
    if (hasExistingControls) return;

    const mountPoint = getFiltersMountPoint();
    if (!mountPoint || !mountPoint.parentNode) return;

    const filters = document.createElement('section');
    filters.setAttribute('data-portal', 'dashboard-filters');
    filters.style.display = 'grid';
    filters.style.gap = '12px';
    filters.style.margin = '16px 0 20px';
    filters.style.padding = '14px';
    filters.style.border = '1px solid rgba(16, 40, 70, 0.12)';
    filters.style.borderRadius = '16px';
    filters.style.background = 'rgba(255, 255, 255, 0.8)';
    filters.style.backdropFilter = 'blur(6px)';
    filters.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#17365d;font-weight:600;">' +
      '<span>Sort By</span>' +
      '<select data-portal="sort-select" style="border:1px solid rgba(16,40,70,0.22);border-radius:10px;padding:8px 10px;background:#fff;color:#17365d;">' +
      '<option value="newest">Descending (Latest First)</option>' +
      '<option value="oldest">Ascending (Earliest First)</option>' +
      '<option value="titleasc">Name: A to Z</option>' +
      '<option value="titledesc">Name: Z to A</option>' +
      '</select>' +
      '</label>' +
      '<button type="button" data-portal="filters-reset" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Reset</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button type="button" class="is-active" data-portal="report-filter" data-filter-value="all" aria-pressed="true" style="border:1px solid rgba(16,40,70,0.18);background:#17365d;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">All</button>' +
      '<button type="button" data-portal="report-filter" data-filter-value="monthly" aria-pressed="false" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Monthly Reports</button>' +
      '<button type="button" data-portal="report-filter" data-filter-value="quarterly" aria-pressed="false" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Quarterly Reports</button>' +
      '<button type="button" data-portal="report-filter" data-filter-value="yearly" aria-pressed="false" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Yearly / Annual Reports</button>' +
      '<button type="button" data-portal="report-filter" data-filter-value="custom" aria-pressed="false" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Custom Date Range</button>' +
      '</div>' +
      '<div data-portal="custom-date-controls" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<button type="button" data-portal="custom-date-open" style="border:1px solid rgba(16,40,70,0.18);background:#fff;color:#17365d;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Select Date Range</button>' +
      '<input type="text" data-portal="custom-date-range" readonly aria-label="Custom date range" placeholder="Select date range" style="border:1px solid rgba(16,40,70,0.22);border-radius:10px;padding:8px 10px;background:#fff;color:#17365d;min-width:220px;">' +
      '<input type="date" data-portal="custom-date-start" aria-label="Custom start date" style="border:1px solid rgba(16,40,70,0.22);border-radius:10px;padding:8px 10px;background:#fff;color:#17365d;">' +
      '<input type="date" data-portal="custom-date-end" aria-label="Custom end date" style="border:1px solid rgba(16,40,70,0.22);border-radius:10px;padding:8px 10px;background:#fff;color:#17365d;">' +
      '<button type="button" data-portal="custom-date-apply" style="border:1px solid rgba(16,40,70,0.18);background:#17365d;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;cursor:pointer;">Apply Range</button>' +
      '</div>' +
      '<div data-portal="filter-summary" style="font-size:12px;color:#39597f;"></div>';

    mountPoint.parentNode.insertBefore(filters, mountPoint.nextSibling);
  }

  function getFiltersMountPoint() {
    if (searchInput && searchInput.parentElement) return searchInput.parentElement;
    if (gridContainer && gridContainer.parentElement) return gridContainer.parentElement;
    if (listContainer && listContainer.parentElement) return listContainer.parentElement;
    return null;
  }

  function normalizeSortOrder(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'oldest' || normalized === 'titleasc' || normalized === 'titledesc') {
      return normalized;
    }
    return 'newest';
  }

  function setSortOrder(value, selectedOptionElement, shouldCloseDropdown) {
    currentSortOrder = normalizeSortOrder(value);
    syncSortUI(selectedOptionElement);
    if (shouldCloseDropdown) {
      closeSortDropdown();
    }
    applyFiltersAndRender();
  }

  function syncSortUI(selectedOptionElement) {
    if (sortSelect) {
      sortSelect.value = currentSortOrder;
    }
    if (sortDropdown) {
      sortDropdown.setAttribute('data-sort-value', currentSortOrder);
      updateSortDropdownLabel(selectedOptionElement);
    }
    syncSortAppliedState();
    if (!sortOptionLinks.length) return;

    sortOptionLinks.forEach(function(link) {
      const value = getSortOptionValue(link);
      const isActive = value === currentSortOrder;
      link.classList.toggle('is-active', isActive);
      link.classList.toggle('is-selected', isActive);
      link.classList.toggle('w--current', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
      link.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function syncSortAppliedState() {
    const isActive = currentSortOrder !== 'newest';

    if (sortSelect) {
      sortSelect.classList.toggle('is-active', isActive);
      sortSelect.setAttribute('data-sort-active', isActive ? 'true' : 'false');
    }

    if (!sortDropdown) return;

    const toggle = getSortDropdownToggle();
    sortDropdown.classList.toggle('is-active', isActive);
    sortDropdown.setAttribute('data-sort-active', isActive ? 'true' : 'false');

    if (toggle) {
      toggle.classList.toggle('is-active', isActive);
      toggle.setAttribute('data-sort-active', isActive ? 'true' : 'false');
      toggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  function updateSortDropdownLabel(selectedOptionElement) {
    if (!sortDropdown) return;
    const labelEl = getSortDropdownLabelElement();
    if (!labelEl) return;

    let label = '';
    if (selectedOptionElement) {
      label = String(selectedOptionElement.textContent || '').trim();
    }
    if (!label) {
      const activeOption = sortOptionLinks.find(function(link) {
        return getSortOptionValue(link) === currentSortOrder;
      });
      if (activeOption) {
        label = String(activeOption.textContent || '').trim();
      }
    }
    if (!label) {
      label = getSortLabelByValue(currentSortOrder);
    }

    if (!labelEl.getAttribute('data-default-sort-label')) {
      labelEl.setAttribute('data-default-sort-label', String(labelEl.textContent || '').trim() || 'Sort by');
    }
    labelEl.textContent = label || labelEl.getAttribute('data-default-sort-label') || 'Sort by';
  }

  function getSortDropdownLabelElement() {
    if (!sortDropdown) return null;

    const toggle = sortDropdown.querySelector('.w-dropdown-toggle') || sortDropdown;
    const explicit = toggle.querySelector('[data-portal="sort-label"]');
    if (explicit) return explicit;

    const directChildren = Array.prototype.slice.call(toggle.children || []);
    const firstTextChild = directChildren.find(function(child) {
      return child && child.children && child.children.length === 0 && String(child.textContent || '').trim().length > 0;
    });
    if (firstTextChild) return firstTextChild;

    return toggle;
  }

  function getSortLabelByValue(value) {
    if (value === 'oldest') return 'Oldest';
    if (value === 'titleasc') return 'Name: A to Z';
    if (value === 'titledesc') return 'Name: Z to A';
    return 'Newest';
  }

  function closeSortDropdown() {
    if (!sortDropdown) return;
    const container = sortDropdown.classList.contains('w-dropdown')
      ? sortDropdown
      : sortDropdown.closest('.w-dropdown') || sortDropdown;
    const toggle = getSortDropdownToggle();
    const list = container.querySelector('.w-dropdown-list');
    const isOpen = container.classList.contains('w--open') ||
      (toggle && toggle.getAttribute('aria-expanded') === 'true') ||
      (list && list.classList.contains('w--open'));

    // Prefer an outside click so Webflow closes via native handler.
    if (isOpen && document.body) {
      window.setTimeout(function() {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }, 0);
      return;
    }

    // Fallback: click the toggle if outside click does not apply.
    if (isOpen && toggle && typeof toggle.click === 'function') {
      window.setTimeout(function() {
        toggle.click();
      }, 0);
      return;
    }

    // Fallback for non-Webflow dropdown markup.
    container.classList.remove('w--open');
    if (toggle) {
      toggle.classList.remove('w--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    if (list) {
      list.classList.remove('w--open');
    }
  }

  function getSortDropdownToggle() {
    const sortControl = document.querySelector('[data-portal="sort-select"]:not(select):not(input):not(textarea)');
    if (!sortControl) return null;
    const customToggle = sortControl.querySelector('.dropdown1_toggle');
    if (customToggle) {
      return customToggle;
    }
    if (sortControl.classList.contains('w-dropdown-toggle')) {
      return sortControl;
    }
    return sortControl.querySelector('.w-dropdown-toggle');
  }

  function getSortOptionLinks() {
    const explicitOptions = Array.prototype.slice.call(document.querySelectorAll('[data-portal="sort-option"]'))
      .filter(function(link) {
        return Boolean(getSortOptionValue(link));
      });
    if (explicitOptions.length) {
      return explicitOptions;
    }
    if (!sortDropdown) {
      return [];
    }

    const fallbackOptions = Array.prototype.slice.call(
      sortDropdown.querySelectorAll('[data-sort-value], .w-dropdown-list a, .w-dropdown-list button, [role="menu"] a, [role="menu"] button')
    ).filter(function(link) {
      return Boolean(getSortOptionValue(link));
    });

    return fallbackOptions;
  }

  function getSortOptionValue(optionElement) {
    if (!optionElement) return '';

    const rawValue = String(
      optionElement.getAttribute('data-sort-value') ||
      optionElement.getAttribute('value') ||
      ''
    ).toLowerCase().trim();

    if (rawValue === 'newest' || rawValue === 'oldest' || rawValue === 'titleasc' || rawValue === 'titledesc') {
      return rawValue;
    }

    const text = String(optionElement.textContent || '').toLowerCase().trim();
    if (!text) return '';
    if (text.includes('oldest') || text.includes('earliest')) return 'oldest';
    if (text.includes('newest') || text.includes('latest')) return 'newest';
    if (text.includes('a to z') || text.includes('a-z')) return 'titleasc';
    if (text.includes('z to a') || text.includes('z-a')) return 'titledesc';
    if (text.includes('name') && text.includes('asc')) return 'titleasc';
    if (text.includes('name') && text.includes('desc')) return 'titledesc';

    return '';
  }

  function getReportFilterButtons() {
    const candidates = Array.prototype.slice.call(
      document.querySelectorAll('[data-portal="report-filter"], .dashboard-search_bottom-wrap .filter-button')
    );
    const seen = new Set();
    const controls = [];

    candidates.forEach(function(node) {
      if (isDatePickerTriggerNode(node)) return;

      const control = resolveReportFilterControl(node);
      if (!control || seen.has(control)) return;
      if (isDatePickerTriggerNode(control)) return;

      const hasExplicitFilter = control.getAttribute('data-portal') === 'report-filter' || node.getAttribute('data-portal') === 'report-filter';
      const inferredValue = inferReportFilterValue(control) || inferReportFilterValue(node);
      const explicitValue = control.getAttribute('data-filter-value') || node.getAttribute('data-filter-value') || '';
      if (!hasExplicitFilter && !explicitValue && !inferredValue) {
        return;
      }

      const normalizedValue = normalizeReportFilter(
        explicitValue || inferredValue
      );

      control.setAttribute('data-portal', 'report-filter');
      control.setAttribute('data-filter-value', normalizedValue);

      if (!control.hasAttribute('aria-pressed')) {
        const isActive = control.classList.contains('is-active') || normalizedValue === 'all';
        control.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }

      // Keep attributes on the clickable parent control to avoid mis-binding on nested text wrappers.
      if (node !== control && node.getAttribute('data-portal') === 'report-filter') {
        node.removeAttribute('data-portal');
        node.removeAttribute('data-filter-value');
        node.removeAttribute('aria-pressed');
      }

      seen.add(control);
      controls.push(control);
    });

    return controls;
  }

  function isDatePickerTriggerNode(node) {
    if (!node || !node.tagName) return false;
    if (node.getAttribute('data-open-date-picker') === 'true') return true;
    if (node.getAttribute('data-portal') === 'custom-date-open') return true;
    if (node.getAttribute('data-portal') === 'date-range-label' || node.hasAttribute('data-date-range-label')) return true;
    if (node.querySelector && node.querySelector('[data-portal="date-range-label"], [data-date-range-label]')) return true;
    return false;
  }

  function getCustomDateOpenButtons() {
    const candidates = Array.prototype.slice.call(
      document.querySelectorAll('[data-portal="custom-date-open"], [data-open-date-picker="true"]')
    );
    const seen = new Set();
    const controls = [];

    candidates.forEach(function(node) {
      const control = resolveReportFilterControl(node) || node;
      if (!control || seen.has(control)) return;
      seen.add(control);
      controls.push(control);
    });

    return controls;
  }

  function resolveReportFilterControl(node) {
    if (!node || !node.tagName) return null;

    const tag = node.tagName.toLowerCase();
    const isClickable = tag === 'a' || tag === 'button';
    if (isClickable && (node.classList.contains('filter-button') || node.getAttribute('data-portal') === 'report-filter')) {
      return node;
    }

    const closestClickable = node.closest('a,button');
    if (closestClickable && (closestClickable.classList.contains('filter-button') || closestClickable.getAttribute('data-portal') === 'report-filter')) {
      return closestClickable;
    }

    return null;
  }

  function inferReportFilterValue(node) {
    if (!node) return '';

    const raw = String(node.textContent || '').toLowerCase();
    if (raw.includes('monthly')) return 'monthly';
    if (raw.includes('quarterly') || /\bq[1-4]\b/.test(raw)) return 'quarterly';
    if (raw.includes('yearly') || raw.includes('annual')) return 'yearly';
    if (raw.includes('custom')) return 'custom';
    if (raw.includes('all')) return 'all';

    return '';
  }

  function normalizeReportFilter(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'monthly' || normalized === 'quarterly' || normalized === 'yearly') {
      return normalized;
    }
    return 'all';
  }

  function setReportFilter(value) {
    currentReportFilter = normalizeReportFilter(value);
    syncReportFilterButtons();
    updateCustomDateControlsVisibility();
    applyFiltersAndRender();
  }

  function syncReportFilterButtons() {
    reportFilterButtons.forEach(function(btn) {
      const value = normalizeReportFilter(btn.getAttribute('data-filter-value'));
      const isActive = value === currentReportFilter;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateCustomDateControlsVisibility() {
    if (!customDateControls) return;
    customDateControls.style.display = 'none';
  }

  function setupEmbeddedDateRangePicker() {
    ensureDatePickerHostContainer();
    ensureCustomDateControlsWiring();
    ensureMobileDatePickers();
    updateCustomDateApplyState();
    updateDatePickerTriggerText();
    if (customDatePickerReady) return;

    loadLitepickerAssets()
      .then(function() {
        if (!window.Litepicker || !customDateRangeInput) return;
        if (customDatePicker) return;

        const pickerAnchor = getDatePickerAnchorElement();
        const isCompactViewport = isMobileViewport();
        customDatePicker = new window.Litepicker({
          element: pickerAnchor,
          singleMode: false,
          autoApply: true,
          numberOfMonths: isCompactViewport ? 1 : 2,
          numberOfColumns: isCompactViewport ? 1 : 2,
          format: 'YYYY-MM-DD',
          setup: function(picker) {
            picker.on('selected', function(startDate, endDate) {
              const start = startDate && typeof startDate.format === 'function' ? startDate.format('YYYY-MM-DD') : '';
              const end = endDate && typeof endDate.format === 'function' ? endDate.format('YYYY-MM-DD') : '';
              setCustomDateRangeValues(start, end, true, true);
            });

            picker.on('clear:selection', function() {
              setCustomDateRangeValues('', '', false, true);
            });
          }
        });

        customDatePickerReady = true;
        if (customDateStart || customDateEnd) {
          syncRangeInputFromDates();
        }
      })
      .catch(function(err) {
        console.warn('Litepicker initialization failed:', err);
      });
  }

  function ensureDatePickerHostContainer() {
    if (customDateControls) return;

    customDateControls = document.createElement('div');
    customDateControls.setAttribute('data-portal-generated-host', 'true');
    customDateControls.style.display = 'none';
    customDateControls.style.position = 'fixed';
    customDateControls.style.width = '1px';
    customDateControls.style.height = '1px';
    customDateControls.style.overflow = 'hidden';
    customDateControls.style.opacity = '0';
    customDateControls.style.pointerEvents = 'none';
    document.body.appendChild(customDateControls);
    customDateHostIsGenerated = true;
  }

  function ensureCustomDateControlsWiring() {
    if (!customDateControls) return;
    if (!customDateOpenButton) {
      customDateOpenButton = customDateControls.querySelector('[data-portal="custom-date-open"]');
    }

    if (!customDateRangeInput) {
      customDateRangeInput = document.createElement('input');
      customDateRangeInput.type = 'text';
      customDateRangeInput.readOnly = true;
      customDateRangeInput.placeholder = 'Select date range';
      customDateRangeInput.setAttribute('aria-label', 'Custom date range');
      customDateRangeInput.setAttribute('data-portal', 'custom-date-range');
      customDateRangeInput.style.border = '1px solid rgba(16,40,70,0.22)';
      customDateRangeInput.style.borderRadius = '10px';
      customDateRangeInput.style.padding = '8px 10px';
      customDateRangeInput.style.background = '#fff';
      customDateRangeInput.style.color = '#17365d';
      customDateRangeInput.style.minWidth = '220px';
      customDateControls.insertBefore(customDateRangeInput, customDateControls.firstChild);
    }

    if (customDateOpenButtons.length) {
      anchorRangeInputToTrigger(customDateOpenButtons[0]);
    } else if (customDateHostIsGenerated) {
      customDateRangeInput.style.position = 'absolute';
      customDateRangeInput.style.left = '-9999px';
      customDateRangeInput.style.top = '0';
      customDateRangeInput.style.width = '1px';
      customDateRangeInput.style.height = '1px';
      customDateRangeInput.style.padding = '0';
      customDateRangeInput.style.border = '0';
      customDateRangeInput.style.opacity = '0';
      customDateRangeInput.style.pointerEvents = 'none';
    }

    if (customDateStartInput) {
      customDateStartInput.type = 'hidden';
    } else {
      customDateStartInput = document.createElement('input');
      customDateStartInput.type = 'hidden';
      customDateStartInput.setAttribute('data-portal', 'custom-date-start');
      customDateControls.appendChild(customDateStartInput);
    }

    if (customDateEndInput) {
      customDateEndInput.type = 'hidden';
    } else {
      customDateEndInput = document.createElement('input');
      customDateEndInput.type = 'hidden';
      customDateEndInput.setAttribute('data-portal', 'custom-date-end');
      customDateControls.appendChild(customDateEndInput);
    }
  }

  function setCustomDateRangeValues(start, end, syncInputText, shouldApply) {
    if (customDateStartInput) customDateStartInput.value = start || '';
    if (customDateEndInput) customDateEndInput.value = end || '';
    customDateStart = start || '';
    customDateEnd = end || '';
    if (syncInputText) {
      syncRangeInputFromDates();
    }
    updateDatePickerTriggerText();
    syncDatePickerTriggerState();
    updateCustomDateApplyState();
    if (shouldApply) {
      applyFiltersAndRender();
    }
  }

  function syncRangeInputFromDates() {
    if (!customDateRangeInput) return;
    if (customDateStart && customDateEnd) {
      customDateRangeInput.value = customDateStart + ' to ' + customDateEnd;
      return;
    }
    if (customDateStart) {
      customDateRangeInput.value = customDateStart + ' to';
      return;
    }
    if (customDateEnd) {
      customDateRangeInput.value = 'to ' + customDateEnd;
      return;
    }
    customDateRangeInput.value = '';
  }

  function openCustomDatePicker() {
    if (customDatePicker && typeof customDatePicker.show === 'function') {
      customDatePicker.show();
      return;
    }
    if (!customDateRangeInput) return;
    customDateRangeInput.focus();
    customDateRangeInput.click();
  }

  function getDatePickerAnchorElement() {
    if (customDateOpenButtons.length) {
      return customDateOpenButtons[0];
    }
    return customDateRangeInput;
  }

  function isMobileViewport() {
    if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) return true;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 991) return true;
    return false;
  }

  function ensureMobileDatePickers() {
    if (!document.body) return;

    if (!mobileDateStartPicker) {
      mobileDateStartPicker = document.createElement('input');
      mobileDateStartPicker.type = 'date';
      mobileDateStartPicker.setAttribute('data-portal', 'mobile-date-start-picker');
      setupHiddenMobilePickerStyles(mobileDateStartPicker);
      mobileDateStartPicker.addEventListener('change', function() {
        mobilePendingDateStart = String(mobileDateStartPicker.value || '').trim();
        if (mobileDateEndPicker) {
          mobileDateEndPicker.min = mobilePendingDateStart || '';
          if (mobilePendingDateStart && mobileDateEndPicker.value && mobileDateEndPicker.value < mobilePendingDateStart) {
            mobileDateEndPicker.value = mobilePendingDateStart;
          }
          openNativeDateInput(mobileDateEndPicker);
        }
      });
      document.body.appendChild(mobileDateStartPicker);
    }

    if (!mobileDateEndPicker) {
      mobileDateEndPicker = document.createElement('input');
      mobileDateEndPicker.type = 'date';
      mobileDateEndPicker.setAttribute('data-portal', 'mobile-date-end-picker');
      setupHiddenMobilePickerStyles(mobileDateEndPicker);
      mobileDateEndPicker.addEventListener('change', function() {
        const start = String(mobilePendingDateStart || customDateStart || '').trim();
        const end = String(mobileDateEndPicker.value || '').trim();
        if (!start && !end) return;
        setCustomDateRangeValues(start, end, true, true);
      });
      document.body.appendChild(mobileDateEndPicker);
    }
  }

  function setupHiddenMobilePickerStyles(input) {
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
  }

  function openMobileDateRangePicker() {
    ensureMobileDatePickers();
    if (!mobileDateStartPicker || !mobileDateEndPicker) return;

    mobilePendingDateStart = String(customDateStart || '').trim();
    mobileDateStartPicker.value = String(customDateStart || '').trim();
    mobileDateEndPicker.value = String(customDateEnd || '').trim();
    mobileDateEndPicker.min = mobileDateStartPicker.value || '';

    openNativeDateInput(mobileDateStartPicker);
  }

  function openNativeDateInput(input) {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  }

  function anchorRangeInputToTrigger(trigger) {
    if (!trigger || !customDateRangeInput) return;

    const triggerStyle = window.getComputedStyle(trigger);
    if (triggerStyle.position === 'static') {
      trigger.style.position = 'relative';
    }

    if (customDateRangeInput.parentElement !== trigger) {
      trigger.appendChild(customDateRangeInput);
    }

    customDateRangeInput.style.position = 'absolute';
    customDateRangeInput.style.left = '0';
    customDateRangeInput.style.top = '0';
    customDateRangeInput.style.width = '100%';
    customDateRangeInput.style.height = '100%';
    customDateRangeInput.style.minWidth = '0';
    customDateRangeInput.style.padding = '0';
    customDateRangeInput.style.border = '0';
    customDateRangeInput.style.opacity = '0';
    customDateRangeInput.style.pointerEvents = 'none';
  }

  function updateDatePickerTriggerText() {
    if (!customDateOpenButtons.length) return;

    const label = (customDateStart && customDateEnd)
      ? formatDateLabel(customDateStart) + ' - ' + formatDateLabel(customDateEnd)
      : '';

    customDateOpenButtons.forEach(function(btn) {
      const target = getDateRangeLabelTarget(btn);
      if (!target) return;

      if (!target.getAttribute('data-default-date-label')) {
        target.setAttribute('data-default-date-label', String(target.textContent || '').trim() || 'Date Range');
      }

      target.textContent = label || target.getAttribute('data-default-date-label') || 'Date Range';
    });
  }

  function syncDatePickerTriggerState() {
    if (!customDateOpenButtons.length) return;
    const hasActiveRange = Boolean(String(customDateStart || '').trim() || String(customDateEnd || '').trim());

    customDateOpenButtons.forEach(function(btn) {
      btn.classList.toggle('is-active', hasActiveRange);
      btn.setAttribute('aria-pressed', hasActiveRange ? 'true' : 'false');
      btn.setAttribute('data-date-range-active', hasActiveRange ? 'true' : 'false');
    });
  }

  function formatDateLabel(value) {
    const date = new Date(String(value) + 'T00:00:00');
    if (!Number.isFinite(date.getTime())) return String(value || '');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getDateRangeLabelTarget(button) {
    if (!button) return null;
    if (button.getAttribute('data-portal') === 'date-range-label' || button.hasAttribute('data-date-range-label')) {
      return button;
    }
    return button.querySelector('[data-portal="date-range-label"], [data-date-range-label]');
  }

  function updateCustomDateApplyState() {
    if (!customDateApplyButton) return;
    const start = customDateStartInput ? String(customDateStartInput.value || '').trim() : '';
    const end = customDateEndInput ? String(customDateEndInput.value || '').trim() : '';
    customDateApplyButton.disabled = !(start && end);
    customDateApplyButton.style.opacity = customDateApplyButton.disabled ? '0.55' : '1';
    customDateApplyButton.style.cursor = customDateApplyButton.disabled ? 'not-allowed' : 'pointer';
  }

  function loadLitepickerAssets() {
    const stylePromise = ensureStylesheet(
      'portal-litepicker-css',
      'https://cdn.jsdelivr.net/npm/litepicker/dist/css/litepicker.css'
    );

    if (window.Litepicker) {
      return stylePromise;
    }

    const scriptPromise = ensureScript(
      'portal-litepicker-js',
      'https://cdn.jsdelivr.net/npm/litepicker/dist/litepicker.js'
    );

    return Promise.all([stylePromise, scriptPromise]).then(function() {
      return undefined;
    });
  }

  function ensureStylesheet(id, href) {
    return new Promise(function(resolve, reject) {
      const existing = document.getElementById(id);
      if (existing) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = function() { resolve(); };
      link.onerror = function() { reject(new Error('Failed to load stylesheet: ' + href)); };
      document.head.appendChild(link);
    });
  }

  function ensureScript(id, src) {
    return new Promise(function(resolve, reject) {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', function onLoad() {
          existing.setAttribute('data-loaded', 'true');
          resolve();
        }, { once: true });
        existing.addEventListener('error', function onErr() {
          reject(new Error('Failed to load script: ' + src));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = function() {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = function() {
        reject(new Error('Failed to load script: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function getCustomDateRangeState() {
    const start = String(customDateStart || '').trim();
    const end = String(customDateEnd || '').trim();
    return {
      startTs: getDateBoundaryTimestamp(start, false),
      endTs: getDateBoundaryTimestamp(end, true),
      hasActiveRange: Boolean(start || end),
    };
  }

  function getDateBoundaryTimestamp(raw, isEndOfDay) {
    const value = String(raw || '').trim();
    if (!value) return 0;
    const date = new Date(value + (isEndOfDay ? 'T23:59:59.999' : 'T00:00:00.000'));
    const ts = date.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  function matchesDateRange(doc, startTs, endTs) {
    const docTs = getDocumentTimestamp(doc);
    if (!docTs) return false;
    if (startTs && docTs < startTs) return false;
    if (endTs && docTs > endTs) return false;
    return true;
  }

  function matchesReportFilter(doc) {
    if (currentReportFilter === 'all') return true;

    const title = String(doc.title || '').toLowerCase();
    const category = String(doc.category || '').toLowerCase();

    if (currentReportFilter === 'monthly') {
      return category.includes('monthly') || title.includes('monthly');
    }

    if (currentReportFilter === 'quarterly') {
      return category.includes('quarter') ||
        title.includes('quarter') ||
        /\bq[1-4]\b/.test(title) ||
        /\bq[1-4]\b/.test(category);
    }

    if (currentReportFilter === 'yearly') {
      return category.includes('yearly') ||
        category.includes('annual') ||
        title.includes('yearly') ||
        title.includes('annual');
    }

    return true;
  }

  function updateFilterSummary(range) {
    const summary = document.querySelector('[data-portal="filter-summary"]');
    if (!summary) return;

    const reportLabel = currentReportFilter === 'all'
      ? 'All reports'
      : currentReportFilter === 'monthly'
        ? 'Monthly reports'
        : currentReportFilter === 'quarterly'
          ? 'Quarterly reports'
          : currentReportFilter === 'yearly'
            ? 'Yearly / annual reports'
            : 'Custom date range';

    const sortLabel = currentSortOrder === 'oldest'
      ? 'Earliest first'
      : currentSortOrder === 'titleasc'
        ? 'Name A-Z'
        : currentSortOrder === 'titledesc'
          ? 'Name Z-A'
          : 'Latest first';
    const rangeLabel = currentReportFilter !== 'custom'
      ? (range.hasActiveRange
        ? ' | Range: ' +
        (range.startTs ? new Date(range.startTs).toLocaleDateString('en-US') : 'Any') +
        ' to ' +
        (range.endTs ? new Date(range.endTs).toLocaleDateString('en-US') : 'Any')
        : '')
      : ' | Range: ' +
        (range.startTs ? new Date(range.startTs).toLocaleDateString('en-US') : 'Any') +
        ' to ' +
        (range.endTs ? new Date(range.endTs).toLocaleDateString('en-US') : 'Any');

    summary.textContent = reportLabel + ' | ' + sortLabel + rangeLabel;
  }

  function hasAppliedFiltersOrSort(range) {
    const hasSearch = Boolean(String(currentSearchTerm || '').trim());
    const hasReportFilter = currentReportFilter !== 'all';
    const hasSort = currentSortOrder !== 'newest';
    const hasRange = Boolean(range && range.hasActiveRange);
    return hasSearch || hasReportFilter || hasSort || hasRange;
  }

  function updateAppliedStateIndicators(range, visibleCount) {
    const hasApplied = hasAppliedFiltersOrSort(range);

    if (document.body) {
      document.body.setAttribute('data-portal-filters-applied', hasApplied ? 'true' : 'false');
    }

    const filtersContainer = document.querySelector('[data-portal="dashboard-filters"]');
    if (filtersContainer) {
      filtersContainer.classList.toggle('is-active', hasApplied);
      filtersContainer.setAttribute('data-filters-applied', hasApplied ? 'true' : 'false');
    }

    const indicators = document.querySelectorAll('[data-portal="filters-applied-indicator"]');
    indicators.forEach(function(node) {
      node.classList.toggle('is-active', hasApplied);
      node.setAttribute('data-filters-applied', hasApplied ? 'true' : 'false');
      node.style.display = hasApplied ? '' : 'none';

      if (!node.getAttribute('data-default-indicator-label')) {
        node.setAttribute('data-default-indicator-label', String(node.textContent || '').trim());
      }

      if (hasApplied) {
        const label = visibleCount === 1 ? '1 result' : String(visibleCount) + ' results';
        node.textContent = label + ' matching active filters/sort';
      } else {
        node.textContent = node.getAttribute('data-default-indicator-label') || '';
      }
    });
  }

  function resetFilters() {
    currentSortOrder = 'newest';
    currentReportFilter = 'all';
    customDateStart = '';
    customDateEnd = '';

    syncSortUI();
    if (customDateStartInput) {
      customDateStartInput.value = '';
    }
    if (customDateEndInput) {
      customDateEndInput.value = '';
    }
    if (customDateRangeInput) {
      customDateRangeInput.value = '';
    }
    if (mobileDateStartPicker) {
      mobileDateStartPicker.value = '';
    }
    if (mobileDateEndPicker) {
      mobileDateEndPicker.value = '';
      mobileDateEndPicker.min = '';
    }
    mobilePendingDateStart = '';
    if (customDatePicker && typeof customDatePicker.clearSelection === 'function') {
      customDatePicker.clearSelection();
    }
    updateDatePickerTriggerText();
    syncDatePickerTriggerState();

    syncReportFilterButtons();
    updateCustomDateControlsVisibility();
    updateCustomDateApplyState();
    applyFiltersAndRender();
  }

  function getSearchClearButton() {
    const existingButton = document.querySelector('[data-portal="search-clear"]');
    if (existingButton) return existingButton;
    if (!searchInput || !searchInput.parentElement) return null;

    const wrapper = searchInput.parentElement;
    const wrapperStyle = window.getComputedStyle(wrapper);
    if (wrapperStyle.position === 'static') {
      wrapper.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Clear search');
    btn.setAttribute('data-portal', 'search-clear');
    btn.textContent = '×';
    btn.style.position = 'absolute';
    btn.style.top = '50%';
    btn.style.right = '12px';
    btn.style.transform = 'translateY(-50%)';
    btn.style.border = '0';
    btn.style.background = 'transparent';
    btn.style.color = 'currentColor';
    btn.style.cursor = 'pointer';
    btn.style.padding = '0 4px';
    btn.style.fontSize = '18px';
    btn.style.lineHeight = '1';
    btn.style.opacity = '0.75';
    btn.style.display = 'none';
    btn.style.zIndex = '2';
    searchInput.style.paddingRight = '36px';
    wrapper.appendChild(btn);
    return btn;
  }

  function updateSearchClearButtonState() {
    if (!searchClearButton) return;
    const hasValue = Boolean(currentSearchTerm && currentSearchTerm.trim());
    searchClearButton.style.display = hasValue ? '' : 'none';
  }

  function isDocumentNew(doc) {
    const docTs = getDocumentTimestamp(doc);
    if (!docTs) return false;
    if (!lastSeenAt) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - docTs <= sevenDaysMs;
    }
    return docTs > lastSeenAt;
  }

  function getDocumentTimestamp(doc) {
    const raw = doc && (doc.published_date || doc.created_on);
    if (!raw) return 0;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  function setupLastSeenTracking() {
    const update = function() {
      const now = Date.now();
      setLastSeenAt(now);
      lastSeenAt = now;
    };

    window.addEventListener('beforeunload', update);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        update();
      }
    });
  }

  function openDocumentViewer(viewUrl, title) {
    const modal = ensureViewerModal();
    const frame = modal.querySelector('[data-portal="doc-view-frame"]');
    const titleEl = modal.querySelector('[data-portal="doc-view-title"]');
    if (!frame) return Promise.resolve();

    if (titleEl) {
      titleEl.textContent = title || 'Document Preview';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    frame.src = '';

    if (getStoredToken()) {
      return authFetch(viewUrl)
        .then(function(res) {
          if (res.status === 401) {
            redirectToLogin(true);
            return null;
          }
          if (!res.ok) {
            throw new Error('Preview failed with status ' + res.status);
          }
          return res.blob();
        })
        .then(function(blob) {
          if (!blob) return;
          const blobUrl = URL.createObjectURL(blob);
          frame.src = blobUrl;
          modal.__blobUrl = blobUrl;
        })
        .catch(function(err) {
          console.error('Preview error:', err);
          closeViewerModal();
        });
    }

    frame.src = viewUrl;
    return Promise.resolve();
  }

  function ensureViewerModal() {
    let modal = document.querySelector('[data-portal="doc-view-modal"]');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.setAttribute('data-portal', 'doc-view-modal');
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '9999';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(8, 18, 36, 0.45)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.innerHTML =
      '<div data-portal="doc-view-shell" style="width:min(960px,92vw);height:min(85vh,820px);background:#f9fbff;border:1px solid rgba(255,255,255,0.35);border-radius:28px;box-shadow:0 30px 80px rgba(8,18,36,0.35);overflow:hidden;display:flex;flex-direction:column;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(16,40,70,0.12);background:linear-gradient(180deg,#ffffff,#f2f6ff);">' +
      '<div data-portal="doc-view-title" style="font-size:15px;font-weight:600;color:#17365d;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Document Preview</div>' +
      '<button type="button" data-portal="doc-view-close" aria-label="Close preview" style="border:0;background:#eaf0fb;color:#17365d;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:18px;line-height:1;">×</button>' +
      '</div>' +
      '<iframe data-portal="doc-view-frame" title="Document preview" style="border:0;width:100%;height:100%;background:#fff;"></iframe>' +
      '</div>';

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeViewerModal();
      }
    });

    const closeBtn = modal.querySelector('[data-portal="doc-view-close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeViewerModal();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeViewerModal();
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function closeViewerModal() {
    const modal = document.querySelector('[data-portal="doc-view-modal"]');
    if (!modal) return;

    const frame = modal.querySelector('[data-portal="doc-view-frame"]');
    if (frame) frame.src = '';

    if (modal.__blobUrl) {
      URL.revokeObjectURL(modal.__blobUrl);
      modal.__blobUrl = '';
    }

    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function logDocumentAccess(documentId) {
    return authFetch(API_URL + '/documents/log-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: documentId })
    });
  }

  function downloadWithAuthToken(downloadUrl, fallbackName) {
    return authFetch(downloadUrl)
      .then(function(res) {
        if (res.status === 401) {
          redirectToLogin(true);
          return null;
        }
        if (!res.ok) {
          throw new Error('Download failed with status ' + res.status);
        }
        const disposition = res.headers.get('content-disposition') || '';
        const fileName = extractFileName(disposition) || fallbackName || 'document';
        return res.blob().then(function(blob) {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 1000);
        });
      })
      .catch(function(err) {
        console.error('Download error:', err);
      });
  }

  function extractFileName(disposition) {
    if (!disposition) return '';
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
    return plainMatch && plainMatch[1] ? plainMatch[1] : '';
  }
  
  // Setup Logout button
  const logoutBtns = document.querySelectorAll('[data-portal="logout-button"]');
  logoutBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        authFetch(API_URL + '/auth/logout', { method: 'POST' })
          .finally(function() {
            redirectToLogin(true);
          });
      });
  });
})();
