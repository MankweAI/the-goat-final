/**
 * Homework Support Handler - Academic Integrity First
 * Date: 2025-08-17 10:50:37 UTC
 * Purpose: Teach methods and approaches, not solve homework directly
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { aiService } from '../services/aiService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export const homeworkHandler = {
  // Entry point for homework help
  async startHomeworkHelp(user) {
    const session = await getOrCreateHomeworkSession(user.id);

    // Check if we have grade
    if (!user.grade) {
      session.session_state = { step: 'ask_grade' };
      await saveHomeworkSession(session);
      await markUserInHomeworkFlow(user.id, session.id, 'homework_grade');

      return MESSAGES.WELCOME.GRADE_PROMPT;
    }

    // Go to subject selection
    session.session_state = { step: 'ask_subject' };
    await saveHomeworkSession(session);
    await markUserInHomeworkFlow(user.id, session.id, 'homework_subject');

    return MESSAGES.HOMEWORK.WELCOME_MESSAGE;
  },

  // Handle menu choices in homework flow
  async handleHomeworkMenu(user, choice) {
    const session = await getOrCreateHomeworkSession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_subject';

    console.log(`📚 Homework flow: step=${step}, choice=${choice}`);

    if (step === 'ask_subject') {
      // All subjects lead to math for MVP
      const subjectNames = { 1: 'Mathematics', 2: 'Physics', 3: 'Chemistry', 4: 'Life Sciences' };
      const chosenName = subjectNames[choice] || 'Mathematics';

      session.subject = 'math';
      session.chosen_subject_name = chosenName;
      session.session_state = { step: 'ask_problem_type' };
      await saveHomeworkSession(session);
      await updateUser(user.id, { current_menu: 'homework_problem_type' });

      const response =
        choice !== 1
          ? `Got it! Let's start with Maths foundations for ${chosenName}.\n\n`
          : `Perfect! Let's help with your Maths homework.\n\n`;

      return response + MESSAGES.HOMEWORK.PROBLEM_TYPE_PROMPT;
    }

    if (step === 'ask_problem_type') {
      const problemTypes = {
        1: 'equations',
        2: 'word_problems',
        3: 'graphs_functions',
        4: 'calculus',
        5: 'trigonometry',
        6: 'other'
      };

      const problemTypeNames = {
        1: 'Equations',
        2: 'Word Problems',
        3: 'Graphs & Functions',
        4: 'Calculus',
        5: 'Trigonometry',
        6: 'Mixed/Other'
      };

      if (choice >= 1 && choice <= 6) {
        session.problem_type = problemTypes[choice];
        session.problem_type_display = problemTypeNames[choice];
        session.session_state = { step: 'ask_confusion_details' };
        await saveHomeworkSession(session);
        await updateUser(user.id, { current_menu: 'homework_confusion' });

        return (
          `Great! You're working on ${problemTypeNames[choice]}.\n\n` +
          MESSAGES.HOMEWORK.CONFUSION_PROMPT
        );
      }
      return `Please pick a number 1-6 for your problem type. 📚`;
    }

    if (step === 'method_practice') {
      if (choice === 1) {
        // Practice questions
        return await this.startMethodPractice(user, session);
      }
      if (choice === 2) {
        // Another example
        return await this.showAnotherExample(user, session);
      }
      if (choice === 3) {
        // Back to homework
        session.session_state = { step: 'homework_complete' };
        await saveHomeworkSession(session);
        return await this.completeHomeworkSession(user, session);
      }
      return `Pick 1, 2, or 3 from the method options. 📘`;
    }

    return `I didn't catch that. Let's try again. 📚`;
  },

  // Handle text input for homework confusion
  async handleHomeworkText(user, text) {
    const session = await getOrCreateHomeworkSession(user.id);
    const state = session.session_state || {};

    console.log(`📝 Homework text: step="${state.step}", input="${text.substring(0, 50)}"`);

    // Handle grade input
    if (state.step === 'ask_grade') {
      const lowerText = text.toLowerCase().trim();

      if (['10', '11', 'varsity'].includes(lowerText)) {
        await updateUser(user.id, { grade: lowerText });

        session.session_state = { step: 'ask_subject' };
        await saveHomeworkSession(session);
        await markUserInHomeworkFlow(user.id, session.id, 'homework_subject');

        return MESSAGES.HOMEWORK.WELCOME_MESSAGE;
      } else {
        return `Please choose 10, 11, or varsity for your grade. 🎓`;
      }
    }

    // Handle confusion details (main homework analysis)
    if (state.step === 'ask_confusion_details') {
      return await this.processHomeworkConfusion(user, session, text);
    }

    return `I didn't catch that. Type "menu" to start over. 📚`;
  },

  // Core method: Process homework confusion and generate method teaching
  async processHomeworkConfusion(user, session, confusionText) {
    try {
      console.log(`🔍 Processing homework confusion for user ${user.id}`);

      // Analyze homework confusion using GPT
      const analysis = await aiService.analyzeHomeworkProblem(
        {
          id: user.id,
          grade: user.grade,
          username: user.username
        },
        confusionText,
        {
          subject: session.subject,
          problem_type: session.problem_type,
          problem_type_display: session.problem_type_display
        }
      );

      // Store analysis in session
      session.homework_analysis = analysis;
      session.confusion_text = confusionText;

      // Generate method teaching response
      const methodTeaching = await this.generateMethodTeaching(session, analysis);

      session.session_state = { step: 'method_practice' };
      await saveHomeworkSession(session);
      await updateUser(user.id, { current_menu: 'homework_method' });

      return methodTeaching;
    } catch (error) {
      console.error('❌ Homework confusion processing failed:', error);

      // Fallback to basic method teaching
      return await this.generateBasicMethodTeaching(session);
    }
  },

  // Generate method teaching with examples
  async generateMethodTeaching(session, analysis) {
    try {
      const problemType = session.problem_type_display;
      const concepts = analysis.concepts.join(', ');

      let response = `${MESSAGES.HOMEWORK.ACADEMIC_INTEGRITY_REMINDER}\n\n`;

      response += `🎯 I can see you're working on **${problemType}**`;
      if (concepts) {
        response += ` involving **${concepts}**`;
      }
      response += `.\n\n`;

      // Generate topic-specific method teaching
      const methodContent = await this.getMethodForProblemType(session.problem_type, analysis);
      response += methodContent;

      response += `\n\n1️⃣ Try practice questions\n`;
      response += `2️⃣ See another example\n`;
      response += `3️⃣ Back to homework`;

      return response;
    } catch (error) {
      console.error('❌ Method teaching generation failed:', error);
      return await this.generateBasicMethodTeaching(session);
    }
  },

  // Get method content based on problem type
  async getMethodForProblemType(problemType, analysis) {
    const methodContent = {
      equations: this.getEquationsMethod(analysis),
      word_problems: this.getWordProblemsMethod(analysis),
      graphs_functions: this.getGraphsMethod(analysis),
      calculus: this.getCalculusMethod(analysis),
      trigonometry: this.getTrigonometryMethod(analysis),
      other: this.getGeneralMethod(analysis)
    };

    return methodContent[problemType] || methodContent.other;
  },

  // Method templates for different problem types
  getEquationsMethod(analysis) {
    return (
      `📘 **EQUATION SOLVING METHOD:**\n\n` +
      `**Step-by-step approach:**\n` +
      `1️⃣ Identify equation type (linear, quadratic, etc.)\n` +
      `2️⃣ Isolate variable terms on one side\n` +
      `3️⃣ Combine like terms\n` +
      `4️⃣ Solve for the variable\n` +
      `5️⃣ Check your answer\n\n` +
      `**Example (Similar to your homework):**\n` +
      `Solve: 2x + 5 = 13\n` +
      `• Subtract 5: 2x = 8\n` +
      `• Divide by 2: x = 4\n` +
      `• Check: 2(4) + 5 = 13 ✓\n\n` +
      `**For quadratics:** Try factoring first, then quadratic formula if needed.`
    );
  },

  getWordProblemsMethod(analysis) {
    return (
      `📘 **WORD PROBLEM METHOD:**\n\n` +
      `**PROVEN STRATEGY:**\n` +
      `1️⃣ Read twice (understand the story)\n` +
      `2️⃣ Identify what you're looking for\n` +
      `3️⃣ Define your variable (let x = ...)\n` +
      `4️⃣ Write equation from the story\n` +
      `5️⃣ Solve the equation\n` +
      `6️⃣ Answer in context (with units!)\n\n` +
      `**Example approach:**\n` +
      `"A rectangle's length is 3 more than width. Perimeter = 26."\n` +
      `• Let w = width\n` +
      `• Then length = w + 3\n` +
      `• Perimeter: 2w + 2(w + 3) = 26\n` +
      `• Solve: w = 5, length = 8`
    );
  },

  getCalculusMethod(analysis) {
    return MESSAGES.LESSONS.CALCULUS_INTRO.replace(
      '1️⃣ Start Practice',
      '1️⃣ Try practice questions'
    );
  },

  getTrigonometryMethod(analysis) {
    return MESSAGES.LESSONS.TRIGONOMETRY_INTRO.replace(
      '1️⃣ Start Practice',
      '1️⃣ Try practice questions'
    );
  },

  getGraphsMethod(analysis) {
    return (
      `📘 **GRAPHS & FUNCTIONS METHOD:**\n\n` +
      `**KEY STEPS:**\n` +
      `1️⃣ Identify function type (linear, quadratic, etc.)\n` +
      `2️⃣ Find key points (intercepts, vertex)\n` +
      `3️⃣ Determine domain and range\n` +
      `4️⃣ Sketch or analyze behavior\n\n` +
      `**For linear functions (y = mx + b):**\n` +
      `• m = slope (rise/run)\n` +
      `• b = y-intercept\n` +
      `• x-intercept: set y = 0, solve for x\n\n` +
      `**For quadratics (y = ax² + bx + c):**\n` +
      `• Vertex at x = -b/(2a)\n` +
      `• Opens up if a > 0, down if a < 0`
    );
  },

  getGeneralMethod(analysis) {
    return (
      `📘 **GENERAL PROBLEM-SOLVING METHOD:**\n\n` +
      `**UNIVERSAL APPROACH:**\n` +
      `1️⃣ Understand what's given\n` +
      `2️⃣ Identify what you need to find\n` +
      `3️⃣ Choose the right formula/method\n` +
      `4️⃣ Show all work step-by-step\n` +
      `5️⃣ Check if answer makes sense\n\n` +
      `**When stuck:**\n` +
      `• Break into smaller steps\n` +
      `• Look for similar examples\n` +
      `• Check your algebra carefully\n` +
      `• Verify units and reasonableness`
    );
  },

  // Start method practice with similar questions
  async startMethodPractice(user, session) {
    const problemType = session.problem_type;

    // Get practice question similar to their homework type
    const question = await questionService.getQuestionByTopic(user, problemType, {
      subject: 'math',
      difficulty: calculateDifficulty(user),
      excludeRecent: true
    });

    if (!question) {
      return (
        `No practice questions available right now for ${session.problem_type_display}.\n\n` +
        `Try working on your homework with the method I showed you! 💪\n\n` +
        `Come back if you get stuck on the approach.`
      );
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'practice_active' });

    session.session_state = {
      ...session.session_state,
      practice_active: true,
      questions_in_set: 1,
      max_questions: 3,
      practice_topic: problemType
    };
    await saveHomeworkSession(session);

    return (
      `🧮 Let's practice the method with a similar question:\n\n` +
      `${formatQuestion(question)}\n\n` +
      `This uses the same approach as your homework! 📚`
    );
  },

  // Show another example
  async showAnotherExample(user, session) {
    const problemType = session.problem_type;
    const additionalExample = this.getAdditionalExample(problemType);

    return (
      `📘 Here's another example of the same method:\n\n` +
      `${additionalExample}\n\n` +
      `See the pattern? Now apply this to your homework! 🎯\n\n` +
      `1️⃣ Try practice questions\n` +
      `2️⃣ See more examples\n` +
      `3️⃣ Back to homework`
    );
  },

  // Get additional examples for different problem types
  getAdditionalExample(problemType) {
    const examples = {
      equations:
        `**Another Quadratic Example:**\n` +
        `Solve: x² - 7x + 12 = 0\n` +
        `• Try factoring: (x - 3)(x - 4) = 0\n` +
        `• So x = 3 or x = 4\n` +
        `• Check: 3² - 7(3) + 12 = 9 - 21 + 12 = 0 ✓`,

      word_problems:
        `**Another Word Problem:**\n` +
        `"Two consecutive numbers sum to 25. Find them."\n` +
        `• Let first number = x\n` +
        `• Second number = x + 1\n` +
        `• Equation: x + (x + 1) = 25\n` +
        `• Solve: 2x + 1 = 25, so x = 12\n` +
        `• Answer: 12 and 13`,

      calculus:
        `**Another Derivative:**\n` +
        `Find f'(x) for f(x) = x³ + 2x\n` +
        `• f(x+h) = (x+h)³ + 2(x+h)\n` +
        `• Expand: x³ + 3x²h + 3xh² + h³ + 2x + 2h\n` +
        `• Subtract f(x): 3x²h + 3xh² + h³ + 2h\n` +
        `• Divide by h: 3x² + 3xh + h² + 2\n` +
        `• Limit: f'(x) = 3x² + 2`
    };

    return examples[problemType] || examples.equations;
  },

  // Complete homework session
  async completeHomeworkSession(user, session) {
    await endHomeworkSession(session.id);
    await clearHomeworkState(user.id);

    return (
      `🎯 **You're all set!**\n\n` +
      `Use the method I showed you on your homework. Remember:\n` +
      `• Work step-by-step\n` +
      `• Show all your work\n` +
      `• Check your answers\n\n` +
      `Come back if you get stuck on the **approach** (not specific answers)!\n\n` +
      `Good luck with your homework! 💪\n\n` +
      `Type "menu" for other options or "practice" for more questions.`
    );
  },

  // Handle practice answers during homework session
  async handleHomeworkPracticeAnswer(user, answerLetter) {
    const session = await getOrCreateHomeworkSession(user.id);
    const state = session.session_state || {};

    if (!state.practice_active || !user.current_question_id) {
      return `Type "practice" to start practicing! 🧮`;
    }

    const { question, correct } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    await questionService.recordUserResponse(user.id, question.id, answerLetter, correct, null);

    const feedback = correct
      ? `✅ Excellent! You're getting the method. This is exactly how to approach your homework.`
      : `🌱 Not quite, but you're learning the process. Keep applying the method step-by-step.`;

    const questionsCompleted = state.questions_in_set || 1;
    const maxQuestions = state.max_questions || 3;

    if (questionsCompleted >= maxQuestions) {
      session.session_state.practice_active = false;
      await saveHomeworkSession(session);
      await updateUser(user.id, { current_menu: 'homework_complete', current_question_id: null });

      return (
        `${feedback}\n\n✅ Great practice session! You've got the method down.\n\n` +
        `🎯 Now apply this same approach to your homework!\n\n` +
        `${MESSAGES.HOMEWORK.PRACTICE_ENCOURAGEMENT}`
      );
    } else {
      // Continue with more practice
      const nextQuestion = await getNextHomeworkPracticeQuestion(user, session);
      if (!nextQuestion) {
        return await this.completeHomeworkSession(user, session);
      }

      await questionService.serveQuestionToUser(user.id, nextQuestion.id);
      session.session_state.questions_in_set = questionsCompleted + 1;
      await saveHomeworkSession(session);

      return `${feedback}\n\n${formatQuestion(nextQuestion)}`;
    }
  },

  // Generate basic method teaching (fallback)
  async generateBasicMethodTeaching(session) {
    const problemTypeDisplay = session.problem_type_display || 'these problems';

    return (
      `${MESSAGES.HOMEWORK.ACADEMIC_INTEGRITY_REMINDER}\n\n` +
      `📘 **GENERAL APPROACH FOR ${problemTypeDisplay.toUpperCase()}:**\n\n` +
      `1️⃣ Read the problem carefully\n` +
      `2️⃣ Identify what you know and what you need\n` +
      `3️⃣ Choose the right method/formula\n` +
      `4️⃣ Work step-by-step\n` +
      `5️⃣ Check your answer\n\n` +
      `🎯 Apply this systematic approach to your homework!\n\n` +
      `1️⃣ Try practice questions\n` +
      `2️⃣ See an example\n` +
      `3️⃣ Back to homework`
    );
  }
};

// Helper functions
async function getOrCreateHomeworkSession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('homework_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('homework_sessions')
      .insert({
        user_id: userId,
        subject: 'math',
        session_state: { step: 'ask_subject' }
      })
      .select('*')
      .single();

    if (error) throw error;
    return created;
  });
}

async function saveHomeworkSession(session) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('homework_sessions')
      .update({
        subject: session.subject || 'math',
        problem_type: session.problem_type,
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function markUserInHomeworkFlow(userId, sessionId, menuState) {
  await updateUser(userId, {
    current_menu: menuState,
    homework_session_id: sessionId,
    last_active_at: new Date().toISOString()
  });
}

async function clearHomeworkState(userId) {
  await updateUser(userId, {
    current_menu: 'welcome',
    homework_session_id: null,
    current_question_id: null,
    last_active_at: new Date().toISOString()
  });
}

async function endHomeworkSession(sessionId) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('homework_sessions')
      .update({
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    if (error) throw error;
  });
}

async function fetchQuestionAndCheck(questionId, answerLetter) {
  return await executeQuery(async (supabase) => {
    const { data: question, error } = await supabase
      .from('mcqs')
      .select('id, correct_choice')
      .eq('id', questionId)
      .single();

    if (error || !question) throw new Error('Question not found');

    const correctChoice = String(question.correct_choice || '')
      .toUpperCase()
      .trim();
    const userAnswer = String(answerLetter || '')
      .toUpperCase()
      .trim();
    const correct = userAnswer === correctChoice;

    return { question, correct, correctChoice };
  });
}

async function getNextHomeworkPracticeQuestion(user, session) {
  const practiceType = session.problem_type || 'algebra';

  return await questionService.getQuestionByTopic(user, practiceType, {
    subject: 'math',
    difficulty: 'easy',
    excludeRecent: true
  });
}

function calculateDifficulty(user) {
  const rate = user.correct_answer_rate || 0.5;
  if (rate >= 0.8) return 'medium';
  if (rate >= 0.6) return 'medium';
  return 'easy';
}

