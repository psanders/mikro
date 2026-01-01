import { generateKeyPairSync } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, '..', 'keys');

/**
 * Generate RSA key pair for signing JWTs
 */
function generateKeys() {
  console.log('🔐 Mikro Key Generator');
  console.log('======================\n');

  // Create keys directory if it doesn't exist
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
    console.log('📁 Created keys/ directory\n');
  }

  const privateKeyPath = join(KEYS_DIR, 'private.pem');
  const publicKeyPath = join(KEYS_DIR, 'public.pem');

  // Check if keys already exist
  if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
    console.log('⚠️  Keys already exist in keys/ directory.');
    console.log('   Delete them first if you want to generate new ones.\n');
    console.log(`   Private key: ${privateKeyPath}`);
    console.log(`   Public key:  ${publicKeyPath}`);
    process.exit(1);
  }

  console.log('🔑 Generating RSA-2048 key pair...\n');

  // Generate RSA key pair
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Save keys to files
  writeFileSync(privateKeyPath, privateKey);
  writeFileSync(publicKeyPath, publicKey);

  console.log('✅ Keys generated successfully!\n');
  console.log(`   Private key: ${privateKeyPath}`);
  console.log(`   Public key:  ${publicKeyPath}`);
  console.log('\n⚠️  Keep your private key secure! Do not commit it to version control.');
  console.log('   Add "keys/" to your .gitignore file.\n');
}

generateKeys();
