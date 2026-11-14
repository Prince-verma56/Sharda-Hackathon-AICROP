import { PageTransition } from '@/components/app/page-transition';

export default function VolunteerTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
