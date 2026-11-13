/**
 * Copy and data for the public trust pages: privacy policy, terms, data rights and government
 * resources. Describe what the app does TODAY (see server/, ai/ and app/farmer) — never plans as facts.
 */

export const LEGAL_LAST_UPDATED = { iso: '2026-11-13', label: '13 November 2026' } as const;

/** Public contact address, inlined at build time. null until NEXT_PUBLIC_CONTACT_EMAIL is set. */
export function contactEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
}

export const CONTACT_PENDING = 'Contact details will be published here soon.';

export const LEGAL_LINKS = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms & conditions', href: '/terms-and-conditions' },
  { label: 'Data rights', href: '/data-rights' },
  { label: 'Government resources', href: '/resources' },
] as const;

// ---- privacy policy ---------------------------------------------------------------------------

export type DataIcon = 'phone' | 'profile' | 'photo' | 'chat' | 'voice' | 'search' | 'weather' | 'security';

export interface DataCategory {
  icon: DataIcon;
  title: string;
  what: string;
  why: string;
  kept: string;
}

export const DATA_WE_PROCESS: readonly DataCategory[] = [
  {
    icon: 'phone',
    title: 'Mobile number',
    what: 'Your mobile number is your login. We send a one-time code (OTP) to it by SMS. In production the code is created, sent and checked by our SMS provider, Twilio Verify — CropAI never creates or stores the code itself.',
    why: 'To create your account, sign you in safely and stop misuse, such as repeated code requests.',
    kept: 'While your account exists. Staff screens show it masked, for example +91 98•••••210.',
  },
  {
    icon: 'profile',
    title: 'Farmer profile',
    what: 'Only what you choose to add: your name, language (Hindi or English), village, district and state, main crops, and an optional farm location from your phone’s GPS or a place search.',
    why: 'To show the app in your language, suggest your crops and show weather for your farm.',
    kept: 'Until you change it on your profile page or your account is deleted.',
  },
  {
    icon: 'photo',
    title: 'Crop photos and AI results',
    what: 'Leaf photos you take, the crop you choose, the AI screening result, your feedback on a report and any expert review. Each photo is re-encoded before saving, which removes hidden details such as GPS location (EXIF data), and is stored privately — never as a public link.',
    why: 'To give you a result, keep your report history and let an invited expert check it when you ask, or when the result is uncertain.',
    kept: 'With your report history. Each photo also gets a retention date when uploaded — 90 days by default (see “How long we keep data”).',
  },
  {
    icon: 'chat',
    title: 'Text chat with Mitra',
    what: 'Questions you type to Mitra, with the context needed to answer: your selected report, crops, district, language and, if you ask, local weather. Your phone number and exact location are not included.',
    why: 'To answer your question in simple words.',
    kept: 'Saved to your account only if you turn on “Save my text chats” in Mitra → History, where you can also turn it off or delete your saved history at any time. If you do not turn it on, your recent messages are kept for up to 24 hours so Mitra can follow the conversation, and then removed.',
  },
  {
    icon: 'voice',
    title: 'Voice calls with Mitra',
    what: 'When you start a voice call, your voice is streamed to Vapi, which runs the call: speech-to-text, the AI reply and the spoken answer.',
    why: 'So you can talk to Mitra hands-free in Hindi or English.',
    kept: 'CropAI does not record the audio. The words appear on your screen during the call and are saved as text only if you turn on “Also save voice-call transcripts” in Mitra → History; otherwise recent turns are kept for up to 24 hours for context, then removed. We also keep a basic call record: start time, length and the linked report.',
  },
  {
    icon: 'search',
    title: 'Web search',
    what: 'When Mitra needs public farming information, your question and crop — never your name or phone number — may be sent to TinyFish, a web-search service.',
    why: 'To find public sources, preferring government and university pages. Web results are labelled “not expert-verified” and sentences with chemical doses are removed.',
    kept: 'Not saved to your account.',
  },
  {
    icon: 'weather',
    title: 'Weather',
    what: 'If you add a farm location, we send Open-Meteo only rounded coordinates (to about 1 km) to fetch temperature, humidity and rain. Place searches send the name you type.',
    why: 'To show local weather next to your report — as context, never as a disease-risk score.',
    kept: 'The weather reading is saved with the report it belongs to.',
  },
  {
    icon: 'security',
    title: 'Security records',
    what: 'Sign-in sessions (browser type and times), audit logs of important actions such as sign-in, new reports and expert reviews, and — for a short time, in scrambled form — your network address to limit repeated requests.',
    why: 'To keep accounts safe, investigate misuse and show who changed what.',
    kept: 'Sessions end after 30 days (12 hours for administrators) or when you log out. Audit logs are kept as long as needed for security.',
  },
];

