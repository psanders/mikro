import { Command, Flags } from '@oclif/core';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { generateKeys } from '@mikro/common';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../../');

export default class GenerateKey extends Command {
  static description = 'Generate RSA key pair for signing receipts';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --keys-dir ./keys',
  ];

  static flags = {
    'keys-dir': Flags.string({
      description: 'Directory to save the key files',
    }),
  };

  async run() {
    const { flags } = await this.parse(GenerateKey);

    const keysDir = flags['keys-dir']
      ? resolve(flags['keys-dir'])
      : join(ROOT_DIR, 'keys');

    this.log('🔐 Mikro Key Generator');
    this.log('======================\n');

    try {
      // Check if keys already exist
      const privateKeyPath = join(keysDir, 'private.pem');
      const publicKeyPath = join(keysDir, 'public.pem');

      if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
        this.error(
          `Keys already exist in ${keysDir}.\n` +
          '   Delete them first if you want to generate new ones.\n' +
          `   Private key: ${privateKeyPath}\n` +
          `   Public key:  ${publicKeyPath}`,
          { exit: 1 }
        );
      }

      this.log('🔑 Generating RSA-2048 key pair...\n');

      const { privateKeyPath: generatedPrivatePath, publicKeyPath: generatedPublicPath } =
        generateKeys(keysDir);

      this.log('✅ Keys generated successfully!\n');
      this.log(`   Private key: ${generatedPrivatePath}`);
      this.log(`   Public key:  ${generatedPublicPath}`);
      this.log(
        '\n⚠️  Keep your private key secure! Do not commit it to version control.'
      );
      this.log('   Add "keys/" to your .gitignore file.\n');
    } catch (error) {
      this.error(error.message, { exit: 1 });
    }
  }
}
