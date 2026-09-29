import type {Viewport} from 'next';
import NavyMessageShell from '@/components/rebrand/NavyMessageShell';

export const viewport: Viewport = {colorScheme: 'light', themeColor: '#112b43'};

export default function CartRecoveryLayout({children}: {children: React.ReactNode}) {
  return <NavyMessageShell>{children}</NavyMessageShell>;
}
