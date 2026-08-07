(function () {
    'use strict';

    var body = document.body;
    var header = document.querySelector('.site-header');
    var main = document.querySelector('main');
    var footer = document.querySelector('.site-footer');
    var callFab = document.querySelector('.call-fab');

    function syncHeaderOffset() {
        if (header) {
            document.documentElement.style.setProperty('--header-h', header.getBoundingClientRect().height + 'px');
        }
    }

    function setInert(elements, state) {
        elements.forEach(function (element) {
            if (!element) return;
            if (state) element.setAttribute('inert', '');
            else element.removeAttribute('inert');
        });
    }

    syncHeaderOffset();
    window.addEventListener('resize', syncHeaderOffset);

    var toggle = document.querySelector('.nav-toggle');
    var menu = document.querySelector('.nav-menu');
    var overlay = document.querySelector('.nav-overlay');
    var navBackground = [main, footer, callFab];
    var navLastFocused = null;

    if (toggle && menu) {
        if (!menu.id) menu.id = 'primary-menu';
        toggle.setAttribute('aria-controls', menu.id);

        function navFocusable() {
            return [toggle].concat(Array.prototype.slice.call(menu.querySelectorAll('a[href]')));
        }

        function openNav() {
            navLastFocused = document.activeElement;
            body.classList.add('nav-open');
            toggle.setAttribute('aria-expanded', 'true');
            setInert(navBackground, true);
            var firstLink = menu.querySelector('a[href]');
            if (firstLink) firstLink.focus();
        }

        function closeNav(restoreFocus) {
            body.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            setInert(navBackground, false);
            if (restoreFocus && navLastFocused && typeof navLastFocused.focus === 'function') {
                navLastFocused.focus();
            }
        }

        toggle.addEventListener('click', function () {
            if (body.classList.contains('nav-open')) closeNav(true);
            else openNav();
        });

        if (overlay) overlay.addEventListener('click', function () { closeNav(true); });
        menu.querySelectorAll('a[href]').forEach(function (link) {
            link.addEventListener('click', function () { closeNav(false); });
        });

        document.addEventListener('keydown', function (event) {
            if (!body.classList.contains('nav-open')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                closeNav(true);
                return;
            }
            if (event.key !== 'Tab') return;
            var items = navFocusable();
            var first = items[0];
            var last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 1180 && body.classList.contains('nav-open')) closeNav(false);
        });
    }

    function normalizedPath(value) {
        try {
            var path = new URL(value, window.location.href).pathname;
            return path
                .replace(/\/index(?:\.html)?$/, '/')
                .replace(/\.html$/, '')
                .replace(/\/$/, '') || '/';
        } catch (error) {
            return '';
        }
    }

    if (menu) {
        var currentPath = normalizedPath(window.location.href);
        var currentLink = null;
        menu.querySelectorAll('a[aria-current="page"]').forEach(function (link) {
            link.removeAttribute('aria-current');
        });
        menu.querySelectorAll('a[href]').forEach(function (link) {
            if (normalizedPath(link.href) === currentPath) {
                link.setAttribute('aria-current', 'page');
                currentLink = link;
            }
        });
        if (currentLink && currentLink.closest('.dropdown')) {
            var currentSection = currentLink.closest('.has-dropdown');
            if (currentSection) currentSection.classList.add('current-section');
        }
    }

    document.querySelectorAll('[data-before-after]').forEach(function (comparison) {
        var range = comparison.querySelector('.before-after-range');
        if (!range) return;
        function updateComparison() {
            comparison.style.setProperty('--position', range.value + '%');
        }
        range.addEventListener('input', updateComparison);
        range.addEventListener('change', updateComparison);
        updateComparison();
    });

    document.querySelectorAll('[data-youtube-video]').forEach(function (player) {
        var button = player.querySelector('.service-video-poster');
        var videoId = player.getAttribute('data-youtube-video');
        if (!button || !videoId) return;

        function loadEmbeddedVideo() {
            var iframe = document.createElement('iframe');
            var canSendOrigin = /^https?:$/.test(window.location.protocol) && window.location.origin;
            var origin = canSendOrigin ? '&origin=' + encodeURIComponent(window.location.origin) : '';
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0&playsinline=1' + origin;
            iframe.title = button.getAttribute('aria-label') || 'YouTube video';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.allowFullscreen = true;
            player.replaceChildren(iframe);
            iframe.focus();
        }

        button.addEventListener('click', function () {
            if (window.location.protocol === 'file:') {
                var fileName = window.location.pathname.split('/').pop();
                var localPreview = new URL('http://127.0.0.1:8000/services/' + encodeURIComponent(fileName));
                localPreview.searchParams.set('playVideo', videoId);
                if (player.id) localPreview.hash = player.id;
                window.location.assign(localPreview.toString());
                return;
            }

            loadEmbeddedVideo();
        }, { once: true });

        var requestedVideo = new URLSearchParams(window.location.search).get('playVideo');
        if (/^https?:$/.test(window.location.protocol) && requestedVideo === videoId) {
            loadEmbeddedVideo();
            window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        }
    });

    var lightbox = document.getElementById('lightbox');
    var tiles = Array.prototype.slice.call(document.querySelectorAll('.photo-strip figure')).filter(function (tile) {
        return !tile.querySelector('[data-before-after]') && tile.querySelector('img');
    });

    if (lightbox && tiles.length) {
        var lightboxImage = lightbox.querySelector('.lb-media img');
        var lightboxCategory = lightbox.querySelector('.lb-cap .cat');
        var lightboxTitle = lightbox.querySelector('.lb-cap .ttl');
        var lightboxCaption = lightbox.querySelector('.lb-cap');
        var lightboxMedia = lightbox.querySelector('.lb-media');
        var lightboxClose = lightbox.querySelector('.lb-close');
        var lightboxPrevious = lightbox.querySelector('.lb-prev');
        var lightboxNext = lightbox.querySelector('.lb-next');
        var lightboxControls = [lightboxClose, lightboxPrevious, lightboxNext].filter(Boolean);
        var lightboxBackground = [header, main, footer, callFab];
        var lightboxIndex = 0;
        var lightboxLastFocused = null;

        function showPhoto(index) {
            lightboxIndex = (index + tiles.length) % tiles.length;
            var tile = tiles[lightboxIndex];
            var image = tile.querySelector('img');
            var caption = tile.querySelector('figcaption');
            lightboxImage.src = image.getAttribute('data-full-src') || image.currentSrc || image.src;
            lightboxImage.alt = image.alt || 'Florida Maintenance work';
            lightboxCategory.textContent = '';
            lightboxTitle.textContent = caption ? caption.textContent : '';
            lightboxCaption.style.display = caption ? '' : 'none';
            lightboxMedia.classList.toggle('no-cap', !caption);
        }

        function openLightbox(index) {
            if (body.classList.contains('nav-open') && toggle) toggle.click();
            lightboxLastFocused = document.activeElement;
            showPhoto(index);
            lightbox.classList.add('open');
            lightbox.setAttribute('aria-hidden', 'false');
            body.classList.add('lightbox-open');
            setInert(lightboxBackground, true);
            lightboxClose.focus();
        }

        function closeLightbox() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            body.classList.remove('lightbox-open');
            setInert(lightboxBackground, false);
            lightboxImage.removeAttribute('src');
            if (lightboxLastFocused && typeof lightboxLastFocused.focus === 'function') lightboxLastFocused.focus();
        }

        tiles.forEach(function (tile, index) {
            var image = tile.querySelector('img');
            tile.setAttribute('tabindex', '0');
            tile.setAttribute('role', 'button');
            tile.setAttribute('aria-label', 'View larger: ' + (image.alt || 'Florida Maintenance work'));
            tile.addEventListener('click', function () { openLightbox(index); });
            tile.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openLightbox(index);
                }
            });
        });

        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrevious.addEventListener('click', function (event) {
            event.stopPropagation();
            showPhoto(lightboxIndex - 1);
        });
        lightboxNext.addEventListener('click', function (event) {
            event.stopPropagation();
            showPhoto(lightboxIndex + 1);
        });
        lightbox.addEventListener('click', function (event) {
            if (event.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', function (event) {
            if (!lightbox.classList.contains('open')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                closeLightbox();
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                showPhoto(lightboxIndex - 1);
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                showPhoto(lightboxIndex + 1);
                return;
            }
            if (event.key !== 'Tab' || !lightboxControls.length) return;
            var first = lightboxControls[0];
            var last = lightboxControls[lightboxControls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
})();
