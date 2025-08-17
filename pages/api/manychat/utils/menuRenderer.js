/**
 * Context-Aware Menu Renderer
 * Fixes hardcoded "Back to homework" labels
 * Date: 2025-08-17 15:36:12 UTC
 */

export class MenuRenderer {
  static renderLessonMenu(context = 'general') {
    const backLabel = this.getBackLabel(context);

    return `1️⃣ Try practice questions\n` + `2️⃣ See another example\n` + `3️⃣ ${backLabel}`;
  }

  static getBackLabel(context) {
    switch (context) {
      case 'exam':
      case 'exam_prep':
        return 'Back to plan';
      case 'homework':
        return 'Back to homework';
      case 'practice':
        return 'Main menu';
      default:
        return 'Back to menu';
    }
  }

  static renderExampleWithMenu(exampleText, context = 'general') {
    return `${exampleText}\n\n${this.renderLessonMenu(context)}`;
  }

  static renderPracticeMenu(context = 'general') {
    return `1️⃣ Continue practicing\n` + `2️⃣ Switch topic\n` + `3️⃣ Take a short break`;
  }

  static renderExamPrepPlanMenu() {
    return `1️⃣ Begin review\n` + `2️⃣ Switch topics\n` + `3️⃣ Main menu`;
  }

  static renderHomeworkMenu() {
    return `1️⃣ Try practice questions\n` + `2️⃣ See another example\n` + `3️⃣ Back to homework`;
  }
}

export default MenuRenderer;
