/**
 * ECL Tier Cards — Radio Selector + Variation Sync
 * Phase 2.2
 *
 * Handles:
 * - Selecting a tier card updates the hidden WooCommerce variation dropdown
 * - Syncing variation_id + price with the add-to-cart form
 * - Updating the sticky ATC bar price when tier changes
 * - Subscribe-and-save live price preview (Phase 3)
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var tierContainer = document.querySelector('.ecl-tier-cards');
        if (!tierContainer) return;

        var productId = tierContainer.getAttribute('data-product-id');
        var packAttr = tierContainer.getAttribute('data-pack-attr');
        var cards = tierContainer.querySelectorAll('.ecl-tier-card');
        var hiddenSelect = tierContainer.querySelector('.ecl-hidden-select');
        var variationInput = tierContainer.querySelector('.variation_id');
        var stickyPrice = document.querySelector('[data-sticky-price]');
        var stickyPerVial = document.querySelector('[data-sticky-per-vial]');

        /**
         * Select a tier card and sync the hidden Woo variation system.
         */
        function selectCard(card) {
            // Visual: mark only this card as selected.
            cards.forEach(function (c) {
                c.classList.remove('ecl-tier-card--selected');
            });
            card.classList.add('ecl-tier-card--selected');

            var variationId = card.getAttribute('data-variation-id');
            var price = card.getAttribute('data-price');
            var perVial = card.getAttribute('data-per-vial');
            var vialCount = parseInt(card.getAttribute('data-vial-count'), 10);
            var packLabel = card.getAttribute('data-pack-label');

            // Update hidden variation ID input.
            if (variationInput) {
                variationInput.value = variationId;
                variationInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Update hidden WooCommerce select to match.
            if (hiddenSelect) {
                hiddenSelect.value = packLabel;
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Update sticky ATC bar price.
            if (stickyPrice) {
                var priceText = '$' + parseFloat(price).toFixed(2);
                stickyPrice.innerHTML = priceText;
            }
            if (stickyPerVial && vialCount > 1) {
                stickyPerVial.textContent = ' ($' + parseFloat(perVial).toFixed(2) + '/vial)';
            } else if (stickyPerVial) {
                stickyPerVial.textContent = '';
            }

            // Update subscribe preview if toggle is visible.
            updateSubscribePreview(price, vialCount);
        }

        /**
         * Update the subscribe-and-save live price preview.
         */
        function updateSubscribePreview(price, vialCount) {
            var toggle = document.querySelector('.ecl-restock-toggle');
            if (!toggle) return;

            var oneTimeEl = toggle.querySelector('.ecl-restock-toggle__one-time');
            var restockEl = toggle.querySelector('.ecl-restock-toggle__restock');
            var cadenceEl = toggle.querySelector('.ecl-restock-toggle__cadence');

            var discount = 0.10;
            var discounted = parseFloat(price) * (1 - discount);
            var savings = parseFloat(price) - discounted;

            // Cadence by vial count.
            var cadence;
            switch (vialCount) {
                case 1: cadence = 'every 4 weeks'; break;
                case 3: cadence = 'every 12 weeks'; break;
                case 6: cadence = 'every 24 weeks'; break;
                default: cadence = 'every 4 weeks';
            }

            if (oneTimeEl) oneTimeEl.textContent = '$' + parseFloat(price).toFixed(2);
            if (restockEl) restockEl.textContent = '$' + discounted.toFixed(2) + ' (save $' + savings.toFixed(2) + ')';
            if (cadenceEl) cadenceEl.textContent = cadence;
        }

        // Attach click handlers.
        cards.forEach(function (card) {
            var input = card.querySelector('.ecl-tier-card__input');
            if (input) {
                input.addEventListener('change', function () {
                    selectCard(card);
                });
            }
            // Also allow clicking the card itself.
            card.addEventListener('click', function (e) {
                if (e.target === input) return;
                if (input && !input.disabled) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        // Initialize with the default-selected card.
        var defaultCard = tierContainer.querySelector('.ecl-tier-card--selected');
        if (defaultCard) {
            selectCard(defaultCard);
        }

        // Listen for WooCommerce variation form events to keep cards in sync.
        var variationForm = document.querySelector('.variations_form');
        if (variationForm) {
            variationForm.addEventListener('show_variation', function (event, variation) {
                // Find the matching card and select it.
                cards.forEach(function (card) {
                    if (card.getAttribute('data-variation-id') == variation.variation_id) {
                        selectCard(card);
                    }
                });
            });
        }
    });
})();
