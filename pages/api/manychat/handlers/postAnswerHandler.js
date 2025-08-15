/**
 * Post-Answer Experience Handler
 * Provides comprehensive feedback, progress tracking, and structured next actions
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { aiService } from '../services/aiService.js';
import { formatStreak, formatPercentage } from '../utils/responseFormatter.js';

/**
 * Generate comprehensive post-answer response
 */
export async function generatePostAnswerResponse(user, question, answerResult) {
  try {
    const { isCorrect, userAnswer, correctAnswer, newStreak, stats } = answerResult;

    console.log(`📊 Generating post-answer response for user ${user.id}:`, {
      isCorrect,
      newStreak,
      accuracy: stats.accuracy,
      topic: question.topics?.display_name
    });

    // Set post-answer menu state
    await updateUser(user.id, {
      current_menu: 'post_answer',
      last_active_at: new Date().toISOString()
    });

    if (isCorrect) {
      return await generateCorrectResponse(user, question, answerResult);
    } else {
      return await generateIncorrectResponse(user, question, answerResult);
    }
  } catch (error) {
    console.error(`❌ Post-answer response generation failed:`, error);
    return generateFallbackResponse(answerResult.isCorrect);
  }
}

/**
 * Generate enhanced correct answer response
 */
async function generateCorrectResponse(user, question, answerResult) {
  const { newStreak, stats } = answerResult;
  const topicName = question.topics?.display_name || 'this topic';
  const subjectName = question.subjects?.display_name || 'the subject';
  const streakEmoji = formatStreak(newStreak);

  let response = `💯 Nice one sharp shooter! You nailed it! 🔥\n\n`;

  // Enhanced streak messaging
  if (newStreak > 1) {
    response += `🎯 **${newStreak} IN A ROW!** ${streakEmoji}\n`;

    if (newStreak >= 15) {
      response += `🏆 LEGENDARY STATUS! You're unstoppable!\n`;
    } else if (newStreak >= 10) {
      response += `👑 MASTER LEVEL! Absolutely crushing it!\n`;
    } else if (newStreak >= 5) {
      response += `🔥 ON FIRE! Keep this momentum going!\n`;
    } else if (newStreak >= 3) {
      response += `⚡ Building that confidence! You've got this!\n`;
    }
    response += `\n`;
  }

  // Comprehensive progress section
  response += `📈 **${topicName.toUpperCase()} PROGRESS:**\n`;
  response += `• Questions answered: ${stats.totalQuestions}\n`;
  response += `• Accuracy: ${formatPercentage(stats.accuracy)}%\n`;
  response += `• Current streak: ${newStreak} ${streakEmoji}\n`;
  response += `• Total correct: ${stats.totalCorrect}\n\n`;

  // Performance-based motivation
  if (stats.accuracy >= 90) {
    response += `🌟 Outstanding performance! You're mastering ${topicName}!\n\n`;
  } else if (stats.accuracy >= 80) {
    response += `💪 Strong work! You're getting really good at ${topicName}!\n\n`;
  } else if (stats.accuracy >= 70) {
    response += `🎯 Good progress! Keep practicing ${topicName}!\n\n`;
  } else {
    response += `📚 Keep going! Every question makes you stronger!\n\n`;
  }

  // Dynamic next actions based on performance
  response += `**What's next?**\n\n`;

  if (newStreak >= 5) {
    response += `1️⃣ Keep the streak alive! (Next ${topicName})\n`;
    response += `2️⃣ Challenge a friend to beat your streak\n`;
    response += `3️⃣ Try a harder ${topicName} question\n`;
    response += `4️⃣ Switch to another topic\n`;
    response += `5️⃣ See detailed progress report\n`;
  } else {
    response += `1️⃣ Next ${topicName} question\n`;
    response += `2️⃣ Switch topic\n`;
    response += `3️⃣ Challenge a friend\n`;
    response += `4️⃣ See progress report\n`;
    response += `5️⃣ Main menu\n`;
  }

  response += `\nType the number! ⚡`;

  return response;
}

