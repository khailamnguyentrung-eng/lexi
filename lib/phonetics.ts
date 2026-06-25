// Renders the underlined part of a word for PHONETICS_SOUND questions
// (e.g. "Chọn từ có phần gạch chân phát âm khác"). The source test-bank
// docx underlines a specific letter cluster per word, but that markup
// wasn't captured during transcription — only the `topic` tag (e.g.
// "ed_ending_pronunciation") survived. This derives a reasonable substring
// to underline from the topic, which covers every phonetics topic
// currently in the question bank. Falls back to no underline if a topic
// isn't recognized, rather than guessing wrong.
const TOPIC_TO_PATTERN: Record<string, RegExp> = {
  ed_ending_pronunciation: /ed$/i,
  ch_sound: /ch/i,
  ea_vowel_sound: /ea/i,
  th_sound_voiced_voiceless: /th/i,
  vowel_sounds_oo: /oo/i,
};

export interface UnderlineParts {
  before: string;
  underline: string | null;
  after: string;
}

export function splitForUnderline(word: string, topic: string): UnderlineParts {
  const pattern = TOPIC_TO_PATTERN[topic];
  if (!pattern) return { before: word, underline: null, after: "" };

  const match = word.match(pattern);
  if (!match || match.index === undefined) return { before: word, underline: null, after: "" };

  return {
    before: word.slice(0, match.index),
    underline: match[0],
    after: word.slice(match.index + match[0].length),
  };
}
