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

        const loadSearchIndex = async () => {
            try {
                const resp = await fetch('assets/js/search_index.json');
                searchIndex = await resp.json();
                console.log('Search Index Loaded');
            } catch (e) {
                console.error('Failed to load search index:', e);
            }
        };

        searchBtn.addEventListener('click', () => {
            searchOverlay.classList.add('visible');
            searchInput.focus();
            if (searchIndex.length === 0) loadSearchIndex();
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
                searchResults.innerHTML = '';
                return;
            }

            const filtered = searchIndex.filter(item => 
                item.t.toLowerCase().includes(query) || 
                item.c.toLowerCase().includes(query)
            ).slice(0, 15);

            searchResults.innerHTML = filtered.map(item => `
                <a href="${item.u}" class="search-item">
                    <span class="search-item-cat">${item.c}</span>
                    <span class="search-item-title">${item.t}</span>
                </a>
            `).join('');
        });
    }

    // DARK MODE LOGIC
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');

    // Check for saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        if (themeIcon) themeIcon.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"></path>`;
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            if (themeIcon) {
                themeIcon.innerHTML = isDark 
                    ? `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"></path>` 
                    : `<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`;
            }
        });
    }

    // SHARE LOGIC
    const shareWA = document.getElementById('shareWA');
    const shareTG = document.getElementById('shareTG');
    const shareCopy = document.getElementById('shareCopy');

    if (shareWA) {
        shareWA.addEventListener('click', (e) => {
            e.preventDefault();
            const url = window.location.href;
            const text = document.title;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        });
    }
    if (shareTG) {
        shareTG.addEventListener('click', (e) => {
            e.preventDefault();
            const url = window.location.href;
            const text = document.title;
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
        });
    }
    if (shareCopy) {
        shareCopy.addEventListener('click', (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(window.location.href).then(() => {
                const originalText = shareCopy.innerHTML;
                shareCopy.innerHTML = '✅ Copied!';
                setTimeout(() => { shareCopy.innerHTML = originalText; }, 2000);
            });
        });
    }
});

