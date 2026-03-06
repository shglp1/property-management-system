import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    const { data, error } = await supabase.from('rental_payments').select('*').limit(1)
    if (error) {
        console.error('Error fetching rental_payments:', error.message)
    } else {
        console.log('rental_payments table EXISTS. Data:', data)
    }
}

checkSchema()
