export class FallbackService {
  static getBasicExplanation(topic, correctAnswer) {
    const explanations = {
      algebra: `🧠 For algebra problems, isolate the variable step by step.\n\n💡 Quick tip: Whatever you do to one side, do to the other!`,
      geometry: `🧠 Remember your geometric formulas and angle relationships.\n\n💡 Quick tip: Draw diagrams to visualize the problem!`,
      trigonometry: `🧠 Use SOHCAHTOA: Sin = Opposite/Hypotenuse, Cos = Adjacent/Hypotenuse, Tan = Opposite/Adjacent.\n\n💡 Quick tip: Learn the special angles: 30°, 45°, 60°!`,
      physics: `🧠 Break down the problem: What's given? What's asked? Which formula applies?\n\n💡 Quick tip: Always check your units!`,
      chemistry: `🧠 Consider electron configuration, bonding, and reaction mechanisms.\n\n💡 Quick tip: Balance equations and track electrons!`
    };

    const defaultExplanation = `🧠 The correct answer was ${correctAnswer}.\n\n💡 Quick tip: Review this topic and practice similar problems!`;

    return explanations[topic] || defaultExplanation;
  }

  static getEncouragementMessage(streak, isCorrect) {
    if (isCorrect) {
      const messages = [
        "Sharp! You're getting the hang of this! 🔥",
        'Lekker work! Keep that momentum going! 💪',
        "You're on fire! Mathematics bows to you! ⚡",
        "Eish, you're too sharp! Crushing it! 🚀"
      ];

      if (streak >= 5) {
        return `🔥🔥 ${streak} in a row! You're absolutely unstoppable!`;
      }

      return messages[Math.floor(Math.random() * messages.length)];
    } else {
      const messages = [
        'No stress! Every mistake is progress! 💪',
        "Eish, close one! You'll nail the next one! 🎯",
        'Learning curve in action! Keep pushing! 🚀',
        "That's how we grow! Try another one! 💫"
      ];

      return messages[Math.floor(Math.random() * messages.length)];
    }
  }
}

