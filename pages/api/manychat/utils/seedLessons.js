/**
 * Lesson Seeding Utility
 * Date: 2025-08-18 11:42:18 UTC
 * Author: sophoniagoat
 * 
 * Seeds the database with initial lesson content
 */

import { executeQuery } from '../config/database.js';
import INITIAL_LESSONS from '../services/initialLessonsData.js';

export async function seedLessons() {
  try {
    console.log(`🌱 Starting lesson seeding process...`);
    
    // Check if lessons already exist
    const existingCount = await executeQuery(async (supabase) => {
      const { count, error } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.error('❌ Error checking existing lessons:', error);
        return 0;
      }
      
      return count;
    });
    
    if (existingCount > 0) {
      console.log(`✅ Database already has ${existingCount} lessons. Skipping seeding.`);
      return {
        success: true,
        seeded: false,
        message: `Skipped seeding: ${existingCount} lessons already exist`
      };
    }
    
    // Insert lessons
    const results = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lessons')
        .insert(INITIAL_LESSONS)
        .select();
        
      if (error) {
        console.error('❌ Error seeding lessons:', error);
        throw error;
      }
      
      return data;
    });
    
    console.log(`✅ Successfully seeded ${results.length} lessons`);
    
    return {
      success: true,
      seeded: true,
      count: results.length,
      message: `Successfully seeded ${results.length} lessons`
    };
  } catch (error) {
    console.error('❌ Lesson seeding failed:', error);
    return {
      success: false,
      seeded: false,
      error: error.message,
      message: 'Lesson seeding failed'
    };
  }
}

// Export command to run seeding
export async function runSeedCommand() {
  try {
    const result = await seedLessons();
    console.log(result.message);
    return result;
  } catch (error) {
    console.error('Seeding command failed:', error);
    return {
      success: false,
      message: `Seeding command failed: ${error.message}`
    };
  }
}

// Allow direct execution: node seedLessons.js
if (require.main === module) {
  runSeedCommand()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
