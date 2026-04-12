/* Rojgar.site - Shared JavaScript */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Rojgar.site Refined Code Loaded Successfully');

    // UNIFIED HEADER: Sticky Behavior
    const header = document.querySelector('.main-header');
    const scrollThreshold = 40;

    window.addEventListener('scroll', () => {
        if (window.scrollY > scrollThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // UNIFIED HEADER: Mobile Menu Toggle
    const mobileToggle = document.querySelector('.mobile-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileClose = document.querySelector('.mobile-close');

    if (mobileToggle && mobileNav) {
        mobileToggle.addEventListener('click', () => {
            mobileNav.classList.add('open');
            document.body.style.overflow = 'hidden'; // Prevent scroll
        });

        const closeMenu = () => {
            mobileNav.classList.remove('open');
            document.body.style.overflow = ''; // Restore scroll
        };

        if (mobileClose) mobileClose.addEventListener('click', closeMenu);
        mobileNav.addEventListener('click', (e) => {
            if (e.target === mobileNav) closeMenu();
        });
    }

    // Handle Active Link in Nav
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const allLinks = document.querySelectorAll('.nav-links a, .m-nav-links a');

    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // SEARCH & RELATED JOBS LOGIC
    const searchBtn = document.querySelector('.search-btn');
    const isInJobs = window.location.pathname.includes('/jobs/');
    const basePath = isInJobs ? '../../' : '';

    if (searchBtn) {
        const searchOverlay = document.createElement('div');
        searchOverlay.className = 'search-overlay';
        searchOverlay.innerHTML = `
            <div class="search-modal">
                <div class="search-header">
                    <input type="text" id="searchInput" placeholder="Search Jobs, Results, Admit Cards..." autofocus>
                    <button class="search-close">&times;</button>
                </div>
                <div class="search-results" id="searchResults"></div>
            </div>
        `;
        document.body.appendChild(searchOverlay);

        const searchInput = searchOverlay.querySelector('#searchInput');
        const searchResults = searchOverlay.querySelector('#searchResults');
        const searchClose = searchOverlay.querySelector('.search-close');

        let searchIndex = [];

        const loadSearchIndex = async () => {
            try {
                // Try search_index.json first as it is optimized
                const resp = await fetch(basePath + 'search_index.json');
                if (!resp.ok) throw new Error('Search index not found');
                searchIndex = await resp.json();
                console.log('Search Index Loaded');
                if(searchInput.value.trim().length < 2) showDefaultSuggestions();
            } catch (e) {
                console.error('Search Load Error:', e);
            }
        };

        const showDefaultSuggestions = () => {
            if(searchIndex.length === 0) return;
            const defaults = searchIndex.slice(0, 8);
            searchResults.innerHTML = '<div class="search-section-title">🔥 Latest & Trending</div>' + defaults.map(item => `
                <a href="${basePath}${item.u}" class="search-item">
                    <span class="search-item-cat">${item.c}</span>
                    <span class="search-item-title">${item.t}</span>
                </a>
            `).join('');
        };

        searchBtn.addEventListener('click', () => {
            searchOverlay.classList.add('visible');
            searchInput.focus();
            if (searchIndex.length === 0) loadSearchIndex();
            else if(searchInput.value.trim().length < 2) showDefaultSuggestions();
        });

        const closeSearch = () => {
            searchOverlay.classList.remove('visible');
            searchInput.value = '';
        };

        searchClose.addEventListener('click', closeSearch);
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearch();
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length < 2) {
                showDefaultSuggestions();
                return;
            }

            const filtered = searchIndex.filter(item => 
                item.t.toLowerCase().includes(query) || 
                item.c.toLowerCase().includes(query)
            ).slice(0, 15);

            searchResults.innerHTML = '<div class="search-section-title">🔍 Search Results</div>' + (filtered.length ? filtered.map(item => `
                <a href="${basePath}${item.u}" class="search-item">
                    <span class="search-item-cat">${item.c}</span>
                    <span class="search-item-title">${item.t}</span>
                </a>
            `).join('') : '<div style="padding:24px; text-align:center; color:#888;">No results found for your search.</div>');
        });
    }

    // RELATED JOBS INJECTION (Only on Job Detail Pages)
    const relatedContainer = document.getElementById('related-jobs-container');
    if (relatedContainer && isInJobs) {
        const loadRelated = async () => {
            try {
                const resp = await fetch(basePath + 'search_index.json');
                const data = await resp.json();
                
                // Get current category from breadcrumb or URL
                const currentCat = document.querySelector('.breadcrumb-item:nth-child(2) a')?.textContent || '';
                
                // Filter by same category, excluding current page
                const currentUrl = window.location.pathname.split('/').slice(-2).join('/');
                const related = data
                    .filter(item => (currentCat && item.c === currentCat) || !currentCat)
                    .filter(item => !window.location.pathname.includes(item.u))
                    .sort(() => 0.5 - Math.random()) // Shuffle
                    .slice(0, 3);

                if (related.length) {
                    relatedContainer.innerHTML = related.map(item => `
                        <a href="${basePath}${item.u}" class="related-card">
                            <span class="rel-cat">${item.c}</span>
                            <span class="rel-title">${item.t}</span>
                        </a>
                    `).join('');
                } else {
                    relatedContainer.parentElement.style.display = 'none';
                }
            } catch (e) {
                console.error('Related Jobs Error:', e);
                relatedContainer.parentElement.style.display = 'none';
            }
        };
        loadRelated();
    }

    // BACK TO TOP
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) backToTop.classList.add('visible');
            else backToTop.classList.remove('visible');
        });
        backToTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
});

// GLOBAL UTILS
function copyPageUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.share-copy');
        if (!btn) return;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}
