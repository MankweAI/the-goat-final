/**
 * Context-Aware Menu Renderer
 * Fixes hardcoded "Back to homework" labels
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
}
