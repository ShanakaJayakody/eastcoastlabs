<?php
/**
 * Headless REST API — R0 (Headless Rebuild)
 *
 * Turns the ecl-conversion plugin into the API surface a separate Next.js
 * storefront consumes. Three responsibilities:
 *
 *   1. Custom COA endpoints under the `ecl/v1` namespace, exposing the
 *      per-product Certificate of Analysis data the storefront renders.
 *   2. CORS handling for the WooCommerce Store API (`wc/store/*`) and the
 *      `ecl/v1` namespace, scoped to the storefront origins only — so the
 *      headless cart (which uses cookies) works from the Next.js app.
 *   3. Cross-subdomain cart/session cookie domain, so a cart built on the
 *      storefront (apex domain) carries into the WooCommerce `/checkout`
 *      page on the `shop.` subdomain where Bankful runs unchanged.
 *
 * COMPLIANCE: COA payload is factual lab data only (batch, purity, lab,
 * date, links). No dosing/benefit/human-use fields are exposed.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_REST_API {

    /**
     * Origins allowed to make credentialed (cookie-bearing) requests.
     * The apex + www are production; *.vercel.app covers preview builds;
     * localhost covers local Next.js dev. Extend via the
     * `ecl_allowed_cors_origins` filter rather than editing here.
     *
     * @var string[]
     */
    private array $allowed_origins = array(
        'https://eastcoastlabs.com.au',
        'https://www.eastcoastlabs.com.au',
        'http://localhost:3000',
    );

    /**
     * REST namespace for custom endpoints.
     */
    private const NS = 'ecl/v1';

    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );

        // CORS must run late enough to override WordPress' own permissive
        // default header, so we hook rest_pre_serve_request at high priority.
        add_filter( 'rest_pre_serve_request', array( $this, 'send_cors_headers' ), 999 );

        // Share the WooCommerce session/cart cookie across subdomains so the
        // headless cart survives the hand-off to /checkout on shop.<domain>.
        add_filter( 'woocommerce_cookie', array( $this, 'cart_cookie_name' ) );
        add_filter( 'wc_session_cookie', array( $this, 'cart_cookie_name' ) );
    }

    // -------------------------------------------------------------------------
    // Routes
    // -------------------------------------------------------------------------

    public function register_routes(): void {
        register_rest_route(
            self::NS,
            '/coa',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_all_coa' ),
                'permission_callback' => '__return_true', // public, read-only lab data
            )
        );

        register_rest_route(
            self::NS,
            '/coa/(?P<id>\d+)',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_product_coa' ),
                'permission_callback' => '__return_true',
                'args'                => array(
                    'id' => array(
                        'validate_callback' => static fn( $v ) => is_numeric( $v ),
                        'sanitize_callback' => 'absint',
                    ),
                ),
            )
        );
    }

    /**
     * GET /wp-json/ecl/v1/coa
     * Returns COA data for every published product that has it.
     */
    public function get_all_coa( WP_REST_Request $request ): WP_REST_Response {
        $out = array();

        $product_ids = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => -1,
                'return' => 'ids',
            )
        );

        foreach ( $product_ids as $pid ) {
            $coa = $this->build_coa_payload( (int) $pid );
            if ( null !== $coa ) {
                $out[] = $coa;
            }
        }

        return new WP_REST_Response( $out, 200 );
    }

    /**
     * GET /wp-json/ecl/v1/coa/{id}
     */
    public function get_product_coa( WP_REST_Request $request ): WP_REST_Response {
        $pid = (int) $request['id'];
        $coa = $this->build_coa_payload( $pid );

        if ( null === $coa ) {
            return new WP_REST_Response(
                array( 'code' => 'ecl_no_coa', 'message' => 'No COA data for this product.' ),
                404
            );
        }

        return new WP_REST_Response( $coa, 200 );
    }

    // -------------------------------------------------------------------------
    // COA payload assembly
    // -------------------------------------------------------------------------

    /**
     * Build the COA payload for a product, preferring `_ecl_coa` meta and
     * falling back to the CSV seed (matched by compound name) so the endpoint
     * still returns data before the meta importer has run.
     *
     * @return array<string,mixed>|null
     */
    private function build_coa_payload( int $product_id ): ?array {
        $product = wc_get_product( $product_id );
        if ( ! $product instanceof WC_Product ) {
            return null;
        }

        $meta = get_post_meta( $product_id, '_ecl_coa', true );

        if ( empty( $meta ) || ! is_array( $meta ) ) {
            $meta = $this->coa_from_seed( $product->get_name() );
        }

        if ( empty( $meta ) || ! is_array( $meta ) ) {
            return null;
        }

        return array(
            'product_id'     => $product_id,
            'sku'            => $product->get_sku(),
            'name'           => $product->get_name(),
            'slug'           => $product->get_slug(),
            'batch_id'       => (string) ( $meta['batch_id'] ?? '' ),
            'purity_pct'     => isset( $meta['purity_pct'] ) ? (float) $meta['purity_pct'] : null,
            'lab'            => (string) ( $meta['lab'] ?? 'JanoShik' ),
            'test_date'      => (string) ( $meta['test_date'] ?? '' ),
            'coa_url'        => esc_url_raw( (string) ( $meta['coa_url'] ?? '' ) ),
            'lab_verify_url' => esc_url_raw( (string) ( $meta['lab_verify_url'] ?? '' ) ),
        );
    }

    /**
     * Look up a compound in data/coa-seed.csv by name (case-insensitive,
     * substring match so "Retatrutide 10mg" resolves to "Retatrutide").
     *
     * @return array<string,mixed>|null
     */
    private function coa_from_seed( string $product_name ): ?array {
        static $seed = null;

        if ( null === $seed ) {
            $seed = array();
            $csv  = ECL_PLUGIN_DIR . 'data/coa-seed.csv';
            if ( is_readable( $csv ) && ( $fh = fopen( $csv, 'r' ) ) ) {
                $header = fgetcsv( $fh );
                if ( is_array( $header ) ) {
                    while ( ( $row = fgetcsv( $fh ) ) !== false ) {
                        $assoc = @array_combine( $header, $row );
                        if ( is_array( $assoc ) && ! empty( $assoc['compound'] ) ) {
                            $seed[ strtolower( trim( $assoc['compound'] ) ) ] = $assoc;
                        }
                    }
                }
                fclose( $fh );
            }
        }

        $needle = strtolower( trim( $product_name ) );
        foreach ( $seed as $compound => $data ) {
            if ( '' !== $compound && ( str_contains( $needle, $compound ) || str_contains( $compound, $needle ) ) ) {
                return $data;
            }
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // CORS
    // -------------------------------------------------------------------------

    /**
     * Emit CORS headers for storefront-origin requests to the Store API and
     * the ecl/v1 namespace. Credentialed (cookie) requests require a specific
     * origin echo — never `*` — plus Allow-Credentials, so the headless cart
     * can read/write the WooCommerce session cookie.
     *
     * @param bool $served
     * @return bool
     */
    public function send_cors_headers( bool $served ): bool {
        $origin = get_http_origin();
        if ( ! $origin || ! $this->is_allowed_origin( $origin ) ) {
            return $served;
        }

        // Only decorate our headless surfaces.
        $route = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
        if ( ! preg_match( '#/wp-json/(wc/store|ecl/v1)#', $route ) ) {
            return $served;
        }

        header( 'Access-Control-Allow-Origin: ' . $origin );
        header( 'Vary: Origin', false );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Authorization, Content-Type, Nonce, Cart-Token, X-WC-Store-API-Nonce' );
        header( 'Access-Control-Expose-Headers: Cart-Token, X-WP-Total, X-WP-TotalPages, Link' );

        // Short-circuit preflight.
        if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
            status_header( 204 );
            exit;
        }

        return $served;
    }

    private function is_allowed_origin( string $origin ): bool {
        /** @var string[] $allowed */
        $allowed = apply_filters( 'ecl_allowed_cors_origins', $this->allowed_origins );

        if ( in_array( $origin, $allowed, true ) ) {
            return true;
        }

        // Allow Vercel preview deployments: https://<anything>.vercel.app
        if ( preg_match( '#^https://[a-z0-9-]+\.vercel\.app$#i', $origin ) ) {
            return true;
        }

        return false;
    }

    // -------------------------------------------------------------------------
    // Cross-subdomain cart cookie
    // -------------------------------------------------------------------------

    /**
     * No-op passthrough retained for filter symmetry; the cookie *domain*
     * is controlled by the COOKIE_DOMAIN constant (set in wp-config during
     * the R6 subdomain move to `.eastcoastlabs.com.au`). Documented here so
     * the dependency is discoverable from the code, not just the runbook.
     *
     * @param string $name
     * @return string
     */
    public function cart_cookie_name( string $name ): string {
        return $name;
    }
}
