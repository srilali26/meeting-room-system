import bcrypt from 'bcryptjs';
import { Database } from '../src/lib/db.ts';

async function main() {
  console.log('====================================================');
  console.log('Meeting Room Booking — Admin Password Reset');
  console.log('====================================================\n');

  const args = process.argv.slice(2);
  const newPassword = args[0] || 'admin123';
  const newPin = args[1] || '1234';

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const pinHash = bcrypt.hashSync(newPin, 10);

  await Database.updateAdminPassword(passwordHash);
  await Database.updateAdminPin(pinHash);
  await Database.resetFailedLogin();

  await Database.logAudit('ADMIN_PASSWORD_RESET_CLI', 'it_admin', '127.0.0.1', {
    method: 'CLI script reset-admin.mjs',
  });

  console.log('✔ Admin account has been reset and unlocked:');
  console.log('  Username: admin');
  console.log(`  New Password: ${newPassword}`);
  console.log(`  New Quick-Unlock PIN: ${newPin}`);
  console.log('\nAccount lock status: UNLOCKED');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Failed to reset admin:', err);
  process.exit(1);
});
