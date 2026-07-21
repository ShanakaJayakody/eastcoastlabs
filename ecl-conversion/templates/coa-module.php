<?php
/**
 * COA Module Template — Phase 1.2
 *
 * Rendered on single product pages under the buy box.
 * Shows: batch ID, purity %, test date, lab name, COA link, lab verification link.
 *
 * Variables available in scope:
 * @var array  $coa       COA data array.
 * @var string $lab       Lab name.
 * @var string $test_date Formatted test date.
 * @var string $purity    Formatted purity percentage.
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="ecl-coa-module" itemscope itemtype="https://schema.org/Dataset">
    <div class="ecl-coa-module__header">
        <span class="ecl-coa-module__icon">🔬</span>
        <span class="ecl-coa-module__title">Batch Verified</span>
    </div>

    <div class="ecl-coa-module__data">
        <span class="ecl-coa-module__line">
            <span class="ecl-coa-module__label">Batch</span>
            <span class="ecl-coa-module__value" itemprop="identifier">#<?php echo esc_html( $coa['batch_id'] ); ?></span>
        </span>
        <span class="ecl-coa-module__line ecl-coa-module__line--purity">
            <span class="ecl-coa-module__label">Purity</span>
            <span class="ecl-coa-module__value ecl-coa-module__value--purity" itemprop="variableMeasured">
                <strong><?php echo esc_html( $purity ); ?>%</strong>
            </span>
        </span>
        <span class="ecl-coa-module__line">
            <span class="ecl-coa-module__label">Tested</span>
            <span class="ecl-coa-module__value" itemprop="dateModified"><?php echo esc_html( $test_date ); ?></span>
        </span>
        <span class="ecl-coa-module__line">
            <span class="ecl-coa-module__label">Lab</span>
            <span class="ecl-coa-module__value" itemprop="creator"><?php echo esc_html( $lab ); ?></span>
        </span>
    </div>

    <div class="ecl-coa-module__links">
        <?php if ( ! empty( $coa['coa_url'] ) ) : ?>
            <a href="<?php echo esc_url( $coa['coa_url'] ); ?>" target="_blank" rel="noopener"
               class="ecl-coa-module__link ecl-coa-module__link--coa">
                View COA →
            </a>
        <?php endif; ?>

        <?php if ( ! empty( $coa['lab_verify_url'] ) ) : ?>
            <a href="<?php echo esc_url( $coa['lab_verify_url'] ); ?>" target="_blank" rel="noopener"
               class="ecl-coa-module__link ecl-coa-module__link--verify">
                Verify with <?php echo esc_html( $lab ); ?> →
            </a>
        <?php endif; ?>
    </div>

    <p class="ecl-coa-module__footer">
        Independently tested. Every result published. If it doesn't pass, it doesn't ship.
    </p>
</div>
