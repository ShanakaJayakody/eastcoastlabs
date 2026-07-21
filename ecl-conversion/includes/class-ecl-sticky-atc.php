<?php
/**
 * Sticky Add-to-Cart Bar — Phase 4.1
 *
 * Shows a fixed bottom bar when the buy box scrolls out of view.
 * Contains: product name, currently-selected tier price, and ATC button.
 * Uses IntersectionObserver for scroll detection.
 *
 * Mobile-first design — most valuable on mobile where the buy box
 * can be far from the top.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Sticky_ATC {

    public function __construct() {
        // Render the sticky bar HTML at the bottom of the page (hidden by default).
        add_action( 'woocommerce_after_single_product', array( $this, 'render_sticky_bar' ) );

        // Enqueue JS and CSS.
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    /**
     * Render the sticky ATC bar template.
     */
    public function render_sticky_bar(): void {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return;
        }

        // Get the default/cheapest price for initial display.
        $initial_price = '';
        $initial_vial_count = 1;

        if ( $product instanceof WC_Product_Variable ) {
            $variations = $product->get_available_variations( 'objects' );
            // Find the 3-pack (default selected) for initial price.
            foreach ( $variations as $variation ) {
                $attrs = $variation->get_attributes();
                foreach ( $attrs as $name => $value ) {
                    if ( false !== stripos( $name, 'pack' ) && strpos( $value, '3' ) !== false ) {
                        $initial_price = $variation->get_price();
                        $initial_vial_count = 3;
                        break 2;
                    }
                }
            }
            // Fallback to cheapest variation.
            if ( empty( $initial_price ) ) {
                $initial_price = $product->get_price();
            }
        } else {
            $initial_price = $product->get_price();
        }

        // Load template.
        $template = ECL_PLUGIN_DIR . 'templates/sticky-atc-bar.php';
        if ( file_exists( $template ) ) {
            include $template;
        }
    }

    /**
     * Enqueue JS and CSS for the sticky bar.
     */
    public function enqueue_assets(): void {
        if ( ! is_product() ) {
            return;
        }

        wp_enqueue_script(
            'ecl-sticky-atc',
            ECL_PLUGIN_URL . 'assets/js/ecl-sticky-atc.js',
            array(),
            ECL_VERSION,
            true
        );
    }
}
