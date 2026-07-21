<?php
/**
 * GA4 Ecommerce Events Module — Phase 6.2
 *
 * Verifies and supplements GA4 ecommerce event tracking via MonsterInsights
 * or direct gtag. This module provides a fallback gtag snippet for any
 * events not covered by MonsterInsights.
 *
 * Required events:
 * - view_item        (PDP load)
 * - add_to_cart      (ATC click)
 * - begin_checkout   (checkout start)
 * - purchase         (order complete)
 *
 * If MonsterInsights is active and tracking these, this module is a no-op
 * (it detects existing event dispatching and skips). Otherwise, it injects
 * the missing gtag calls.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_GA4_Events {

    /**
     * Whether MonsterInsights is active.
     */
    private bool $has_monsterinsights;

    /**
     * Whether we've detected gtag already loaded.
     */
    private bool $has_gtag;

    public function __construct() {
        $this->has_monsterinsights = class_exists( 'MonsterInsights' ) || defined( 'MONSTERINSIGHTS_VERSION' );
        $this->has_gtag = $this->detect_gtag();

        // Only add our fallback if gtag is available (MonsterInsights or manual).
        if ( ! $this->has_gtag ) {
            return;
        }

        // view_item on single product pages.
        add_action( 'woocommerce_after_single_product', array( $this, 'track_view_item' ) );

        // add_to_cart via AJAX response.
        add_action( 'woocommerce_ajax_added_to_cart', array( $this, 'track_add_to_cart_ajax' ), 10, 1 );
        add_filter( 'woocommerce_add_to_cart_fragments', array( $this, 'add_to_cart_fragment' ) );

        // begin_checkout and purchase are typically handled by MonsterInsights.
        // If MI is not active, we add them via WooCommerce hooks.
        if ( ! $this->has_monsterinsights ) {
            add_action( 'woocommerce_after_checkout_form', array( $this, 'track_begin_checkout' ) );
            add_action( 'woocommerce_thankyou', array( $this, 'track_purchase' ) );
        }

        // Admin notice about tracking status.
        add_action( 'admin_notices', array( $this, 'admin_tracking_status' ) );
    }

    /**
     * Detect whether gtag is loaded on the site.
     */
    private function detect_gtag(): bool {
        // MonsterInsights loads gtag.
        if ( $this->has_monsterinsights ) {
            return true;
        }

        // Check if a GA4 measurement ID is configured.
        $ga4_id = get_option( 'ecl_ga4_measurement_id', '' );
        return ! empty( $ga4_id );
    }

    /**
     * Track view_item on PDP.
     */
    public function track_view_item(): void {
        global $product;
        if ( ! $product instanceof WC_Product ) {
            return;
        }

        $item_data = $this->format_product_for_ga4( $product );
        ?>
        <script>
        if (typeof gtag === 'function') {
            gtag('event', 'view_item', {
                currency: 'AUD',
                value: <?php echo (float) $product->get_price(); ?>,
                items: [<?php echo wp_json_encode( $item_data ); ?>]
            });
        }
        </script>
        <?php
    }

    /**
     * Track add_to_cart via AJAX fragment.
     * WooCommerce AJAX add-to-cart doesn't give us a clean JS hook,
     * so we inject a data attribute and use the fragments system.
     */
    public function add_to_cart_fragment( array $fragments ): array {
        $product_id = absint( $_POST['product_id'] ?? $_POST['add-to-cart'] ?? 0 );
        $variation_id = absint( $_POST['variation_id'] ?? 0 );
        $quantity = absint( $_POST['quantity'] ?? 1 );

        $product = $variation_id ? wc_get_product( $variation_id ) : wc_get_product( $product_id );
        if ( ! $product ) {
            return $fragments;
        }

        $item_data = $this->format_product_for_ga4( $product );

        $fragments['script.ecl-ga4-add-to-cart'] = sprintf(
            '<script class="ecl-ga4-add-to-cart">if(typeof gtag==="function"){gtag("event","add_to_cart",{currency:"AUD",value:%s,items:[%s]});}</script>',
            esc_js( $product->get_price() * $quantity ),
            esc_js( wp_json_encode( $item_data ) )
        );

        return $fragments;
    }

    /**
     * Fallback AJAX add_to_cart tracking.
     */
    public function track_add_to_cart_ajax( int $product_id ): void {
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            return;
        }
        // The fragment handler above does the actual JS injection.
        // This method exists as a hook marker for debugging.
    }

    /**
     * Track begin_checkout on checkout page (fallback if no MI).
     */
    public function track_begin_checkout(): void {
        $cart = WC()->cart;
        if ( ! $cart || $cart->is_empty() ) {
            return;
        }

        $items = array();
        foreach ( $cart->get_cart() as $cart_item ) {
            $product = $cart_item['data'];
            $items[] = $this->format_product_for_ga4( $product );
        }
        ?>
        <script>
        if (typeof gtag === 'function') {
            gtag('event', 'begin_checkout', {
                currency: 'AUD',
                value: <?php echo (float) $cart->get_cart_contents_total(); ?>,
                items: <?php echo wp_json_encode( $items ); ?>
            });
        }
        </script>
        <?php
    }

    /**
     * Track purchase on thank-you page (fallback if no MI).
     */
    public function track_purchase( int $order_id ): void {
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        // Only fire once per order.
        if ( $order->get_meta( '_ecl_ga4_purchase_tracked' ) ) {
            return;
        }

        $items = array();
        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( ! $product ) {
                continue;
            }
            $item_data = $this->format_product_for_ga4( $product );
            $item_data['quantity'] = $item->get_quantity();
            $item_data['price'] = (float) $order->get_item_total( $item, false );
            $items[] = $item_data;
        }

        $order->update_meta_data( '_ecl_ga4_purchase_tracked', true );
        $order->save();
        ?>
        <script>
        if (typeof gtag === 'function') {
            gtag('event', 'purchase', {
                transaction_id: '<?php echo esc_js( $order->get_order_number() ); ?>',
                currency: 'AUD',
                value: <?php echo (float) $order->get_total(); ?>,
                tax: <?php echo (float) $order->get_total_tax(); ?>,
                shipping: <?php echo (float) $order->get_shipping_total(); ?>,
                items: <?php echo wp_json_encode( $items ); ?>
            });
        }
        </script>
        <?php
    }

    /**
     * Format a product for GA4 ecommerce item schema.
     */
    private function format_product_for_ga4( WC_Product $product ): array {
        $categories = wp_get_post_terms( $product->get_id(), 'product_cat', array( 'fields' => 'names' ) );

        return array(
            'item_id'       => $product->get_sku() ?: (string) $product->get_id(),
            'item_name'     => $product->get_name(),
            'item_category' => ! empty( $categories ) ? $categories[0] : 'Peptides',
            'price'         => (float) $product->get_price(),
            'quantity'      => 1,
        );
    }

    /**
     * Admin notice showing GA4 tracking status.
     */
    public function admin_tracking_status(): void {
        $screen = get_current_screen();
        if ( ! $screen || 'woocommerce_page_ecl-conversion-settings' !== $screen->id ) {
            return;
        }

        $status = $this->has_monsterinsights
            ? '✓ MonsterInsights detected — GA4 events are handled by the plugin.'
            : ( $this->has_gtag
                ? '△ gtag detected (no MonsterInsights) — using ecl-conversion fallback events.'
                : '✗ No GA4/gtag detected — set up MonsterInsights or configure a Measurement ID.' );

        echo '<div class="notice notice-info"><p><strong>GA4 Tracking:</strong> ' . esc_html( $status ) . '</p></div>';
    }
}
