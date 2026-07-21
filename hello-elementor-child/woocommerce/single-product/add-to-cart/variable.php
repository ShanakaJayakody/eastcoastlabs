<?php
/**
 * Variable Product Add-to-Cart Template — Radio Tier Card Override
 *
 * Replaces WooCommerce's default variation dropdown with radio-card
 * tier selector for ECL's 1/3/6-vial pack structure.
 *
 * This template is loaded by the ecl_child_locate_template filter
 * in the child theme's functions.php.
 *
 * @package HelloElementorChild
 * @version 1.6.4 (WooCommerce compatibility)
 */

defined( 'ABSPATH' ) || exit;

global $product;

/** @var WC_Product_Variable $product */

// Ensure this is a variable product.
if ( ! $product instanceof WC_Product_Variable ) {
    // Fallback to Woo core template if somehow loaded for wrong type.
    woocommerce_template_single_add_to_cart();
    return;
}

// Get available variations (sorted by menu_order / price).
$variations       = $product->get_available_variations();
$available_attrs  = $product->get_variation_attributes();
$default_attrs    = $product->get_default_attributes();

// ECL tier configuration — maps variation attribute values to tier metadata.
$tier_config = array(
    '1 vial'  => array(
        'badge'      => '',
        'is_default' => false,
    ),
    '3 vials' => array(
        'badge'      => 'MOST POPULAR',
        'is_default' => true,
    ),
    '6 vials' => array(
        'badge'      => 'BEST VALUE — SAVE 25%',
        'is_default' => false,
    ),
);

// The pack-size attribute name (case-insensitive search).
$pack_attr_key = '';
foreach ( $available_attrs as $attr_name => $options ) {
    if ( false !== stripos( $attr_name, 'pack' ) || false !== stripos( $attr_name, 'size' ) ) {
        $pack_attr_key = $attr_name;
        break;
    }
}

// If no pack attribute found, fall back to default WooCommerce template.
if ( empty( $pack_attr_key ) ) {
    wc_get_template( 'single-product/add-to-cart/variable.php', array(), '', WC()->plugin_path() . '/templates/' );
    return;
}
?>

