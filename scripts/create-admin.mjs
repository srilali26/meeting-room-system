import bcrypt from 'bcryptjs';
import { Database } from '../src/lib/db.ts';

async function main() {
  console.log('====================================================');
  console.log('Meeting Room Booking — Admin Account Initializer');
  console.log('====================================================\n');

  const args = process.argv.slice(2);
  const password = args[0] || 'admin123';
  const pin = args[1] || '1234';

  const passwordHash = bcrypt.hashSync(password, 10);
  const pinHash = bcrypt.hashSync(pin, 10);

  await Database.updateAdminPassword(passwordHash);
  await Database.updateAdminPin(pinHash);
  await Database.resetFailedLogin();

  console.log('✔ Admin user account successfully created/updated:');
  console.log('  Username: admin');
  console.log(`  Password: ${password}`);
  console.log(`  Quick-Unlock PIN: ${pin}`);
  console.log('\nYou can now sign in at http://192.168.50.143/admin');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
