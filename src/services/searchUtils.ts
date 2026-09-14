/**
 * FilmX APK — Smart Search Engine v2.0
 * Ushbu fayl web versiyasi bilan to'liq sinxronlashtirilgan.
 * O'zbek, ingliz va rus tillarida qidiruv qo'llab-quvvatlanadi.
 */

// Phrase-level replacements: "harry potter" → "garri potter", etc.
export const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(spider[- ]?man|spiderman|человек[- ]паук)\b/gi, 'orgimchak odam'],
  [/\b(iron[- ]?man|ironman|железный человек)\b/gi, 'temir odam'],
  [/\b(harry potter|гарри поттер)\b/gi, 'garri potter'],
  [/\b(avengers?|мстители)\b/gi, 'qasoskorlar'],
  [/\b(taxi|такси)\b/gi, 'taksi'],
  [/\b(captain america|первый мститель)\b/gi, 'kapitan amerika'],
  [/\b(fast (and|&) furious|форсаж)\b/gi, 'forsaj'],
  [/\b(doctor strange|доктор стрэндж)\b/gi, 'doktor strendj'],
  [/\b(john wick|джон уик)\b/gi, 'jon uik'],
  [/\b(home alone|один дома)\b/gi, 'uyda yolgiz'],
  [/\b(ant[- ]?man|человек[- ]муравей)\b/gi, 'chumoli odam'],
  [/\b(deadpool|дэдпул)\b/gi, 'dedpul'],
  [/\b(batman|бэтмен)\b/gi, 'betmen'],
  [/\b(superman|супермен)\b/gi, 'supermen'],
  [/\b(thor|тор)\b/gi, 'tor'],
  [/\b(venom|веном)\b/gi, 'venom'],
  [/\b(transformers|трансформеры)\b/gi, 'transformatorlar'],
  [/\b(lord of the rings|властелин колец)\b/gi, 'uzuklar hukumdori'],
  [/\b(pirates of the caribbean|пираты карибского моря)\b/gi, 'karib dengizi qaroqchilari'],
  [/\b(no way home|нет пути домой)\b/gi, 'uyga yol yoq'],
  [/\b(far from home|вдали от дома)\b/gi, 'uydan uzoqda'],
  [/\b(infinity war|война бесконечности)\b/gi, 'cheksizlik jangi'],
  [/\b(game of thrones|taxtlar o['']yini)\b/gi, 'taxtlar oyini'],
  [/\b(breaking bad)\b/gi, 'breaking bad'],
  [/\b(star wars|звёздные войны)\b/gi, 'yulduzlar urushi'],
  [/\b(jurassic park|мир юрского периода)\b/gi, 'yura davri'],
  [/\b(lion king|король лев)\b/gi, 'sherlar shohi'],
];

// Synonym map: o'zbek ↔ ingliz ↔ rus
export const SYNONYMS: Record<string, string[]> = {
  'endgame': ['intiho', 'yakuniy', 'финал', 'endgame'],
  'infinity': ['cheksizlik', 'бесконечности'],
  'ultron': ['altron', 'альтрон'],
  'goblet': ['olov'],
  'fire': ['olov'],
  'secrets': ['maxfiy'],
  'azkaban': ['azkaban'],
  'phoenix': ['feniks'],
  'hallows': ['ajal'],
  'stone': ['toshi', 'hikmatlar'],
  'chamber': ['xujra'],
  'prisoner': ['mahbusi'],
  'order': ['jamiyati'],
  'prince': ['shahzoda'],
  'deathly': ['ajal'],
  'garri': ['harry', 'garri', 'гарри'],
  'harry': ['garri', 'harry', 'гарри'],
  'potter': ['potter', 'поттер'],
  'qasoskorlar': ['avengers', 'qasoskorlar', 'мстители'],
  'avengers': ['qasoskorlar', 'avengers', 'мстители'],
  'avenger': ['qasoskorlar', 'avengers', 'мстители'],
  'taksi': ['taxi', 'taksi', 'такси'],
  'taxi': ['taksi', 'taxi', 'такси'],
  'orgimchak': ['spider', "o'rgimchak", 'orgimchak', 'паук'],
  'spider': ['orgimchak', "o'rgimchak", 'spider', 'паук'],
  'temir': ['iron', 'temir', 'железный'],
  'iron': ['temir', 'iron', 'железный'],
  'tor': ['thor', 'tor', 'тор'],
  'thor': ['tor', 'thor', 'тор'],
  'forsaj': ['fast', 'furious', 'forsaj', 'форсаж'],
  'furious': ['forsaj', 'fast', 'furious', 'форсаж'],
  'marvel': ['marvel', 'qasoskorlar', 'марвел'],
  'betmen': ['batman', 'betmen', 'бэтмен'],
  'batman': ['betmen', 'batman', 'бэтмен'],
  'uik': ['wick', 'uik', 'уик'],
  'wick': ['uik', 'wick', 'уик'],
  'singam': ['singam'],
  'koreys': ['koreya', 'koreys', 'korean'],
  'koreya': ['koreys', 'koreya', 'korean'],
  'hind': ['hindiston', 'bollywood', 'india'],
  'anime': ['multfilm', 'animatsiya', 'manga'],
  'multfilm': ['anime', 'animatsiya', 'cartoon'],
  'kapitan': ['captain', 'kapitan'],
  'doktor': ['doctor', 'dr', 'доктор'],
  'dedpul': ['deadpool', 'дэдпул'],
  'venom': ['venom', 'веном'],
  'transformatorlar': ['transformers', 'трансформеры'],
  'supermen': ['superman', 'супермен'],
};

