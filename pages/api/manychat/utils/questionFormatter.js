/**
 * Question Formatter Utility
 * Formats MCQ questions for WhatsApp display with enhanced South African personality
 *
 * The GOAT Bot - Question Display System
 * Created: 2025-08-15
 * Updated: 2025-08-15 10:50:04 UTC
 */

/**
 * Format a complete question for display
 * @param {Object} question - Question object from database
 * @param {Object} options - Formatting options
 * @returns {string} Formatted question string
 */
export function formatQuestion(question, options = {}) {
  try {
    if (!question) {
      console.error('❌ No question provided to formatter');
      return generateErrorQuestion();
    }

    const {
      showDifficulty = false,
      showTopic = true,
      showSubject = false,
      showQuestionId = false,
      compact = false,
      includeInstructions = true
    } = options;

    console.log(`🎨 Formatting question ${question.id}:`, {
      topic: question.topics?.display_name,
      difficulty: question.difficulty,
      hasChoices: !!question.choices
    });

    let formattedQuestion = '';

    // Add topic header (if enabled)
    if (showTopic && question.topics?.display_name) {
      const topicEmoji = getTopicEmoji(question.topics.name);
      formattedQuestion += `${topicEmoji} **${question.topics.display_name.toUpperCase()}** QUESTION\n\n`;
    }

    // Add subject context (if enabled)
    if (showSubject && question.subjects?.display_name) {
      const subjectEmoji = getSubjectEmoji(question.subjects.name);
      formattedQuestion += `${subjectEmoji} ${question.subjects.display_name} | `;
    }

    // Add difficulty indicator (if enabled)
    if (showDifficulty && question.difficulty) {
      const difficultyIndicator = getDifficultyIndicator(question.difficulty);
      formattedQuestion += `${difficultyIndicator}\n\n`;
    }

    // Add question ID for debugging (if enabled)
    if (showQuestionId) {
      formattedQuestion += `[Q${question.id}] `;
    }

    // Main question text
    const questionText = question.question_text || 'Question text missing';
    formattedQuestion += `${questionText}\n\n`;

    // Format and add choices
    const choicesText = formatChoices(question.choices, { compact });
    if (choicesText) {
      formattedQuestion += choicesText;
    } else {
      console.warn(`⚠️ No valid choices for question ${question.id}`);
      formattedQuestion += generateDefaultChoices();
    }

    // Add instructions (if enabled)
    if (includeInstructions && !compact) {
      formattedQuestion += `\n\n${getRandomInstruction()}`;
    }

    console.log(`✅ Question ${question.id} formatted successfully`);
    return formattedQuestion.trim();
  } catch (error) {
    console.error(`❌ Question formatting error:`, error);
    return generateErrorQuestion();
  }
}

/**
 * Format question choices with flexible input support
 * @param {string|Array|Object} choicesData - Raw choices data
 * @param {Object} options - Formatting options
 * @returns {string} Formatted choices string
 */
export function formatChoices(choicesData, options = {}) {
  try {
    const { compact = false, showLetters = true } = options;

    // Parse choices data
    const choices = parseChoicesData(choicesData);
    if (!choices || choices.length === 0) {
      console.warn('⚠️ No choices data available');
      return generateDefaultChoices();
    }

    let formattedChoices = '';
    const validChoices = choices.slice(0, 4); // Limit to 4 choices max

    validChoices.forEach((choice, index) => {
      // Determine choice letter
      const letter = choice.choice || String.fromCharCode(65 + index); // A, B, C, D

      // Get choice text
      const text = choice.text || choice.option || `Option ${letter}`;

      // Format choice line
      if (compact) {
        formattedChoices += `${letter}) ${text}\n`;
      } else {
        formattedChoices += `**${letter})** ${text}\n`;
      }
    });

    return formattedChoices.trim();
  } catch (error) {
    console.error(`❌ Choices formatting error:`, error);
    return generateDefaultChoices();
  }
}

/**
 * Parse choices data from various formats
 * @param {string|Array|Object} choicesData - Raw choices data
 * @returns {Array} Parsed choices array
 */
function parseChoicesData(choicesData) {
  try {
    // Handle null/undefined
    if (!choicesData) {
      return [];
    }

    // Handle string (JSON)
    if (typeof choicesData === 'string') {
      try {
        const parsed = JSON.parse(choicesData);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        console.warn('⚠️ Failed to parse choices JSON:', parseError);
        return [];
      }
    }

    // Handle array
    if (Array.isArray(choicesData)) {
      return choicesData;
    }

    // Handle object (convert to array)
    if (typeof choicesData === 'object') {
      const choiceKeys = ['A', 'B', 'C', 'D'];
      return choiceKeys
        .map((key) => (choicesData[key] ? { choice: key, text: choicesData[key] } : null))
        .filter(Boolean);
    }

    console.warn('⚠️ Unrecognized choices data format:', typeof choicesData);
    return [];
  } catch (error) {
    console.error(`❌ Choices parsing error:`, error);
    return [];
  }
}

