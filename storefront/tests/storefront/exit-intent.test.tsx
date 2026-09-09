// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,act} from '@testing-library/react';
afterEach(()=>{cleanup();vi.useRealTimers();});
const m=vi.hoisted(()=>({path:'/checkout'}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({cartOpen:false})}));
vi.mock('@/components/EmailCapture',()=>({default:()=>null}));
import ExitIntentModal from '@/components/ExitIntentModal';
it.each(['/checkout','/checkout/thank-you','/pay/order','/subscribe/confirm'])('never interrupts transaction route %s',path=>{m.path=path;localStorage.clear();vi.useFakeTimers();window.matchMedia=vi.fn().mockReturnValue({matches:true});render(<ExitIntentModal/>);act(()=>vi.advanceTimersByTime(61000));fireEvent.mouseOut(document,{clientY:0});expect(screen.queryByText('Save 10%')).toBeNull();});

it('hides footer capture on the actual subscription confirmation route',async()=>{m.path='/subscribe/confirm';const {default:MarketingOnly}=await import('@/components/MarketingOnly');render(<MarketingOnly><button>Newsletter capture</button></MarketingOnly>);expect(screen.queryByRole('button',{name:'Newsletter capture'})).toBeNull();});
