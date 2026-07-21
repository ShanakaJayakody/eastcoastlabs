<?php
/**
 * Restock Program Module — Phase 3
 *
 * Provides BOTH subscription (if gateway supports) and reminder-based
 * fallback pseudo-subscription functionality.
 *
 * Features:
 * 1. Subscribe & Save toggle (unchecked by default) on PDP buy box
 *    - Extra 10% off tier price
 *    - Cadence coupled to pack size (1→4wk, 3→12wk, 6→24wk)
 *    - Uses WooCommerce Subscriptions if available
 * 2. Reminder-based fallback (if gateway doesn't support recurring):
 *    - Post-purchase opt-in checkbox
 *    - WP-Cron email at chosen interval with one-click reorder link
 *    - RESTOCK10 coupon auto-applied
 * 3. "Bulk Packs" collection page shortcode
 *
 * Compliance: all copy uses "restock" / "supply" language — never
 * usage cadence or dosing implications.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Restock {

    /**
     * Pack size → reminder interval mapping (weeks).
     */
    private array $cadence_map = array(
        1 => 4,    // 1 vial → every 4 weeks
        3 => 12,   // 3-pack → every 12 weeks
        6 => 24,   // 6-pack → every 24 weeks
    );

    /**
     * Subscription discount percentage.
     */
    private const SUB_DISCOUNT_PCT = 10;

    /**
     * Restock reminder coupon code.
     */
    private const RESTOCK_COUPON = 'RESTOCK10';

    public function __construct() {
        // Subscribe toggle on PDP (only if Woo Subscriptions active).
        if ( class_exists( 'WC_Subscriptions' ) ) {
            add_action( 'woocommerce_after_add_to_cart_button', array( $this, 'render_subscribe_toggle' ), 5 );
            add_filter( 'woocommerce_add_cart_item_data', array( $this, 'handle_subscribe_toggle' ), 10, 2 );
        }

        // Reminder-based fallback — always available.
        add_action( 'woocommerce_review_order_after_submit', array( $this, 'render_reminder_optin' ) );
        add_action( 'woocommerce_thankyou', array( $this, 'save_reminder_optin' ) );
        add_action( 'ecl_restock_reminder_cron', array( $this, 'process_restock_reminders' ) );

        // Bulk Packs page shortcode.
        add_shortcode( 'ecl_bulk_packs', array( $this, 'render_bulk_packs_page' ) );

        // AJAX handler for subscribe price preview.
        add_action( 'wp_ajax_ecl_subscribe_preview', array( $this, 'ajax_subscribe_preview' ) );
        add_action( 'wp_ajax_nopriv_ecl_subscribe_preview', array( $this, 'ajax_subscribe_preview' ) );

        // Pre-renewal reminder email (5 days before subscription renewal).
        add_action( 'woocommerce_scheduled_subscription_payment', array( $this, 'send_pre_renewal_reminder' ), 5 );
    }

    // -------------------------------------------------------------------------
    // SUBSCRIPTION MODE (WooCommerce Subscriptions active)
    // -------------------------------------------------------------------------

    /**
     * Render the Subscribe & Save toggle.
     * UNCHECKED by default (per plan — trust-first for scam-wary audience).
     */
    public function render_subscribe_toggle(): void {
        global $product;

        if ( ! $product instanceof WC_Product || ! ecl_is_peptide_product( $product ) ) {
            return;
        }

        // Determine cadence based on product variations.
        $cadence_text = 'every 4 weeks';
        if ( $product instanceof WC_Product_Variable ) {
            $variations = $product->get_available_variations( 'objects' );
            // Show the most relevant cadence (for the default 3-pack).
            $cadence_text = 'every 12 weeks';
        }
        ?>
        <div class="ecl-restock-toggle">
            <label class="ecl-restock-toggle__label">
                <input type="checkbox"
                       name="ecl_subscribe_restock"
                       value="1"
                       class="ecl-restock-toggle__input" />
                <span class="ecl-restock-toggle__text">
                    <strong>Restock automatically &amp; save an extra <?php echo esc_html( self::SUB_DISCOUNT_PCT ); ?>%</strong>
                    <span class="ecl-restock-toggle__subtext">
                        Delivery <?php echo esc_html( $cadence_text ); ?>. Pause, skip, or cancel anytime. No lock-in.
                    </span>
                </span>
            </label>
        </div>
        <?php
    }

    /**
     * Handle the subscribe toggle in cart data.
     */
    public function handle_subscribe_toggle( array $cart_item_data, int $product_id ): array {
        if ( empty( $_POST['ecl_subscribe_restock'] ) ) {
            return $cart_item_data;
        }

        $cart_item_data['_ecl_restock_subscription'] = true;

        // If using All Products for Woo Subscriptions, this data triggers the subscription.
        // Otherwise, we flag it for the fallback reminder system.

        return $cart_item_data;
    }

    /**
     * AJAX: Calculate subscribe-and-save price preview.
     */
    public function ajax_subscribe_preview(): void {
        check_ajax_referer( 'ecl_frontend', 'nonce' );

        $price = (float) ( $_POST['price'] ?? 0 );
        $vial_count = (int) ( $_POST['vial_count'] ?? 1 );

        $cadence = $this->cadence_map[ $vial_count ] ?? 4;
        $discounted = $price * ( 1 - self::SUB_DISCOUNT_PCT / 100 );
        $savings = $price - $discounted;

        wp_send_json_success( array(
            'one_time'   => ecl_format_price( $price ),
            'restock'    => ecl_format_price( $discounted ),
            'savings'    => ecl_format_price( $savings ),
            'cadence'    => $cadence,
            'cadence_text' => "every {$cadence} weeks",
        ) );
    }

    /**
     * Send pre-renewal reminder email 5 days before subscription payment.
     */
    public function send_pre_renewal_reminder( int $subscription_id ): void {
        if ( ! function_exists( 'wcs_get_subscription' ) ) {
            return;
        }

        $subscription = wcs_get_subscription( $subscription_id );
        if ( ! $subscription ) {
            return;
        }

        // Only send if we haven't already for this renewal.
        $next_payment = $subscription->get_time( 'next_payment' );
        $days_until = ( $next_payment - time() ) / DAY_IN_SECONDS;

        // Only send if we're ~5 days before.
        if ( $days_until > 6 || $days_until < 4 ) {
            return;
        }

        $sent_flag = '_ecl_pre_renewal_sent_' . $next_payment;
        if ( $subscription->get_meta( $sent_flag ) ) {
            return;
        }

        $customer_email = $subscription->get_billing_email();
        $customer_name = $subscription->get_billing_first_name() ?: 'there';

        $subject = 'Your ECL restock ships soon — skip or edit anytime';
        $message = "Hi {$customer_name},\n\n";
        $message .= "Your Restock Program order is scheduled to ship soon. Here's what's coming:\n\n";
        foreach ( $subscription->get_items() as $item ) {
            $message .= "• " . $item->get_name() . "\n";
        }
        $message .= "\nTotal: " . wp_strip_all_tags( $subscription->get_total_to_recur() ) . "\n";
        $message .= "Delivery date: " . wp_date( 'j F Y', $next_payment ) . "\n\n";
        $message .= "Need to skip, pause, or change this delivery?\n";
        $message .= "Manage your restock schedule here: " . wc_get_account_endpoint_url( 'subscriptions' ) . "\n\n";
        $message .= "Questions? Reply to this email or contact " . ecl_setting( 'support_email', 'support@eastcoastlabs.com.au' ) . ".\n\n";
        $message .= "— East Coast Labs\n";

        wp_mail( $customer_email, $subject, $message, array(
            'From: East Coast Labs <' . ecl_setting( 'support_email', 'support@eastcoastlabs.com.au' ) . '>',
        ) );

        $subscription->update_meta_data( $sent_flag, true );
        $subscription->save();
    }

    // -------------------------------------------------------------------------
    // REMINDER-BASED FALLBACK (no gateway recurring support)
    // -------------------------------------------------------------------------

    /**
     * Render the restock reminder opt-in checkbox on checkout.
     */
    public function render_reminder_optin(): void {
        ?>
        <div class="ecl-restock-optin">
            <label class="ecl-restock-optin__label">
                <input type="checkbox"
                       name="ecl_restock_reminder"
                       value="1"
                       class="ecl-restock-optin__input" />
                <span class="ecl-restock-optin__text">
                    <strong>Remind me to restock</strong>
                    <span class="ecl-restock-optin__subtext">
                        Get an email when your supply is likely running low.
                        Includes 10% off your restock order.
                    </span>
                </span>
            </label>
            <div class="ecl-restock-optin__interval" style="display:none;">
                <label>Remind me in:</label>
                <select name="ecl_restock_interval">
                    <option value="4">4 weeks</option>
                    <option value="8">8 weeks</option>
                    <option value="12" selected>12 weeks</option>
                    <option value="24">24 weeks</option>
                </select>
            </div>
        </div>

        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const checkbox = document.querySelector('.ecl-restock-optin__input');
            const interval = document.querySelector('.ecl-restock-optin__interval');
            if (checkbox && interval) {
                checkbox.addEventListener('change', function() {
                    interval.style.display = this.checked ? 'block' : 'none';
                });
            }
        });
        </script>
        <?php
    }

    /**
     * Save the restock reminder opt-in on order completion.
     */
    public function save_reminder_optin( int $order_id ): void {
        if ( empty( $_POST['ecl_restock_reminder'] ) ) {
            return;
        }

        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        $interval_weeks = (int) ( $_POST['ecl_restock_interval'] ?? 12 );
        $reminder_date = gmdate( 'Y-m-d', time() + ( $interval_weeks * WEEK_IN_SECONDS ) );

        $order->update_meta_data( '_ecl_restock_reminder', true );
        $order->update_meta_data( '_ecl_restock_interval', $interval_weeks );
        $order->update_meta_data( '_ecl_restock_reminder_date', $reminder_date );
        $order->update_meta_data( '_ecl_restock_email_sent', false );
        $order->save();

        // Also store globally for the cron job.
        $reminders = get_option( 'ecl_restock_reminders', array() );
        $reminders[] = array(
            'order_id'      => $order_id,
            'customer_id'   => $order->get_customer_id(),
            'customer_email'=> $order->get_billing_email(),
            'reminder_date' => $reminder_date,
            'sent'          => false,
        );
        update_option( 'ecl_restock_reminders', $reminders );
    }

    /**
     * Process pending restock reminders (runs via WP-Cron daily).
     */
    public function process_restock_reminders(): void {
        $reminders = get_option( 'ecl_restock_reminders', array() );
        $today = gmdate( 'Y-m-d' );
        $updated = false;

        foreach ( $reminders as $index => &$reminder ) {
            if ( $reminder['sent'] ) {
                continue;
            }
            if ( $reminder['reminder_date'] > $today ) {
                continue;
            }

            // Send the reminder email.
            $this->send_restock_reminder_email( $reminder );

            $reminder['sent'] = true;
            $updated = true;
        }

        if ( $updated ) {
            update_option( 'ecl_restock_reminders', $reminders );
        }
    }

    /**
     * Send a restock reminder email with reorder link.
     */
    private function send_restock_reminder_email( array $reminder ): void {
        $order = wc_get_order( $reminder['order_id'] );
        if ( ! $order ) {
            return;
        }

        $customer_name = $order->get_billing_first_name() ?: 'there';
        $email = $reminder['customer_email'];

        // Build reorder URL — pre-fills the cart with the same items.
        $reorder_url = add_query_arg( 'ecl_reorder', $reminder['order_id'], wc_get_cart_url() );

        $subject = 'Running low? Restock in one click + 10% off';
        $message = "Hi {$customer_name},\n\n";
        $message .= "It's been a while since your last order. If your lab supplies are running low, restocking is quick.\n\n";
        $message .= "Your last order:\n";
        foreach ( $order->get_items() as $item ) {
            $message .= "• " . $item->get_name() . "\n";
        }
        $message .= "\nRestock now with code RESTOCK10 for 10% off:\n";
        $message .= $reorder_url . "\n\n";
        $message .= "Every restock ships from the latest tested batch with an independent COA included.\n\n";
        $message .= "No longer need reminders? Unsubscribe: " . add_query_arg( 'ecl_unsubscribe', $reminder['order_id'], home_url() ) . "\n\n";
        $message .= "— East Coast Labs\n";

        wp_mail( $email, $subject, $message, array(
            'From: East Coast Labs <' . ecl_setting( 'support_email', 'support@eastcoastlabs.com.au' ) . '>',
        ) );
    }

    // -------------------------------------------------------------------------
    // BULK PACKS COLLECTION PAGE
    // -------------------------------------------------------------------------

    /**
     * Render the Bulk Packs collection page via shortcode.
     * Usage: [ecl_bulk_packs]
     */
    public function render_bulk_packs_page( array $atts = array() ): string {
        ob_start();
        ?>
        <div class="ecl-bulk-packs">
            <div class="ecl-bulk-packs__header">
                <h2>Buy in bulk. No subscription needed.</h2>
                <p>For labs that prefer to stock up without a recurring delivery. All packs ship with an independent COA and qualify for free shipping over $150.</p>
            </div>

            <div class="ecl-bulk-packs__grid">
                <?php
                // Get all variable products (peptides with pack sizes).
                $products = wc_get_products( array(
                    'type'         => 'variable',
                    'limit'        => 20,
                    'status'       => 'publish',
                    'return'       => 'objects',
                ) );

                foreach ( $products as $product ) :
                    if ( ! ecl_is_peptide_product( $product ) ) {
                        continue;
                    }

                    // Get 3-pack and 6-pack variations.
                    $variations = $product->get_available_variations( 'objects' );
                    $packs = array();
                    foreach ( $variations as $variation ) {
                        $attrs = $variation->get_attributes();
                        foreach ( $attrs as $name => $value ) {
                            if ( false !== stripos( $name, 'pack' ) || false !== stripos( $name, 'size' ) ) {
                                if ( strpos( $value, '3' ) !== false || strpos( $value, '6' ) !== false ) {
                                    $vial_count = strpos( $value, '6' ) !== false ? 6 : 3;
                                    $price = $variation->get_price();
                                    $per_vial = $price / $vial_count;
                                    $packs[$vial_count] = array(
                                        'variation_id' => $variation->get_id(),
                                        'price'        => $price,
                                        'per_vial'     => $per_vial,
                                    );
                                }
                                break;
                            }
                        }
                    }

                    if ( empty( $packs ) ) {
                        continue;
                    }

                    $product_url = $product->get_permalink();
                    ?>
                    <div class="ecl-bulk-packs__item">
                        <h3 class="ecl-bulk-packs__name">
                            <a href="<?php echo esc_url( $product_url ); ?>"><?php echo esc_html( $product->get_name() ); ?></a>
                        </h3>
                        <?php if ( isset( $packs[6] ) ) : ?>
                            <p class="ecl-bulk-packs__per-vial">
                                From <strong><?php echo wp_kses_post( wc_price( $packs[6]['per_vial'] ) ); ?></strong> /vial in 6-packs
                            </p>
                        <?php elseif ( isset( $packs[3] ) ) : ?>
                            <p class="ecl-bulk-packs__per-vial">
                                From <strong><?php echo wp_kses_post( wc_price( $packs[3]['per_vial'] ) ); ?></strong> /vial in 3-packs
                            </p>
                        <?php endif; ?>
                        <a href="<?php echo esc_url( $product_url ); ?>" class="button">View pack options →</a>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Handle reorder URL (pre-fills cart from a previous order).
     */
    public static function handle_reorder_url(): void {
        if ( empty( $_GET['ecl_reorder'] ) ) {
            return;
        }

        $order_id = absint( $_GET['ecl_reorder'] );
        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        // Clear cart.
        WC()->cart->empty_cart();

        // Add all items from the order.
        foreach ( $order->get_items() as $item ) {
            $product_id = $item->get_product_id();
            $variation_id = $item->get_variation_id();
            $quantity = $item->get_quantity();

            WC()->cart->add_to_cart( $product_id, $quantity, $variation_id );
        }

        // Auto-apply RESTOCK10 coupon.
        if ( WC()->cart && ! WC()->cart->has_discount( self::RESTOCK_COUPON ) ) {
            WC()->cart->apply_coupon( self::RESTOCK_COUPON );
        }

        wp_safe_redirect( wc_get_checkout_url() );
        exit;
    }
}

// Handle reorder URL early.
add_action( 'template_redirect', array( 'ECL_Restock', 'handle_reorder_url' ) );
