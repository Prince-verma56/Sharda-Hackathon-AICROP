import { PageTransition } from '@/components/app/page-transition';

export default function FarmerTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
