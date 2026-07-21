<?php
/**
 * ECL Conversion — WP-CLI Commands
 *
 * Available commands:
 *
 *   wp ecl convert-products     Convert simple products to variable with 1/3/6 vial tiers
 *   wp ecl import-coa           Import COA data from CSV into product meta
 *   wp ecl scan-consistency     Scan database for trust/consistency issues
 *   wp ecl set-cross-sells      Apply curated cross-sell mappings from JSON
 *   wp ecl create-welcome15     Create the WELCOME15 coupon
 *   wp ecl create-bulk-packs    Create the Bulk Packs collection page
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

WP_CLI::add_command( 'ecl', 'ECL_CLI_Commands' );

class ECL_CLI_Commands {

    /**
     * Convert simple peptide products to variable products with 1/3/6 vial tiers.
     *
     * ## OPTIONS
     *
     * [--dry-run]
     * : Show what would be changed without making any changes.
     *
     * [--product-id=<id>]
     * : Convert only this specific product ID.
     *
     * ## EXAMPLES
     *
     *     wp ecl convert-products --dry-run
     *     wp ecl convert-products --product-id=123
     *     wp ecl convert-products
     *
     * @subcommand convert-products
     */
    public function convert_products( array $args, array $assoc_args ): void {
        $dry_run = isset( $assoc_args['dry-run'] );
        $product_id_filter = $assoc_args['product-id'] ?? null;

        // Load price table.
        $price_table_path = ECL_PLUGIN_DIR . 'data/price-table.json';
        $price_data = json_decode( file_get_contents( $price_table_path ), true );

        if ( ! $price_data || empty( $price_data['products'] ) ) {
            WP_CLI::error( 'Could not load price table from data/price-table.json' );
        }

        WP_CLI::log( '=== ECL Product Converter ===' );
        WP_CLI::log( 'Mode: ' . ( $dry_run ? 'DRY RUN' : 'LIVE' ) );
        WP_CLI::log( '' );

        $converted = 0;
        $skipped = 0;
        $errors = 0;

        foreach ( $price_data['products'] as $product_entry ) {
            $slug = $product_entry['slug'];
            $name = $product_entry['name'];

            // Find the product by slug.
            $query_args = array(
                'status' => 'publish',
                'limit'  => 1,
                'return' => 'ids',
            );

            if ( $product_id_filter ) {
                $query_args['include'] = array( (int) $product_id_filter );
            } else {
                $query_args['slug'] = $slug;
            }

            $product_ids = wc_get_products( $query_args );

            if ( empty( $product_ids ) ) {
                WP_CLI::warning( "Product '{$name}' (slug: {$slug}) not found — skipping." );
                $skipped++;
                continue;
            }

            $product_id = $product_ids[0];
            $product = wc_get_product( $product_id );

            if ( ! $product ) {
                WP_CLI::warning( "Could not load product ID {$product_id}." );
                $errors++;
                continue;
            }

            // Skip if already variable.
            if ( $product->is_type( 'variable' ) ) {
                WP_CLI::log( "  ✓ '{$name}' already variable — skipping." );
                $skipped++;
                continue;
            }

            $prices = $product_entry['prices'];

            if ( $dry_run ) {
                WP_CLI::log( "  [DRY RUN] Would convert '{$name}' (ID: {$product_id}):" );
                WP_CLI::log( "    Simple price: \${$product->get_price()}" );
                WP_CLI::log( "    1 vial:  \${$prices['1_vial']}" );
                WP_CLI::log( "    3-pack:  \${$prices['3_pack']} ({$prices['3_pack_per_vial']}/vial)" );
                WP_CLI::log( "    6-pack:  \${$prices['6_pack']} ({$prices['6_pack_per_vial']}/vial)" );
                $converted++;
                continue;
            }

            // ── LIVE conversion ──

            WP_CLI::log( "  Converting '{$name}' (ID: {$product_id})..." );

            // Step 1: Remove fake sale price, set regular price = current sale price.
            $current_sale = $product->get_sale_price();
            $current_regular = $product->get_regular_price();

            $new_regular = $prices['1_vial'];

            $product->set_regular_price( $new_regular );
            $product->set_sale_price( '' ); // Kill the fake compare-at.
            $product->set_price( $new_regular );

            WP_CLI::log( "    Removed sale price (was: \${$current_sale}). Regular set to \${$new_regular}." );

            // Step 2: Convert to variable product.
            $new_product = new WC_Product_Variable();
            $new_product->set_id( $product_id ); // Reuse the same post.
            // Actually, we need to change the type in the database directly.

            // Use WooCommerce's built-in type change.
            wp_set_object_terms( $product_id, 'variable', 'product_type' );

            // Reload product.
            $product = wc_get_product( $product_id );

            // Step 3: Create the "Pack Size" attribute.
            $attribute = new WC_Product_Attribute();
            $attribute->set_name( 'Pack Size' );
            $attribute->set_options( array( '1 vial', '3 vials', '6 vials' ) );
            $attribute->set_position( 0 );
            $attribute->set_visible( true );
            $attribute->set_variation( true );

            $product->set_attributes( array( 'pa_pack-size' => $attribute ) );
            $product->save();

            WP_CLI::log( "    Created 'Pack Size' attribute: 1 vial | 3 vials | 6 vials" );

            // Step 4: Create variations.
            $tier_data = array(
                array(
                    'label'       => '1 vial',
                    'price'       => $prices['1_vial'],
                    'regular'     => $prices['1_vial'],
                    'sale'        => '',
                    'sku_suffix'  => '',
                    'vial_count'  => 1,
                ),
                array(
                    'label'       => '3 vials',
                    'price'       => $prices['3_pack'],
                    'regular'     => $prices['1_vial'] * 3, // Anchor: N× single.
                    'sale'        => $prices['3_pack'],
                    'sku_suffix'  => '-3PK',
                    'vial_count'  => 3,
                ),
                array(
                    'label'       => '6 vials',
                    'price'       => $prices['6_pack'],
                    'regular'     => $prices['1_vial'] * 6, // Anchor: N× single.
                    'sale'        => $prices['6_pack'],
                    'sku_suffix'  => '-6PK',
                    'vial_count'  => 6,
                ),
            );

            $base_sku = $product_entry['sku'] ?? $product->get_sku();

            foreach ( $tier_data as $tier ) {
                $variation = new WC_Product_Variation();
                $variation->set_parent_id( $product_id );
                $variation->set_attributes( array( 'pa_pack-size' => $tier['label'] ) );

                // Set the anchor prices.
                $variation->set_regular_price( $tier['regular'] );
                if ( ! empty( $tier['sale'] ) && $tier['sale'] < $tier['regular'] ) {
                    $variation->set_sale_price( $tier['sale'] );
                }

                // SKU.
                $variation_sku = $base_sku . $tier['sku_suffix'];
                $variation->set_sku( $variation_sku );

                // Stock — inherit from parent or set managed.
                $variation->set_manage_stock( false ); // Use parent stock by default.
                $variation->set_stock_status( 'instock' );

                // Weight and dimensions from parent.
                $variation->set_weight( $product->get_weight() );

                $variation->save();

                WP_CLI::log( "    Created variation: {$tier['label']} — \${$tier['price']} (SKU: {$variation_sku})" );
            }

            // Set default attribute = 3 vials (MOST POPULAR).
            $product->set_default_attributes( array( 'pa_pack-size' => '3 vials' ) );
            $product->save();

            WP_CLI::log( "    Default selection: 3 vials (MOST POPULAR)" );

            // Set curated cross-sells.
            $cross_sell_map = json_decode( file_get_contents( ECL_PLUGIN_DIR . 'data/cross-sells.json' ), true );
            $cross_slugs = $cross_sell_map['mappings'][ $slug ] ?? $cross_sell_map['default'];

            $cross_ids = array();
            foreach ( $cross_slugs as $cs_slug ) {
                $cs_products = wc_get_products( array( 'slug' => $cs_slug, 'limit' => 1, 'return' => 'ids' ) );
                if ( ! empty( $cs_products ) ) {
                    $cross_ids[] = $cs_products[0];
                }
            }
            $product->set_cross_sell_ids( $cross_ids );
            $product->save();

            WP_CLI::log( "    Cross-sells set: " . implode( ', ', $cross_slugs ) );

            $converted++;
            WP_CLI::log( "  ✓ '{$name}' converted successfully." );
            WP_CLI::log( '' );
        }

        // Summary.
        WP_CLI::log( '' );
        WP_CLI::success( sprintf(
            'Done. Converted: %d | Skipped: %d | Errors: %d',
            $converted,
            $skipped,
            $errors
        ) );

        if ( $dry_run ) {
            WP_CLI::log( '(Dry run — no changes were made.)' );
        }
    }

    /**
     * Import COA data from CSV into product post meta.
     *
     * ## OPTIONS
     *
     * [--file=<path>]
     * : Path to CSV file. Default: data/coa-seed.csv
     *
     * ## EXAMPLES
     *
     *     wp ecl import-coa
     *     wp ecl import-coa --file=/path/to/coa.csv
     *
     * @subcommand import-coa
     */
    public function import_coa( array $args, array $assoc_args ): void {
        $file = $assoc_args['file'] ?? ECL_PLUGIN_DIR . 'data/coa-seed.csv';

        if ( ! file_exists( $file ) ) {
            WP_CLI::error( "CSV file not found: {$file}" );
        }

        $handle = fopen( $file, 'r' );
        if ( ! $handle ) {
            WP_CLI::error( "Could not open CSV file: {$file}" );
        }

        $headers = fgetcsv( $handle );
        WP_CLI::log( '=== ECL COA Importer ===' );
        WP_CLI::log( "File: {$file}" );
        WP_CLI::log( '' );

        $imported = 0;
        $skipped = 0;

        // Get the COA module instance.
        $coa_module = new ECL_COA_Module();

        while ( ( $row = fgetcsv( $handle ) ) !== false ) {
            $data = array_combine( $headers, $row );

            $compound = $data['compound'];

            // Find product by name/slug.
            $products = wc_get_products( array(
                'search' => $compound,
                'limit'  => 1,
                'return' => 'ids',
            ) );

            if ( empty( $products ) ) {
                WP_CLI::warning( "Product '{$compound}' not found — skipping." );
                $skipped++;
                continue;
            }

            $product_id = $products[0];

            $coa_data = array(
                'batch_id'       => $data['batch_id'],
                'purity_pct'     => (float) $data['purity_pct'],
                'lab'            => $data['lab'],
                'test_date'      => $data['test_date'],
                'coa_url'        => $data['coa_url'],
                'lab_verify_url' => $data['lab_verify_url'],
            );

            $coa_module->import_coa_data( $product_id, $coa_data );

            WP_CLI::log( "  ✓ {$compound} (ID: {$product_id}): Batch #{$data['batch_id']}, {$data['purity_pct']}% purity" );
            $imported++;
        }

        fclose( $handle );

        WP_CLI::log( '' );
        WP_CLI::success( "Imported {$imported} COA records, skipped {$skipped}." );
    }

    /**
     * Scan the database for trust/consistency issues.
     *
     * ## EXAMPLES
     *
     *     wp ecl scan-consistency
     *
     * @subcommand scan-consistency
     */
    public function scan_consistency( array $args, array $assoc_args ): void {
        WP_CLI::log( '=== ECL Consistency Scan ===' );
        WP_CLI::log( '' );

        $consistency = new ECL_Consistency();
        $report = $consistency->scan_database();

        // Posts.
        if ( ! empty( $report['posts'] ) ) {
            WP_CLI::log( '--- Post Content Issues ---' );
            foreach ( $report['posts'] as $issue ) {
                $status = $issue['auto_fix'] ? '[AUTO-FIXED]' : '[MANUAL]';
                WP_CLI::log( "  {$status} #{$issue['post_id']} ({$issue['post_type']}): {$issue['post_title']}" );
                WP_CLI::log( "    Issue: {$issue['description']}" );
            }
            WP_CLI::log( '' );
        }

        // Elementor.
        if ( ! empty( $report['elementor'] ) ) {
            WP_CLI::log( '--- Elementor Data Issues (require manual edit) ---' );
            foreach ( $report['elementor'] as $issue ) {
                WP_CLI::log( "  [MANUAL] #{$issue['post_id']}: {$issue['post_title']}" );
                WP_CLI::log( "    Issue: {$issue['description']}" );
            }
            WP_CLI::log( '' );
        }

        // Options.
        if ( ! empty( $report['options'] ) ) {
            WP_CLI::log( '--- Options Table Issues ---' );
            foreach ( $report['options'] as $issue ) {
                $status = $issue['auto_fix'] ? '[AUTO-FIXED]' : '[MANUAL]';
                WP_CLI::log( "  {$status} {$issue['option_name']}" );
                WP_CLI::log( "    Issue: {$issue['description']}" );
            }
            WP_CLI::log( '' );
        }

        // Summary.
        WP_CLI::log( '--- Summary ---' );
        WP_CLI::log( "  Total issues:    {$report['summary']['total_issues']}" );
        WP_CLI::log( "  Auto-fixable:    {$report['summary']['auto_fixable']}" );
        WP_CLI::log( "  Manual required: {$report['summary']['manual_fix']}" );
        WP_CLI::log( '' );

        if ( $report['summary']['total_issues'] === 0 ) {
            WP_CLI::success( 'No consistency issues found.' );
        } else {
            WP_CLI::warning( "Found {$report['summary']['total_issues']} issue(s). See above for details." );
        }
    }

    /**
     * Apply curated cross-sell mappings from JSON.
     *
     * ## EXAMPLES
     *
     *     wp ecl set-cross-sells
     *
     * @subcommand set-cross-sells
     */
    public function set_cross_sells( array $args, array $assoc_args ): void {
        $file = ECL_PLUGIN_DIR . 'data/cross-sells.json';
        $data = json_decode( file_get_contents( $file ), true );

        if ( ! $data || empty( $data['mappings'] ) ) {
            WP_CLI::error( 'Could not load cross-sell mappings.' );
        }

        WP_CLI::log( '=== ECL Cross-Sell Setup ===' );
        WP_CLI::log( '' );

        $applied = 0;

        foreach ( $data['mappings'] as $slug => $cross_slugs ) {
            $products = wc_get_products( array( 'slug' => $slug, 'limit' => 1, 'return' => 'objects' ) );

            if ( empty( $products ) ) {
                WP_CLI::warning( "Product '{$slug}' not found — skipping." );
                continue;
            }

            $product = $products[0];
            $cross_ids = array();

            foreach ( $cross_slugs as $cs_slug ) {
                $cs_products = wc_get_products( array( 'slug' => $cs_slug, 'limit' => 1, 'return' => 'ids' ) );
                if ( ! empty( $cs_products ) ) {
                    $cross_ids[] = $cs_products[0];
                }
            }

            $product->set_cross_sell_ids( $cross_ids );
            $product->save();

            WP_CLI::log( "  ✓ {$slug}: " . implode( ', ', $cross_slugs ) );
            $applied++;
        }

        WP_CLI::log( '' );
        WP_CLI::success( "Cross-sells applied to {$applied} products." );
    }

    /**
     * Create the WELCOME15 coupon.
     *
     * ## EXAMPLES
     *
     *     wp ecl create-welcome15
     *
     * @subcommand create-welcome15
     */
    public function create_welcome15( array $args, array $assoc_args ): void {
        WP_CLI::log( '=== Creating WELCOME15 coupon ===' );

        $consistency = new ECL_Consistency();
        $result = $consistency->ensure_welcome15_coupon();

        if ( $result['created'] ) {
            WP_CLI::success( $result['message'] );
        } else {
            WP_CLI::log( $result['message'] );
        }
    }

    /**
     * Create the Bulk Packs collection page.
     *
     * ## EXAMPLES
     *
     *     wp ecl create-bulk-packs
     *
     * @subcommand create-bulk-packs
     */
    public function create_bulk_packs( array $args, array $assoc_args ): void {
        WP_CLI::log( '=== Creating Bulk Packs page ===' );

        // Check if page already exists.
        $existing = get_page_by_path( 'bulk-packs' );

        if ( $existing ) {
            WP_CLI::log( "Page already exists (ID: {$existing->ID})." );
            return;
        }

        $page_id = wp_insert_post( array(
            'post_title'   => 'Bulk Packs',
            'post_name'    => 'bulk-packs',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => '[ecl_bulk_packs]',
        ) );

        if ( is_wp_error( $page_id ) ) {
            WP_CLI::error( 'Failed to create page: ' . $page_id->get_error_message() );
        }

        WP_CLI::success( "Bulk Packs page created (ID: {$page_id}). URL: " . get_permalink( $page_id ) );
    }
}
