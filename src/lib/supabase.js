import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://uvoxbmblbcltgcjnfugd.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2b3hibWJsYmNsdGdjam5mdWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDI2NDYsImV4cCI6MjA5MDQxODY0Nn0.kqdMeT4__9XSLXmajWLOSqlUZR2PkmVzU9nb9a6QYSA'

export const supabase = createClient(url, key)
