import { SiteChrome } from '@/components/marketing/site-chrome';

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
