<?php
/**
 * Final CTA Strip Module — Phase 4.1 (section 10)
 *
 * Renders a call-to-action strip at the bottom of PDP content:
 * "From ${six_pack_per_vial}/vial in 6-packs — Choose your pack"
 * with a scroll-to-buy-box button.
 *
 * Per-vial value computed from the product's 6-pack variant price.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_CTA_Strip {

    public function __construct() {
        // Render after the product tabs (near the bottom of the PDP).
        add_action( 'woocommerce_after_single_product_summary', array( $this, 'render_cta_strip' ), 30 );
    }

    /**
     * Render the final CTA strip.
     */
    public function render_cta_strip(): void {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return;
        }

        $per_vial_6pk = null;

        // Calculate per-vial price from 6-pack variant.
        if ( $product instanceof WC_Product_Variable ) {
            $variations = $product->get_available_variations( 'objects' );
            foreach ( $variations as $variation ) {
                $attrs = $variation->get_attributes();
                foreach ( $attrs as $name => $value ) {
                    if ( ( false !== stripos( $name, 'pack' ) || false !== stripos( $name, 'size' ) )
                         && strpos( $value, '6' ) !== false ) {
                        $price = (float) $variation->get_price();
                        $per_vial_6pk = $price / 6;
                        break 2;
                    }
                }
            }
        }

        // If no 6-pack, try 3-pack.
        if ( null === $per_vial_6pk && $product instanceof WC_Product_Variable ) {
            $variations = $product->get_available_variations( 'objects' );
            foreach ( $variations as $variation ) {
                $attrs = $variation->get_attributes();
                foreach ( $attrs as $name => $value ) {
                    if ( ( false !== stripos( $name, 'pack' ) || false !== stripos( $name, 'size' ) )
                         && strpos( $value, '3' ) !== false ) {
                        $price = (float) $variation->get_price();
                        $per_vial_6pk = $price / 3;
                        break 2;
                    }
                }
            }
        }

        // If still no pack price, use single price.
        if ( null === $per_vial_6pk ) {
            $per_vial_6pk = (float) $product->get_price();
        }

        $per_vial_formatted = wc_price( $per_vial_6pk );
        ?>
        <div class="ecl-cta-strip">
            <div class="ecl-cta-strip__content">
                <p class="ecl-cta-strip__price">
                    From <strong><?php echo wp_kses_post( $per_vial_formatted ); ?></strong> /vial in 6-packs
                </p>
                <a href="#" class="ecl-cta-strip__button button alt" data-scroll-to=".ecl-tier-cards">
                    Choose your pack
                </a>
            </div>
            <p class="ecl-cta-strip__guarantee">
                🛡️ Purity guaranteed — we cover the test. 1-business-day dispatch. Free shipping over $150.
            </p>
        </div>
        <?php
    }
}
