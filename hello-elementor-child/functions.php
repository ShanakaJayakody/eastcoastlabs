<?php
/**
 * Hello Elementor Child Theme — functions.php
 *
 * Houses ECL theme-level customisations:
 * - Enqueues child theme stylesheet (parent + child)
 * - Enqueues ecl-conversion plugin assets with correct dependencies
 * - Provides the variable product add-to-cart template override path
 *
 * @package HelloElementorChild
 * @since   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // No direct access.
}

/**
 * Theme version for cache-busting enqueued assets.
 */
define( 'ECL_CHILD_VERSION', '1.0.0' );
define( 'ECL_CHILD_DIR', get_stylesheet_directory() );
define( 'ECL_CHILD_URI', get_stylesheet_directory_uri() );

/**
 * Enqueue parent + child stylesheets.
 *
 * Hello Elementor uses elementor/frontend as its primary asset handle.
 * We hook after it so our cascade is last.
 */
function ecl_child_enqueue_styles(): void {
    $parent_style = 'hello-elementor';

    // Parent theme stylesheet.
    wp_enqueue_style(
        $parent_style,
        get_template_directory_uri() . '/style.css',
        array(),
        ECL_CHILD_VERSION
    );

    // Child theme stylesheet.
    wp_enqueue_style(
        'hello-elementor-child',
        ECL_CHILD_URI . '/style.css',
        array( $parent_style ),
        ECL_CHILD_VERSION
    );
}
add_action( 'wp_enqueue_scripts', 'ecl_child_enqueue_styles', 15 );

/**
 * Declare WooCommerce and CartFlows support explicitly.
 * Hello Elementor already declares theme support but we make it explicit
 * for the child to avoid edge cases after updates.
 */
function ecl_child_setup(): void {
    add_theme_support( 'woocommerce', array(
        'thumbnail_image_width' => 600,
        'single_image_width'    => 800,
        'product_grid'          => array(
            'default_rows'    => 3,
            'min_rows'        => 2,
            'default_columns' => 4,
            'min_columns'     => 2,
            'max_columns'     => 5,
        ),
    ) );

    add_theme_support( 'wc-product-gallery-zoom' );
    add_theme_support( 'wc-product-gallery-lightbox' );
    add_theme_support( 'wc-product-gallery-slider' );
}
add_action( 'after_setup_theme', 'ecl_child_setup' );

/**
 * Register the variable-product add-to-cart template override location.
 *
 * WooCommerce looks in: child-theme/woocommerce/single-product/add-to-cart/variable.php
 * We provide that file in the child theme's templates/ directory and use
 * woocommerce_locate_template to route it.
 *
 * @param string $template      Full template path.
 * @param string $template_name Template name (e.g. single-product/add-to-cart/variable.php).
 * @param string $template_path Plugin template path (WooCommerce default path).
 * @return string
 */
function ecl_child_locate_template( string $template, string $template_name, string $template_path ): string {
    // Only override the variable add-to-cart template.
    if ( 'single-product/add-to-cart/variable.php' !== $template_name ) {
        return $template;
    }

    $child_template = ECL_CHILD_DIR . '/templates/woocommerce/' . $template_name;

    if ( file_exists( $child_template ) ) {
        return $child_template;
    }

    return $template;
}
add_filter( 'woocommerce_locate_template', 'ecl_child_locate_template', 10, 3 );
