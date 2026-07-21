<?php
/**
 * Checkout Payment Trust Block — Phase 1.5
 *
 * Adds a gateway explanation + security microcopy block to the checkout
 * payment section. Designed for Bankful hosted gateway.
 *
 * Renders:
 * - What the gateway is (hosted, PCI-compliant processing)
 * - Statement descriptor disclosure ("You'll see 'EAST COAST LABS' on your card statement")
 * - Security signals (SSL, lock icon, accepted card logos)
 * - Discretion note ("Discreet billing" — a feature for this audience)
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Checkout_Trust {

    public function __construct() {
        // Render before the payment section on checkout.
        add_action( 'woocommerce_review_order_before_payment', array( $this, 'render_checkout_trust' ) );

        // Also render on the CartFlows checkout if present.
        add_action( 'cartflows_checkout_before_payment', array( $this, 'render_checkout_trust' ) );

        // Add microcopy after the place order button.
        add_filter( 'woocommerce_order_button_html', array( $this, 'add_button_microcopy' ), 10, 1 );
    }

    /**
     * Render the checkout trust block.
     */
    public function render_checkout_trust(): void {
        $descriptor = ecl_setting( 'statement_descriptor', 'EAST COAST LABS' );
        ?>
        <div class="ecl-checkout-trust">
            <div class="ecl-checkout-trust__header">
                <span class="ecl-checkout-trust__icon">🔒</span>
                <span class="ecl-checkout-trust__title">Secure Checkout</span>
            </div>

            <div class="ecl-checkout-trust__content">
                <p class="ecl-checkout-trust__desc">
                    Your payment is processed on a secure, PCI-DSS compliant hosted payment page.
                    We never see or store your card details.
                </p>

                <p class="ecl-checkout-trust__descriptor">
                    <strong>Card statement:</strong> You'll see
                    "<strong><?php echo esc_html( $descriptor ); ?></strong>"
                    on your card statement. Discreet billing — no product names appear on your statement.
                </p>

                <div class="ecl-checkout-trust__signals">
                    <span class="ecl-checkout-trust__signal ecl-checkout-trust__signal--ssl">
                        🔒 SSL Encrypted
                    </span>
                    <span class="ecl-checkout-trust__signal ecl-checkout-trust__signal--pci">
                        ✓ PCI-DSS Compliant
                    </span>
                    <span class="ecl-checkout-trust__signal ecl-checkout-trust__signal--discreet">
                        📦 Discreet Billing
                    </span>
                </div>
            </div>

            <div class="ecl-checkout-trust__faq">
                <details>
                    <summary>What payment methods can I use?</summary>
                    <p>We accept Visa and Mastercard via our secure hosted payment gateway.
                    Unfortunately, services like PayPal and Afterpay are not available for this product category.
                    If you have trouble with a payment, email <?php echo esc_html( ecl_setting( 'support_email', 'support@eastcoastlabs.com.au' ) ); ?>.</p>
                </details>
                <details>
                    <summary>Is my payment information secure?</summary>
                    <p>Yes. Card details are entered directly on the payment provider's secure page — they never touch our servers.
                    The entire checkout is encrypted with SSL, and the payment gateway is PCI-DSS Level 1 certified.</p>
                </details>
                <details>
                    <summary>What appears on my card statement?</summary>
                    <p>Your statement will show "<strong><?php echo esc_html( $descriptor ); ?></strong>" — no product names or descriptions related to your order appear on the statement.</p>
                </details>
            </div>
        </div>
        <?php
    }

    /**
     * Add microcopy after the place order button.
     */
    public function add_button_microcopy( string $button_html ): string {
        $microcopy = '<p class="ecl-place-order-microcopy">'
                   . '🔒 Your payment is secured by 256-bit SSL encryption. '
                   . 'Discreet billing — no product names on your statement.'
                   . '</p>';

        return $button_html . $microcopy;
    }
}
