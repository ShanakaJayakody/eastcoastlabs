import { expect, it } from 'vitest';
import SagePage from '@/app/(variant)/1/page';
import PlumPage from '@/app/(variant)/3/page';

for (const [name, Page] of [['sage', SagePage], ['plum', PlumPage]] as const) {
  it(`takes an old ${name} bookmark to the chosen navy design`, () => {
    try {
      Page();
      expect.fail('A retired design must redirect instead of rendering.');
    } catch (error) {
      expect(error).toHaveProperty('digest', 'NEXT_REDIRECT;replace;/2;307;');
    }
  });
}
