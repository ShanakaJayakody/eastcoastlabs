import {expect,it} from 'vitest';
import {cartLineDestination,reservedVials} from '@/lib/cart-line';
it('routes product, gift, accessory and bundle lines to existing page families',()=>{
 expect(cartLineDestination({key:'1:single',slug:'bpc-157'})).toBe('/product/bpc-157');
 expect(cartLineDestination({key:'gift:bac-water',slug:'bacteriostatic-water'})).toBe('/product/bacteriostatic-water');
 expect(cartLineDestination({key:'acc:reconstitution-kit',slug:'reconstitution-kit'})).toBe('/shop#accessories');
 expect(cartLineDestination({key:'stack:recovery-stack',slug:'recovery-stack'})).toBe('/stacks#recovery-stack');
});
it('counts pack vials and bundle component quantities together',()=>{expect(reservedVials([{key:'p',slug:'bpc-157',variantLabel:'3-pack',quantity:2},{key:'stack:bundle',slug:'bundle',components:['bpc-157'],variantLabel:'Bundle',quantity:2}] as Parameters<typeof reservedVials>[0],'bpc-157')).toBe(8);});