/**
 * Get emoji for topic
 * @param {string} topicName - Topic name
 * @returns {string} Topic emoji
 */
function getTopicEmoji(topicName) {
  const topicEmojis = {
    algebra: '🔢',
    geometry: '📐',
    trigonometry: '📊',
    calculus: '📈',
    statistics: '📊',
    functions: '📉',
    number_theory: '🔢',
    physics: '⚡',
    mechanics: '⚙️',
    waves: '🌊',
    electricity: '⚡',
    magnetism: '🧲',
    chemistry: '⚗️',
    organic: '🧪',
    reactions: '💥',
    stoichiometry: '⚖️',
    life_sciences: '🧬',
    biology: '🧬',
    ecology: '🌱',
    genetics: '🧬',
    human_body: '🫀',
    english: '📖',
    literature: '📚',
    grammar: '✍️',
    geography: '🌍',
    history: '📜'
  };

  return topicEmojis[topicName?.toLowerCase()] || '🎯';
}

/**
 * Get emoji for subject
 * @param {string} subjectName - Subject name
 * @returns {string} Subject emoji
 */
function getSubjectEmoji(subjectName) {
  const subjectEmojis = {
    math: '🧮',
    mathematics: '🧮',
    physics: '⚡',
    chemistry: '⚗️',
    life_sciences: '🧬',
    biology: '🧬',
    english: '📖',
    geography: '🌍',
    history: '📜',
    accounting: '💰',
    economics: '📈',
    business_studies: '💼'
  };

  return subjectEmojis[subjectName?.toLowerCase()] || '📚';
}

/**
 * Get difficulty indicator
 * @param {string} difficulty - Difficulty level
 * @returns {string} Difficulty indicator
 */
function getDifficultyIndicator(difficulty) {
  const indicators = {
    easy: '🟢 Easy Level',
    medium: '🟡 Medium Level',
    hard: '🔴 Hard Level',
    expert: '🟣 Expert Level'
  };

  return indicators[difficulty?.toLowerCase()] || '🟡 Medium Level';
}

/**
 * Get random instruction phrase
 * @returns {string} Random instruction
 */
function getRandomInstruction() {
  const instructions = [
    'Just send the letter (A, B, C or D). Sharp? 🔥',
    'Type your answer: A, B, C or D! 🎯',
    'Pick your choice: A, B, C or D! ⚡',
    'Send the letter of your answer! 🚀',
    "Choose A, B, C or D! Let's go! 💪",
    'Answer with A, B, C or D! 🔥',
    'Type A, B, C or D to answer! 🎯',
    'Send your choice (A, B, C or D)! ⚡'
  ];

  return instructions[Math.floor(Math.random() * instructions.length)];
}

/**
 * Generate default choices when parsing fails
 * @returns {string} Default choices
 */
function generateDefaultChoices() {
  return `**A)** Option A\n**B)** Option B\n**C)** Option C\n**D)** Option D`;
}

/**
 * Generate error question when formatting fails
 * @returns {string} Error question
 */
function generateErrorQuestion() {
  return `🚨 **TECHNICAL DIFFICULTY**\n\nEish, this question got a bit scrambled! 😅\n\nType "next" for a fresh question! 🔄`;
}

/**
 * Format question for challenge/sharing
 * @param {Object} question - Question object
 * @param {Object} challenger - User who sent the challenge
 * @returns {string} Challenge-formatted question
 */
export function formatChallengeQuestion(question, challenger) {
  try {
    const challengerName = challenger.display_name || challenger.username || 'A friend';
    const topicName = question.topics?.display_name || 'this topic';

    let challengeText = `⚔️ **CHALLENGE FROM ${challengerName.toUpperCase()}!**\n\n`;
    challengeText += `🎯 ${topicName} Challenge:\n\n`;
    challengeText += `${question.question_text}\n\n`;

    const choicesText = formatChoices(question.choices, { compact: false });
    challengeText += choicesText;

    challengeText += `\n\n⏰ You have 24 hours to respond!`;
    challengeText += `\nBeat ${challengerName}'s answer to win! 🏆`;
    challengeText += `\n\nSend A, B, C or D! 🔥`;

    return challengeText;
  } catch (error) {
    console.error(`❌ Challenge question formatting error:`, error);
    return `⚔️ Challenge question temporarily unavailable! Try "next" for practice! 🔄`;
  }
}

/**
 * Format question for review/explanation
 * @param {Object} question - Question object
 * @param {string} userAnswer - User's incorrect answer
 * @param {string} correctAnswer - Correct answer
 * @returns {string} Review-formatted question
 */
