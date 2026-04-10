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

    // SEARCH FUNCTIONALITY
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        const searchOverlay = document.createElement('div');
        searchOverlay.className = 'search-overlay';
        searchOverlay.innerHTML = `
            <div class="search-modal">
                <div class="search-header">
                    <input type="text" id="searchInput" placeholder="Search Jobs, Results, Admit Cards..." autofocus>
                    <button class="search-close">×</button>
                </div>
                <div class="search-results" id="searchResults"></div>
            </div>
        `;
        document.body.appendChild(searchOverlay);

        const searchInput = searchOverlay.querySelector('#searchInput');
        const searchResults = searchOverlay.querySelector('#searchResults');
        const searchClose = searchOverlay.querySelector('.search-close');

        let searchIndex = [];

        const getBasePath = () => window.location.pathname.includes('/jobs/') ? '../' : '';

        const loadSearchIndex = async () => {
            try {
                const resp = await fetch(getBasePath() + 'search_index.json');
                searchIndex = await resp.json();
                console.log('Search Index Loaded');
                if(searchInput.value.trim().length < 2) showDefaultSuggestions();
            } catch (e) {
                console.error('Failed to load search index:', e);
            }
        };

        const showDefaultSuggestions = () => {
            if(searchIndex.length === 0) return;
            const defaults = searchIndex.slice(0, 8); // Top 8 items usually Latest/Results
            searchResults.innerHTML = '<div class="search-section-title">🔥 Top Trending Updates</div>' + defaults.map(item => `
                <a href="${getBasePath()}${item.u.replace('../', '')}" class="search-item">
                    <span class="search-item-cat">${item.c}</span>
                    <span class="search-item-title">${item.t}</span>
                </a>
            `).join('');
        };

        searchBtn.addEventListener('click', () => {
            searchOverlay.classList.add('visible');
            searchInput.focus();
            if (searchIndex.length === 0) {
                loadSearchIndex();
            } else {
                if(searchInput.value.trim().length < 2) showDefaultSuggestions();
            }
        });

        const closeSearch = () => {
            searchOverlay.classList.remove('visible');
            searchInput.value = '';
            searchResults.innerHTML = '';
        };

        searchClose.addEventListener('click', closeSearch);
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearch();
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                showDefaultSuggestions();
                return;
            }

            const filtered = searchIndex.filter(item => 
                item.t.toLowerCase().includes(query) || 
                item.c.toLowerCase().includes(query)
            ).slice(0, 15);

            searchResults.innerHTML = '<div class="search-section-title">🔍 Search Results</div>' + filtered.map(item => `
                <a href="${getBasePath()}${item.u.replace('../', '')}" class="search-item">
                    <span class="search-item-cat">${item.c}</span>
                    <span class="search-item-title">${item.t}</span>
                </a>
            `).join('');
        });
    }
});

