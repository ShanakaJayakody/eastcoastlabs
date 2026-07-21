<?php
/**
 * COA Verification Module — Phase 1.2
 *
 * Renders per-product Certificate of Analysis (COA) data under the buy box
 * on every single product page.
 *
 * Data source: product post meta `_ecl_coa` = {
 *     batch_id:        string,
 *     purity_pct:      float,
 *     lab:             string,
 *     test_date:       string (Y-m-d),
 *     coa_url:         string (URL to COA PDF),
 *     lab_verify_url:  string (URL to third-party lab verification)
 * }
 *
 * Also provides the homepage "proof strip" rendering function and
 * a WP-CLI importer for seeding COA data from CSV.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_COA_Module {

    /**
     * Lab name (default — overridable per product via meta).
     */
    private string $default_lab = 'JanoShik';

    public function __construct() {
        // Render COA module on single product pages (after price, before add-to-cart).
        add_action( 'woocommerce_single_product_summary', array( $this, 'render_coa_module' ), 15 );

        // Add COA data to product tabs (additional info tab content).
        add_filter( 'woocommerce_product_tabs', array( $this, 'add_coa_tab' ), 98 );

        // Register REST API endpoint for fetching COA data.
        add_action( 'rest_api_init', array( $this, 'register_rest_endpoint' ) );

        // Homepage proof strip shortcode.
        add_shortcode( 'ecl_proof_strip', array( $this, 'render_proof_strip' ) );

        // Register meta fields for REST API exposure.
        add_action( 'init', array( $this, 'register_meta' ) );
    }

    /**
     * Register the _ecl_coa meta field for REST API access.
     */
    public function register_meta(): void {
        register_post_meta( 'product', '_ecl_coa', array(
            'type'         => 'object',
            'description'  => 'COA verification data for this product',
            'single'       => true,
            'show_in_rest' => array(
                'schema' => array(
                    'type'       => 'object',
                    'properties' => array(
                        'batch_id'       => array( 'type' => 'string' ),
                        'purity_pct'     => array( 'type' => 'number' ),
                        'lab'            => array( 'type' => 'string' ),
                        'test_date'      => array( 'type' => 'string' ),
                        'coa_url'        => array( 'type' => 'string' ),
                        'lab_verify_url' => array( 'type' => 'string' ),
                    ),
                ),
            ),
            'default'      => array(),
        ) );
    }

    /**
     * Get COA data for a product.
     *
     * @param int $product_id
     * @return array|null
     */
    public function get_coa_data( int $product_id ): ?array {
        $data = get_post_meta( $product_id, '_ecl_coa', true );

        if ( empty( $data ) || ! is_array( $data ) ) {
            return null;
        }

        // Ensure all fields have defaults.
        return wp_parse_args( $data, array(
            'batch_id'       => '',
            'purity_pct'     => 0,
            'lab'            => $this->default_lab,
            'test_date'      => '',
            'coa_url'        => '',
            'lab_verify_url' => '',
        ) );
    }

    /**
     * Render the COA verification module on single product pages.
     */
    public function render_coa_module(): void {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return;
        }

        $coa = $this->get_coa_data( $product->get_id() );

        if ( null === $coa || empty( $coa['batch_id'] ) ) {
            // No COA data — don't render the module.
            return;
        }

        $lab         = ! empty( $coa['lab'] ) ? $coa['lab'] : $this->default_lab;
        $test_date   = ! empty( $coa['test_date'] ) ? wp_date( 'j F Y', strtotime( $coa['test_date'] ) ) : '';
        $purity      = number_format( (float) $coa['purity_pct'], 2 );

        // Load template.
        $template = ECL_PLUGIN_DIR . 'templates/coa-module.php';
        if ( file_exists( $template ) ) {
            include $template;
        }
    }

    /**
     * Add a "Lab Results" tab to the product tabs.
     */
    public function add_coa_tab( array $tabs ): array {
        global $product;

        if ( ! $product instanceof WC_Product ) {
            return $tabs;
        }

        $coa = $this->get_coa_data( $product->get_id() );
        if ( null === $coa ) {
            return $tabs;
        }

        $tabs['ecl_coa'] = array(
            'title'    => '🔬 Lab Results',
            'priority' => 5,
            'callback' => array( $this, 'render_coa_tab_content' ),
        );

        return $tabs;
    }

    /**
     * Render the COA tab content (more detailed than the summary module).
     */
    public function render_coa_tab_content(): void {
        global $product;

        $coa = $this->get_coa_data( $product->get_id() );
        if ( null === $coa ) {
            return;
        }

        $lab       = ! empty( $coa['lab'] ) ? $coa['lab'] : $this->default_lab;
        $test_date = ! empty( $coa['test_date'] ) ? wp_date( 'j F Y', strtotime( $coa['test_date'] ) ) : '';
        $purity    = number_format( (float) $coa['purity_pct'], 2 );
        ?>
        <div class="ecl-coa-tab">
            <h3>Independent Laboratory Analysis</h3>
            <p>Batch <strong>#<?php echo esc_html( $coa['batch_id'] ); ?></strong> — tested by <strong><?php echo esc_html( $lab ); ?></strong> on <?php echo esc_html( $test_date ); ?>.</p>

            <table class="ecl-coa-table">
                <tr>
                    <th>Compound</th>
                    <td><?php echo esc_html( $product->get_name() ); ?></td>
                </tr>
                <tr>
                    <th>Batch ID</th>
                    <td>#<?php echo esc_html( $coa['batch_id'] ); ?></td>
                </tr>
                <tr>
                    <th>Purity</th>
                    <td><strong><?php echo esc_html( $purity ); ?>%</strong></td>
                </tr>
                <tr>
                    <th>Testing Lab</th>
                    <td><?php echo esc_html( $lab ); ?></td>
                </tr>
                <tr>
                    <th>Test Date</th>
                    <td><?php echo esc_html( $test_date ); ?></td>
                </tr>
            </table>

            <?php if ( ! empty( $coa['coa_url'] ) ) : ?>
                <p><a href="<?php echo esc_url( $coa['coa_url'] ); ?>" target="_blank" rel="noopener" class="button ecl-coa-button">
                    View full COA (PDF) →
                </a></p>
            <?php endif; ?>

            <?php if ( ! empty( $coa['lab_verify_url'] ) ) : ?>
                <p><a href="<?php echo esc_url( $coa['lab_verify_url'] ); ?>" target="_blank" rel="noopener" class="button ecl-coa-button--verify">
                    Verify with <?php echo esc_html( $lab ); ?> directly →
                </a></p>
            <?php endif; ?>

            <p class="ecl-coa-note">
                Every batch is independently tested before it ships. Results are published on our site before the product is listed.
                If any independent lab test shows your batch below <?php echo esc_html( ecl_setting( 'purity_pct', '98' ) ); ?>% purity, we refund or replace it — and we cover the cost of the test.
            </p>
        </div>
        <?php
    }

    /**
     * Render the homepage proof strip via shortcode.
     * Usage: [ecl_proof_strip]
     *
     * Shows latest batch results across all products.
     */
    public function render_proof_strip( array $atts = array() ): string {
        $limit = absint( $atts['limit'] ?? 5 );
        $products = $this->get_latest_coa_products( $limit );

        if ( empty( $products ) ) {
            return '';
        }

        ob_start();
        ?>
        <div class="ecl-proof-strip">
            <div class="ecl-proof-strip__header">
                <span class="ecl-proof-strip__label">🔬 Latest Batch Results</span>
            </div>
            <div class="ecl-proof-strip__items">
                <?php foreach ( $products as $item ) : ?>
                    <div class="ecl-proof-strip__item">
                        <span class="ecl-proof-strip__compound"><?php echo esc_html( $item['name'] ); ?></span>
                        <span class="ecl-proof-strip__purity"><?php echo esc_html( number_format( $item['purity'], 2 ) ); ?>%</span>
                    </div>
                <?php endforeach; ?>
            </div>
            <p class="ecl-proof-strip__footer">
                Tested by <?php echo esc_html( $this->default_lab ); ?>.
                <a href="/lab-results/">See all lab results →</a>
            </p>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Get products with their latest COA data, sorted by test date.
     *
     * @param int $limit
     * @return array
     */
    private function get_latest_coa_products( int $limit = 5 ): array {
        $args = array(
            'post_type'      => 'product',
            'posts_per_page' => 50, // Overfetch then filter for ones with COA.
            'post_status'    => 'publish',
            'meta_key'       => '_ecl_coa',
        );

        $products = get_posts( $args );
        $results = array();

        foreach ( $products as $post ) {
            $coa = $this->get_coa_data( $post->ID );
            if ( null === $coa || empty( $coa['batch_id'] ) ) {
                continue;
            }
            $results[] = array(
                'id'         => $post->ID,
                'name'       => get_the_title( $post ),
                'batch_id'   => $coa['batch_id'],
                'purity'     => (float) $coa['purity_pct'],
                'test_date'  => $coa['test_date'] ?? '',
                'lab'        => $coa['lab'] ?? $this->default_lab,
            );
        }

        // Sort by test date descending.
        usort( $results, function ( $a, $b ) {
            return strcmp( $b['test_date'], $a['test_date'] );
        } );

        return array_slice( $results, 0, $limit );
    }

    /**
     * Register REST API endpoint for COA data.
     */
    public function register_rest_endpoint(): void {
        register_rest_route( 'ecl/v1', '/coa/(?P<product_id>\d+)', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'rest_get_coa' ),
            'permission_callback' => '__return_true',
            'args'                => array(
                'product_id' => array(
                    'validate_callback' => function ( $param ) {
                        return is_numeric( $param );
                    },
                ),
            ),
        ) );

        register_rest_route( 'ecl/v1', '/coa', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'rest_get_all_coa' ),
            'permission_callback' => '__return_true',
        ) );
    }

    /**
     * REST callback: get COA for a single product.
     */
    public function rest_get_coa( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $product_id = (int) $request['product_id'];
        $coa = $this->get_coa_data( $product_id );

        if ( null === $coa ) {
            return new WP_Error( 'no_coa', 'No COA data found for this product', array( 'status' => 404 ) );
        }

        return rest_ensure_response( $coa );
    }

    /**
     * REST callback: get all COA data.
     */
    public function rest_get_all_coa( WP_REST_Request $request ): WP_REST_Response {
        $args = array(
            'post_type'      => 'product',
            'posts_per_page' => -1,
            'post_status'    => 'publish',
            'meta_key'       => '_ecl_coa',
        );

        $products = get_posts( $args );
        $results = array();

        foreach ( $products as $post ) {
            $coa = $this->get_coa_data( $post->ID );
            if ( null !== $coa ) {
                $results[] = array(
                    'product_id' => $post->ID,
                    'product_name' => get_the_title( $post ),
                    'coa'        => $coa,
                );
            }
        }

        return rest_ensure_response( $results );
    }

    /**
     * Import COA data for a product.
     *
     * @param int   $product_id
     * @param array $data
     * @return bool
     */
    public function import_coa_data( int $product_id, array $data ): bool {
        $sanitized = array(
            'batch_id'       => sanitize_text_field( $data['batch_id'] ?? '' ),
            'purity_pct'     => (float) ( $data['purity_pct'] ?? 0 ),
            'lab'            => sanitize_text_field( $data['lab'] ?? 'JanoShik' ),
            'test_date'      => sanitize_text_field( $data['test_date'] ?? '' ),
            'coa_url'        => esc_url_raw( $data['coa_url'] ?? '' ),
            'lab_verify_url' => esc_url_raw( $data['lab_verify_url'] ?? '' ),
        );

        return update_post_meta( $product_id, '_ecl_coa', $sanitized );
    }
}
