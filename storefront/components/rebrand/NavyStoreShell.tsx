import type {ReactNode} from 'react';
import NavyCartDrawer from './NavyCartDrawer';
import StoreEnhancements from '@/components/StoreEnhancements';
import NavyHeader from './NavyHeader';
import NavyFooter from './NavyFooter';
import type {RebrandProps} from './RebrandExperience';
import './rebrand.css';
import './homepage-sections.css';
import './storefront-theme.css';

type Props = Pick<RebrandProps, 'collections' | 'supportEmail' | 'supportHours' | 'legalName' | 'abn'> & {children: ReactNode};

/** One public shell. Commerce providers stay in the route layout, outside admin. */
export default function NavyStoreShell({children, ...footer}: Props) {
  return <div className="rebrand rb-v2 ecl-store navy-store flex min-h-screen flex-col" data-brand-variant="v2">
    <NavyHeader />
    <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
    <NavyFooter {...footer} />
    <NavyCartDrawer />
    <StoreEnhancements />
  </div>;
}
