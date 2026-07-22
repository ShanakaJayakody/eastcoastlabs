<?php
/**
 * Plugin Name:       ECL Conversion
 * Plugin URI:        https://eastcoastlabs.com.au
 * Description:       East Coast Labs conversion optimisation plugin. Houses all custom WooCommerce hooks: COA verification module, tier-card pricing, bac-water attach, free-shipping threshold, restock program, sticky ATC, announcement bar, and more. Built per ECOM_UPGRADE_PLAN.md.
 * Version:           1.0.0
 * Author:            East Coast Labs
 * Author URI:        https://eastcoastlabs.com.au
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ecl-conversion
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * WC requires at least: 8.0
 * WC tested up to:   9.5
 *
 * COMPLIANCE NOTE:
 * This plugin operates on a research-use-only peptide store. All copy, hooks, and
 * generated content must preserve "research use only" framing. See docs/COMPLIANCE.md
 * for the full guardrail list. Every module is designed to never output dosing,
 * benefit, or human-consumption language.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// -----------------------------------------------------------------------------
// Plugin constants
// -----------------------------------------------------------------------------

define( 'ECL_VERSION', '1.0.0' );
define( 'ECL_PLUGIN_FILE', __FILE__ );
define( 'ECL_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ECL_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'ECL_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Configurable constants (override in wp-config.php if needed).

// Purity guarantee percentage shown in guarantee block.
if ( ! defined( 'ECL_PURITY_GUARANTEE_PCT' ) ) {
    define( 'ECL_PURITY_GUARANTEE_PCT', '98' );
}

// Free shipping threshold in AUD.
if ( ! defined( 'ECL_FREE_SHIPPING_THRESHOLD' ) ) {
    define( 'ECL_FREE_SHIPPING_THRESHOLD', 150 );
}

// Bac water product ID — must be updated after import.
// Set via: wp option update ecl_bac_water_product_id <ID>
if ( ! defined( 'ECL_BAC_WATER_PRODUCT_ID' ) ) {
    define( 'ECL_BAC_WATER_PRODUCT_ID', 0 );
}

// Checkout statement descriptor from Bankful.
if ( ! defined( 'ECL_STATEMENT_DESCRIPTOR' ) ) {
    define( 'ECL_STATEMENT_DESCRIPTOR', 'EAST COAST LABS' );
}

// Support email address.
if ( ! defined( 'ECL_SUPPORT_EMAIL' ) ) {
    define( 'ECL_SUPPORT_EMAIL', 'support@eastcoastlabs.com.au' );
}

// -----------------------------------------------------------------------------
// Autoloader for includes
// -----------------------------------------------------------------------------

/**
 * Simple PSR-4-ish autoloader for ECL module classes.
 * Class names: ECL_Stock_Status, ECL_COA_Module, etc.
 * File paths: includes/class-ecl-stock-status.php
 */
spl_autoload_register( function ( string $class ): void {
    if ( ! str_starts_with( $class, 'ECL_' ) ) {
        return;
    }

    $class_lower = strtolower( str_replace( '_', '-', $class ) );
    $file = ECL_PLUGIN_DIR . 'includes/class-' . $class_lower . '.php';

    if ( file_exists( $file ) ) {
        require_once $file;
    }
} );

// -----------------------------------------------------------------------------
// Activation / Deactivation
// -----------------------------------------------------------------------------

