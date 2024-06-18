document.addEventListener("DOMContentLoaded", function() {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const navLeft = document.querySelector('.nav-left');
    const navRight = document.querySelector('.nav-right');

    hamburgerMenu.addEventListener('click', function() {
        navLeft.classList.toggle('active');
        navRight.classList.toggle('active');
    });
});
