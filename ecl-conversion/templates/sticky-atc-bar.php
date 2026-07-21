<?php
/**
 * Sticky ATC Bar Template — Phase 4.1
 *
 * Variables in scope:
 * @var WC_Product $product           Product object.
 * @var string     $initial_price     Formatted initial price.
 * @var int        $initial_vial_count Vial count of default tier.
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="ecl-sticky-atc" id="ecl-sticky-atc" aria-hidden="true">
    <div class="ecl-sticky-atc__inner">
        <div class="ecl-sticky-atc__product">
            <span class="ecl-sticky-atc__name"><?php echo esc_html( $product->get_name() ); ?></span>
            <span class="ecl-sticky-atc__price" data-sticky-price>
                <?php echo wp_kses_post( wc_price( $initial_price ) ); ?>
                <?php if ( $initial_vial_count > 1 ) : ?>
                    <span class="ecl-sticky-atc__per-vial" data-sticky-per-vial>
                        (<?php echo wp_kses_post( wc_price( $initial_price / $initial_vial_count ) ); ?>/vial)
                    </span>
                <?php endif; ?>
            </span>
        </div>
        <div class="ecl-sticky-atc__actions">
            <button type="button"
                    class="ecl-sticky-atc__button button alt"
                    data-sticky-add-to-cart
                    data-product-id="<?php echo esc_attr( $product->get_id() ); ?>">
                Add to Cart
            </button>
        </div>
    </div>
</div>
