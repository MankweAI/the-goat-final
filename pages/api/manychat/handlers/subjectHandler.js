/**
 * Enhanced Subject Handler with Sub-Topic Selection
 * Provides numbered menu for math topics and immediate question delivery
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';

/**
 * Handle subject switching with sub-topic selection
 */
export async function handleSubjectSwitchCommand(user, command) {
  try {
    const targetSubject = command.target;

    console.log(`🎯 Subject switch request from user ${user.id}: ${targetSubject}`);

    // If switching to math, show sub-topic selection
    if (targetSubject === 'math' || targetSubject === 'mathematics') {
      return await showMathTopicSelection(user);
    }

    // For other subjects, switch directly
    return await switchToSubject(user, targetSubject);
  } catch (error) {
    console.error(`❌ Subject switch error:`, error);
    return `Eish, couldn't switch subjects right now. Try "menu" to see options! 🔄`;
  }
}

/**
 * Show math sub-topic selection menu
 */
async function showMathTopicSelection(user) {
  try {
    // Update user menu state
    await updateUser(user.id, {
      current_menu: 'math_topics',
      current_subject: 'math',
      last_active_at: new Date().toISOString()
    });

    const response =
      `🧮 **MATHEMATICS** - Choose your battlefield!\n\n` +
      `📚 Select a topic to master:\n\n` +
      `1️⃣ **Algebra** - Equations, functions, graphs\n` +
      `2️⃣ **Geometry** - Shapes, angles, proofs\n` +
      `3️⃣ **Trigonometry** - Sin, cos, tan ratios\n` +
      `4️⃣ **Calculus** - Derivatives, integrals\n` +
      `5️⃣ **Statistics** - Data, probability, graphs\n` +
      `6️⃣ **Functions** - Domain, range, transformations\n` +
      `7️⃣ **Number Theory** - Patterns, sequences, series\n` +
      `8️⃣ **Surprise me!** - Random math topic mix\n\n` +
      `9️⃣ Back to subjects\n\n` +
      `Just type the number! 🔥`;

    console.log(`📱 Showing math topics menu to user ${user.id}`);
    return response;
  } catch (error) {
    console.error(`❌ Math topics menu error:`, error);
    return `Eish, couldn't load math topics. Try "next" for a question! 🔄`;
  }
}

/**
 * Handle math topic selection and serve immediate question
 */
export async function handleMathTopicSelection(user, topicNumber) {
  try {
    const topicMap = {
      1: { name: 'algebra', display: 'Algebra', description: 'equations and functions' },
      2: { name: 'geometry', display: 'Geometry', description: 'shapes and angles' },
      3: { name: 'trigonometry', display: 'Trigonometry', description: 'trig ratios' },
      4: { name: 'calculus', display: 'Calculus', description: 'derivatives and integrals' },
      5: { name: 'statistics', display: 'Statistics', description: 'data and probability' },
      6: { name: 'functions', display: 'Functions', description: 'function analysis' },
      7: { name: 'number_theory', display: 'Number Theory', description: 'patterns and sequences' },
      8: { name: 'random', display: 'Random Math', description: 'mixed topics' },
      9: { name: 'back', display: 'Back', description: 'return to subjects' }
    };

    const selectedTopic = topicMap[topicNumber];

    if (!selectedTopic) {
      return `Invalid choice! Pick a number 1-9 from the math topics! 🧮`;
    }

    // Handle back option
    if (selectedTopic.name === 'back') {
      await updateUser(user.id, {
        current_menu: 'subject',
        last_active_at: new Date().toISOString()
      });
      return await showSubjectMenu(user);
    }

    console.log(`🎯 Math topic selected: ${selectedTopic.display} by user ${user.id}`);

    // Update user's current topic
    await updateUser(user.id, {
      current_subject: 'math',
      current_topic: selectedTopic.name,
      current_menu: 'question_active',
      last_active_at: new Date().toISOString()
    });

    // Get and serve immediate question
    const question = await getTopicQuestion(user, selectedTopic.name);

    if (!question) {
      return `No ${selectedTopic.display} questions available right now! 😅\n\nTry another topic or type "menu"! 🔄`;
    }

    // Set current question for user
    await updateUser(user.id, {
      current_question_id: question.id
    });

    // Update question's last_served_at
    await updateQuestionServedTime(question.id);

    // Format response with topic confirmation + question
    let response = `🔥 **${selectedTopic.display.toUpperCase()}** CHALLENGE ACTIVATED!\n\n`;
    response += `Ready to dominate ${selectedTopic.description}? Let's go! 💪\n\n`;
    response += `${formatQuestion(question)}\n\n`;
    response += `Just send the letter (A, B, C or D). Sharp? 🎯`;

    console.log(`✅ Served ${selectedTopic.display} question ${question.id} to user ${user.id}`);
    return response;
  } catch (error) {
    console.error(`❌ Math topic selection error:`, error);
    return `Eish, couldn't load that topic. Try "menu" to restart! 🔄`;
  }
}

/**
 * Switch to other subjects (non-math)
 */
