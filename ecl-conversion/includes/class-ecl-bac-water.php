<?php
/**
 * Bac Water Attach + Cross-Sells Module — Phase 2.3
 *
 * Features:
 * 1. Checkbox on peptide PDPs: "Add Bacteriostatic Water (10mL) +$19.99 — required for reconstitution"
 * 2. Auto-add free Bacteriostatic Water when a 6-pack variant is in cart (Phase 2.6)
 * 3. Curated cross-sell mappings (replaces default related products)
 * 4. Remove free bac water if the 6-pack is removed from cart
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Bac_Water {

    /**
     * Cart item key used to identify the free gift.
     */
    private const FREE_GIFT_KEY = '_ecl_free_bac_water';

    public function __construct() {
        // Bac water attach checkbox on PDP (under the buy box).
        add_action( 'woocommerce_after_add_to_cart_button', array( $this, 'render_bac_water_checkbox' ) );

        // Handle the checkbox when adding to cart.
        add_filter( 'woocommerce_add_cart_item_data', array( $this, 'handle_bac_water_attach' ), 10, 3 );

        // Auto-add free bac water when 6-pack is in cart.
        add_action( 'woocommerce_add_to_cart', array( $this, 'maybe_add_free_bac_water' ), 10, 6 );

        // Remove free bac water when 6-pack is removed.
        add_action( 'woocommerce_remove_cart_item_from_session', array( $this, 'maybe_remove_free_bac_water' ) );
        add_action( 'woocommerce_cart_item_removed', array( $this, 'handle_cart_item_removed' ), 10, 2 );

        // Prevent free bac water from being manually quantity-changed.
        add_filter( 'woocommerce_cart_item_quantity', array( $this, 'lock_free_gift_quantity' ), 10, 3 );

        // Make free bac water price $0.
        add_filter( 'woocommerce_product_get_price', array( $this, 'free_gift_price' ), 10, 2 );
        add_filter( 'woocommerce_product_get_sale_price', array( $this, 'free_gift_price' ), 10, 2 );
        add_filter( 'woocommerce_product_get_regular_price', array( $this, 'free_gift_price' ), 10, 2 );

        // Set curated cross-sells.
        add_filter( 'woocommerce_cross_sell_ids', array( $this, 'set_curated_cross_sells' ), 10, 2 );

        // Add free express shipping class for 6-pack orders.
        add_filter( 'woocommerce_package_rates', array( $this, 'apply_6pk_free_express' ), 10, 2 );
    }

    /**
     * Get the Bacteriostatic Water product ID.
     */
    private function get_bac_water_id(): int {
        $id = (int) ecl_setting( 'bac_water_product_id', 0 );
        if ( ! $id ) {
            // Try to find by name/slug.
            $products = wc_get_products( array(
                'limit'      => 1,
                'status'     => 'publish',
                'return'     => 'ids',
                'search'     => 'Bacteriostatic Water',
            ) );
            $id = ! empty( $products ) ? (int) $products[0] : 0;
        }
        return $id;
    }

    /**
     * Render the bac water attach checkbox on peptide PDPs.
     */
    public function render_bac_water_checkbox(): void {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return;
        }

        // Only show on peptide products (not on bac water itself).
        if ( ! ecl_is_peptide_product( $product ) ) {
            return;
        }

        $bac_id = $this->get_bac_water_id();
        if ( ! $bac_id ) {
            return;
        }

        $bac_product = wc_get_product( $bac_id );
        if ( ! $bac_product ) {
            return;
        }

        $price = $bac_product->get_price();
        ?>
        <div class="ecl-bac-water-attach">
            <label class="ecl-bac-water-attach__label">
                <input type="checkbox"
                       name="ecl_add_bac_water"
                       value="<?php echo esc_attr( $bac_id ); ?>"
                       class="ecl-bac-water-attach__input" />
                <span class="ecl-bac-water-attach__text">
                    Add Bacteriostatic Water (10mL)
                    <strong>+<?php echo wp_kses_post( wc_price( $price ) ); ?></strong>
                    <span class="ecl-bac-water-attach__note">— required for reconstitution</span>
                </span>
            </label>
        </div>
        <?php
    }

    /**
     * Handle the bac water checkbox when adding a product to cart.
     */
    public function handle_bac_water_attach( array $cart_item_data, int $product_id, int $variation_id ): array {
        if ( empty( $_POST['ecl_add_bac_water'] ) ) {
            return $cart_item_data;
        }

        $bac_id = (int) $_POST['ecl_add_bac_water'];
        $bac_product = wc_get_product( $bac_id );

        if ( ! $bac_product || ! $bac_product->is_type( 'simple' ) ) {
            return $cart_item_data;
        }

        // Add the bac water as a separate cart item.
        WC()->cart->add_to_cart( $bac_id, 1, 0, array(), array(
            '_ecl_attached_to' => $variation_id ?: $product_id,
        ) );

        return $cart_item_data;
    }

    /**
     * Check if a cart item is a 6-pack variation.
     */
    private function is_6pk_cart_item( array $cart_item ): bool {
        if ( empty( $cart_item['variation_id'] ) ) {
            return false;
        }

        $variation = wc_get_product( $cart_item['variation_id'] );
        if ( ! $variation ) {
            return false;
        }

        $attrs = $variation->get_attributes();
        foreach ( $attrs as $name => $value ) {
            if ( ( false !== stripos( $name, 'pack' ) || false !== stripos( $name, 'size' ) )
                 && false !== stripos( $value, '6' ) ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Auto-add free Bacteriostatic Water when a 6-pack is added to cart.
     */
    public function maybe_add_free_bac_water( string $cart_item_key, int $product_id, int $quantity, int $variation_id, array $variation, array $cart_item_data ): void {
        $bac_id = $this->get_bac_water_id();
        if ( ! $bac_id ) {
            return;
        }

        // Check if this is a 6-pack.
        $cart_item = WC()->cart->get_cart_item( $cart_item_key );
        if ( ! $cart_item || ! $this->is_6pk_cart_item( $cart_item ) ) {
            return;
        }

        // Check if free bac water already in cart.
        foreach ( WC()->cart->get_cart() as $item ) {
            if ( isset( $item[ self::FREE_GIFT_KEY ] ) ) {
                return; // Already added.
            }
        }

        // Add the free bac water.
        WC()->cart->add_to_cart( $bac_id, 1, 0, array(), array(
            self::FREE_GIFT_KEY      => true,
            '_ecl_free_gift_for'      => $cart_item_key,
        ) );

        wc_add_notice( 'Free Bacteriostatic Water added with your 6-pack!', 'success' );
    }

    /**
     * Handle cart item removal — remove free bac water if the 6-pack is removed.
     */
    public function handle_cart_item_removed( string $cart_item_key, WC_Cart $cart ): void {
        $removed_item = $cart->removed_cart_contents[ $cart_item_key ] ?? null;
        if ( ! $removed_item ) {
            return;
        }

        // If a 6-pack was removed, remove the free bac water.
        if ( $this->is_6pk_cart_item( $removed_item ) ) {
            foreach ( $cart->get_cart() as $key => $item ) {
                if ( isset( $item[ self::FREE_GIFT_KEY ] ) ) {
                    $cart->remove_cart_item( $key );
                }
            }
        }
    }

    /**
     * Prevent free bac water quantity changes.
     */
    public function lock_free_gift_quantity( string $quantity_html, string $cart_item_key, array $cart_item ): string {
        if ( isset( $cart_item[ self::FREE_GIFT_KEY ] ) ) {
            return '<span class="ecl-free-gift-qty">FREE (1)</span>';
        }
        return $quantity_html;
    }

    /**
     * Set price to $0 for free gift bac water.
     */
    public function free_gift_price( $price, $product ) {
        if ( ! is_admin() && did_action( 'woocommerce_before_calculate_totals' ) >= 0 ) {
            // Check each cart item.
            if ( WC()->cart ) {
                foreach ( WC()->cart->get_cart() as $cart_item ) {
                    if ( isset( $cart_item[ self::FREE_GIFT_KEY ] )
                         && $cart_item['product_id'] == $product->get_id() ) {
                        return 0;
                    }
                }
            }
        }
        return $price;
    }

    /**
     * Maybe remove free bac water from session (if 6-pack no longer present).
     */
    public function maybe_remove_free_bac_water( array $session_data, array $values ): array {
        // This runs when cart session is restored — check if 6-pack still exists.
        return $session_data;
    }

    /**
     * Curated cross-sell mappings.
     */
    private array $cross_sell_map = array(
        // BPC-157 ↔ TB-500 (classic pairing)
        'bpc-157'   => array( 'tb-500', 'bacteriostatic-water' ),
        'tb-500'    => array( 'bpc-157', 'bacteriostatic-water' ),
        // GHK-Cu ↔ GLOW
        'ghk-cu'    => array( 'glow', 'bacteriostatic-water' ),
        'glow'      => array( 'ghk-cu', 'bacteriostatic-water' ),
        // KLOW ↔ IGF-1 LR3
        'klow'      => array( 'igf-1-lr3', 'bacteriostatic-water' ),
        'igf-1-lr3' => array( 'klow', 'bacteriostatic-water' ),
        // Semaglutide ↔ Tirzepatide (GLP-1 pair)
        'semaglutide'  => array( 'tirzepatide', 'bacteriostatic-water' ),
        'tirzepatide'  => array( 'semaglutide', 'retatrutide' ),
        'retatrutide'  => array( 'tirzepatide', 'semaglutide' ),
        // Tesamorelin ↔ MOTS-C
        'tesamorelin' => array( 'mots-c', 'bacteriostatic-water' ),
        'mots-c'       => array( 'tesamorelin', 'bacteriostatic-water' ),
        // Selank ↔ Semax
        'selank' => array( 'semax', 'bacteriostatic-water' ),
        'semax'  => array( 'selank', 'bacteriostatic-water' ),
        // MT2 default
        'mt2' => array( 'bacteriostatic-water', 'bpc-157' ),
    );

    /**
     * Set curated cross-sell IDs for a product.
     */
    public function set_curated_cross_sells( array $cross_sell_ids, WC_Product $product ): array {
        // Find the product slug in our map.
        $slug = $product->get_slug();

        // Try direct slug match.
        if ( isset( $this->cross_sell_map[ $slug ] ) ) {
            $mapped_slugs = $this->cross_sell_map[ $slug ];
        } else {
            // Try fuzzy match on product name.
            $name = strtolower( $product->get_name() );
            $mapped_slugs = null;
            foreach ( $this->cross_sell_map as $key => $slugs ) {
                if ( false !== strpos( $name, str_replace( '-', ' ', $key ) ) ) {
                    $mapped_slugs = $slugs;
                    break;
                }
            }
            if ( null === $mapped_slugs ) {
                // Default: bac water + a bestseller.
                $mapped_slugs = array( 'bacteriostatic-water', 'bpc-157' );
            }
        }

        // Resolve slugs to product IDs.
        $resolved = array();
        foreach ( $mapped_slugs as $slug ) {
            $found = wc_get_products( array(
                'limit'  => 1,
                'return' => 'ids',
                'slug'   => $slug,
            ) );
            if ( ! empty( $found ) ) {
                $resolved[] = (int) $found[0];
            }
        }

        return $resolved;
    }

    /**
     * Apply free Express shipping for orders containing a 6-pack.
     */
    public function apply_6pk_free_express( array $rates, array $package ): array {
        $has_6pk = false;

        foreach ( WC()->cart->get_cart() as $cart_item ) {
            if ( $this->is_6pk_cart_item( $cart_item ) ) {
                $has_6pk = true;
                break;
            }
        }

        if ( ! $has_6pk ) {
            return $rates;
        }

        // Make express shipping free; keep standard as-is.
        foreach ( $rates as $rate_id => $rate ) {
            if ( false !== stripos( $rate->label, 'express' ) ) {
                $rate->cost = 0;
                $rate->label = 'FREE Express Post (6-pack perk)';
            }
        }

        return $rates;
    }
}
