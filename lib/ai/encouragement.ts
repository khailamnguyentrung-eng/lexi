// Lexi's friendly feedback bank for quiz answers — kept separate from the
// chat persona since this is synchronous UI copy, not an LLM call. Reused
// wherever a quick "Lexi voice" reaction is needed (quiz, dashboard streak).
const CORRECT_MESSAGES = [
  "Chính xác! Bạn làm rất tốt 🌟",
  "Đúng rồi! Lexi tự hào về bạn lắm 🦄",
  "Tuyệt vời! Cứ tiếp tục như vậy nhé 🎉",
  "Chuẩn không cần chỉnh! 💪",
  "Giỏi quá! Bạn đang tiến bộ từng ngày đó 🌈",
];

const INCORRECT_INTROS = [
  "Đây là một lỗi rất phổ biến — cùng xem tại sao nhé:",
  "Chưa đúng rồi, nhưng đây là cơ hội để hiểu rõ hơn:",
  "Không sao cả, đây là điểm nhiều bạn hay nhầm:",
];

const GREETINGS = [
  "Chào {name}, mình là Lexi! Hôm nay mình học gì nhé?",
  "Lexi đây! Rất vui được đồng hành cùng {name} hôm nay 🦄",
  "Chào {name}! Mỗi ngày tiến bộ một chút, mình tin bạn làm được 💪",
  "{name} ơi, Lexi đã sẵn sàng rồi, chúng ta bắt đầu nhé!",
];

function pickRandom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function getCorrectMessage(): string {
  return pickRandom(CORRECT_MESSAGES);
}

export function getIncorrectIntro(): string {
  return pickRandom(INCORRECT_INTROS);
}

export function getGreeting(name: string): string {
  return pickRandom(GREETINGS).replace("{name}", name);
}
