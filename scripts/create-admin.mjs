import fs from 'fs';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { Database, getPool } from '../src/lib/db.ts';

// ---------------------------------------------------------------------------
// 1. Load environment variables (.env / .env.local)
// ---------------------------------------------------------------------------
function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env.local'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // continue
      }
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// 2. Reliable Prompt Engine (Handles both Interactive TTY and Piped Streams)
// ---------------------------------------------------------------------------
function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY ?? false,
  });

  const bufferedLines = [];
  const waitingResolvers = [];
  let isClosed = false;

  rl.on('line', (line) => {
    if (waitingResolvers.length > 0) {
      const resolve = waitingResolvers.shift();
      resolve(line.trim());
    } else {
      bufferedLines.push(line.trim());
    }
  });

  rl.on('close', () => {
    isClosed = true;
    while (waitingResolvers.length > 0) {
      const resolve = waitingResolvers.shift();
      resolve('');
    }
  });

  return {
    ask(promptText) {
      process.stdout.write(promptText);
      if (bufferedLines.length > 0) {
        return Promise.resolve(bufferedLines.shift());
      }
      if (isClosed) {
        return Promise.resolve('');
      }
      return new Promise((resolve) => {
        waitingResolvers.push(resolve);
      });
    },
    close() {
      rl.close();
    },
  };
}

// Parse command line arguments if provided
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) {
      result.username = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[++i];
    } else if (args[i] === '--pin' && args[i + 1]) {
      result.pin = args[++i];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 3. Main script execution
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n====================================================');
  console.log(' Meeting Room Booking — PostgreSQL Admin Provisioner');
  console.log('====================================================\n');

  // Verify DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    console.error('❌ FATAL: DATABASE_URL is not set in environment or .env file.');
    console.error('   A valid PostgreSQL connection string is required.');
    console.error('   Example: DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/meeting_rooms');
    process.exit(1);
  }

  // Mask credentials for display
  const maskedUrl = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:******@');
  console.log(`Connecting to PostgreSQL database: ${maskedUrl}`);

  let dbMeta;
  try {
    dbMeta = await Database.testConnection();
    console.log(`✔ Connected to database "${dbMeta.database}" (${dbMeta.version.split(' ')[0]} ${dbMeta.version.split(' ')[1]})\n`);
  } catch (err) {
    console.error(`❌ FATAL: Failed to connect to PostgreSQL: ${err.message}`);
    process.exit(1);
  }

  const cliArgs = parseArgs();
  const prompter = createPrompter();

  try {
    // 1. Username
    let username = cliArgs.username;
    if (!username) {
      const input = await prompter.ask('Enter Admin Username [default: admin]: ');
      username = input || 'admin';
    }
    console.log(`Using username: "${username}"\n`);

    // 2. Password (Interactive, NO default, minimum 8 characters)
    let password = cliArgs.password;
    if (!password) {
      while (true) {
        const pass1 = await prompter.ask('Enter Admin Password (min 8 chars, required): ');
        if (!pass1) {
          console.log('\n⚠ Password cannot be empty. Please enter a valid password.');
          continue;
        }
        if (pass1.length < 8) {
          console.log(`\n⚠ Password too short (${pass1.length} chars). Minimum length is 8 characters.`);
          continue;
        }
        const pass2 = await prompter.ask('\nConfirm Admin Password: ');
        if (pass1 !== pass2) {
          console.log('\n⚠ Passwords do not match. Please try again.\n');
          continue;
        }
        password = pass1;
        break;
      }
    } else {
      if (password.length < 8) {
        console.error('❌ FATAL: Password provided via CLI must be at least 8 characters long.');
        process.exit(1);
      }
    }

    // 3. Quick-Unlock PIN (Interactive, NO default, 4 to 6 numeric digits)
    let pin = cliArgs.pin;
    if (!pin) {
      while (true) {
        const pin1 = await prompter.ask('\nEnter Quick-Unlock PIN (4 to 6 numeric digits, required): ');
        if (!/^\d{4,6}$/.test(pin1)) {
          console.log('\n⚠ Invalid PIN. Must be between 4 and 6 numeric digits (e.g., 5829).');
          continue;
        }
        const pin2 = await prompter.ask('\nConfirm Quick-Unlock PIN: ');
        if (pin1 !== pin2) {
          console.log('\n⚠ PINs do not match. Please try again.');
          continue;
        }
        pin = pin1;
        break;
      }
    } else {
      if (!/^\d{4,6}$/.test(pin)) {
        console.error('❌ FATAL: PIN provided via CLI must be between 4 and 6 numeric digits.');
        process.exit(1);
      }
    }

    console.log('\nEncrypting credentials with bcrypt (10 rounds)...');
    const passwordHash = bcrypt.hashSync(password, 10);
    const pinHash = bcrypt.hashSync(pin, 10);

    console.log(`Writing to PostgreSQL table "admin_user"...`);
    const adminRecord = await Database.createOrUpdateAdminUser(username, passwordHash, pinHash);

    // Audit log
    await Database.logAudit('ADMIN_PROVISIONED', username, '127.0.0.1', {
      source: 'scripts/create-admin.mjs',
      action: 'Interactive admin provisioning',
    });

    console.log('\n====================================================');
    console.log('✔ Admin account successfully stored in PostgreSQL!');
    console.log('====================================================');
    console.log(`  Table:        admin_user`);
    console.log(`  Database:     ${dbMeta.database}`);
    console.log(`  User ID:      ${adminRecord.id}`);
    console.log(`  Username:     ${adminRecord.username}`);
    console.log(`  Password:     [SET & SECURELY HASHED]`);
    console.log(`  PIN:          [SET & SECURELY HASHED]`);
    console.log(`  Account:      UNLOCKED (0 failed attempts)`);
    console.log(`  Created/Mod:  ${adminRecord.updated_at}`);
    console.log('====================================================\n');
  } finally {
    prompter.close();
    await getPool().end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ Unhandled Fatal Error:', err);
  process.exit(1);
});
