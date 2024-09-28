import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkAndCreateUser(userEmail: string, userId: string) {
  try {
    // Check if user exists in the users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking user:', checkError);
      return null;
    }

    if (!existingUser) {
      // User doesn't exist, create a new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          { user_email: userEmail, user_role: 'editor', auth_id: userId }
        ])
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        return null;
      }

      return newUser;
    }

    return existingUser;
  } catch (error) {
    console.error('Unexpected error in checkAndCreateUser:', error);
    return null;
  }
}