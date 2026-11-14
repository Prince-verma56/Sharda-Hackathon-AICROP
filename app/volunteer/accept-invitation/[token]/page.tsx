import { Manrope } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CalendarClock, CircleAlert, CircleCheck, HandHeart, MapPin, Smartphone } from 'lucide-react';
import { Accent } from '@/components/app/page-intro';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Logo } from '@/components/marketing/home/brand';
import { getAppUser } from '@/server/auth/dal';
import { maskPhone } from '@/server/auth/phone';
import { acceptInvitation } from '@/server/volunteer/invitation-actions';
import { findInvitationByToken } from '@/server/volunteer/invitations';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata = { title: 'Volunteer invitation', robots: { index: false, follow: false } };

const pill = 'group inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[12px] font-semibold tracking-[0.12em] uppercase transition-colors';

/**
 * Public page behind an invitation link. It explains the invitation; acceptance always requires
 * OTP sign-in with the invited number (checked again on the server).
 */
export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([findInvitationByToken(token), getAppUser()]);
  const loginHref = `/login?role=volunteer&next=/volunteer/accept-invitation/${token}`;
  const mine = Boolean(user && invite && user.phone === invite.phone);

  let body: React.ReactNode;
  if (!invite) {
    body = <Notice tone="error" title="This invitation link is not valid" text="Check that you opened the full link, or ask your programme administrator for a new invitation." />;
  } else if (invite.state === 'EXPIRED' || invite.state === 'REVOKED') {
    body = (
      <Notice
        tone="error"
        title={invite.state === 'EXPIRED' ? 'This invitation has expired' : 'This invitation was withdrawn'}
        text="Ask your programme administrator to send you a new invitation."
      />
    );
  } else if (invite.state === 'ACCEPTED') {
    body =
      user && invite.acceptedUserId === user.userId ? (
        <div className="flex flex-col gap-4">
          <Notice tone="ok" title="You are a CropAI volunteer" text="Your invitation is accepted. Complete your profile to start." />
          <Link href="/volunteer/profile" className={`${pill} bg-[var(--crop-green-800)] text-white hover:bg-[var(--crop-green-900)]`}>
            Open volunteer workspace <ArrowUpRight className="size-4" />
          </Link>
        </div>
      ) : (
        <Notice tone="error" title="This invitation has already been used" text="Each invitation link works once. Ask your administrator if you need a new one." />
      );
  } else if (user && !mine) {
    body = (
      <div className="flex flex-col gap-4">
        <Notice
          tone="error"
          title="Signed in with a different number"
          text={`This invitation is for ${maskPhone(invite.phone)}, but you are signed in as ${maskPhone(user.phone)}. Sign out, then sign in with the invited number.`}
        />
        <SignOutButton className={`${pill} w-full bg-white ring-1 ring-border hover:bg-[var(--crop-green-100)]`}>Sign out</SignOutButton>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <ul className="grid gap-px overflow-hidden rounded-2xl bg-border/70">
          <Row icon={Smartphone} label="Invited number" value={maskPhone(invite.phone)} />
          {(invite.serviceArea || invite.village || invite.district) && (
            <Row icon={MapPin} label="Service area" value={[invite.serviceArea, invite.village, invite.district].filter(Boolean).join(' · ')} />
          )}
          <Row icon={CalendarClock} label="Valid until" value={invite.expiresAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
        </ul>
        {user ? (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={`${pill} w-full bg-[var(--crop-green-800)] text-white hover:bg-[var(--crop-green-900)]`}>
              Accept invitation <ArrowUpRight className="size-4" />
            </button>
          </form>
        ) : (
          <Link href={loginHref} className={`${pill} w-full bg-[var(--crop-green-800)] text-white hover:bg-[var(--crop-green-900)]`}>
            Verify your phone to accept <ArrowUpRight className="size-4" />
          </Link>
        )}
        <p className="text-xs text-muted-foreground">
          You will receive a one-time code on the invited number. The volunteer role is added only after that number is verified. If you already use CropAI as a farmer, your account and reports stay the same.
        </p>
      </div>
    );
  }

  return (
    <div className={`theme-crop ${manrope.variable} grid min-h-dvh bg-[var(--crop-cream)] antialiased lg:grid-cols-2`}>
      <div className="relative hidden overflow-hidden bg-[var(--crop-green-950)] lg:block">
        <Image src="/images/home/hero.jpg" alt="" fill sizes="50vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--crop-green-950)] via-[var(--crop-green-950)]/40 to-transparent" />
        <p className="absolute right-10 bottom-10 left-10 text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-white uppercase">
          Help farmers <span className="text-[var(--crop-green-200)]">check their crops</span>
        </p>
      </div>
      <main className="flex flex-col justify-center gap-8 px-5 py-10 sm:px-10 lg:px-16">
        <Logo className="text-[1.3rem]" />
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--crop-green-600)] uppercase">
            <HandHeart className="size-4" /> Volunteer invitation
          </p>
          <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.6rem)] leading-[0.92] font-semibold tracking-[-0.045em] uppercase">
            {invite?.inviteeName ? (
              <>
                Namaste, <Accent>{invite.inviteeName}</Accent>
              </>
            ) : (
              <>
                Join as a <Accent>volunteer</Accent>
              </>
            )}
          </h1>
          {invite && invite.state === 'PENDING' && (
            <p className="mt-3 max-w-md text-muted-foreground">
              {invite.invitedBy.name ? `${invite.invitedBy.name} invited you` : 'You have been invited'} to help farmers in your area use CropAI safely.
            </p>
          )}
        </div>
        <div className="max-w-md">{body}</div>
      </main>
    </div>
  );
}

function Notice({ tone, title, text }: { tone: 'ok' | 'error'; title: string; text: string }) {
  const Icon = tone === 'ok' ? CircleCheck : CircleAlert;
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ring-1 ${tone === 'ok' ? 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)] ring-[var(--crop-green-200)]' : 'bg-amber-50 text-amber-950 ring-amber-200'}`}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-85">{text}</p>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 bg-white p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--crop-green-100)] text-[var(--crop-green-600)]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
        <span className="block truncate text-sm font-semibold">{value}</span>
      </span>
    </li>
  );
}
