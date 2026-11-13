/**
 * Mitra speaks Hindi and English. Speech recognisers occasionally invent glyphs from other scripts
 * for short words (seen: the spoken greeting "Hi" transcribed as Thai "ให้"). Keep Latin, Devanagari
 * and the shared digits/punctuation; drop everything else. Built at runtime: Unicode property
 * escapes need ES2018 and the project targets ES2017.
 */
const FOREIGN_SCRIPT = new RegExp('[^\\p{Script=Latin}\\p{Script=Devanagari}\\p{Script=Common}\\p{Script=Inherited}]', 'gu');

export function cleanTranscript(text: string): string {
  return text.replace(FOREIGN_SCRIPT, '').replace(/\s{2,}/g, ' ').trim();
}
