import {expect,it} from 'vitest';
import {getProductCopy} from '@/lib/content';
it('does not publish missing scientific values or study placeholders from the copy deck',async()=>{const copy=await getProductCopy('BPC-157','bpc-157');expect(copy).not.toBeNull();expect(copy!.html).not.toContain('PLACEHOLDER');});
