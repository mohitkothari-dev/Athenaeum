#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks that environment variables are properly configured
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying Athenaeum Setup...\n');

let hasErrors = false;
let hasWarnings = false;

// Check .env file
console.log('📄 Checking .env file...');
const envPath = join(rootDir, '.env');

if (!existsSync(envPath)) {
  console.error('  ❌ .env file not found!');
  console.error('     Create one by copying .env.example:');
  console.error('     cp .env.example .env\n');
  hasErrors = true;
} else {
  const envContent = readFileSync(envPath, 'utf-8');
  
  // Check required VITE_ variables
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  requiredVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    if (!regex.test(envContent)) {
      console.error(`  ❌ Missing ${varName}`);
      hasErrors = true;
    } else {
      // Check if it's still the placeholder value
      if (envContent.includes(`${varName}="your_`) || envContent.includes(`${varName}=your_`)) {
        console.warn(`  ⚠️  ${varName} still has placeholder value`);
        hasWarnings = true;
      } else {
        console.log(`  ✅ ${varName} is set`);
      }
    }
  });
  
  // Security check: Warn if sensitive keys are in .env
  const sensitiveKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  sensitiveKeys.forEach(key => {
    // Check both VITE_ prefixed and non-prefixed versions
    const patterns = [
      new RegExp(`^${key}=.+`, 'm'),
      new RegExp(`^VITE_${key}=.+`, 'm')
    ];
    patterns.forEach(pattern => {
      if (pattern.test(envContent)) {
        console.warn(`  ⚠️  Found ${key} in .env file!`);
        console.warn(`     This should be in Supabase secrets, not frontend .env`);
        console.warn(`     Run: supabase secrets set ${key}=your_key`);
        hasWarnings = true;
      }
    });
  });
  
  console.log();
}

// Check Supabase secrets setup
console.log('🔐 Checking Supabase Edge Function secrets...');
console.log('  ℹ️  Run the following commands to set up edge function secrets:\n');
console.log('     supabase login');
console.log('     supabase link --project-ref YOUR_PROJECT_REF');
console.log('     supabase secrets set GEMINI_API_KEY=your_actual_key');
console.log('     supabase secrets list  # to verify\n');
console.log('  📚 See supabase/functions/README.md for detailed instructions\n');

// Check if Supabase CLI is installed
console.log('🛠️  Checking Supabase CLI...');
try {
  const { execSync } = await import('child_process');
  const version = execSync('supabase --version', { encoding: 'utf-8' }).trim();
  console.log(`  ✅ Supabase CLI installed: ${version}\n`);
} catch (error) {
  console.warn('  ⚠️  Supabase CLI not found or not in PATH');
  console.warn('     Install from: https://supabase.com/docs/guides/cli\n');
  hasWarnings = true;
}

// Summary
console.log('═══════════════════════════════════════════════════════');
if (hasErrors) {
  console.error('❌ Setup incomplete - please fix the errors above');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('⚠️  Setup has warnings - review the messages above');
  process.exit(0);
} else {
  console.log('✅ Frontend environment setup looks good!');
  console.log('   Remember to configure edge function secrets via Supabase CLI');
  process.exit(0);
}
