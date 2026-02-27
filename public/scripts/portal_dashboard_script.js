(function() {
  const API_URL = 'https://nextjs-portal-psi.vercel.app/api';
  
  // 1. Session Check
  fetch(API_URL + '/auth/session', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.authenticated) {
        window.location.href = '/app/login';
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
        const typeStr = inv.investor_type === 'domestic' ? 'Domestic Institutional' : 
                       inv.investor_type === 'foreign' ? 'Foreign Institutional' : 
                       'Valued Investor';
        breadcrumbType.textContent = typeStr + ' - Documents';
      }
      
      // Fetch Documents
      loadDocuments();
    })
    .catch(function() {
      window.location.href = '/app/login';
    });
    
  function loadDocuments() {
    fetch(API_URL + '/documents', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.documents) {
          renderDocuments(data.documents);
        }
      })
      .catch(console.error);
  }
  
  function renderDocuments(docs) {
    const grid = document.querySelector('[data-portal="document-grid"]');
    if (!grid) return;
    
    // Find template card
    const firstCard = grid.querySelector('[data-portal="document-item"]');
    if (!firstCard) return;
    
    // Save template
    const template = firstCard.cloneNode(true);
    
    const countBadge = document.querySelector('[data-portal="total-docs"]');
    if (countBadge) countBadge.textContent = docs.length + ' documents';
    
    // Clear grid
    grid.innerHTML = '';
    
    docs.forEach(function(doc) {
      const card = template.cloneNode(true);
      
      // Document Title
      const title = card.querySelector('[data-portal="doc-title"]');
      if (title) title.textContent = doc.title;
      
      // Document metadata
      const fileType = card.querySelector('[data-portal="doc-type"]');
      if (fileType) fileType.textContent = (doc.file_type || 'PDF').toUpperCase();
      
      const fileSize = card.querySelector('[data-portal="doc-size"]');
      if (fileSize) fileSize.textContent = doc.file_size_label || '';
      
      // Document date
      const dateEl = card.querySelector('[data-portal="doc-date"]');
      if (dateEl) {
        const d = new Date(doc.published_date || doc.created_on);
        if (!isNaN(d.getTime())) {
          dateEl.textContent = d.toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
        } else {
          dateEl.textContent = doc.published_date || '';
        }
      }
      
      // Document link
      // Set href on the card itself if it's an anchor, otherwise find inner link
      if (card.tagName === 'A') {
          card.href = doc.file_url || '#';
          card.target = '_blank';
      } else {
          const innerLink = card.querySelector('[data-portal="doc-link"]');
          if (innerLink) {
              innerLink.href = doc.file_url || '#';
              innerLink.target = '_blank';
          }
      }
      
      // Add tracking click event
      card.addEventListener('click', function() {
        fetch(API_URL + '/documents/log-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: doc.id }),
          credentials: 'include'
        });
      });
      
      grid.appendChild(card);
    });
    
    // Setup Search filtering
    const searchInput = document.querySelector('[data-portal="search-input"]');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        const cards = grid.querySelectorAll('[data-portal="document-item"]');
        let count = 0;
        cards.forEach(function(c) {
          const t = c.querySelector('[data-portal="doc-title"]');
          if (t && t.textContent.toLowerCase().includes(term)) {
            c.style.display = '';
            count++;
          } else {
            c.style.display = 'none';
          }
        });
        if (countBadge) countBadge.textContent = count + ' documents';
        
        // Update Empty State for Search Results
        const emptyStates = document.querySelectorAll('[data-portal="empty-state"]');
        emptyStates.forEach(function(el) {
           el.style.display = count === 0 ? '' : 'none';
        });
      });
    }

    // Hide Loading State with smooth fade out
    const loadingStates = document.querySelectorAll('[data-portal="loading-state"]');
    loadingStates.forEach(function(el) {
       el.style.transition = 'opacity 0.6s ease';
       el.style.opacity = '0';
       
       // Remove from DOM after fade out completes
       setTimeout(function() {
         if (el.parentNode) {
           el.parentNode.removeChild(el);
         }
       }, 600);
    });

    // Handle Empty State
    const emptyStates = document.querySelectorAll('[data-portal="empty-state"]');
    emptyStates.forEach(function(el) {
       el.style.display = docs.length === 0 ? '' : 'none';
    });
  }
  
  // Setup Logout button
  const logoutBtns = document.querySelectorAll('[data-portal="logout-button"]');
  logoutBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' })
          .finally(function() {
            window.location.href = '/app/login';
          });
      });
  });
})();

// Force deploy update
