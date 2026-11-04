import fs from 'fs';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { Database, getPool } from '../src/lib/db.ts';

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

async function main() {
  console.log('\n====================================================');
  console.log(' Meeting Room Booking — PostgreSQL Admin Reset');
  console.log('====================================================\n');

  const dbMeta = await Database.testConnection();
  console.log(`✔ Connected to database "${dbMeta.database}"\n`);

  const cliArgs = parseArgs();
  const prompter = createPrompter();

  try {
    let username = cliArgs.username;
    if (!username) {
      const input = await prompter.ask('Enter Admin Username to reset [default: admin]: ');
      username = input || 'admin';
    }

    let password = cliArgs.password;
    if (!password) {
      while (true) {
        const pass1 = await prompter.ask('Enter New Admin Password (min 8 chars, required): ');
        if (!pass1 || pass1.length < 8) {
          console.log('\n⚠ Password must be at least 8 characters.');
          continue;
        }
        const pass2 = await prompter.ask('\nConfirm New Admin Password: ');
        if (pass1 !== pass2) {
          console.log('\n⚠ Passwords do not match.');
          continue;
        }
        password = pass1;
        break;
      }
    }

    let pin = cliArgs.pin;
    if (!pin) {
      while (true) {
        const pin1 = await prompter.ask('\nEnter New Quick-Unlock PIN (4 to 6 digits, required): ');
        if (!/^\d{4,6}$/.test(pin1)) {
          console.log('\n⚠ Invalid PIN. Must be 4 to 6 digits.');
          continue;
        }
        const pin2 = await prompter.ask('\nConfirm New Quick-Unlock PIN: ');
        if (pin1 !== pin2) {
          console.log('\n⚠ PINs do not match.');
          continue;
        }
        pin = pin1;
        break;
      }
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const pinHash = bcrypt.hashSync(pin, 10);

    const user = await Database.createOrUpdateAdminUser(username, passwordHash, pinHash);
    await Database.logAudit('ADMIN_PASSWORD_RESET', username, '127.0.0.1', {
      source: 'scripts/reset-admin.mjs',
    });

    console.log('\n✔ Admin account has been reset and unlocked in PostgreSQL:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Status:   UNLOCKED`);
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
