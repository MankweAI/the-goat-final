import { questionService } from '../services/questionService.js';
import { updateUser } from '../services/userService.js';

export async function handleQuestionRequest(user, command) {
  try {
    console.log(`🎯 Handling question request for user ${user.id}`);

    // Determine subject preference
    let targetSubject = null;
    if (command.target && user.preferred_subjects?.includes(command.target)) {
      targetSubject = command.target;
    }

    // Get next question
    const question = await questionService.getNextQuestion(user.id, targetSubject);

    if (!question) {
      return `You've smashed all available questions! 🔥\n\nMore content coming soon. Try switching subjects or check back later! 💪`;
    }

    // Serve question to user
    await questionService.serveQuestionToUser(user.id, question.id);

    // Format and return question
    const formattedQuestion = questionService.formatQuestionText(question);

    console.log(`✅ Question ${question.id} served to user ${user.id}`);

    return formattedQuestion;
  } catch (error) {
    console.error('❌ Question request error:', error);
    throw new Error(`Failed to get question: ${error.message}`);
  }
}

export async function handleSubjectSwitch(user, targetSubject) {
  try {
    // Validate subject
    if (!user.preferred_subjects?.includes(targetSubject)) {
      const availableSubjects = user.preferred_subjects?.join(', ') || 'none';
      return `Eish, you're not registered for ${targetSubject}! 📚\n\nYour subjects: ${availableSubjects}\n\nType "next" for a question from your subjects!`;
    }

    // Get question from specific subject
    const question = await questionService.getNextQuestion(user.id, targetSubject);

    if (!question) {
      return `No more ${targetSubject} questions available right now! 📝\n\nTry another subject or check back later! 💪`;
    }

    // Serve the question
    await questionService.serveQuestionToUser(user.id, question.id);

    const subjectName = question.subjects?.display_name || targetSubject;
    const formattedQuestion = questionService.formatQuestionText(question);

    return `🔄 Switched to ${subjectName}!\n\n${formattedQuestion}`;
  } catch (error) {
    console.error('❌ Subject switch error:', error);
    throw new Error(`Failed to switch subject: ${error.message}`);
  }
}
