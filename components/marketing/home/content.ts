/**
 * Home page copy and data. Numbers here are factual for AgriSmart India v1
 * (see docs/agrismart-implementation) — keep them in sync with the model.
 */

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'About', href: '/about' },
  { label: 'Insights', href: '/insights' },
  { label: 'Contact', href: '/contact' },
] as const;

export const FEATURES = [
  { icon: 'leaf', title: 'Disease Detection', text: '387 diseases & conditions', live: true },
  { icon: 'bug', title: 'Pest Identification', text: 'Spot pest damage early', live: true },
  { icon: 'cloud', title: 'Weather Context', text: 'Local conditions, not guesses', live: true },
  { icon: 'sparkles', title: 'Voice Advisor', text: 'Ask Mitra in Hindi', live: true },
] as const;

export const STEPS = [
  { icon: 'upload', title: 'Upload a Leaf Photo', text: 'Snap one affected leaf and choose your crop.' },
  { icon: 'cpu', title: 'Get AI Diagnosis', text: 'The model checks 387 diseases and pests in under a second.' },
  { icon: 'sprout', title: 'Take Action', text: 'Follow the guidance and confirm with your local agri officer.' },
] as const;

export const STATS = [
  { value: 59, suffix: '', label: 'Crops Supported' },
  { value: 387, suffix: '', label: 'Diseases & Pests' },
  { value: 94, suffix: '%', label: 'Test Accuracy*' },
] as const;

export const STATS_FOOTNOTE =
  '*AgriSmart India v1 on its 28,328-photo held-out test set with the crop selected. Field photos score lower; every result is a screening aid, not a lab diagnosis.';

export const CROPS = [
  { name: 'Rice', image: '/images/home/crop-rice.jpg', alt: 'Golden rice panicle in a green paddy' },
  { name: 'Wheat', image: '/images/home/crop-wheat.jpg', alt: 'Ripe golden wheat ears' },
  { name: 'Corn', image: '/images/home/crop-corn.jpg', alt: 'Corn cob opening on the plant' },
  { name: 'Cotton', image: '/images/home/crop-cotton.jpg', alt: 'Open cotton boll in evening light' },
  { name: 'Soybean', image: '/images/home/crop-soybean.jpg', alt: 'Harvested soybeans' },
] as const;