/**
 * Generate enhanced incorrect answer response
 */
async function generateIncorrectResponse(user, question, answerResult) {
  const { userAnswer, correctAnswer, stats, streakLost } = answerResult;
  const topicName = question.topics?.display_name || 'this concept';
  const subjectName = question.subjects?.display_name || 'the subject';

  let response = `Eish, not this time! The correct answer was **${correctAnswer}**`;

  // Add correct choice text if available
  const correctChoice = getChoiceByLetter(question.choices, correctAnswer);
  if (correctChoice?.text) {
    response += `: ${correctChoice.text}`;
  }
  response += ` 📚\n\n`;

  // Streak loss acknowledgment
  if (streakLost >= 5) {
    response += `💔 Streak of ${streakLost} ended, but that foundation is still solid!\n\n`;
  } else if (streakLost >= 3) {
    response += `🎯 ${streakLost}-question streak ended - close one!\n\n`;
  }

  // Enhanced explanation attempt
  try {
    const explanation = await generateSmartExplanation(question, userAnswer, correctAnswer, user);
    response += `💡 **Quick explanation:**\n${explanation}\n\n`;
  } catch (error) {
    console.log(`⚠️ Smart explanation failed, using topic-based fallback`);
    response += await generateTopicBasedExplanation(question, userAnswer, correctAnswer);
  }

  // Weakness identification and logging
  const weaknessTag = await identifyAndLogWeakness(user, question, userAnswer);
  if (weaknessTag && weaknessTag !== 'general') {
    response += `🎯 **Focus area identified:** ${weaknessTag}\n\n`;
  }

  // Current performance context
  response += `📊 **Your ${topicName} performance:**\n`;
  response += `• Total questions: ${stats.totalQuestions}\n`;
  response += `• Accuracy: ${formatPercentage(stats.accuracy)}%\n`;
  response += `• Keep practicing to improve!\n\n`;

  // Encouraging next actions
  response += `**Bounce back stronger:**\n\n`;
  response += `1️⃣ Try another ${topicName} question\n`;
  response += `2️⃣ Switch to a different topic\n`;
  response += `3️⃣ Review ${topicName} concepts\n`;
  response += `4️⃣ Challenge a friend (show them this one!)\n`;
  response += `5️⃣ See detailed progress\n\n`;
  response += `Type the number! 💪`;

  return response;
}

/**
 * Generate smart AI-powered explanation
 */