register_activation_hook( __FILE__, function (): void {
    // Create default options.
    if ( false === get_option( 'ecl_settings' ) ) {
        add_option( 'ecl_settings', array(
            'purity_pct'           => ECL_PURITY_GUARANTEE_PCT,
            'free_shipping_threshold' => ECL_FREE_SHIPPING_THRESHOLD,
            'bac_water_product_id' => ECL_BAC_WATER_PRODUCT_ID,
            'statement_descriptor' => ECL_STATEMENT_DESCRIPTOR,
            'support_email'        => ECL_SUPPORT_EMAIL,
            'announcement_text'    => 'Free shipping over $150 · Every batch independently tested → See lab results',
            'announcement_link'    => '/lab-results/',
            'guarantee_text'       => 'Every vial ships with an independent COA. If any independent lab test shows your batch below ' . ECL_PURITY_GUARANTEE_PCT . '% purity, we refund or replace it — and we cover the cost of the test.',
        ) );
    }

    // Schedule cron events for restock reminders (Phase 3).
    if ( ! wp_next_scheduled( 'ecl_restock_reminder_cron' ) ) {
        wp_schedule_event( time(), 'daily', 'ecl_restock_reminder_cron' );
    }

    flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function (): void {
    wp_clear_scheduled_hook( 'ecl_restock_reminder_cron' );
    delete_option( 'ecl_settings' );
    flush_rewrite_rules();
} );

// -----------------------------------------------------------------------------
// Module loader
// -----------------------------------------------------------------------------

/**
 * Load all ECL modules.
 * Each module self-registers its hooks in its __construct() or init() method.
 *
 * Module load order matters for hook priority consistency:
 * 1. Stock status (foundational — runs on every PDP)
 * 2. COA module (renders early on PDP)
 * 3. Guarantee block (after COA)
 * 4. Checkout trust
 * 5. Tier cards (handled by template override + JS)
 * 6. Bac water attach + cross-sells
 * 7. Free shipping notice
 * 8. Restock program
 * 9. Sticky ATC
 * 10. Announcement bar
 * 11. CTA strip
 * 12. GA4 events
 */
function ecl_load_modules(): void {

    $modules = array(
        'ECL_REST_API',
        'ECL_Stock_Status',
        'ECL_Consistency',
        'ECL_COA_Module',
        'ECL_Guarantee',
        'ECL_Checkout_Trust',
        'ECL_Bac_Water',
        'ECL_Free_Shipping',
        'ECL_Restock',
        'ECL_Sticky_ATC',
        'ECL_Announcement',
        'ECL_CTA_Strip',
        'ECL_GA4_Events',
    );

    foreach ( $modules as $module_class ) {
        if ( class_exists( $module_class ) ) {
            new $module_class();
        }
    }
}

// Hook after WooCommerce is loaded so all Woo functions are available.
add_action( 'plugins_loaded', function (): void {
    // Bail early if WooCommerce is not active.
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', function (): void {
            echo '<div class="notice notice-error"><p><strong>ECL Conversion</strong> requires WooCommerce to be installed and active.</p></div>';
        } );
        return;
    }

    ecl_load_modules();

    // Enqueue plugin assets (CSS is global; JS is module-specific).
    add_action( 'wp_enqueue_scripts', function (): void {
        wp_enqueue_style(
            'ecl-conversion',
            ECL_PLUGIN_URL . 'assets/css/ecl-conversion.css',
            array(),
            ECL_VERSION
        );

        // Tier cards JS — only on product pages.
        if ( is_product() ) {
            wp_enqueue_script(
                'ecl-tier-cards',
                ECL_PLUGIN_URL . 'assets/js/ecl-tier-cards.js',
                array(),
                ECL_VERSION,
                true
            );
        }
    } );

    // Load WP-CLI commands.
    if ( defined( 'WP_CLI' ) && WP_CLI ) {
        require_once ECL_PLUGIN_DIR . 'cli/class-ecl-cli-commands.php';
    }
} );

// -----------------------------------------------------------------------------
// Settings page (admin)
// -----------------------------------------------------------------------------

add_action( 'admin_menu', function (): void {
    add_submenu_page(
        'woocommerce',
        __( 'ECL Conversion Settings', 'ecl-conversion' ),
        __( 'ECL Conversion', 'ecl-conversion' ),
        'manage_options',
        'ecl-conversion-settings',
        'ecl_render_settings_page'
    );
} );

/**
 * Render the settings page.
 */
