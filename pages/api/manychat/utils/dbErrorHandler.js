/**
 * Enhanced database error handler with diagnostic logging
 */
export async function executeQueryWithDiagnostics(supabaseCallback) {
  try {
    return await supabaseCallback();
  } catch (error) {
    // Log detailed diagnostic information
    if (error.code === '22001') {
      console.error('❌ VARCHAR length error detected!');

      // Try to extract the SQL causing the error
      const details = error.details || error.message;
      console.error('SQL details:', details);

      // Log the last arguments
      const args = arguments;
      console.error('Function arguments:', JSON.stringify(args));
    }

    throw error;
  }
}

