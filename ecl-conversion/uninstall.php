<?php
/**
 * Uninstall ECL Conversion Plugin
 *
 * Removes all plugin options and scheduled events.
 * Does NOT remove product meta (_ecl_coa, etc.) — that data is
 * intentionally preserved in case the plugin is reinstalled.
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Remove options.
delete_option( 'ecl_settings' );

// Clear scheduled events.
wp_clear_scheduled_hook( 'ecl_restock_reminder_cron' );

// Remove transients.
delete_transient( 'ecl_elementor_scan' );

// Note: product meta (_ecl_coa) and page content are intentionally preserved.
// To fully remove COA data:
// wp post meta list --post_type=product --fields=meta_key | grep _ecl
// wp eval 'delete_post_meta_by_key("_ecl_coa");'