function ecl_render_settings_page(): void {
    $settings = get_option( 'ecl_settings', array() );

    // Handle form submission.
    if ( isset( $_POST['ecl_settings_submit'] ) && check_admin_referer( 'ecl_save_settings' ) ) {
        $new_settings = array(
            'purity_pct'           => sanitize_text_field( $_POST['purity_pct'] ?? '98' ),
            'free_shipping_threshold' => absint( $_POST['free_shipping_threshold'] ?? 150 ),
            'bac_water_product_id' => absint( $_POST['bac_water_product_id'] ?? 0 ),
            'statement_descriptor' => sanitize_text_field( $_POST['statement_descriptor'] ?? 'EAST COAST LABS' ),
            'support_email'        => sanitize_email( $_POST['support_email'] ?? '' ),
            'announcement_text'    => sanitize_text_field( $_POST['announcement_text'] ?? '' ),
            'announcement_link'    => esc_url_raw( $_POST['announcement_link'] ?? '' ),
            'guarantee_text'       => sanitize_textarea_field( $_POST['guarantee_text'] ?? '' ),
        );
        update_option( 'ecl_settings', $new_settings );
        $settings = $new_settings;
        echo '<div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>';
    }

    $s = wp_parse_args( $settings, array(
        'purity_pct'           => '98',
        'free_shipping_threshold' => 150,
        'bac_water_product_id' => 0,
        'statement_descriptor' => 'EAST COAST LABS',
        'support_email'        => 'support@eastcoastlabs.com.au',
        'announcement_text'    => 'Free shipping over $150 · Every batch independently tested',
        'announcement_link'    => '/lab-results/',
        'guarantee_text'       => '',
    ) );
    ?>
    <div class="wrap">
        <h1>ECL Conversion Settings</h1>
        <p>Central configuration for all ECL conversion modules. Changes here propagate to COA modules, guarantee blocks, shipping notices, and checkout trust blocks sitewide.</p>

        <form method="post" action="">
            <?php wp_nonce_field( 'ecl_save_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="purity_pct">Purity Guarantee (%)</label></th>
                    <td>
                        <input type="text" id="purity_pct" name="purity_pct" value="<?php echo esc_attr( $s['purity_pct'] ); ?>" class="regular-text" />
                        <p class="description">Shown in guarantee blocks. Must match all COA data. Default: 98</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="free_shipping_threshold">Free Shipping Threshold ($)</label></th>
                    <td>
                        <input type="number" id="free_shipping_threshold" name="free_shipping_threshold" value="<?php echo esc_attr( $s['free_shipping_threshold'] ); ?>" class="regular-text" />
                        <p class="description">Cart total that triggers free standard shipping. Default: 150</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="bac_water_product_id">Bacteriostatic Water Product ID</label></th>
                    <td>
                        <input type="number" id="bac_water_product_id" name="bac_water_product_id" value="<?php echo esc_attr( $s['bac_water_product_id'] ); ?>" class="regular-text" />
                        <p class="description">WooCommerce product ID for Bacteriostatic Water (used in 6-pack free gift + attach checkbox)</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="statement_descriptor">Bank Statement Descriptor</label></th>
                    <td>
                        <input type="text" id="statement_descriptor" name="statement_descriptor" value="<?php echo esc_attr( $s['statement_descriptor'] ); ?>" class="regular-text" />
                        <p class="description">What customers see on their card statement (confirm with Bankful)</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="support_email">Support Email</label></th>
                    <td>
                        <input type="email" id="support_email" name="support_email" value="<?php echo esc_attr( $s['support_email'] ); ?>" class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="announcement_text">Announcement Bar Text</label></th>
                    <td>
                        <input type="text" id="announcement_text" name="announcement_text" value="<?php echo esc_attr( $s['announcement_text'] ); ?>" class="large-text" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="announcement_link">Announcement Bar Link</label></th>
                    <td>
                        <input type="url" id="announcement_link" name="announcement_link" value="<?php echo esc_attr( $s['announcement_link'] ); ?>" class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="guarantee_text">Guarantee Block Text</label></th>
                    <td>
                        <textarea id="guarantee_text" name="guarantee_text" rows="4" class="large-text"><?php echo esc_textarea( $s['guarantee_text'] ); ?></textarea>
                        <p class="description">Purity guarantee copy shown under every COA module on PDPs.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button( 'Save Settings', 'primary', 'ecl_settings_submit' ); ?>
        </form>
    </div>
    <?php
}

// -----------------------------------------------------------------------------
// Helper functions (available globally)
// -----------------------------------------------------------------------------

/**
 * Get a plugin setting value.
 *
 * @param string $key     Setting key.
 * @param mixed  $default Default value.
 * @return mixed
 */
function ecl_setting( string $key, mixed $default = null ): mixed {
    $settings = get_option( 'ecl_settings', array() );
    return $settings[ $key ] ?? $default;
}

/**
 * Render guarantee microcopy — called from the variable add-to-cart template.
 * Phase 4.3: "Purity guaranteed — we cover the test. 1-business-day dispatch."
 */
if ( ! function_exists( 'ecl_render_guarantee_microcopy' ) ) {
    function ecl_render_guarantee_microcopy(): void {
        ?>
        <p class="ecl-guarantee-microcopy">
            <span class="ecl-guarantee-microcopy__icon">🛡️</span>
            Purity guaranteed — we cover the test. 1-business-day dispatch.
        </p>
        <?php
    }
}

/**
 * Format a price as AUD for display in non-WooCommerce contexts.
 *
 * @param float $amount
 * @return string
 */
function ecl_format_price( float $amount ): string {
    return '$' . number_format( $amount, 2 );
}

/**
 * Check if the current product is a peptide (has the Pack Size attribute)
 * vs. Bacteriostatic Water or other non-peptide products.
 *
 * @param int|WC_Product|null $product
 * @return bool
 */
function ecl_is_peptide_product( int|WC_Product|null $product = null ): bool {
    if ( null === $product ) {
        global $product;
    }
    if ( is_numeric( $product ) ) {
        $product = wc_get_product( $product );
    }
    if ( ! $product instanceof WC_Product ) {
        return false;
    }

    // Check for Pack Size attribute.
    $attrs = $product->get_attributes();
    foreach ( $attrs as $attr ) {
        if ( $attr instanceof WC_Product_Attribute ) {
            $name = $attr->get_name();
            if ( false !== stripos( $name, 'pack' ) || false !== stripos( $name, 'size' ) ) {
                return true;
            }
        }
    }

    return false;
}
