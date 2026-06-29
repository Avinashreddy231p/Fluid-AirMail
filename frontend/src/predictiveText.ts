import { unigrams } from './predictiveDictionary';

const MAX_SUGGESTIONS = 4;

export function getLocalCompletions(text: string): string[] {
  if (!text) return ["I", "The", "Hi", "Are"];
  
  const trimmed = text.trimStart();
  if (!trimmed) return ["I", "The", "Hi", "Are"];

  const endsWithSpace = text.endsWith(" ");
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1];
  const lastWordLower = lastWord.toLowerCase();

  const capitalize = (word: string, original: string) => {
    if (!original || original.length === 0) return word;
    if (original[0] === original[0].toUpperCase()) {
      if (word === "i") return "I";
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    if (word === "i") return "I";
    return word;
  };

  if (endsWithSpace) {
    // Instant fallback if they just typed a space, before Datamuse returns
    // Very basic hardcoded unigram predictions so UI doesn't jump
    const defaults = ["the", "to", "and", "a"];
    if (lastWordLower === "i") return ["am", "will", "have", "want"].map(w => w === "i" ? "I" : w);
    if (["how", "what", "where", "who", "why", "when"].includes(lastWordLower)) return ["is", "are", "do", "did"].slice(0, MAX_SUGGESTIONS);
    if (["he", "she", "it", "this", "that", "there"].includes(lastWordLower)) return ["is", "was", "will", "has"].slice(0, MAX_SUGGESTIONS);
    if (["you", "we", "they"].includes(lastWordLower)) return ["are", "were", "will", "have"].slice(0, MAX_SUGGESTIONS);
    return defaults;
  } else {
    // Word completion (ultra-fast prefix match against 10k dictionary)
    const matches = unigrams.filter(w => w.startsWith(lastWordLower) && w !== lastWordLower);
    if (matches.length >= MAX_SUGGESTIONS) {
      return matches.slice(0, MAX_SUGGESTIONS).map(w => capitalize(w, lastWord));
    }
    
    // Fallback if < MAX_SUGGESTIONS matches
    const moreMatches = unigrams.filter(w => w.includes(lastWordLower) && !matches.includes(w) && w !== lastWordLower);
    const combined = [...matches, ...moreMatches];
    if (combined.length > 0) {
      return combined.slice(0, MAX_SUGGESTIONS).map(w => capitalize(w, lastWord));
    }
    return [];
  }
}

export async function getDatamuseSuggestions(text: string): Promise<string[]> {
  const trimmed = text.trimStart();
  if (!trimmed || !text.endsWith(" ")) return [];
  
  const words = trimmed.trimEnd().split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  
  try {
    const res = await fetch(`https://api.datamuse.com/words?lc=${encodeURIComponent(lastWord)}&sp=*&max=${MAX_SUGGESTIONS}`);
    if (res.ok) {
      const data = await res.json();
      const suggestions = data.map((d: any) => d.word);
      return suggestions;
    }
  } catch (e) {
    console.error("Datamuse fetch error", e);
  }
  return [];
}
