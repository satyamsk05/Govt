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
});
