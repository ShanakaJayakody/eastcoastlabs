/**
 * ECL Sticky ATC Bar — IntersectionObserver
 * Phase 4.1
 *
 * Shows the sticky bar when the buy box scrolls out of view.
 * Hides it when the buy box is visible or when scrolled past the CTA strip.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var stickyBar = document.getElementById('ecl-sticky-atc');
        if (!stickyBar) return;

        // The element we watch — the buy box / add to cart area.
        var buyBox = document.querySelector('.ecl-tier-cards') ||
                     document.querySelector('.cart') ||
                     document.querySelector('.single_add_to_cart_button');

        // The CTA strip at the bottom — hide sticky bar when it's visible.
        var ctaStrip = document.querySelector('.ecl-cta-strip');

        if (!buyBox) return;

        var buyBoxVisible = true;
        var ctaVisible = false;

        // Observe the buy box.
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    buyBoxVisible = entry.isIntersecting;
                    updateVisibility();
                });
            }, {
                threshold: 0,
                rootMargin: '0px 0px -50px 0px'
            });

            observer.observe(buyBox);

            // Also observe the CTA strip.
            if (ctaStrip) {
                var ctaObserver = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        ctaVisible = entry.isIntersecting;
                        updateVisibility();
                    });
                }, { threshold: 0.1 });

                ctaObserver.observe(ctaStrip);
            }
        } else {
            // Fallback: show on scroll position.
            window.addEventListener('scroll', function () {
                var rect = buyBox.getBoundingClientRect();
                buyBoxVisible = rect.bottom > 0 && rect.top < window.innerHeight;
                updateVisibility();
            });
        }

        function updateVisibility() {
            var shouldShow = !buyBoxVisible && !ctaVisible;
            if (shouldShow) {
                stickyBar.classList.add('ecl-sticky-atc--visible');
                stickyBar.setAttribute('aria-hidden', 'false');
            } else {
                stickyBar.classList.remove('ecl-sticky-atc--visible');
                stickyBar.setAttribute('aria-hidden', 'true');
            }
        }

        // Handle the sticky ATC button click.
        var stickyBtn = stickyBar.querySelector('[data-sticky-add-to-cart]');
        if (stickyBtn) {
            stickyBtn.addEventListener('click', function (e) {
                e.preventDefault();
                // Find the main ATC button and click it.
                var mainBtn = document.querySelector('button.single_add_to_cart_button[name="add-to-cart"]');
                if (mainBtn) {
                    mainBtn.click();
                }
            });
        }
    });
})();
