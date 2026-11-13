/**
 * Login / access strings (English default, Hindi). Same plain-dictionary approach as
 * lib/i18n/farmer.ts; the choice is stored in the `cropai_lang` cookie (lang-cookie.ts)
 * and becomes the farmer profile language after sign-in.
 */
import type { Lang } from './farmer';
import type { Workspace } from '@/lib/auth/redirects';

export type { Lang };

/** New visitors get English unless they chose Hindi before. */
export function authLang(cookieValue: string | undefined): Lang {
  return cookieValue === 'hi' ? 'hi' : 'en';
}

export type OtpErrorKey =
  | 'invalidPhone'
  | 'wrongCode'
  | 'expired'
  | 'locked'
  | 'cooldown'
  | 'tooMany'
  | 'network'
  | 'notConfigured'
  | 'devLocalOnly'
  | 'devPhoneNotAllowed'
  | 'recipientNotAllowed'
  | 'countryBlocked'
  | 'numberUnsupported'
  | 'deliveryBlocked'
  | 'providerError'
  | 'volunteerDenied'
  | 'adminDenied'
  | 'accountSuspended'
  | 'accountPending'
  | 'accountDisabled'
  | 'generic';

interface RoleCopy {
  tab: string;
  title: string;
  subtitle: string;
  help: string;
  workspace: string;
}

export interface AuthText {
  languageLabel: string;
  roleGroupLabel: string;
  roles: Record<Workspace, RoleCopy>;
  phoneLabel: string;
  india: string;
  otherCountry: string;
  phonePlaceholder: string;
  otherPlaceholder: string;
  sendOtp: string;
  codeTitle: string;
  codeHelp: (maskedPhone: string) => string;
  codeLabel: string;
  verify: string;
  resendIn: (seconds: number) => string;
  resend: string;
  codeSent: string;
  changeNumber: string;
  continuingTo: (workspace: string) => string;
  success: string;
  errors: Record<OtpErrorKey, string>;
  attemptsLeft: (n: number) => string;
  devMode: string;
  devSent: string;
  heroTitle: string;
  heroPoints: [string, string, string];
  secured: string;
  privacyNote: string;
  backHome: string;
  // after verification (/auth/continue)
  checking: string;
  denied: Record<Workspace, { title: string; text: string }>;
  noWorkspace: string;
  startFarmer: string;
  goTo: (workspace: string) => string;
  signOut: string;
  states: { suspended: string; pending: string; disabled: string; NO_VERIFIED_PHONE: string; generic: string };
}