export const STOP_WORDS = new Set([
  'kino', 'kinosi', 'kinolar', 'kinolari',
  'film', 'filmi', 'filmlar', 'filmlari',
  'serial', 'seriali', 'seriallar', 'seriallari',
  'multfilm', 'multfilmi', 'multfilmlar', 'multserial',
  'dorama', 'doramalar', 'barcha', 'qism', 'qismi', 'qismlar', 'qismlari',
  'uzbek', "o'zbek", 'ozbek', "o`zbek", 'oʻzbek', 'tilida', 'tarjima',
  'hd', 'full', '1080p', '720p', 'skachat', 'onlayn', 'online', 'bepul', 'premyera',
  'part', 'season', 'the', 'of', 'and',
]);

export function normalizeStr(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BB\u02BC`']/g, "'")
    .replace(/[^a-z0-9а-яё']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-boundary aware contains check (prevents "tor" matching "torrent") */
export function containsWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  // For longer terms, substring match is fine (e.g. "orgimchak")
  if (term.length > 3) return text.includes(term);
  // For short tokens, require word boundaries
  const words = text.split(' ');
  return words.includes(term);
}

export function calculateSearchScore(item: {
  title: string;
  rawTitle?: string;
  genres?: string[];
  country?: string;
  actors?: string[];
  description?: string;
  rating?: number;
  year?: number;
}, query: string): number {
  const normQuery = normalizeStr(query);
  if (!normQuery) return 0;

  // Apply phrase replacements first
  let expandedQuery = normQuery;
  for (const [pattern, repl] of PHRASE_REPLACEMENTS) {
    expandedQuery = expandedQuery.replace(pattern, repl);
  }

  const titleNorm = normalizeStr(item.title);
  const titleNoApos = titleNorm.replace(/'/g, '');
  const rawTitleNorm = normalizeStr(item.rawTitle || '');
  const rawTitleNoApos = rawTitleNorm.replace(/'/g, '');
  const genresNorm = normalizeStr((item.genres || []).join(' '));
  const countryNorm = normalizeStr(item.country || '');
  const descNorm = normalizeStr(item.description || '');

  let score = 0;

  // Meaningful query tokens (filter out stop words)
  const rawWords = expandedQuery.split(' ').filter(Boolean);
  const meaningfulWords = rawWords.filter(w => !STOP_WORDS.has(w));
  const wordsToMatch = meaningfulWords.length > 0 ? meaningfulWords : rawWords;
  const cleanQuery = wordsToMatch.join(' ');
  const cleanQueryNoApos = cleanQuery.replace(/'/g, '');

  // 1. Direct or clean phrase match boost
  const testQueries = [expandedQuery, cleanQuery, normQuery].filter(Boolean);
  let fullMatched = false;

  for (const tq of testQueries) {
    const tqNoApos = tq.replace(/'/g, '');
    if (titleNorm === tq || titleNoApos === tqNoApos) {
      score += 260;
      fullMatched = true;
      break;
    } else if (titleNorm.startsWith(tq + ' ') || titleNoApos.startsWith(tqNoApos + ' ')) {
      score += 190;
      fullMatched = true;
      break;
    } else if (titleNorm.includes(tq) || titleNoApos.includes(tqNoApos)) {
      score += 130;
      fullMatched = true;
      break;
    } else if (rawTitleNorm.includes(tq) || rawTitleNoApos.includes(tqNoApos)) {
      score += 90;
      fullMatched = true;
      break;
    }
  }

  // 2. Token / word-level match
  let matchedWordCount = 0;

  for (const word of wordsToMatch) {
    const wordNoApos = word.replace(/'/g, '');
    let matched = false;

    if (containsWord(titleNorm, word) || containsWord(titleNoApos, wordNoApos)) {
      score += 40;
      matched = true;
    } else if (containsWord(rawTitleNorm, word) || containsWord(rawTitleNoApos, wordNoApos)) {
      score += 25;
      matched = true;
    }

    // Check synonyms
    if (!matched) {
      const syns = SYNONYMS[word] || [];
      for (const syn of syns) {
        const synNoApos = syn.replace(/'/g, '');
        if (containsWord(titleNorm, syn) || containsWord(titleNoApos, synNoApos)) {
          score += 35;
          matched = true;
          break;
        }
        if (containsWord(rawTitleNorm, syn) || containsWord(rawTitleNoApos, synNoApos)) {
          score += 20;
          matched = true;
          break;
        }
      }
    }

    // Genre / country / description fallback
    if (!matched) {
      if (containsWord(genresNorm, word)) {
        score += 10;
        matched = true;
      } else if (containsWord(countryNorm, word)) {
        score += 8;
        matched = true;
      } else if (descNorm.includes(word)) {
        score += 5;
        matched = true;
      }
    }

    if (matched) matchedWordCount++;
  }

  // Minimum threshold: if fullMatched, always pass;
  // otherwise require at least 70% of tokens to match
  if (
    !fullMatched &&
    matchedWordCount < wordsToMatch.length &&
    matchedWordCount < Math.ceil(wordsToMatch.length * 0.7)
  ) {
    return 0;
  }

  if (item.rating) score += Math.min(10, item.rating);
  if (item.year && item.year >= 2020) score += 2;

  return score;
}

/**
 * Search and rank an array of media items by relevance score.
 */
export function searchAndRank<T extends {
  title: string;
  rawTitle?: string;
  genres?: string[];
  country?: string;
  actors?: string[];
  description?: string;
  rating?: number;
  year?: number;
}>(items: T[], query: string, limit: number = 60): T[] {
  if (!query.trim()) {
    return items.slice(0, limit);
  }

  const scored: Array<{ item: T; score: number }> = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const score = calculateSearchScore(it, query);
    if (score > 0) {
      scored.push({ item: it, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.item);
}