<div class="ecl-tier-cards" data-product-id="<?php echo esc_attr( $product->get_id() ); ?>" data-pack-attr="<?php echo esc_attr( $pack_attr_key ); ?>">

    <div class="ecl-tier-cards__header">
        <span class="ecl-tier-cards__label">Choose your pack</span>
    </div>

    <div class="ecl-tier-cards__grid" role="radiogroup" aria-label="Pack size selection">

        <?php foreach ( $variations as $variation ) :

            $variation_id   = $variation['variation_id'];
            $variation_obj  = wc_get_product( $variation_id );
            if ( ! $variation_obj ) {
                continue;
            }

            // Determine pack label from variation attributes.
            $variation_attrs = $variation_obj->get_variation_attributes();
            $pack_label      = '';
            foreach ( $variation_attrs as $attr => $value ) {
                if ( false !== stripos( $attr, 'pack' ) || false !== stripos( $attr, 'size' ) ) {
                    $pack_label = $value;
                    break;
                }
            }
            if ( empty( $pack_label ) ) {
                continue;
            }

            // Normalize key for config lookup.
            $pack_key        = strtolower( trim( $pack_label ) );
            $config          = $tier_config[ $pack_label ] ?? array( 'badge' => '', 'is_default' => false );
            $is_default      = $config['is_default'];
            $badge           = $config['badge'];

            $regular_price   = (float) $variation_obj->get_regular_price();
            $sale_price      = (float) $variation_obj->get_sale_price();
            $effective_price = $sale_price > 0 ? $sale_price : $regular_price;
            $has_anchor      = $sale_price > 0 && $sale_price < $regular_price;

            // Per-vial price calculation.
            $vial_count = 1;
            if ( strpos( $pack_key, '6' ) !== false ) {
                $vial_count = 6;
            } elseif ( strpos( $pack_key, '3' ) !== false ) {
                $vial_count = 3;
            }
            $per_vial = $vial_count > 0 ? ( $effective_price / $vial_count ) : $effective_price;

            // 6-pack perk line.
            $has_6pk_perk = ( 6 === $vial_count );
            $is_in_stock  = $variation_obj->is_in_stock();
            ?>

            <label class="ecl-tier-card <?php echo $is_default ? 'ecl-tier-card--selected' : ''; ?> <?php echo ! $is_in_stock ? 'ecl-tier-card--out-of-stock' : ''; ?>"
                   data-variation-id="<?php echo esc_attr( $variation_id ); ?>"
                   data-pack-label="<?php echo esc_attr( $pack_label ); ?>"
                   data-price="<?php echo esc_attr( $effective_price ); ?>"
                   data-per-vial="<?php echo esc_attr( number_format( $per_vial, 2 ) ); ?>"
                   data-vial-count="<?php echo esc_attr( $vial_count ); ?>">

                <input type="radio"
                       name="ecl-tier-selection"
                       value="<?php echo esc_attr( $variation_id ); ?>"
                       class="ecl-tier-card__input"
                       <?php checked( $is_default ); ?>
                       <?php disabled( ! $is_in_stock ); ?>
                       aria-label="<?php echo esc_attr( $pack_label ); ?>" />

                <?php if ( ! empty( $badge ) ) : ?>
                    <span class="ecl-tier-card__badge ecl-tier-card__badge--<?php echo esc_attr( $pack_key === '3 vials' ? 'popular' : 'value' ); ?>">
                        <?php echo esc_html( $badge ); ?>
                    </span>
                <?php endif; ?>

                <span class="ecl-tier-card__pack"><?php echo esc_html( $pack_label ); ?></span>

                <span class="ecl-tier-card__price-row">
                    <?php if ( $has_anchor ) : ?>
                        <span class="ecl-tier-card__anchor"><?php echo wc_price( $regular_price ); ?></span>
                    <?php endif; ?>
                    <span class="ecl-tier-card__total"><?php echo wc_price( $effective_price ); ?></span>
                </span>

                <?php if ( $vial_count > 1 ) : ?>
                    <span class="ecl-tier-card__per-vial">
                        <?php echo wc_price( $per_vial ); ?> per vial
                    </span>
                <?php endif; ?>

                <?php if ( $has_6pk_perk ) : ?>
                    <span class="ecl-tier-card__perk">
                        Includes FREE Bacteriostatic Water + FREE Express Post
                    </span>
                <?php endif; ?>

                <?php if ( ! $is_in_stock ) : ?>
                    <span class="ecl-tier-card__stock ecl-tier-card__stock--out">Currently unavailable</span>
                <?php endif; ?>
            </label>

        <?php endforeach; ?>

    </div>

    <!-- WooCommerce hidden variation data (required for add-to-cart to work) -->
    <table class="variations ecl-variations-hidden" cellspacing="0" style="display:none;">
        <tbody>
        <?php foreach ( $available_attrs as $attribute_name => $options ) :
            $sanitized_name = sanitize_title( $attribute_name );
            ?>
            <tr>
                <td class="label"><label for="<?php echo esc_attr( $sanitized_name ); ?>"><?php echo esc_html( wc_attribute_label( $attribute_name ) ); ?></label></td>
                <td class="value">
                    <?php
                    $selected = isset( $_REQUEST[ 'attribute_' . $sanitized_name ] ) ? wc_clean( wp_unslash( $_REQUEST[ 'attribute_' . $sanitized_name ] ) ) : $product->get_attribute( $attribute_name );
                    // Pre-select the 3-pack (default).
                    if ( $attribute_name === $pack_attr_key && empty( $selected ) ) {
                        $selected = '3 vials';
                    }
                    wc_dropdown_variation_attribute_options( array(
                        'options'   => $options,
                        'attribute' => $attribute_name,
                        'product'   => $product,
                        'selected'  => $selected,
                        'id'        => $sanitized_name,
                        'class'     => 'ecl-hidden-select',
                    ) );
                    ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>

    <!-- Quantity + Add to Cart -->
    <div class="ecl-tier-cards__actions">
        <?php
        // Quantity selector (hidden by default for variations, controlled by JS).
        woocommerce_quantity_input( array(
            'min_value'   => apply_filters( 'woocommerce_quantity_input_min', $product->get_min_purchase_quantity(), $product ),
            'max_value'   => apply_filters( 'woocommerce_quantity_input_max', $product->get_max_purchase_quantity(), $product ),
            'input_value' => isset( $_POST['quantity'] ) ? wc_stock_amount( wp_unslash( $_POST['quantity'] ) ) : $product->get_min_purchase_quantity(),
        ), $product );
        ?>

        <button type="submit"
                class="single_add_to_cart_button button alt<?php echo esc_attr( wc_wp_theme_get_element_class_name( 'button' ) ? ' ' . wc_wp_theme_get_element_class_name( 'button' ) : '' ); ?>"
                name="add-to-cart"
                value="<?php echo esc_attr( $product->get_id() ); ?>">
            <?php echo esc_html( $product->single_add_to_cart_text() ); ?>
        </button>

        <input type="hidden" name="product_id" value="<?php echo esc_attr( absint( $product->get_id() ) ); ?>" />
        <input type="hidden" name="variation_id" class="variation_id" value="" />
    </div>

    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr( absint( $product->get_id() ) ); ?>" />
</div>

<?php
// Guarantee microcopy under ATC (Phase 4.3).
if ( function_exists( 'ecl_render_guarantee_microcopy' ) ) {
    ecl_render_guarantee_microcopy();
}
?>
