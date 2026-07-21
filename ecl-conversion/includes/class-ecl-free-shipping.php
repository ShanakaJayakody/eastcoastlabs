<?php
/**
 * Free Shipping Threshold + Progress Notice — Phase 2.4
 *
 * Features:
 * 1. Free standard shipping when cart total >= $150
 * 2. Cart notice: "You're $X away from free shipping" (with live AJAX update)
 * 3. Mini-cart progress bar fragment for AJAX refresh
 *
 * Configurable threshold via ecl_setting('free_shipping_threshold', 150).
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Free_Shipping {

    public function __construct() {
        // Render progress notice above cart contents.
        add_action( 'woocommerce_before_cart_contents', array( $this, 'render_cart_notice' ) );

        // Render in mini-cart.
        add_action( 'woocommerce_widget_shopping_cart_before_buttons', array( $this, 'render_mini_cart_notice' ) );

        // Add to cart fragments for AJAX update.
        add_filter( 'woocommerce_add_to_cart_fragments', array( $this, 'add_fragment' ) );

        // Enqueue the CSS (lightweight inline for the progress bar).
        add_action( 'wp_head', array( $this, 'inline_styles' ), 20 );

        // Set up the free shipping method when threshold is met.
        // This is configured in Woo shipping zones; we just handle the messaging.
    }

    /**
     * Calculate remaining amount for free shipping.
     *
     * @return array{ remaining: float, threshold: float, percentage: int, qualifies: bool }
     */
    public function get_progress_data(): array {
        $threshold = (float) ecl_setting( 'free_shipping_threshold', 150 );
        $cart_total = WC()->cart ? WC()->cart->get_cart_contents_total() : 0;
        $remaining = max( 0, $threshold - $cart_total );
        $percentage = $threshold > 0 ? min( 100, (int) round( ( $cart_total / $threshold ) * 100 ) ) : 0;

        return array(
            'remaining'  => $remaining,
            'threshold'  => $threshold,
            'percentage' => $percentage,
            'qualifies'  => $cart_total >= $threshold,
            'cart_total' => $cart_total,
        );
    }

    /**
     * Render the cart free-shipping progress notice.
     */
    public function render_cart_notice(): void {
        $data = $this->get_progress_data();

        echo '<div class="ecl-shipping-notice ecl-shipping-notice--cart" id="ecl-shipping-notice">';

        if ( $data['qualifies'] ) {
            echo '<div class="ecl-shipping-notice__qualified">';
            echo '<span class="ecl-shipping-notice__icon">✓</span> ';
            echo 'You\'ve qualified for <strong>FREE standard shipping!</strong>';
            echo '</div>';
        } else {
            echo '<div class="ecl-shipping-notice__progress-text">';
            echo 'You\'re <strong>' . wp_kses_post( wc_price( $data['remaining'] ) ) . '</strong> away from free shipping';
            echo '</div>';
        }

        // Progress bar.
        echo '<div class="ecl-shipping-progress-bar">';
        echo '<div class="ecl-shipping-progress-bar__fill" style="width: ' . esc_attr( $data['percentage'] ) . '%;"></div>';
        echo '</div>';

        echo '<div class="ecl-shipping-progress-bar__labels">';
        echo '<span>$0</span>';
        echo '<span>' . wp_kses_post( wc_price( $data['threshold'] ) ) . ' (free shipping)</span>';
        echo '</div>';

        echo '</div>';
    }

    /**
     * Render the mini-cart free-shipping notice (compact).
     */
    public function render_mini_cart_notice(): void {
        $data = $this->get_progress_data();

        echo '<div class="ecl-shipping-notice ecl-shipping-notice--mini" id="ecl-mini-shipping-notice">';

        if ( $data['qualifies'] ) {
            echo '<span class="ecl-shipping-notice__icon">✓</span> Free shipping unlocked!';
        } else {
            echo '<span>' . wp_kses_post( wc_price( $data['remaining'] ) ) . ' away from free shipping</span>';
        }

        echo '<div class="ecl-shipping-progress-bar ecl-shipping-progress-bar--mini">';
        echo '<div class="ecl-shipping-progress-bar__fill" style="width: ' . esc_attr( $data['percentage'] ) . '%;"></div>';
        echo '</div>';

        echo '</div>';
    }

    /**
     * Add AJAX fragment for live-updating the notice.
     */
    public function add_fragment( array $fragments ): array {
        $data = $this->get_progress_data();

        // Cart notice fragment.
        ob_start();
        $this->render_cart_notice();
        $fragments['#ecl-shipping-notice'] = ob_get_clean();

        // Mini-cart notice fragment.
        ob_start();
        $this->render_mini_cart_notice();
        $fragments['#ecl-mini-shipping-notice'] = ob_get_clean();

        return $fragments;
    }

    /**
     * Inline CSS for the shipping progress bar (lightweight, no extra request).
     */
    public function inline_styles(): void {
        // Only output on pages with cart/checkout.
        if ( ! ( is_cart() || is_checkout() || is_shop() || is_product() || wp_is_json_request() ) ) {
            return;
        }
        ?>
        <style>
        .ecl-shipping-notice { margin: 0 0 1.5em; padding: 16px; border-radius: 8px; background: #f8f9fa; border: 1px solid #e0e0e0; }
        .ecl-shipping-notice--mini { padding: 8px 12px; margin-bottom: 8px; font-size: 13px; }
        .ecl-shipping-notice__qualified { color: #2d8f3f; font-weight: 600; }
        .ecl-shipping-progress-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin: 10px 0 4px; overflow: hidden; }
        .ecl-shipping-progress-bar--mini { height: 4px; margin: 6px 0 0; }
        .ecl-shipping-progress-bar__fill { height: 100%; background: linear-gradient(90deg, #2d8f3f, #4caf50); transition: width 0.3s ease; border-radius: 3px; }
        .ecl-shipping-progress-bar__labels { display: flex; justify-content: space-between; font-size: 12px; color: #666; }
        </style>
        <?php
    }
}