export interface ServiceProvider {
  name: string;
  role: string;
  receives: string;
}

export const SERVICE_PROVIDERS: readonly ServiceProvider[] = [
  { name: 'Twilio Verify', role: 'Sends and checks login codes by SMS', receives: 'Your mobile number and the code you enter' },
  { name: 'Vapi', role: 'Runs Mitra voice calls (speech, AI reply, spoken answer)', receives: 'The audio of the call and the report context Mitra needs' },
  { name: 'AI language-model service', role: 'Writes simple explanations and Mitra’s text answers', receives: 'The AI result, your question, preferred name, language, district and crops — not your phone number or photo' },
  { name: 'TinyFish', role: 'Searches public web pages for farming information', receives: 'Your question and crop, without your name or phone number' },
  { name: 'Open-Meteo', role: 'Weather data and place search', receives: 'Rounded farm coordinates or the place name you type' },
];

// ---- data rights ------------------------------------------------------------------------------

export type RightIcon = 'access' | 'correct' | 'erase' | 'withdraw' | 'grievance' | 'nominate';

export interface DataRight {
  id: string;
  icon: RightIcon;
  title: string;
  hindi: string;
  summary: string;
  /** What works in the app today, step by step. Empty when the right is handled by request only. */
  inApp: readonly string[];
  /** What needs a request to the team. */
  byRequest: string | null;
}

export const DATA_RIGHTS: readonly DataRight[] = [
  {
    id: 'access',
    icon: 'access',
    title: 'Know what we hold',
    hindi: 'जानकारी पाने का अधिकार',
    summary: 'You can ask what personal data we hold about you, why we use it and who we shared it with.',
    inApp: [
      'Open Profile to see your name, language, location and crops.',
      'Open History to see every crop check with its photo, AI result and any expert review.',
    ],
    byRequest: 'For a full summary — including sign-in records and the service providers involved — send us a request. There is no download button yet.',
  },
  {
    id: 'correction',
    icon: 'correct',
    title: 'Correct or update',
    hindi: 'सुधार का अधिकार',
    summary: 'If something is wrong or out of date, you can fix it.',
    inApp: [
      'Open Profile, change your name, language, farm location or crops, and tap Save.',
      'To remove your name, clear the box and tap Save.',
    ],
    byRequest: 'Your mobile number cannot be changed in the app. To move your account to a new number, or to remove a saved farm location, send us a request.',
  },
  {
    id: 'erasure',
    icon: 'erase',
    title: 'Delete your data',
    hindi: 'मिटाने का अधिकार',
    summary: 'You can ask us to delete your account, or only some photos and reports. Saved Mitra conversations you can delete yourself.',
    inApp: ['Mitra conversations: Mitra → History → “Delete saved history” removes your saved chats and voice transcripts at once.'],
    byRequest: 'For your account, photos and reports there is no delete button in the app yet. Send us a request saying what you want deleted. We will check it comes from your registered mobile number, delete your profile, photos and reports, and confirm when it is done. Security logs may be kept for a limited time where the law allows.',
  },
  {
    id: 'consent',
    icon: 'withdraw',
    title: 'Withdraw consent',
    hindi: 'सहमति वापस लेने का अधिकार',
    summary: 'You can change your mind about things you agreed to. Some choices work in the app; withdrawing photo permission needs a request for now.',
    inApp: [
      'Voice: simply don’t start a call — voice is never on by default.',
      'Mitra history: Mitra → History — turn “Save my text chats” and “Also save voice-call transcripts” on or off at any time (off by default).',
      'Location: turn off location permission for this site in your phone’s browser settings.',
      'Sessions: Profile → Account → “Log out of all devices” ends every sign-in at once.',
    ],
    byRequest: 'To withdraw permission to keep your crop photos, send us a request. Because a report needs its photo, you will not be able to start new crop checks until you agree again; we can also delete existing photos.',
  },
  {
    id: 'grievance',
    icon: 'grievance',
    title: 'Raise a complaint',
    hindi: 'शिकायत का अधिकार',
    summary: 'If you are unhappy with how we handled your data, tell us and we will look into it.',
    inApp: [],
    byRequest: 'Write to our grievance contact with your registered mobile number and what went wrong. If you are not satisfied with our reply, you may be able to complain to the Data Protection Board of India under the DPDP Act.',
  },
  {
    id: 'nominate',
    icon: 'nominate',
    title: 'Nominate someone',
    hindi: 'नामांकन का अधिकार',
    summary: 'You can name a trusted person, such as a family member, to use these rights for you if you die or cannot act yourself.',
    inApp: [],
    byRequest: 'Nomination is done by request today: send us the nominee’s name, their relationship to you and their mobile number from your registered number.',
  },
];

