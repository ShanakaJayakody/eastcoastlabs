<?php
/**
 * Guarantee Block Module — Phase 1.3
 *
 * Renders the purity guarantee block under the COA module on every PDP.
 * Copy is filterable via ecl_setting('guarantee_text') and the
 * ecl_guarantee_text filter.
 *
 * Default guarantee:
 * "Every vial ships with an independent COA. If any independent lab test
 * shows your batch below [98/99]% purity, we refund or replace it — and we
 * cover the cost of the test. Wrong, damaged, or missing items are replaced
 * free within 30 days. One email: eclpeptides@gmail.com."
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Guarantee {

    public function __construct() {
        // Render guarantee block after COA module (priority 20 = after COA's 15).
        add_action( 'woocommerce_single_product_summary', array( $this, 'render_guarantee_block' ), 20 );

        // Add guarantee section to the refund policy page via shortcode.
        add_shortcode( 'ecl_guarantee', array( $this, 'render_guarantee_shortcode' ) );
    }

    /**
     * Get the guarantee text, allowing filter overrides.
     *
     * @return string
     */
    public function get_guarantee_text(): string {
        $text = ecl_setting( 'guarantee_text', $this->get_default_text() );

        /**
         * Filter the guarantee text.
         * Use this to customize per-product or per-category if needed.
         */
        return apply_filters( 'ecl_guarantee_text', $text );
    }

    /**
     * Default guarantee text.
     */
    private function get_default_text(): string {
        $purity = ecl_setting( 'purity_pct', '98' );
        $email = ecl_setting( 'support_email', 'eclpeptides@gmail.com' );

        return "Every vial ships with an independent COA. If any independent lab test shows your batch below {$purity}% purity, we refund or replace it — and we cover the cost of the test. Wrong, damaged, or missing items are replaced free within 30 days. One email: {$email}.";
    }

    /**
     * Render the guarantee block on single product pages.
     */
    public function render_guarantee_block(): void {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return;
        }

        $text = $this->get_guarantee_text();
        $purity = ecl_setting( 'purity_pct', '98' );

        // Load template.
        $template = ECL_PLUGIN_DIR . 'templates/guarantee-block.php';
        if ( file_exists( $template ) ) {
            include $template;
        }
    }

    /**
     * Shortcode renderer for use on the refund policy page.
     *
     * @param array $atts
     * @return string
     */
    public function render_guarantee_shortcode( array $atts = array() ): string {
        $text = $this->get_guarantee_text();
        $purity = ecl_setting( 'purity_pct', '98' );
        $email = ecl_setting( 'support_email', 'eclpeptides@gmail.com' );

        ob_start();
        ?>
        <div class="ecl-guarantee-block ecl-guarantee-block--full">
            <div class="ecl-guarantee-block__header">
                <span class="ecl-guarantee-block__icon">🛡️</span>
                <h3>Purity Guarantee</h3>
            </div>
            <p class="ecl-guarantee-block__text"><?php echo esc_html( $text ); ?></p>
            <div class="ecl-guarantee-block__details">
                <p><strong>What's covered:</strong></p>
                <ul>
                    <li>Purity verification: if any independent lab test shows your batch below <?php echo esc_html( $purity ); ?>% purity, we refund or replace — and we cover the test cost.</li>
                    <li>Wrong, damaged, or missing items: replaced free within 30 days of delivery.</li>
                    <li>COA included with every order: verify independently before you use it.</li>
                </ul>
            </div>
            <p class="ecl-guarantee-block__cta">
                Questions? Email <a href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a>
            </p>
        </div>
        <?php
        return ob_get_clean();
    }
}
