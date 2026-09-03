import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://efcgobturabgoybwyahk.supabase.co');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmY2dvYnR1cmFiZ295Ynd5YWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjg3NDgsImV4cCI6MjEwNDAwNDc0OH0.7tktUQfE0u2fbhyR7fO9Ery7XkqIWHzQSOJOk4g77cs');

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseConfigured = Boolean(supabase);