// ---- government resources ---------------------------------------------------------------------

/**
 * Every `url` below was opened with curl on RESOURCES_LAST_CHECKED and returned a final HTTP 2xx/3xx.
 * Not listed because they failed that check (re-test before adding):
 *   - https://icar.org.in/      HTTPS timed out on every attempt (25–120 s); HTTP only redirects to HTTPS
 *   - https://kvk.icar.gov.in/  no DNS record — the KVK card below is shown without a link
 *   - https://farmer.gov.in/    no DNS record
 */
export const RESOURCES_LAST_CHECKED = { iso: '2026-11-13', label: '13 November 2026' } as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-13" -> "13 Nov 2026" (string maths, so the server's time zone cannot shift the day). */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export type ResourceIcon = 'income' | 'insurance' | 'soil' | 'protection' | 'market' | 'prices' | 'weather' | 'sms' | 'helpline' | 'kvk' | 'ministry';

export interface GovResource {
  name: string;
  hindi: string;
  description: string;
  /** Official website (verified on `checked`), or null when no official link passed the check. */
  url: string | null;
  /** Shown instead of the link when url is null. */
  linkNote?: string;
  icon: ResourceIcon;
  /** ISO date of the last link check. */
  checked: string;
  phone?: { display: string; tel: string; label: string };
}

export interface ResourceGroup {
  id: string;
  title: string;
  hindi: string;
  resources: readonly GovResource[];
}

const checked = RESOURCES_LAST_CHECKED.iso;
const KISAN_CALL_CENTRE = { display: '1800-180-1551', tel: '18001801551' } as const;

