/**
 * Labels for Mitra's settings (client-safe; values mirror ai/settings/mitra-settings.ts).
 * Shared by the farmer settings page and the admin defaults form.
 */
export type MitraSettingKey = 'language' | 'tone' | 'voice' | 'pace' | 'length';
export type UiLang = 'hi' | 'en';

interface Option {
  value: string;
  label: Record<UiLang, string>;
  hint: Record<UiLang, string>;
  sample?: string;
}

export const MITRA_SETTING_GROUPS: { key: MitraSettingKey; title: Record<UiLang, string>; help: Record<UiLang, string>; options: Option[] }[] = [
  {
    key: 'language',
    title: { en: 'Language', hi: 'भाषा' },
    help: { en: 'How Mitra talks and writes to you. Mitra still understands all three.', hi: 'मित्र आपसे किस भाषा में बात करे। मित्र तीनों भाषाएँ समझता है।' },
    options: [
      { value: 'hinglish', label: { en: 'Hinglish', hi: 'हिंग्लिश' }, hint: { en: 'Hindi + English mix', hi: 'हिंदी + English मिलाकर' }, sample: 'Aapke tomato ke patte par early blight jaise sanket hain.' },
      { value: 'hi', label: { en: 'हिंदी', hi: 'हिंदी' }, hint: { en: 'Simple Hindi', hi: 'सरल हिंदी' }, sample: 'आपके टमाटर के पत्ते पर अगेती झुलसा जैसे संकेत हैं।' },
      { value: 'en', label: { en: 'English', hi: 'English' }, hint: { en: 'Simple Indian English', hi: 'सरल अंग्रेज़ी' }, sample: 'Your tomato leaf shows signs like early blight.' },
    ],
  },
  {
    key: 'tone',
    title: { en: 'Tone', hi: 'बात करने का तरीका' },
    help: { en: 'Mitra’s personality.', hi: 'मित्र का स्वभाव।' },
    options: [
      { value: 'friendly', label: { en: 'Friendly', hi: 'दोस्ताना' }, hint: { en: 'Warm, like a helpful neighbour', hi: 'अपनेपन से, पड़ोसी की तरह' } },
      { value: 'respectful', label: { en: 'Respectful', hi: 'आदरपूर्ण' }, hint: { en: '“Aap” and “ji”, calm and formal', hi: '“आप” और “जी”, शांत और औपचारिक' } },
      { value: 'expert', label: { en: 'Expert', hi: 'विशेषज्ञ' }, hint: { en: 'Short and precise, like an agronomist', hi: 'छोटा और सटीक, कृषि विशेषज्ञ की तरह' } },
    ],
  },
  {
    key: 'voice',
    title: { en: 'Voice', hi: 'आवाज़' },
    help: { en: 'The voice you hear on calls.', hi: 'कॉल पर सुनाई देने वाली आवाज़।' },
    options: [
      { value: 'female', label: { en: 'Female', hi: 'महिला' }, hint: { en: 'Swara (Hindi) · Neerja (English)', hi: 'स्वरा (हिंदी) · नीरजा (English)' } },
      { value: 'male', label: { en: 'Male', hi: 'पुरुष' }, hint: { en: 'Madhur (Hindi) · Prabhat (English)', hi: 'मधुर (हिंदी) · प्रभात (English)' } },
    ],
  },
  {
    key: 'pace',
    title: { en: 'Speaking pace', hi: 'बोलने की गति' },
    help: { en: 'Slower is easier to follow on a weak connection.', hi: 'कमज़ोर नेटवर्क पर धीमी गति समझने में आसान है।' },
    options: [
      { value: 'normal', label: { en: 'Normal', hi: 'सामान्य' }, hint: { en: 'Natural speed', hi: 'सामान्य गति' } },
      { value: 'slow', label: { en: 'Slow', hi: 'धीमी' }, hint: { en: 'A little slower and clearer', hi: 'थोड़ा धीमा और साफ़' } },
    ],
  },
  {
    key: 'length',
    title: { en: 'Answer length', hi: 'जवाब की लंबाई' },
    help: { en: 'How much Mitra says each time.', hi: 'मित्र हर बार कितना बताए।' },
    options: [
      { value: 'short', label: { en: 'Short', hi: 'छोटा' }, hint: { en: '1–2 sentences on calls', hi: 'कॉल पर 1–2 वाक्य' } },
      { value: 'detailed', label: { en: 'Detailed', hi: 'विस्तार से' }, hint: { en: 'More explanation and steps', hi: 'ज़्यादा जानकारी और कदम' } },
    ],
  },
];