async function generateSmartExplanation(question, userAnswer, correctAnswer, user) {
  try {
    const explanation = await aiService.generateExplanation(
      question,
      userAnswer,
      correctAnswer,
      user,
      {
        style: 'concise',
        includeSteps: true,
        gradeLevel: user.grade || 11,
        maxLength: 150
      }
    );

    if (explanation && explanation.length > 20) {
      return explanation;
    }

    throw new Error('AI explanation too short');
  } catch (error) {
    console.log(`⚠️ AI explanation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate topic-based fallback explanation
 */
async function generateTopicBasedExplanation(question, userAnswer, correctAnswer) {
  const topicName = question.topics?.name || 'general';
  const difficulty = question.difficulty || 'medium';

  const explanationTemplates = {
    trigonometry: {
      easy: 'Remember the basic trig ratios: SOH-CAH-TOA. Sin = Opposite/Hypotenuse.',
      medium: 'For special angles, memorize: sin(30°)=1/2, sin(45°)=√2/2, sin(60°)=√3/2.',
      hard: 'Use trig identities and unit circle values for complex problems.'
    },
    algebra: {
      easy: 'Isolate the variable by doing the same operation to both sides.',
      medium: 'Factor expressions or use quadratic formula when needed.',
      hard: 'Consider domain restrictions and multiple solution cases.'
    },
    geometry: {
      easy: 'Remember basic area and perimeter formulas.',
      medium: 'Use properties of triangles and circles for calculations.',
      hard: 'Apply coordinate geometry and transformation principles.'
    },
    calculus: {
      easy: 'Remember basic derivative rules: power rule, product rule.',
      medium: 'Chain rule is key for composite functions.',
      hard: 'Consider limits and continuity for complex problems.'
    }
  };

  const template =
    explanationTemplates[topicName]?.[difficulty] ||
    'Review the concept and practice similar problems to improve!';

  return `🧠 **Study tip:** ${template}\n\n`;
}

/**
 * Identify and log user weakness
 */
async function identifyAndLogWeakness(user, question, userAnswer) {
  try {
    // Get user's choice details
    const userChoice = getChoiceByLetter(question.choices, userAnswer);
    const weaknessTag = userChoice?.weakness_tag || question.topics?.name || 'general_concept';

    // Log weakness to database
    await executeQuery(async (supabase) => {
      const { error } = await supabase.from('user_weaknesses').insert({
        user_id: user.id,
        question_id: question.id,
        topic_id: question.topics?.id,
        subject_id: question.subjects?.id,
        weakness_tag: weaknessTag,
        incorrect_choice: userAnswer,
        correct_choice: question.correct_choice,
        logged_at: new Date().toISOString()
      });

      if (error) {
        console.error(`⚠️ Weakness logging failed:`, error);
      } else {
        console.log(`📝 Logged weakness: ${weaknessTag} for user ${user.id}`);
      }
    });

    return weaknessTag;
  } catch (error) {
    console.error(`❌ Weakness identification failed:`, error);
    return 'general';
  }
}

/**
 * Handle post-answer menu selections
 */
export async function handlePostAnswerAction(user, actionNumber) {
  try {
    console.log(`🎯 Post-answer action ${actionNumber} selected by user ${user.id}`);

    switch (actionNumber) {
      case 1:
        // Next question in same topic
        return await handleNextQuestion(user, 'same_topic');

      case 2:
        // Switch topic/subject
        return await handleTopicSwitch(user);

      case 3:
        // Challenge friend or review concepts
        return await handleChallengeOrReview(user);

      case 4:
        // Progress report or challenge friend
        return await handleProgressOrChallenge(user);

      case 5:
        // Main menu or detailed progress
        return await handleMenuOrProgress(user);

      default:
        return `Invalid choice! Pick a number 1-5 from the options above! 🎯`;
    }
  } catch (error) {
    console.error(`❌ Post-answer action error:`, error);
    return `Eish, couldn't process that action. Try "menu" to restart! 🔄`;
  }
}

/**
 * Handle next question request
 */
async function handleNextQuestion(user, context = 'same_topic') {
  try {
    // This will be handled by the main question handler
    return {
      type: 'question_request',
      context: context,
      message: `Getting your next question... 🎯`
    };
  } catch (error) {
    console.error(`❌ Next question error:`, error);
    return `Eish, couldn't get next question. Try "menu"! 🔄`;
  }
}

/**
 * Handle topic switching
 */
async function handleTopicSwitch(user) {
  try {
    await updateUser(user.id, {
      current_menu: 'subject',
      last_active_at: new Date().toISOString()
    });

    return (
      `📚 **SWITCH SUBJECTS**\n\n` +
      `Choose a new battlefield:\n\n` +
      `1️⃣ 🧮 Mathematics\n` +
      `2️⃣ ⚡ Physics\n` +
      `3️⃣ 🧬 Life Sciences\n` +
      `4️⃣ ⚗️ Chemistry\n` +
      `5️⃣ Main menu\n\n` +
      `Type the number! 🎯`
    );
  } catch (error) {
    console.error(`❌ Topic switch error:`, error);
    return `Eish, couldn't load subjects. Try "menu"! 🔄`;
  }
}

/**
 * Handle challenge or review based on performance
 */
async function handleChallengeOrReview(user) {
  const accuracy = user.correct_answer_rate || 0.5;

  if (accuracy >= 0.7) {
    // Good performance - offer challenge
    return await handleFriendChallenge(user);
  } else {
    // Lower performance - suggest review
    return await handleConceptReview(user);
  }
}

/**
 * Handle friend challenge
 */
async function handleFriendChallenge(user) {
  try {
    await updateUser(user.id, {
      current_menu: 'challenge',
      expecting_input: 'username_for_challenge',
      last_active_at: new Date().toISOString()
    });

    return (
      `⚔️ **CHALLENGE MODE ACTIVATED!**\n\n` +
      `Who do you want to battle?\n\n` +
      `🎯 Type their username (like: john123)\n` +
      `💡 Or type 'random' for a mystery opponent\n\n` +
      `The question you just answered will be their challenge!\n` +
      `Winner gets bragging rights! 🏆`
    );
  } catch (error) {
    console.error(`❌ Challenge setup error:`, error);
    return `Eish, couldn't set up challenge. Try "menu"! 🔄`;
  }
}

/**
 * Handle concept review
 */
async function handleConceptReview(user) {
  const currentTopic = user.current_topic || 'mathematics';

  return (
    `📚 **CONCEPT REVIEW**\n\n` +
    `Let's strengthen your ${currentTopic} foundation!\n\n` +
    `📖 Study tips:\n` +
    `• Review basic formulas\n` +
    `• Practice similar problems\n` +
    `• Take notes on key concepts\n\n` +
    `Ready to try again?\n\n` +
    `1️⃣ Practice more ${currentTopic}\n` +
    `2️⃣ Switch to easier questions\n` +
    `3️⃣ Get study resources\n` +
    `4️⃣ Main menu\n\n` +
    `Type the number! 💪`
  );
}

/**
 * Handle progress or challenge (context-dependent)
 */
async function handleProgressOrChallenge(user) {
  const streak = user.streak_count || 0;

  if (streak >= 3) {
    return await handleFriendChallenge(user);
  } else {
    return await handleProgressReport(user);
  }
}

/**
 * Handle menu or progress (context-dependent)
 */
async function handleMenuOrProgress(user) {
  const totalQuestions = user.total_questions_answered || 0;

  if (totalQuestions >= 10) {
    return await handleDetailedProgress(user);
  } else {
    return await handleMainMenu(user);
  }
}

/**
 * Handle progress report
 */
async function handleProgressReport(user) {
  try {
    const stats = await calculateUserStats(user);

    return (
      `📊 **YOUR PROGRESS REPORT**\n\n` +
      `🎯 **Overall Performance:**\n` +
      `• Total questions: ${stats.totalQuestions}\n` +
      `• Correct answers: ${stats.totalCorrect}\n` +
      `• Accuracy: ${formatPercentage(stats.accuracy)}%\n` +
      `• Best streak: ${stats.bestStreak}\n` +
      `• Current streak: ${stats.currentStreak}\n\n` +
      `📈 **Subject Breakdown:**\n${stats.subjectStats}\n\n` +
      `🎯 **Recommended focus:** ${stats.recommendation}\n\n` +
      `1️⃣ Continue practicing\n` +
      `2️⃣ Work on weak areas\n` +
      `3️⃣ Challenge friends\n` +
      `4️⃣ Main menu\n\n` +
      `Type the number! 📈`
    );
  } catch (error) {
    console.error(`❌ Progress report error:`, error);
    return `Eish, couldn't generate progress report. Try "menu"! 🔄`;
  }
}

/**
 * Handle detailed progress
 */
async function handleDetailedProgress(user) {
  try {
    const detailedStats = await calculateDetailedStats(user);

    return (
      `📊 **DETAILED ANALYTICS**\n\n` +
      `${detailedStats.summary}\n\n` +
      `🏆 **Achievements:**\n${detailedStats.achievements}\n\n` +
      `📈 **Growth Areas:**\n${detailedStats.growthAreas}\n\n` +
      `🎯 **Next Goals:**\n${detailedStats.goals}\n\n` +
      `1️⃣ Continue current focus\n` +
      `2️⃣ Set new challenges\n` +
      `3️⃣ Share progress\n` +
      `4️⃣ Main menu\n\n` +
      `Type the number! 🚀`
    );
  } catch (error) {
    console.error(`❌ Detailed progress error:`, error);
    return await handleProgressReport(user); // Fallback to simple progress
  }
}

/**
 * Handle main menu
 */
async function handleMainMenu(user) {
  try {
    await updateUser(user.id, {
      current_menu: 'main',
      last_active_at: new Date().toISOString()
    });

    return (
      `🏠 **MAIN MENU**\n\n` +
      `Welcome back to The GOAT! 🐐\n\n` +
      `What do you want to do?\n\n` +
      `1️⃣ Get practice question\n` +
      `2️⃣ Switch subjects\n` +
      `3️⃣ Progress report\n` +
      `4️⃣ Friends & challenges\n` +
      `5️⃣ Settings\n\n` +
      `Type the number! ⚡`
    );
  } catch (error) {
    console.error(`❌ Main menu error:`, error);
    return `🏠 Main menu temporarily unavailable. Try "next" for a question! 🎯`;
  }
}

/**
 * Helper function to get choice by letter
 */
function getChoiceByLetter(choicesData, letter) {
  try {
    const choices = parseChoices(choicesData);
    return choices.find(
      (choice) =>
        choice.choice?.toUpperCase() === letter.toUpperCase() ||
        String.fromCharCode(65 + choices.indexOf(choice)) === letter.toUpperCase()
    );
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to parse choices
 */
function parseChoices(choicesData) {
  if (!choicesData) return [];

  try {
    if (typeof choicesData === 'string') {
      return JSON.parse(choicesData);
    }
    return Array.isArray(choicesData) ? choicesData : [];
  } catch (error) {
    return [];
  }
}

/**
 * Generate fallback response for errors
 */
function generateFallbackResponse(isCorrect) {
  if (isCorrect) {
    return `💯 Correct! Well done! 🔥\n\nType "next" for another question! 🎯`;
  } else {
    return `Not quite right, but keep going! 💪\n\nType "next" to try again! 🎯`;
  }
}

/**
 * Calculate user statistics
 */
async function calculateUserStats(user) {
  try {
    // This would fetch detailed stats from database
    // For now, return basic stats
    const totalQuestions = user.total_questions_answered || 0;
    const totalCorrect = user.total_correct_answers || 0;
    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    return {
      totalQuestions,
      totalCorrect,
      accuracy,
      bestStreak: user.best_streak || user.streak_count || 0,
      currentStreak: user.streak_count || 0,
      subjectStats: '• Mathematics: 75% accuracy\n• Physics: 65% accuracy',
      recommendation: 'Focus on Physics concepts'
    };
  } catch (error) {
    console.error(`❌ Stats calculation error:`, error);
    return {
      totalQuestions: 0,
      totalCorrect: 0,
      accuracy: 0,
      bestStreak: 0,
      currentStreak: 0,
      subjectStats: 'Data loading...',
      recommendation: 'Keep practicing!'
    };
  }
}

/**
 * Calculate detailed statistics
 */
async function calculateDetailedStats(user) {
  try {
    // This would perform comprehensive analytics
    return {
      summary: `📈 You've answered ${user.total_questions_answered || 0} questions with ${Math.round((user.correct_answer_rate || 0.5) * 100)}% accuracy!`,
      achievements: '🏆 Math Explorer\n🔥 5+ Streak Master',
      growthAreas: '📚 Trigonometry concepts\n⚡ Physics problem solving',
      goals: '🎯 Reach 80% accuracy\n🔥 Build 10+ streak'
    };
  } catch (error) {
    console.error(`❌ Detailed stats error:`, error);
    return {
      summary: 'Analytics loading...',
      achievements: 'Keep practicing to unlock achievements!',
      growthAreas: 'Continue learning to identify growth areas',
      goals: 'Set goals by practicing more questions'
    };
  }
}

