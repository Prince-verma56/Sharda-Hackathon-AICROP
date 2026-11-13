import Link from 'next/link';
import { ArrowUpRight, Phone } from 'lucide-react';
import { Accent, PageIntro, eyebrowClass } from '@/components/app/page-intro';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/server/auth/phone';
import { requireFarmer } from '@/server/auth/dal';
import { getCropImages } from '@/server/cropai/crop-images';
import { loadProfileValues } from '@/server/cropai/farmer-profile';
import { tryGetTaxonomy } from '@/server/cropai/taxonomy';
import { ProfileEditor } from '../../profile-editor';
import { AccountControls } from './account-controls';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const farmer = await requireFarmer();
  const [values, taxonomy, cropImages] = await Promise.all([loadProfileValues(farmer.userId), tryGetTaxonomy(), getCropImages()]);
  const lang = values.language === 'en' ? 'en' : 'hi';
  const hi = lang === 'hi';
  const links = [
    { href: '/farmer/settings', label: hi ? 'मित्र सेटिंग्स' : 'Mitra settings', hint: hi ? 'भाषा, आवाज़, स्वभाव' : 'Language, voice, tone' },
    { href: '/farmer/assistant', label: hi ? 'मित्र की सेव बातचीत' : 'Mitra chat history', hint: hi ? 'सेव करें या मिटाएँ' : 'Save or delete' },
    { href: '/data-rights', label: hi ? 'आपके डेटा अधिकार' : 'Your data rights', hint: hi ? 'देखें, सुधारें, मिटाएँ' : 'Access, correct, delete' },
    { href: '/privacy-policy', label: hi ? 'गोपनीयता नीति' : 'Privacy policy', hint: hi ? 'हम क्या रखते हैं' : 'What we keep' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 lg:gap-8 lg:px-8 lg:pt-10">
      <PageIntro
        lang={lang}
        eyebrow={hi ? 'आपका खाता' : 'Your account'}
        title={
          hi ? (
            <>
              आपकी <Accent>प्रोफ़ाइल</Accent>
            </>
          ) : (
            <>
              Your <Accent>profile</Accent>
            </>
          )
        }
        description={hi ? 'नाम, भाषा, खेत की जगह और फसलें — सब वैकल्पिक। मित्र इनसे बेहतर सलाह देता है।' : 'Name, language, farm location and crops — all optional. Mitra uses them to give better advice.'}
      />

      <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <ProfileEditor initial={values} crops={taxonomy?.crops.map((c) => c.id) ?? []} cropImages={cropImages} mode="profile" />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-4">
          <section className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-border sm:p-6">
            <p className={cn(eyebrowClass(lang), 'text-[var(--crop-green-600)]')}>{hi ? 'खाता' : 'Account'}</p>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
                <Phone className="size-5" strokeWidth={1.7} />
              </span>
              <span>
                <span className="block font-semibold tabular-nums">{maskPhone(farmer.phone)}</span>
                <span className="text-xs text-muted-foreground">{hi ? 'OTP से सत्यापित मोबाइल' : 'Mobile verified by OTP'}</span>
              </span>
            </div>
            <AccountControls lang={lang} />
          </section>

          <nav aria-label={hi ? 'गोपनीयता' : 'Privacy'} className="overflow-hidden rounded-[24px] bg-white ring-1 ring-border">
            <ul className="divide-y divide-border/70">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[var(--crop-green-100)]/60">
                    <span>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
