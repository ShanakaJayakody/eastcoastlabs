<?php
/**
 * Guarantee Block Template — Phase 1.3
 *
 * Rendered under the COA module on single product pages.
 *
 * Variables in scope:
 * @var string $text   Guarantee text.
 * @var string $purity Purity percentage.
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="ecl-guarantee-block ecl-guarantee-block--pdp">
    <div class="ecl-guarantee-block__header">
        <span class="ecl-guarantee-block__icon">🛡️</span>
        <span class="ecl-guarantee-block__title">Purity Guaranteed — We Cover the Test</span>
    </div>
    <p class="ecl-guarantee-block__text"><?php echo esc_html( $text ); ?></p>
    <div class="ecl-guarantee-block__badges">
        <span class="ecl-guarantee-block__badge">✓ COA included with every order</span>
        <span class="ecl-guarantee-block__badge">✓ Independent lab testing</span>
        <span class="ecl-guarantee-block__badge">✓ 30-day replacement guarantee</span>
    </div>
</div>
