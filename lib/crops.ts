/**
 * Display helpers for the model's crop ids (shared by server and client).
 * The authoritative crop list always comes from the inference service; this file only
 * adds human-friendly names and an icon. Unknown ids fall back gracefully.
 */
export const CROP_DISPLAY: Record<string, { hi: string; en: string; emoji: string }> = {
  apple: { en: 'Apple', hi: 'सेब', emoji: '🍎' },
  ash_gourd: { en: 'Ash gourd', hi: 'पेठा', emoji: '🥒' },
  banana: { en: 'Banana', hi: 'केला', emoji: '🍌' },
  bean: { en: 'Bean', hi: 'सेम', emoji: '🫘' },
  bell_pepper: { en: 'Bell pepper', hi: 'शिमला मिर्च', emoji: '🫑' },
  betel: { en: 'Betel', hi: 'पान', emoji: '🍃' },
  bitter_gourd: { en: 'Bitter gourd', hi: 'करेला', emoji: '🥒' },
  black_gram: { en: 'Black gram', hi: 'उड़द', emoji: '🫘' },
  blueberry: { en: 'Blueberry', hi: 'ब्लूबेरी', emoji: '🫐' },
  bottle_gourd: { en: 'Bottle gourd', hi: 'लौकी', emoji: '🥒' },
  brinjal_eggplant: { en: 'Brinjal', hi: 'बैंगन', emoji: '🍆' },
  cabbage: { en: 'Cabbage', hi: 'पत्ता गोभी', emoji: '🥬' },
  cashew: { en: 'Cashew', hi: 'काजू', emoji: '🌰' },
  cauliflower: { en: 'Cauliflower', hi: 'फूल गोभी', emoji: '🥦' },
  cherry: { en: 'Cherry', hi: 'चेरी', emoji: '🍒' },
  chilli: { en: 'Chilli', hi: 'मिर्च', emoji: '🌶️' },
  citrus_orange: { en: 'Orange', hi: 'संतरा', emoji: '🍊' },
  coconut: { en: 'Coconut', hi: 'नारियल', emoji: '🥥' },
  coffee: { en: 'Coffee', hi: 'कॉफ़ी', emoji: '☕' },
  corn_maize: { en: 'Maize', hi: 'मक्का', emoji: '🌽' },
  cotton: { en: 'Cotton', hi: 'कपास', emoji: '☁️' },
  cowpea: { en: 'Cowpea', hi: 'लोबिया', emoji: '🫘' },
  cucumber: { en: 'Cucumber', hi: 'खीरा', emoji: '🥒' },
  custard_apple: { en: 'Custard apple', hi: 'सीताफल', emoji: '🍏' },
  finger_millet_ragi: { en: 'Ragi', hi: 'रागी', emoji: '🌾' },
  garlic: { en: 'Garlic', hi: 'लहसुन', emoji: '🧄' },
  ginger: { en: 'Ginger', hi: 'अदरक', emoji: '🫚' },
  grape: { en: 'Grape', hi: 'अंगूर', emoji: '🍇' },
  groundnut: { en: 'Groundnut', hi: 'मूंगफली', emoji: '🥜' },
  guava: { en: 'Guava', hi: 'अमरूद', emoji: '🍐' },
  jamun: { en: 'Jamun', hi: 'जामुन', emoji: '🫐' },
  jute: { en: 'Jute', hi: 'जूट', emoji: '🌿' },
  lemon: { en: 'Lemon', hi: 'नींबू', emoji: '🍋' },
  lentil: { en: 'Lentil', hi: 'मसूर', emoji: '🫘' },
  malabar_spinach: { en: 'Malabar spinach', hi: 'पोई साग', emoji: '🥬' },
  mango: { en: 'Mango', hi: 'आम', emoji: '🥭' },
  moringa: { en: 'Moringa', hi: 'सहजन', emoji: '🌿' },
  okra: { en: 'Okra', hi: 'भिंडी', emoji: '🌱' },
  onion: { en: 'Onion', hi: 'प्याज़', emoji: '🧅' },
  papaya: { en: 'Papaya', hi: 'पपीता', emoji: '🍈' },
  peach: { en: 'Peach', hi: 'आड़ू', emoji: '🍑' },
  pomegranate: { en: 'Pomegranate', hi: 'अनार', emoji: '🍎' },
  potato: { en: 'Potato', hi: 'आलू', emoji: '🥔' },
  pumpkin: { en: 'Pumpkin', hi: 'कद्दू', emoji: '🎃' },
  radish: { en: 'Radish', hi: 'मूली', emoji: '🥕' },
  raspberry: { en: 'Raspberry', hi: 'रसभरी', emoji: '🍓' },
  rice: { en: 'Rice (paddy)', hi: 'धान', emoji: '🌾' },
  soybean: { en: 'Soybean', hi: 'सोयाबीन', emoji: '🫛' },
  spinach: { en: 'Spinach', hi: 'पालक', emoji: '🥬' },
  squash: { en: 'Squash', hi: 'स्क्वैश', emoji: '🎃' },
  strawberry: { en: 'Strawberry', hi: 'स्ट्रॉबेरी', emoji: '🍓' },
  sugarcane: { en: 'Sugarcane', hi: 'गन्ना', emoji: '🎋' },
  sunflower: { en: 'Sunflower', hi: 'सूरजमुखी', emoji: '🌻' },
  tea: { en: 'Tea', hi: 'चाय', emoji: '🍵' },
  tobacco: { en: 'Tobacco', hi: 'तंबाकू', emoji: '🍂' },
  tomato: { en: 'Tomato', hi: 'टमाटर', emoji: '🍅' },
  turmeric: { en: 'Turmeric', hi: 'हल्दी', emoji: '🫚' },
  watermelon: { en: 'Watermelon', hi: 'तरबूज़', emoji: '🍉' },
  wheat: { en: 'Wheat', hi: 'गेहूं', emoji: '🌾' },
};

export function cropName(id: string, language = 'en'): string {
  const entry = CROP_DISPLAY[id];
  if (!entry) return id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return language === 'hi' ? entry.hi : entry.en;
}

export function cropEmoji(id: string): string {
  return CROP_DISPLAY[id]?.emoji ?? '🌱';
}

/** "tomato::Late blight" -> { crop: "tomato", condition: "Late blight" } */
export function splitLabel(label: string) {
  const [crop, ...rest] = label.split('::');
  return { crop, condition: rest.join('::') };
}

export function isHealthyLabel(label: string) {
  return splitLabel(label).condition.trim().toLowerCase() === 'healthy';
}
