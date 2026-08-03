import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedDatabase } from './db/seed';
import { supabaseConfigurationError } from './lib/supabase';

if (supabaseConfigurationError) {
  console.info('[Configuration] ' + supabaseConfigurationError.message)
}

// Render immediately — don't block on seeding
const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Seed demo data in background (non-blocking)
seedDatabase().catch((err) => {
  console.warn('Seed failed (may already be seeded):', err)
})
