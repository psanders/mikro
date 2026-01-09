import { Command, Args, Flags } from '@oclif/core';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
  loadLoanData,
  loadPrivateKey,
  createSignedToken,
  generateQRCode,
  loadFonts,
  loadBackgroundImage,
  createReceiptLayout,
  RECEIPT_WIDTH,
  RECEIPT_HEIGHT,
  type ReceiptData,
} from '@mikro/common';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../../');

export default class GenerateReceipt extends Command {
  static description = 'Generate a payment receipt as an image';

  static examples = [
    '<%= config.bin %> <%= command.id %> loans/10001.json',
    '<%= config.bin %> <%= command.id %> loans/10001.json --output ./receipts',
    '<%= config.bin %> <%= command.id %> loans/10001.json --keys-dir ./keys --assets-dir ./assets',
  ];

  static flags = {
    output: Flags.string({
      char: 'o',
      description: 'Output directory for generated files',
    }),
    'keys-dir': Flags.string({
      description: 'Directory containing private.pem key file',
    }),
    'assets-dir': Flags.string({
      description: 'Directory containing background.png asset',
    }),
  };

  static args = {
    loanFile: Args.string({
      description: 'Path to the loan JSON file',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GenerateReceipt);

    const outputDir = flags.output 
      ? resolve(flags.output)
      : join(ROOT_DIR, 'output');
    
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const keysDir = flags['keys-dir']
      ? resolve(flags['keys-dir'])
      : join(ROOT_DIR, 'keys');
    
    const assetsDir = flags['assets-dir']
      ? resolve(flags['assets-dir'])
      : join(ROOT_DIR, 'assets');

    this.log('🎨 Mikro Receipt Generator');
    this.log('==========================\n');

    try {
      // Load loan data
      this.log('📄 Loading loan data...');
      // Resolve loan file path: if relative, try from project root first, then cwd
      let loanFilePath = args.loanFile;
      if (!isAbsolute(loanFilePath)) {
        // Try resolving relative to project root first
        const rootPath = resolve(ROOT_DIR, loanFilePath);
        if (existsSync(rootPath)) {
          loanFilePath = rootPath;
        } else {
          // Fall back to resolving relative to current working directory
          loanFilePath = resolve(loanFilePath);
        }
      }
      const loanData = loadLoanData(loanFilePath);
      this.log(`✅ Loan data loaded from ${loanFilePath}\n`);
      this.log('   Loan #:', loanData.loanNumber);
      this.log('   Name:', loanData.firstName, loanData.lastName);
      this.log('   Amount:', loanData.amountPaid, '\n');

      // Load private key and create JWT
      this.log('🔐 Loading private key...');
      const privateKey = loadPrivateKey(keysDir);
      this.log('✅ Private key loaded\n');

      this.log('📝 Creating signed JWT...');
      const token = createSignedToken(loanData as Parameters<typeof createSignedToken>[0], privateKey);
      this.log('✅ JWT created');
      this.log(`   Token length: ${token.length} characters\n`);

      // Save token to file for verification
      const tokenPath = join(outputDir, 'token.jwt');
      writeFileSync(tokenPath, token);
      this.log(`   Token saved: ${tokenPath}\n`);

      // Generate QR code
      this.log('📱 Generating QR code...');
      const qrCodeDataUrl = await generateQRCode(token);
      this.log('✅ QR code generated\n');

      // Load fonts
      this.log('📦 Loading fonts...');
      const fonts = await loadFonts();
      this.log('✅ Fonts loaded\n');

      // Load background
      this.log('🖼️  Loading background...');
      const backgroundImage = loadBackgroundImage(assetsDir);
      if (backgroundImage) {
        this.log('✅ Background loaded\n');
      } else {
        this.log('ℹ️  Using gradient fallback\n');
      }

      // Create layout
      this.log('🖼️  Creating receipt layout...');
      const layout = createReceiptLayout(loanData, qrCodeDataUrl, backgroundImage);

      // Generate SVG
      this.log('📝 Generating SVG...');
      const svg = await satori(layout, {
        width: RECEIPT_WIDTH,
        height: RECEIPT_HEIGHT,
        fonts: fonts as Parameters<typeof satori>[1]['fonts'],
      });

      const svgPath = join(outputDir, 'receipt.svg');
      writeFileSync(svgPath, svg);
      this.log(`✅ SVG saved: ${svgPath}\n`);

      // Convert to PNG
      this.log('🖼️  Converting to PNG...');
      const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: RECEIPT_WIDTH * 2 },
      });
      const png = resvg.render().asPng();
      const pngPath = join(outputDir, 'receipt.png');
      writeFileSync(pngPath, png);
      this.log(`✅ PNG saved: ${pngPath}\n`);

      this.log('🎉 Done! Check the output folder for your receipt.');
      this.log('\n📋 Generated files:');
      this.log(`   - ${pngPath}`);
      this.log(`   - ${svgPath}`);
      this.log(`   - ${tokenPath}`);
    } catch (error) {
      const err = error as Error;
      this.error(err.message, { exit: 1 });
    }
  }
}