async function switchToSubject(user, subjectName) {
  try {
    const subjectMap = {
      physics: { display: 'Physics', emoji: '⚡' },
      life_sciences: { display: 'Life Sciences', emoji: '🧬' },
      chemistry: { display: 'Chemistry', emoji: '⚗️' },
      english: { display: 'English', emoji: '📖' },
      geography: { display: 'Geography', emoji: '🌍' },
      history: { display: 'History', emoji: '📜' }
    };

    const subject = subjectMap[subjectName];
    if (!subject) {
      return `Unknown subject: ${subjectName}. Try "menu" to see available subjects! 📚`;
    }

    // Update user's subject
    await updateUser(user.id, {
      current_subject: subjectName,
      current_topic: null, // Clear specific topic
      current_menu: 'question_active',
      last_active_at: new Date().toISOString()
    });

    // Get question for this subject
    const question = await getSubjectQuestion(user, subjectName);

    if (!question) {
      return `No ${subject.display} questions available right now! 😅\n\nTry another subject or type "menu"! 🔄`;
    }

    // Set current question
    await updateUser(user.id, {
      current_question_id: question.id
    });

    await updateQuestionServedTime(question.id);

    // Format response
    let response = `${subject.emoji} **${subject.display.toUpperCase()}** ACTIVATED!\n\n`;
    response += `Ready to master ${subject.display}? Let's go! 💪\n\n`;
    response += `${formatQuestion(question)}\n\n`;
    response += `Just send the letter (A, B, C or D). Sharp? 🎯`;

    console.log(
      `✅ Switched to ${subject.display}, served question ${question.id} to user ${user.id}`
    );
    return response;
  } catch (error) {
    console.error(`❌ Subject switch error:`, error);
    return `Eish, couldn't switch to that subject. Try "menu"! 🔄`;
  }
}

/**
 * Get question for specific math topic
 */
async function getTopicQuestion(user, topicName) {
  try {
    if (topicName === 'random') {
      // Get random math question from any topic
      return await questionService.getRandomQuestion(user, {
        subject: 'math',
        excludeRecent: true
      });
    }

    // Get question for specific topic
    return await questionService.getQuestionByTopic(user, topicName, {
      subject: 'math',
      difficulty: calculateUserDifficulty(user),
      excludeRecent: true
    });
  } catch (error) {
    console.error(`❌ Topic question fetch error:`, error);
    return null;
  }
}

/**
 * Get question for non-math subjects
 */
async function getSubjectQuestion(user, subjectName) {
  try {
    return await questionService.getRandomQuestion(user, {
      subject: subjectName,
      difficulty: calculateUserDifficulty(user),
      excludeRecent: true
    });
  } catch (error) {
    console.error(`❌ Subject question fetch error:`, error);
    return null;
  }
}

/**
 * Show subject menu (for back navigation)
 */
async function showSubjectMenu(user) {
  try {
    await updateUser(user.id, {
      current_menu: 'subject',
      last_active_at: new Date().toISOString()
    });

    const response =
      `📚 **CHOOSE YOUR SUBJECT**\n\n` +
      `Which subject do you want to dominate?\n\n` +
      `1️⃣ 🧮 **Mathematics** - Multiple topics available\n` +
      `2️⃣ ⚡ **Physics** - Mechanics, waves, electricity\n` +
      `3️⃣ 🧬 **Life Sciences** - Biology, human body, ecology\n` +
      `4️⃣ ⚗️ **Chemistry** - Reactions, organic, stoichiometry\n\n` +
      `5️⃣ Back to main menu\n\n` +
      `Type the number! 🎯`;

    return response;
  } catch (error) {
    console.error(`❌ Subject menu error:`, error);
    return `Eish, couldn't load subjects. Try "menu"! 🔄`;
  }
}

/**
 * Calculate user difficulty based on performance
 */
function calculateUserDifficulty(user) {
  const rate = user.correct_answer_rate || 0.5;

  if (rate >= 0.8) return 'hard';
  if (rate >= 0.5) return 'medium';
  return 'easy';
}

/**
 * Update question served timestamp
 */
async function updateQuestionServedTime(questionId) {
  try {
    await executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('mcqs')
        .update({ last_served_at: new Date().toISOString() })
        .eq('id', questionId);

      if (error) throw error;
    });
  } catch (error) {
    console.error(`⚠️ Question served time update failed:`, error);
    // Non-critical error, don't throw
  }
}

/**
 * Handle invalid topic selection
 */
export function handleInvalidTopicSelection(user, input) {
  return `Invalid choice! 🚫\n\nFor math topics, pick a number 1-9.\n\nYou sent: "${input}"\n\nTry again! 🧮`;
}

/**
 * Get available topics for a subject
 */
export async function getSubjectTopics(subjectName) {
  try {
    return await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('topics')
        .select('id, name, display_name, description')
        .eq('subject_name', subjectName)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data || [];
    });
  } catch (error) {
    console.error(`❌ Topics fetch error:`, error);
    return [];
  }
}