export const GOV_RESOURCE_GROUPS: readonly ResourceGroup[] = [
  {
    id: 'schemes',
    title: 'Schemes & crop insurance',
    hindi: 'योजनाएँ और फसल बीमा',
    resources: [
      {
        name: 'PM-KISAN',
        hindi: 'प्रधानमंत्री किसान सम्मान निधि',
        description: 'Income support paid directly into eligible farmers’ bank accounts — check your status, eKYC and registration.',
        url: 'https://pmkisan.gov.in/',
        icon: 'income',
        checked,
      },
      {
        name: 'Pradhan Mantri Fasal Bima Yojana',
        hindi: 'प्रधानमंत्री फसल बीमा योजना',
        description: 'Crop insurance for losses from natural calamities, pests and diseases — apply and check your policy or claim.',
        url: 'https://pmfby.gov.in/',
        icon: 'insurance',
        checked,
      },
      {
        name: 'Department of Agriculture & Farmers Welfare',
        hindi: 'कृषि एवं किसान कल्याण विभाग',
        description: 'The Union Government department for agriculture — details of central schemes, guidelines and a place to raise grievances.',
        url: 'https://agriwelfare.gov.in/',
        icon: 'ministry',
        checked,
      },
    ],
  },
  {
    id: 'soil-protection',
    title: 'Soil & plant protection',
    hindi: 'मिट्टी और फसल सुरक्षा',
    resources: [
      {
        name: 'Soil Health Card',
        hindi: 'मृदा स्वास्थ्य कार्ड',
        description: 'Soil test results for your field with nutrient and fertiliser recommendations.',
        url: 'https://soilhealth.dac.gov.in/',
        icon: 'soil',
        checked,
      },
      {
        name: 'Directorate of Plant Protection, Quarantine & Storage',
        hindi: 'वनस्पति संरक्षण, संगरोध एवं संग्रह निदेशालय',
        description: 'Integrated pest management (IPM) guidance and the official list of pesticides registered for use in India.',
        url: 'https://ppqs.gov.in/',
        icon: 'protection',
        checked,
      },
    ],
  },
  {
    id: 'markets',
    title: 'Markets & prices',
    hindi: 'मंडी और भाव',
    resources: [
      {
        name: 'e-NAM',
        hindi: 'राष्ट्रीय कृषि बाज़ार (ई-नाम)',
        description: 'Online trading platform linking mandis across India — see prices and sell produce online.',
        url: 'https://enam.gov.in/web/',
        icon: 'market',
        checked,
      },
      {
        name: 'Agmarknet',
        hindi: 'एगमार्कनेट — मंडी भाव',
        description: 'Daily arrivals and prices of crops at agricultural markets across India.',
        url: 'https://agmarknet.gov.in/',
        icon: 'prices',
        checked,
      },
    ],
  },
  {
    id: 'weather-advisories',
    title: 'Weather & advisories',
    hindi: 'मौसम और सलाह',
    resources: [
      {
        name: 'IMD — Mausam',
        hindi: 'भारत मौसम विज्ञान विभाग',
        description: 'Official weather forecasts, warnings and rainfall information from the India Meteorological Department.',
        url: 'https://mausam.imd.gov.in/',
        icon: 'weather',
        checked,
      },
      {
        name: 'mKisan',
        hindi: 'एम-किसान',
        description: 'Government SMS portal that sends farm advisories and information to registered farmers’ phones.',
        url: 'https://mkisan.gov.in/',
        icon: 'sms',
        checked,
      },
    ],
  },
  {
    id: 'expert-help',
    title: 'Expert help',
    hindi: 'विशेषज्ञ सहायता',
    resources: [
      {
        name: 'Kisan Call Centre',
        hindi: 'किसान कॉल सेंटर',
        description: 'Free farming advice by phone from agriculture graduates, in your language — 6 am to 10 pm, every day. Run by the Department of Agriculture & Farmers Welfare.',
        url: 'https://agriwelfare.gov.in/pages/Extension',
        icon: 'helpline',
        checked,
        phone: { ...KISAN_CALL_CENTRE, label: 'Call free' },
      },
      {
        name: 'Krishi Vigyan Kendra (KVK)',
        hindi: 'कृषि विज्ञान केंद्र',
        description: 'ICAR-supported farm science centres in most districts — field visits, training and crop advice from local scientists. Your district agriculture office or the Kisan Call Centre can tell you the nearest one.',
        url: null,
        linkNote: 'The official KVK portal could not be reached when we checked, so no link is shown.',
        icon: 'kvk',
        checked,
        phone: { ...KISAN_CALL_CENTRE, label: 'Find your KVK' },
      },
    ],
  },
];
