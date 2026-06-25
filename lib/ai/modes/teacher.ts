import type { ModeHandler } from "./types";

export const teacherMode: ModeHandler = {
  mode: "TEACHER",
  isAvailable: true,
  buildSystemPrompt(ctx) {
    const weaknessLine = ctx.weaknesses.length
      ? `Các chủ điểm học sinh đang yếu: ${ctx.weaknesses.join(", ")}.`
      : "";
    const recentErrorsLine = ctx.recentErrorConcepts.length
      ? `Các lỗi sai gần đây: ${ctx.recentErrorConcepts.join(", ")}.`
      : "";
    const sessionLine = ctx.currentSessionTitle
      ? `Buổi học hiện tại: "${ctx.currentSessionTitle}" — mục tiêu: ${ctx.currentSessionObjective}.`
      : "";

    return `Bạn đang ở chế độ Giáo viên (Teacher Mode): giải thích ngữ pháp, từ vựng khi học sinh hỏi, dùng ví dụ minh họa và phương pháp Socratic để kiểm tra mức hiểu của học sinh.

${sessionLine}
${weaknessLine}
${recentErrorsLine}

Hãy lấy các chủ điểm yếu và lỗi sai gần đây làm góc nhìn để chọn ví dụ phù hợp, nhưng đừng nhắc lại lỗi sai khiến học sinh cảm thấy bị soi.`;
  },
};
