<?php
/**
 * Announcement Bar — Phase 4.2
 *
 * Renders a dismissible announcement bar above the header via wp_body_open.
 * Links to the Lab Results page.
 *
 * Text and link configurable via ecl_setting('announcement_text') and
 * ecl_setting('announcement_link').
 *
 * Dismissible — dismissal stored in localStorage (persists per-browser).
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Announcement {

    public function __construct() {
        // Render at wp_body_open (above Elementor header).
        add_action( 'wp_body_open', array( $this, 'render_announcement_bar' ), 5 );

        // Enqueue dismiss JS.
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    /**
     * Render the announcement bar.
     */
    public function render_announcement_bar(): void {
        $text = ecl_setting( 'announcement_text', 'Free shipping over $150 · Every batch independently tested → See lab results' );
        $link = ecl_setting( 'announcement_link', '/lab-results/' );

        // Don't render on checkout/cart (keeps the funnel clean).
        if ( is_checkout() && ! is_wc_endpoint_url( 'order-received' ) ) {
            return;
        }

        // Split text at → for the CTA portion.
        $parts = preg_split( '/\s*[→]\s*/', $text, 2 );
        $main_text = $parts[0];
        $cta_text = $parts[1] ?? 'See lab results';
        ?>
        <div class="ecl-announcement-bar" id="ecl-announcement-bar" role="banner">
            <div class="ecl-announcement-bar__content">
                <span class="ecl-announcement-bar__text"><?php echo esc_html( $main_text ); ?></span>
                <a href="<?php echo esc_url( $link ); ?>" class="ecl-announcement-bar__cta">
                    <?php echo esc_html( $cta_text ); ?> →
                </a>
            </div>
            <button class="ecl-announcement-bar__close" id="ecl-announcement-close" aria-label="Dismiss announcement">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="2"/>
                </svg>
            </button>
        </div>
        <?php
    }

    /**
     * Enqueue the dismiss script (inline, minimal).
     */
    public function enqueue_assets(): void {
        wp_enqueue_script(
            'ecl-announcement',
            ECL_PLUGIN_URL . 'assets/js/ecl-announcement.js',
            array(),
            ECL_VERSION,
            true
        );
    }
}
