import {it,expect} from 'vitest';
import {historicalProductImage} from '@/lib/customer-orders/media';
const parent={size_parent_id:null,size_label:'50 mg',images:[{src:'/images/50mg.jpg',size_label:'50 mg'},{src:'/images/100mg.jpg',size_label:'100 mg'}]};
it('requires size agreement and explicit image provenance for inherited child media',()=>{
 expect(historicalProductImage({...parent,size_parent_id:'parent',size_label:'100 mg'},'100 mg','1 vial')).toBe('/images/100mg.jpg');
 expect(historicalProductImage({...parent,size_parent_id:'parent',size_label:'100 mg',images:[parent.images[0]]},'100 mg','1 vial')).toBeNull();
 expect(historicalProductImage(parent,'100 mg','1 vial')).toBeNull();
});
it('does not guess a historical size when the receipt never recorded it',()=>{
 expect(historicalProductImage(parent,null,'1 vial')).toBeNull();
 expect(historicalProductImage(parent,null,'1 vial · 50 mg')).toBe('/images/50mg.jpg');
});
