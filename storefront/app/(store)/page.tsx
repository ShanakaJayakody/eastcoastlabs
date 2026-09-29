import type {Metadata} from 'next';
import RebrandPage from '@/components/rebrand/RebrandPage';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Research peptides you can trust',
  alternates: {canonical: '/'},
};

export default function HomePage() {
  return <RebrandPage variant="v2" />;
}