export const AUTH_TEXT: Record<Lang, AuthText> = {
  en: {
    languageLabel: 'Language',
    roleGroupLabel: 'Choose how you want to continue',
    roles: {
      farmer: {
        tab: 'Farmer',
        title: 'Simple access to your crop assistant.',
        subtitle: 'Continue using only your mobile number.',
        help: 'We will send a 6-digit OTP by SMS. No email or password needed.',
        workspace: 'Farmer workspace',
      },
      volunteer: {
        tab: 'Volunteer',
        title: 'Access your farmer assistance workspace.',
        subtitle: 'For invited and approved field volunteers.',
        help: 'Use the mobile number your programme administrator invited. Your volunteer access is checked after OTP verification.',
        workspace: 'Volunteer workspace',
      },
      admin: {
        tab: 'Admin',
        title: 'Authorised team and agricultural expert access.',
        subtitle: 'Restricted access for approved administrators.',
        help: 'Only pre-approved administrator numbers can open the admin workspace. Access is verified on our server after OTP verification.',
        workspace: 'Admin workspace',
      },
    },
    phoneLabel: 'Enter your mobile number',
    india: 'India +91',
    otherCountry: 'Other country',
    phonePlaceholder: '10-digit mobile number',
    otherPlaceholder: 'Full number with + and country code',
    sendOtp: 'Send OTP',
    codeTitle: 'Enter the OTP',
    codeHelp: (p) => `Enter the 6-digit code sent to ${p}.`,
    codeLabel: '6-digit OTP',
    verify: 'Verify OTP',
    resendIn: (s) => `Resend OTP in ${s}s`,
    resend: 'Resend OTP',
    codeSent: 'OTP sent.',
    changeNumber: 'Change mobile number',
    continuingTo: (w) => `Continuing to: ${w}`,
    success: 'Verified! Taking you to your workspace…',
    errors: {
      invalidPhone: 'Please enter a valid mobile number.',
      wrongCode: 'That OTP is not correct. Please check and try again.',
      expired: 'This OTP has expired or was already used. Please request a new one.',
      locked: 'Too many wrong attempts. Please request a new OTP.',
      cooldown: 'Please wait a moment before requesting another OTP.',
      tooMany: 'Too many attempts. Please wait and try again later.',
      network: 'Network problem. Check your internet connection and try again.',
      notConfigured: 'OTP login is not set up on this server yet. Please try again later.',
      devLocalOnly: 'Development OTP mode works only on localhost.',
      devPhoneNotAllowed: 'This number is not in the development test-number list.',
      recipientNotAllowed: 'Our SMS provider cannot send to this number yet. It must be added as a verified number first.',
      countryBlocked: 'SMS to this country is not enabled for our SMS provider yet.',
      numberUnsupported: 'This number cannot receive SMS. Please use a mobile number.',
      deliveryBlocked: 'The SMS provider blocked delivery to this number. Please contact support.',
      providerError: 'The SMS service is temporarily unavailable. Please try again shortly.',
      volunteerDenied: 'This number has no volunteer invitation yet. Ask your admin to invite this exact number (Admin → Volunteers → Invite volunteer), then sign in again — or use the Farmer tab.',
      adminDenied: 'Access denied. This mobile number is not authorised for the admin workspace.',
      accountSuspended: 'This account has been suspended. Please contact the CropAI team.',
      accountPending: 'This account is waiting for approval.',
      accountDisabled: 'This account has been disabled. Please contact the CropAI team.',
      generic: 'Something went wrong. Please try again.',
    },
    attemptsLeft: (n) => (n === 1 ? '1 attempt left.' : `${n} attempts left.`),
    devMode: 'Development mode: no SMS is sent. Enter the development code from AUTH_DEV_OTP_CODE.',
    devSent: 'Development mode: no SMS was sent.',
    heroTitle: 'Healthier crops start with one photo.',
    heroPoints: ['Check a leaf photo in seconds', 'Advice in simple words and by voice', 'One secure login: mobile number and OTP'],
    secured: 'Secured with one-time passwords. We never ask for a password.',
    privacyNote: 'Your mobile number is used to sign you in and to protect your account.',
    backHome: 'Back to home',
    checking: 'Checking your access…',
    denied: {
      farmer: { title: 'No farmer workspace yet', text: 'This account does not have the farmer workspace yet. You can start using it now.' },
      volunteer: { title: 'Volunteer access not active', text: 'Your volunteer access is not active yet. Please contact your programme administrator.' },
      admin: { title: 'Access denied', text: 'This mobile number is not authorised for the admin workspace. If you should have access, ask a super administrator to add your number.' },
    },
    noWorkspace: 'No workspace is assigned to this account yet.',
    startFarmer: 'Start using the farmer app',
    goTo: (w) => `Go to ${w}`,
    signOut: 'Sign out',
    states: {
      suspended: 'This account has been suspended. Please contact the CropAI team.',
      pending: 'This account is waiting for approval.',
      disabled: 'This account has been disabled. Please contact the CropAI team.',
      NO_VERIFIED_PHONE: 'This account has no verified mobile number. Please sign in again with your mobile number.',
      generic: 'Sign-in could not be completed. Please try again.',
    },
  },
  hi: {
    languageLabel: 'भाषा',
    roleGroupLabel: 'चुनें कि आप कैसे आगे बढ़ना चाहते हैं',
    roles: {
      farmer: {
        tab: 'किसान',
        title: 'आपके फसल सहायक तक आसान पहुँच।',
        subtitle: 'सिर्फ़ अपने मोबाइल नंबर से आगे बढ़ें।',
        help: 'हम SMS से 6 अंकों का OTP भेजेंगे। ईमेल या पासवर्ड की ज़रूरत नहीं।',
        workspace: 'किसान कार्यक्षेत्र',
      },
      volunteer: {
        tab: 'स्वयंसेवक',
        title: 'अपने किसान सहायता कार्यक्षेत्र में प्रवेश करें।',
        subtitle: 'आमंत्रित और स्वीकृत फ़ील्ड स्वयंसेवकों के लिए।',
        help: 'वही मोबाइल नंबर डालें जिस पर आपके कार्यक्रम प्रशासक ने आपको आमंत्रित किया है। OTP सत्यापन के बाद आपकी स्वयंसेवक पहुँच की जाँच होती है।',
        workspace: 'स्वयंसेवक कार्यक्षेत्र',
      },
      admin: {
        tab: 'प्रशासक',
        title: 'अधिकृत टीम और कृषि विशेषज्ञों के लिए पहुँच।',
        subtitle: 'केवल स्वीकृत प्रशासकों के लिए सीमित पहुँच।',
        help: 'केवल पहले से स्वीकृत प्रशासक नंबर ही प्रशासक कार्यक्षेत्र खोल सकते हैं। OTP सत्यापन के बाद हमारे सर्वर पर पहुँच की जाँच होती है।',
        workspace: 'प्रशासक कार्यक्षेत्र',
      },
    },
    phoneLabel: 'अपना मोबाइल नंबर दर्ज करें',
    india: 'भारत +91',
    otherCountry: 'अन्य देश',
    phonePlaceholder: '10 अंकों का मोबाइल नंबर',
    otherPlaceholder: '+ और देश कोड सहित पूरा नंबर',
    sendOtp: 'OTP भेजें',
    codeTitle: 'OTP दर्ज करें',
    codeHelp: (p) => `${p} पर भेजा गया 6 अंकों का कोड दर्ज करें।`,
    codeLabel: '6 अंकों का OTP',
    verify: 'OTP सत्यापित करें',
    resendIn: (s) => `${s} सेकंड में OTP दोबारा भेजें`,
    resend: 'OTP दोबारा भेजें',
    codeSent: 'OTP भेज दिया गया है।',
    changeNumber: 'मोबाइल नंबर बदलें',
    continuingTo: (w) => `आगे: ${w}`,
    success: 'सत्यापित! आपको आपके कार्यक्षेत्र पर ले जा रहे हैं…',
    errors: {
      invalidPhone: 'कृपया सही मोबाइल नंबर दर्ज करें।',
      wrongCode: 'यह OTP सही नहीं है। कृपया जाँचकर दोबारा कोशिश करें।',
      expired: 'इस OTP की समय-सीमा समाप्त हो गई है या इसका उपयोग हो चुका है। कृपया नया OTP मँगाएँ।',
      locked: 'बहुत अधिक गलत प्रयास हुए। कृपया नया OTP मँगाएँ।',
      cooldown: 'नया OTP मँगाने से पहले कृपया थोड़ा इंतज़ार करें।',
      tooMany: 'बहुत अधिक प्रयास हुए। कृपया कुछ देर बाद फिर कोशिश करें।',
      network: 'नेटवर्क में समस्या है। इंटरनेट कनेक्शन जाँचकर फिर कोशिश करें।',
      notConfigured: 'इस सर्वर पर अभी OTP लॉगिन चालू नहीं है। कृपया बाद में कोशिश करें।',
      devLocalOnly: 'डेवलपमेंट OTP मोड केवल localhost पर काम करता है।',
      devPhoneNotAllowed: 'यह नंबर डेवलपमेंट टेस्ट-नंबर सूची में नहीं है।',
      recipientNotAllowed: 'हमारी SMS सेवा अभी इस नंबर पर संदेश नहीं भेज सकती। पहले इसे सत्यापित नंबर के रूप में जोड़ना होगा।',
      countryBlocked: 'हमारी SMS सेवा के लिए इस देश में SMS अभी चालू नहीं है।',
      numberUnsupported: 'इस नंबर पर SMS नहीं आ सकता। कृपया मोबाइल नंबर डालें।',
      deliveryBlocked: 'SMS सेवा ने इस नंबर पर संदेश भेजना रोक दिया है। कृपया सहायता टीम से संपर्क करें।',
      providerError: 'SMS सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।',
      volunteerDenied: 'इस नंबर के लिए अभी स्वयंसेवक निमंत्रण नहीं है। अपने एडमिन से यही नंबर आमंत्रित करवाएँ (Admin → Volunteers → Invite volunteer), फिर दोबारा लॉग इन करें — या किसान टैब से लॉग इन करें।',
      adminDenied: 'पहुँच अस्वीकृत। यह मोबाइल नंबर प्रशासक कार्यक्षेत्र के लिए अधिकृत नहीं है।',
      accountSuspended: 'यह खाता निलंबित कर दिया गया है। कृपया CropAI टीम से संपर्क करें।',
      accountPending: 'यह खाता अभी स्वीकृति की प्रतीक्षा में है।',
      accountDisabled: 'यह खाता बंद कर दिया गया है। कृपया CropAI टीम से संपर्क करें।',
      generic: 'कुछ गलत हो गया। कृपया फिर कोशिश करें।',
    },
    attemptsLeft: (n) => `${n} प्रयास बाकी हैं।`,
    devMode: 'डेवलपमेंट मोड: कोई SMS नहीं भेजा जाता। AUTH_DEV_OTP_CODE में सेट किया गया डेवलपमेंट कोड डालें।',
    devSent: 'डेवलपमेंट मोड: कोई SMS नहीं भेजा गया।',
    heroTitle: 'स्वस्थ फसल की शुरुआत एक फ़ोटो से।',
    heroPoints: ['पत्ती की फ़ोटो से कुछ सेकंड में जाँच', 'आसान शब्दों और आवाज़ में सलाह', 'एक सुरक्षित लॉगिन: मोबाइल नंबर और OTP'],
    secured: 'एक बार इस्तेमाल होने वाले कोड (OTP) से सुरक्षित। हम कभी पासवर्ड नहीं माँगते।',
    privacyNote: 'आपके मोबाइल नंबर का उपयोग लॉगिन और आपके खाते की सुरक्षा के लिए किया जाता है।',
    backHome: 'होम पेज पर वापस',
    checking: 'आपकी पहुँच की जाँच हो रही है…',
    denied: {
      farmer: { title: 'अभी किसान कार्यक्षेत्र नहीं है', text: 'इस खाते में अभी किसान कार्यक्षेत्र नहीं है। आप इसे अभी शुरू कर सकते हैं।' },
      volunteer: { title: 'स्वयंसेवक पहुँच सक्रिय नहीं', text: 'आपकी स्वयंसेवक पहुँच अभी सक्रिय नहीं है। कृपया अपने कार्यक्रम प्रशासक से संपर्क करें।' },
      admin: { title: 'पहुँच अस्वीकृत', text: 'यह मोबाइल नंबर प्रशासक कार्यक्षेत्र के लिए अधिकृत नहीं है। यदि आपको पहुँच मिलनी चाहिए, तो किसी सुपर प्रशासक से अपना नंबर जुड़वाएँ।' },
    },
    noWorkspace: 'इस खाते को अभी कोई कार्यक्षेत्र नहीं मिला है।',
    startFarmer: 'किसान ऐप शुरू करें',
    goTo: (w) => `${w} पर जाएँ`,
    signOut: 'लॉग आउट करें',
    states: {
      suspended: 'यह खाता निलंबित कर दिया गया है। कृपया CropAI टीम से संपर्क करें।',
      pending: 'यह खाता अभी स्वीकृति की प्रतीक्षा में है।',
      disabled: 'यह खाता बंद कर दिया गया है। कृपया CropAI टीम से संपर्क करें।',
      NO_VERIFIED_PHONE: 'इस खाते में सत्यापित मोबाइल नंबर नहीं है। कृपया अपने मोबाइल नंबर से फिर लॉगिन करें।',
      generic: 'लॉगिन पूरा नहीं हो सका। कृपया फिर कोशिश करें।',
    },
  },
};

export function authText(lang: Lang): AuthText {
  return AUTH_TEXT[lang];
}
