// js/nav.js

document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        const icon = navToggle.querySelector('i');

        // Function to close the menu
        const closeMenu = () => {
            navLinks.classList.remove('active');
            navToggle.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        };
        
        // --- FIX STARTS HERE ---
        // Add click listeners to all links inside the nav
        const allLinks = navLinks.querySelectorAll('a');
        allLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });
        // --- FIX ENDS HERE ---

        navToggle.addEventListener('click', () => {
            const isActive = navLinks.classList.toggle('active');
            navToggle.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', isActive);
            
            if (isActive) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
});