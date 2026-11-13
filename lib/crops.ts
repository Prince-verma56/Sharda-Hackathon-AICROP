/**
 * Display helpers for the model's crop ids (shared by server and client).
 * The authoritative crop list always comes from the inference service; this file only
 * adds human-friendly names (photos: public/images/crops). Unknown ids fall back gracefully.
 */
export const CROP_DISPLAY: Record<string, { hi: string; en: string }> = {
  apple: { en: 'Apple', hi: 'सेब' },
  ash_gourd: { en: 'Ash gourd', hi: 'पेठा' },
  banana: { en: 'Banana', hi: 'केला' },
  bean: { en: 'Bean', hi: 'सेम' },
  bell_pepper: { en: 'Bell pepper', hi: 'शिमला मिर्च' },
  betel: { en: 'Betel', hi: 'पान' },
  bitter_gourd: { en: 'Bitter gourd', hi: 'करेला' },
  black_gram: { en: 'Black gram', hi: 'उड़द' },
  blueberry: { en: 'Blueberry', hi: 'ब्लूबेरी' },
  bottle_gourd: { en: 'Bottle gourd', hi: 'लौकी' },
  brinjal_eggplant: { en: 'Brinjal', hi: 'बैंगन' },
  cabbage: { en: 'Cabbage', hi: 'पत्ता गोभी' },
  cashew: { en: 'Cashew', hi: 'काजू' },
  cauliflower: { en: 'Cauliflower', hi: 'फूल गोभी' },
  cherry: { en: 'Cherry', hi: 'चेरी' },
  chilli: { en: 'Chilli', hi: 'मिर्च' },
  citrus_orange: { en: 'Orange', hi: 'संतरा' },
  coconut: { en: 'Coconut', hi: 'नारियल' },
  coffee: { en: 'Coffee', hi: 'कॉफ़ी' },
  corn_maize: { en: 'Maize', hi: 'मक्का' },
  cotton: { en: 'Cotton', hi: 'कपास' },
  cowpea: { en: 'Cowpea', hi: 'लोबिया' },
  cucumber: { en: 'Cucumber', hi: 'खीरा' },
  custard_apple: { en: 'Custard apple', hi: 'सीताफल' },
  finger_millet_ragi: { en: 'Ragi', hi: 'रागी' },
  garlic: { en: 'Garlic', hi: 'लहसुन' },
  ginger: { en: 'Ginger', hi: 'अदरक' },
  grape: { en: 'Grape', hi: 'अंगूर' },
  groundnut: { en: 'Groundnut', hi: 'मूंगफली' },
  guava: { en: 'Guava', hi: 'अमरूद' },
  jamun: { en: 'Jamun', hi: 'जामुन' },
  jute: { en: 'Jute', hi: 'जूट' },
  lemon: { en: 'Lemon', hi: 'नींबू' },
  lentil: { en: 'Lentil', hi: 'मसूर' },
  malabar_spinach: { en: 'Malabar spinach', hi: 'पोई साग' },
  mango: { en: 'Mango', hi: 'आम' },
  moringa: { en: 'Moringa', hi: 'सहजन' },
  okra: { en: 'Okra', hi: 'भिंडी' },
  onion: { en: 'Onion', hi: 'प्याज़' },
  papaya: { en: 'Papaya', hi: 'पपीता' },
  peach: { en: 'Peach', hi: 'आड़ू' },
  pomegranate: { en: 'Pomegranate', hi: 'अनार' },
  potato: { en: 'Potato', hi: 'आलू' },
  pumpkin: { en: 'Pumpkin', hi: 'कद्दू' },
  radish: { en: 'Radish', hi: 'मूली' },
  raspberry: { en: 'Raspberry', hi: 'रसभरी' },
  rice: { en: 'Rice (paddy)', hi: 'धान' },
  soybean: { en: 'Soybean', hi: 'सोयाबीन' },
  spinach: { en: 'Spinach', hi: 'पालक' },
  squash: { en: 'Squash', hi: 'स्क्वैश' },
  strawberry: { en: 'Strawberry', hi: 'स्ट्रॉबेरी' },
  sugarcane: { en: 'Sugarcane', hi: 'गन्ना' },
  sunflower: { en: 'Sunflower', hi: 'सूरजमुखी' },
  tea: { en: 'Tea', hi: 'चाय' },
  tobacco: { en: 'Tobacco', hi: 'तंबाकू' },
  tomato: { en: 'Tomato', hi: 'टमाटर' },
  turmeric: { en: 'Turmeric', hi: 'हल्दी' },
  watermelon: { en: 'Watermelon', hi: 'तरबूज़' },
  wheat: { en: 'Wheat', hi: 'गेहूं' },
};

export function cropName(id: string, language = 'en'): string {
  const entry = CROP_DISPLAY[id];
  if (!entry) return id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return language === 'hi' ? entry.hi : entry.en;
}


/** "tomato::Late blight" -> { crop: "tomato", condition: "Late blight" } */
export function splitLabel(label: string) {
  const [crop, ...rest] = label.split('::');
  return { crop, condition: rest.join('::') };
}

export function isHealthyLabel(label: string) {
  return splitLabel(label).condition.trim().toLowerCase() === 'healthy';
}
