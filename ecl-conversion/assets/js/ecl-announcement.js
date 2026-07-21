/**
 * ECL Announcement Bar — Dismiss Handler
 * Phase 4.2
 *
 * Stores dismissal in localStorage so it persists per-browser.
 * Reappears if the text changes (tracked via a version hash).
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var bar = document.getElementById('ecl-announcement-bar');
        var closeBtn = document.getElementById('ecl-announcement-close');
        if (!bar || !closeBtn) return;

        // Compute a hash of the announcement text for version tracking.
        var textEl = bar.querySelector('.ecl-announcement-bar__text');
        var text = textEl ? textEl.textContent.trim() : '';
        var version = btoa(text).slice(0, 16);
        var storageKey = 'ecl-announcement-dismissed';

        // Check if this version was dismissed.
        try {
            var dismissed = localStorage.getItem(storageKey);
            if (dismissed === version) {
                bar.style.display = 'none';
                document.body.classList.add('ecl-announcement-dismissed');
                return;
            }
        } catch (e) {
            // localStorage may be unavailable (private mode). Show the bar.
        }

        // Add margin to body to account for the bar height.
        document.body.classList.add('ecl-announcement-active');

        // Handle dismiss.
        closeBtn.addEventListener('click', function () {
            bar.style.display = 'none';
            document.body.classList.remove('ecl-announcement-active');
            document.body.classList.add('ecl-announcement-dismissed');
            try {
                localStorage.setItem(storageKey, version);
            } catch (e) {
                // Ignore storage errors.
            }
        });
    });
})();
