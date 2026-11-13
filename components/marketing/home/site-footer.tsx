import { Separator } from '@/components/ui/separator';
import { Logo, SocialIcon } from './brand';
import { NAV_LINKS } from './content';
import { SmoothLink } from './smooth-link';

const SOCIALS = ['YouTube', 'X', 'LinkedIn', 'GitHub'] as const;

export function SiteFooter() {
  return (
    <footer id="contact" className="scroll-mt-24 px-4 pt-12 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <SmoothLink href="#top" aria-label="Back to top">
            <Logo />
          </SmoothLink>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {NAV_LINKS.map((link) => (
              <SmoothLink key={link.href} href={link.href} className="text-[13px] font-medium text-foreground/70 transition-colors hover:text-foreground">
                {link.label}
              </SmoothLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            {SOCIALS.map((name) => (
              <a
                key={name}
                href="#contact"
                aria-label={name}
                className="grid size-9 place-items-center rounded-full text-foreground/80 transition-all hover:-translate-y-0.5 hover:bg-[var(--crop-green-100)] hover:text-[var(--crop-green-800)]"
              >
                <SocialIcon name={name} />
              </a>
            ))}
          </div>
        </div>
        <Separator className="my-7" />
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} CropAI. All rights reserved.</p>
          <p className="italic">Smarter Farming. A Greener Tomorrow.</p>
        </div>
      </div>
    </footer>
  );
}