export function formatReviewQuestion(question, userAnswer, correctAnswer) {
  try {
    const topicName = question.topics?.display_name || 'this topic';

    let reviewText = `📚 **${topicName.toUpperCase()} REVIEW**\n\n`;
    reviewText += `Question: ${question.question_text}\n\n`;

    const choices = parseChoicesData(question.choices);
    choices.forEach((choice, index) => {
      const letter = choice.choice || String.fromCharCode(65 + index);
      const isCorrect = letter === correctAnswer;
      const wasUserChoice = letter === userAnswer;

      let prefix = '  ';
      if (isCorrect) prefix = '✅ ';
      else if (wasUserChoice) prefix = '❌ ';

      reviewText += `${prefix}**${letter})** ${choice.text}\n`;
    });

    reviewText += `\n💡 The correct answer was **${correctAnswer}**`;
    reviewText += `\n📝 You chose **${userAnswer}**`;
    reviewText += `\n\nStudy this concept and try again! 💪`;

    return reviewText;
  } catch (error) {
    console.error(`❌ Review question formatting error:`, error);
    return `📚 Review temporarily unavailable. Keep practicing! 💪`;
  }
}

/**
 * Format compact question for mobile optimization
 * @param {Object} question - Question object
 * @returns {string} Compact formatted question
 */
export function formatCompactQuestion(question) {
  return formatQuestion(question, {
    showDifficulty: false,
    showTopic: false,
    showSubject: false,
    compact: true,
    includeInstructions: true
  });
}

/**
 * Format question with full context
 * @param {Object} question - Question object
 * @returns {string} Full context formatted question
 */
export function formatFullContextQuestion(question) {
  return formatQuestion(question, {
    showDifficulty: true,
    showTopic: true,
    showSubject: true,
    showQuestionId: false,
    compact: false,
    includeInstructions: true
  });
}

/**
 * Validate question object structure
 * @param {Object} question - Question object to validate
 * @returns {boolean} Is valid question
 */
export function validateQuestion(question) {
  try {
    if (!question) return false;
    if (!question.question_text) return false;
    if (!question.choices) return false;
    if (!question.correct_choice) return false;

    const choices = parseChoicesData(question.choices);
    if (choices.length < 2) return false;

    return true;
  } catch (error) {
    console.error(`❌ Question validation error:`, error);
    return false;
  }
}

/**
 * Extract question metadata for logging
 * @param {Object} question - Question object
 * @returns {Object} Question metadata
 */
export function extractQuestionMetadata(question) {
  try {
    return {
      id: question.id,
      topic: question.topics?.name,
      topicDisplay: question.topics?.display_name,
      subject: question.subjects?.name,
      subjectDisplay: question.subjects?.display_name,
      difficulty: question.difficulty,
      hasChoices: !!question.choices,
      choiceCount: parseChoicesData(question.choices).length,
      correctChoice: question.correct_choice,
      questionLength: question.question_text?.length || 0,
      lastServed: question.last_served_at
    };
  } catch (error) {
    console.error(`❌ Metadata extraction error:`, error);
    return {
      id: question?.id || 'unknown',
      error: error.message
    };
  }
}

/**
 * Format question for testing/debugging
 * @param {Object} question - Question object
 * @returns {string} Debug formatted question
 */
export function formatDebugQuestion(question) {
  try {
    const metadata = extractQuestionMetadata(question);

    let debugText = `🐛 **DEBUG QUESTION [${metadata.id}]**\n\n`;
    debugText += `📊 Metadata:\n`;
    debugText += `• Topic: ${metadata.topicDisplay || 'N/A'}\n`;
    debugText += `• Subject: ${metadata.subjectDisplay || 'N/A'}\n`;
    debugText += `• Difficulty: ${metadata.difficulty || 'N/A'}\n`;
    debugText += `• Choices: ${metadata.choiceCount}\n`;
    debugText += `• Correct: ${metadata.correctChoice}\n\n`;

    debugText += formatQuestion(question, { showQuestionId: true });

    return debugText;
  } catch (error) {
    console.error(`❌ Debug question formatting error:`, error);
    return `🐛 Debug formatting failed: ${error.message}`;
  }
}

/**
 * Get question display statistics
 * @param {Object} question - Question object
 * @returns {Object} Display statistics
 */
export function getQuestionDisplayStats(question) {
  try {
    const formatted = formatQuestion(question);
    const metadata = extractQuestionMetadata(question);

    return {
      questionId: metadata.id,
      topic: metadata.topicDisplay,
      subject: metadata.subjectDisplay,
      difficulty: metadata.difficulty,
      formattedLength: formatted.length,
      choiceCount: metadata.choiceCount,
      hasValidChoices: metadata.choiceCount >= 2,
      estimatedReadTime: Math.ceil(formatted.length / 200), // seconds
      mobileOptimized: formatted.length <= 500,
      isValid: validateQuestion(question)
    };
  } catch (error) {
    console.error(`❌ Display stats error:`, error);
    return {
      error: error.message,
      isValid: false
    };
  }
}
