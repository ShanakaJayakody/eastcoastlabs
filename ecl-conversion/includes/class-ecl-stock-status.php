<?php
/**
 * Stock Status Module — Phase 0.3
 *
 * Replaces the hardcoded "In stock — ships today" line with a real
 * per-product stock status driven by WooCommerce inventory.
 *
 * Logic:
 * - In stock:        "In stock — dispatched within 1 business day"
 * - On backorder:    "Made to order — allow 7–12 business days"
 * - Out of stock:    "Currently out of stock — next batch expected [date if available]"
 *
 * Removes any hardcoded backorder banner text via content filtering.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Stock_Status {

    public function __construct() {
        // Render stock status line on single product pages.
        add_action( 'woocommerce_single_product_summary', array( $this, 'render_stock_status' ), 10 );

        // Also render on the shop/catalog loop for quick visibility.
        add_action( 'woocommerce_after_shop_loop_item_title', array( $this, 'render_loop_stock_status' ), 15 );

        // Filter to remove any hardcoded "ships today" text in product short descriptions.
        add_filter( 'woocommerce_short_description', array( $this, 'remove_hardcoded_ships_today' ), 10 );
        add_filter( 'the_content', array( $this, 'remove_hardcoded_backorder_banner' ), 10 );
    }

    /**
     * Get the stock status text for a product.
     *
     * @param WC_Product $product
     * @return array{ text: string, class: string }
     */
    public function get_stock_status_text( WC_Product $product ): array {
        $stock_status = $product->get_stock_status();
        $manage_stock = $product->get_manage_stock();

        switch ( $stock_status ) {
            case 'instock':
                return array(
                    'text'  => 'In stock — dispatched within 1 business day',
                    'class' => 'ecl-stock--in',
                );

            case 'onbackorder':
                // Check if this is managed stock with a backorder allowed setting.
                return array(
                    'text'  => 'Made to order — allow 7–12 business days',
                    'class' => 'ecl-stock--backorder',
                );

            case 'outofstock':
            default:
                // Try to get restock date from meta if available.
                $restock_date = $product->get_meta( '_ecl_restock_date' );
                $text = 'Currently out of stock';
                if ( ! empty( $restock_date ) ) {
                    $formatted = wp_date( 'j F Y', strtotime( $restock_date ) );
                    $text .= " — next batch expected {$formatted}";
                }
                return array(
                    'text'  => $text,
                    'class' => 'ecl-stock--out',
                );
        }
    }

    /**
     * Render stock status on single product pages.
     * Hooks into woocommerce_single_product_summary at priority 10
     * (after title/price/rating, before add-to-cart).
     */
    public function render_stock_status(): void {
        global $product;
        if ( ! $product instanceof WC_Product ) {
            return;
        }

        // For variable products, show the stock status of the default/first variation.
        if ( $product instanceof WC_Product_Variable ) {
            $variations = $product->get_available_variations( 'objects' );
            if ( ! empty( $variations ) ) {
                // Find the default variation.
                $default_attrs = $product->get_default_attributes();
                $display_product = $variations[0]; // fallback to first
                foreach ( $variations as $variation ) {
                    $variation_attrs = $variation->get_attributes();
                    $match = true;
                    foreach ( $default_attrs as $key => $value ) {
                        if ( ( $variation_attrs[ 'attribute_' . $key ] ?? '' ) !== $value ) {
                            $match = false;
                            break;
                        }
                    }
                    if ( $match ) {
                        $display_product = $variation;
                        break;
                    }
                }
                $product = $display_product;
            }
        }

        $status = $this->get_stock_status_text( $product );

        echo '<p class="ecl-stock-status ' . esc_attr( $status['class'] ) . '" data-stock="' . esc_attr( $product->get_stock_status() ) . '">';
        echo '<span class="ecl-stock-status__dot"></span>';
        echo esc_html( $status['text'] );
        echo '</p>';
    }

    /**
     * Compact stock status for the shop loop.
     */
    public function render_loop_stock_status(): void {
        global $product;
        if ( ! $product instanceof WC_Product ) {
            return;
        }

        $status = $this->get_stock_status_text( $product );
        // Shorter text for loop.
        $text = $product->is_in_stock()
            ? 'In stock'
            : ( 'onbackorder' === $product->get_stock_status() ? 'Made to order' : 'Out of stock' );

        echo '<p class="ecl-loop-stock ' . esc_attr( $status['class'] ) . '">' . esc_html( $text ) . '</p>';
    }

    /**
     * Remove hardcoded "ships today" text from product descriptions.
     * This catches instances left in post content that the admin couldn't clean up.
     */
    public function remove_hardcoded_ships_today( string $content ): string {
        // Match common patterns.
        $patterns = array(
            '/In stock\s*[-—]\s*ships today/i',
            '/Ships today/i',
            '/In stock\s*[-—]\s*ships same day/i',
            '/Same.?day dispatch/i',
        );

        foreach ( $patterns as $pattern ) {
            $content = preg_replace( $pattern, '', $content );
        }

        return $content;
    }

    /**
     * Remove hardcoded backorder banner from page content.
     * Targets the stale "ON BACK ORDER. ORDERS PLACED AFTER 3:30PM JUNE 20..." text.
     */
    public function remove_hardcoded_backorder_banner( string $content ): string {
        // Match the backorder banner pattern.
        $pattern = '/ON BACK ORDER\.?\s*ORDERS PLACED AFTER.*?(?:JUNE|MAY|JULY|AUGUST)\s*\d{1,2}[^<]*<\/?(?:div|span|p)[^>]*>/is';

        if ( preg_match( $pattern, $content ) ) {
            $content = preg_replace( $pattern, '', $content );
        }

        // Also match without closing tags (text-only).
        $pattern2 = '/ON BACK ORDER\.?\s*ORDERS PLACED AFTER\s*\d{1,2}:\d{2}(?:pm|am)?\s*(?:JUNE|MAY|JULY|AUGUST)\s*\d{1,2}[^<]*/i';
        $content = preg_replace( $pattern2, '', $content );

        return $content;
    }
}
