<?php
/**
 * Sitewide Consistency Sweep Module — Phase 0.4–0.7
 *
 * Provides helpers to detect and report consistency issues across the site:
 * - Purity claim conflicts (≥99% vs ≥98%)
 * - Dispatch claim conflicts (24h vs 1 business day)
 * - Stale @eastcoastlabs.com.au address references (target: eclpeptides@gmail.com)
 * - Old coupon code (WELCOME!)
 *
 * This module provides:
 * 1. A WP-CLI command for scanning the database (ecl scan-consistency)
 * 2. Content filters that fix known issues in post content on the fly
 * 3. A reporting function for the admin settings page
 *
 * NOTE: Content filters are conservative — they fix text patterns in
 * post_content and post_excerpt. Elementor-stored JSON is reported
 * but NOT auto-edited (per plan constraint: no Elementor JSON edits).
 *
 * @package ECL_Conversion
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ECL_Consistency {

    /**
     * Patterns to scan for and their replacements.
     */
    private array $scan_patterns = array(
        'purity_99' => array(
            'pattern'     => '/≥\s*99%\s*purity|at least 99%\s*purity|99%\+\s*purity/i',
            'description' => 'Purity claim "≥99%" — check if this matches all COA data',
            'fix_to'      => '', // Depends on owner decision — empty = report only
        ),
        'purity_98' => array(
            'pattern'     => '/≥\s*98%\s*purity|at least 98%\s*purity/i',
            'description' => 'Purity claim "≥98%" — check if this matches all COA data',
            'fix_to'      => '',
        ),
        'dispatch_24h' => array(
            'pattern'     => '/24h\s*ship|ships?\s*(?:in\s*)?24\s*hours|24-?hour\s*dispatch/i',
            'description' => 'Dispatch claim "24h" — target: "dispatched within 1 business day"',
            'fix_to'      => 'dispatched within 1 business day',
        ),
        'stale_domain_address' => array(
            'pattern'     => '/(support|orders)@eastcoastlabs\.com\.au/i',
            'description' => 'Stale @eastcoastlabs.com.au address found — target: eclpeptides@gmail.com',
            'fix_to'      => 'eclpeptides@gmail.com',
        ),
        'old_coupon' => array(
            'pattern'     => '/\bWELCOME!/i',
            'description' => 'Old coupon code "WELCOME!" — target: WELCOME15',
            'fix_to'      => 'WELCOME15',
        ),
    );

    public function __construct() {
        // Content filters (applied on display).
        add_filter( 'the_content', array( $this, 'auto_fix_content' ), 5 );
        add_filter( 'the_excerpt', array( $this, 'auto_fix_content' ), 5 );
        add_filter( 'woocommerce_short_description', array( $this, 'auto_fix_content' ), 5 );

        // Add admin notice if issues are found in Elementor data (non-blocking).
        add_action( 'admin_init', array( $this, 'check_for_elementor_issues' ) );

        // Register AJAX endpoint for the admin scan report.
        add_action( 'wp_ajax_ecl_scan_consistency', array( $this, 'ajax_scan_report' ) );
    }

    /**
     * Auto-fix known content patterns on display.
     * Only applies patterns that have a fix_to value.
     */
    public function auto_fix_content( string $content ): string {
        foreach ( $this->scan_patterns as $key => $config ) {
            if ( empty( $config['fix_to'] ) ) {
                continue;
            }
            $content = preg_replace( $config['pattern'], $config['fix_to'], $content );
        }

        return $content;
    }

    /**
     * Scan the database for consistency issues.
     * Returns a structured report.
     *
     * @return array{ posts: array, elementor: array, options: array, summary: array }
     */
    public function scan_database(): array {
        global $wpdb;

        $report = array(
            'posts'      => array(),
            'elementor'  => array(),
            'options'    => array(),
            'summary'    => array(
                'total_issues'    => 0,
                'auto_fixable'    => 0,
                'manual_fix'      => 0,
            ),
        );

        // Scan post content and excerpts.
        foreach ( $this->scan_patterns as $key => $config ) {
            $regex = $config['pattern'];

            // Post content.
            $results = $wpdb->get_results( $wpdb->prepare(
                "SELECT ID, post_title, post_type FROM {$wpdb->posts}
                 WHERE post_content REGEXP %s
                 AND post_status IN ('publish', 'private', 'draft')
                 LIMIT 100",
                $this->regex_to_mysql( $config['pattern'] )
            ), ARRAY_A );

            if ( $results ) {
                foreach ( $results as $row ) {
                    $report['posts'][] = array(
                        'issue'      => $key,
                        'description' => $config['description'],
                        'post_id'     => $row['ID'],
                        'post_title'  => $row['post_title'],
                        'post_type'   => $row['post_type'],
                        'auto_fix'    => ! empty( $config['fix_to'] ),
                    );
                    $report['summary']['total_issues']++;
                    if ( ! empty( $config['fix_to'] ) ) {
                        $report['summary']['auto_fixable']++;
                    } else {
                        $report['summary']['manual_fix']++;
                    }
                }
            }

            // Elementor data (postmeta _elementor_data).
            $elementor_results = $wpdb->get_results( $wpdb->prepare(
                "SELECT pm.post_id, p.post_title
                 FROM {$wpdb->postmeta} pm
                 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = '_elementor_data'
                 AND pm.meta_value REGEXP %s
                 LIMIT 100",
                $this->regex_to_mysql( $config['pattern'] )
            ), ARRAY_A );

            if ( $elementor_results ) {
                foreach ( $elementor_results as $row ) {
                    $report['elementor'][] = array(
                        'issue'       => $key,
                        'description' => $config['description'] . ' [IN ELEMENTOR — requires manual edit]',
                        'post_id'     => $row['post_id'],
                        'post_title'  => $row['post_title'],
                        'auto_fix'    => false, // Never auto-fix Elementor JSON.
                    );
                    $report['summary']['total_issues']++;
                    $report['summary']['manual_fix']++;
                }
            }

            // Options table.
            $option_results = $wpdb->get_results( $wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options}
                 WHERE option_value REGEXP %s
                 LIMIT 50",
                $this->regex_to_mysql( $config['pattern'] )
            ), ARRAY_A );

            if ( $option_results ) {
                foreach ( $option_results as $row ) {
                    $report['options'][] = array(
                        'issue'       => $key,
                        'description' => $config['description'],
                        'option_name' => $row['option_name'],
                        'auto_fix'    => ! empty( $config['fix_to'] ),
                    );
                    $report['summary']['total_issues']++;
                    if ( ! empty( $config['fix_to'] ) ) {
                        $report['summary']['auto_fixable']++;
                    } else {
                        $report['summary']['manual_fix']++;
                    }
                }
            }
        }

        // Also scan for testimonial names.
        $testimonial_names = array( 'Sarah Johnson', 'Michael Chen', 'Emma Williams', 'Daniel Lee', 'Olivia Brown', 'James Martinez' );
        foreach ( $testimonial_names as $name ) {
            $name_pattern = $this->escape_for_mysql_regex( $name );
            $results = $wpdb->get_results(
                "SELECT ID, post_title FROM {$wpdb->posts}
                 JOIN {$wpdb->postmeta} pm ON pm.post_id = {$wpdb->posts}.ID
                 WHERE (post_content LIKE '%{$name_pattern}%'
                    OR pm.meta_value LIKE '%{$name_pattern}%')
                 AND pm.meta_key = '_elementor_data'
                 LIMIT 50"
            );

            if ( $results ) {
                foreach ( $results as $row ) {
                    $report['elementor'][] = array(
                        'issue'       => 'fake_testimonial',
                        'description' => "Fake testimonial name \"{$name}\" found in Elementor data — DELETE this widget manually",
                        'post_id'     => $row->ID,
                        'post_title'  => $row->post_title,
                        'auto_fix'    => false,
                    );
                    $report['summary']['total_issues']++;
                    $report['summary']['manual_fix']++;
                }
            }
        }

        return $report;
    }

    /**
     * Convert PHP regex to MySQL REGEXP compatible pattern.
     * MySQL REGEXP doesn't support all PHP regex features, so we simplify.
     */
    private function regex_to_mysql( string $php_pattern ): string {
        // Strip delimiters and flags.
        $pattern = preg_replace( '/^\/(.*?)\/[a-z]*$/i', '$1', $php_pattern );
        // MySQL REGEXP is case-insensitive by default on most collations.
        return $this->escape_for_mysql_regex( $pattern );
    }

    /**
     * Escape special characters for MySQL REGEXP.
     */
    private function escape_for_mysql_regex( string $pattern ): string {
        // For LIKE queries, escape % and _.
        return str_replace( array( '\\%', '\\_' ), array( '\\\\%', '\\\\_' ), $pattern );
    }

    /**
     * Check if Elementor-stored data contains known issues.
     * If so, show an admin notice pointing to the scan report.
     */
    public function check_for_elementor_issues(): void {
        // Only check once per day.
        $last_check = get_transient( 'ecl_elementor_scan' );
        if ( false !== $last_check ) {
            return;
        }

        $report = $this->scan_database();

        if ( ! empty( $report['elementor'] ) ) {
            add_action( 'admin_notices', function () use ( $report ): void {
                echo '<div class="notice notice-warning is-dismissible">';
                echo '<p><strong>ECL Conversion:</strong> Found ' . count( $report['elementor'] ) . ' issue(s) stored in Elementor JSON data.';
                echo ' These require manual editing in the Elementor editor. Go to <strong>WooCommerce → ECL Conversion</strong> for the full report.</p>';
                echo '</div>';
            } );
        }

        set_transient( 'ecl_elementor_scan', true, DAY_IN_SECONDS );
    }

    /**
     * AJAX handler for the admin scan report.
     */
    public function ajax_scan_report(): void {
        check_ajax_referer( 'ecl_admin', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized', 403 );
        }

        $report = $this->scan_database();
        wp_send_json_success( $report );
    }

    /**
     * Generate the WELCOME15 coupon if it doesn't exist.
     * Called from the WP-CLI importer.
     */
    public function ensure_welcome15_coupon(): array {
        $result = array( 'created' => false, 'message' => '' );

        // Check if coupon exists.
        $existing = get_posts( array(
            'post_type'   => 'shop_coupon',
            'title'       => 'WELCOME15',
            'post_status' => 'publish',
            'numberposts' => 1,
        ) );

        if ( ! empty( $existing ) ) {
            $result['message'] = 'Coupon WELCOME15 already exists (ID: ' . $existing[0]->ID . ')';
            return $result;
        }

        $coupon_code = 'WELCOME15';
        $coupon = new WC_Coupon();
        $coupon->set_code( $coupon_code );
        $coupon->set_discount_type( 'percent' );
        $coupon->set_amount( 15 );
        $coupon->set_description( '15% off first order — replaces old WELCOME! code' );
        $coupon->set_usage_limit( 0 ); // No total limit.
        $coupon->set_usage_limit_per_user( 1 ); // One use per customer.
        $coupon->set_free_shipping( false );
        $coupon->save();

        $result['created'] = true;
        $result['message'] = 'Coupon WELCOME15 created (ID: ' . $coupon->get_id() . ')';

        return $result;
    }
}
