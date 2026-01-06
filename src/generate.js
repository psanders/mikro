import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'output');
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const KEYS_DIR = join(ROOT_DIR, 'keys');

// Receipt dimensions (matching background.png)
const WIDTH = 1024;
const HEIGHT = 1536;

/**
 * Load loan data from loan JSON file
 */
function loadLoanData(loanPath) {
  // Resolve the path (handles both relative and absolute paths)
  const resolvedPath = resolve(loanPath);
  
  if (!existsSync(resolvedPath)) {
    console.error(`❌ Loan file not found: ${resolvedPath}`);
    console.error('   Please provide a valid path to a loan JSON file.\n');
    process.exit(1);
  }
  
  const content = readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load private key for signing
 */
function loadPrivateKey() {
  const keyPath = join(KEYS_DIR, 'private.pem');
  if (!existsSync(keyPath)) {
    console.error('❌ Private key not found!');
    console.error('   Run: npm run generate:key\n');
    process.exit(1);
  }
  
  return readFileSync(keyPath, 'utf-8');
}

/**
 * Create signed JWT from loan data
 */
function createSignedToken(loanData, privateKey) {
  const payload = {
    ...loanData,
    iat: Math.floor(Date.now() / 1000),
    iss: 'mikro',
  };
  
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1y', // Token valid for 1 year
  });
}

/**
 * Generate QR code as data URL
 */
async function generateQRCode(data) {
  const qrDataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'L', // Lower error correction = less dense QR
    margin: 2,
    width: 512, // Higher resolution for better scanning
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  
  return qrDataUrl;
}

/**
 * Load background image as base64 data URL
 */
function loadBackgroundImage() {
  const receiptBgPath = join(ASSETS_DIR, 'background.png');
  if (existsSync(receiptBgPath)) {
    const content = readFileSync(receiptBgPath);
    const base64 = content.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  
  const svgPath = join(ASSETS_DIR, 'background.svg');
  const pngPath = join(ASSETS_DIR, 'background.png');
  
  if (existsSync(svgPath)) {
    const svgContent = readFileSync(svgPath, 'utf-8');
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
  
  if (existsSync(pngPath)) {
    const pngContent = readFileSync(pngPath);
    const base64 = pngContent.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  
  return null;
}

/**
 * Load fonts for Satori
 */
async function loadFonts() {
  const fontUrl = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff';
  const fontUrlBold = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff';
  const fontUrlBlack = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff';
  
  const [regularRes, boldRes, blackRes] = await Promise.all([
    fetch(fontUrl),
    fetch(fontUrlBold),
    fetch(fontUrlBlack),
  ]);
  
  const [regular, bold, black] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    blackRes.arrayBuffer(),
  ]);
  
  return [
    { name: 'Inter', data: regular, weight: 400, style: 'normal' },
    { name: 'Inter', data: bold, weight: 700, style: 'normal' },
    { name: 'Inter', data: black, weight: 900, style: 'normal' },
  ];
}

/**
 * Create the full receipt layout
 */
function createReceiptLayout(data, qrCodeDataUrl, backgroundImage) {
  const {
    loanNumber = '123456',
    firstName = 'John',
    lastName = 'Doe',
    date = '24/04/2024',
    amountPaid = 'RD$ 650',
    pendingPayments = 9,
    paymentNumber = 'P1',
    agentName = 'Nombre del Agente',
  } = data;

  const fields = [
    ['Número de Préstamo:', loanNumber],
    ['Nombre:', firstName],
    ['Apellido:', lastName],
    ['Fecha:', date],
    ['Monto Pagado:', amountPaid],
    ['Pagos Pendientes:', String(pendingPayments)],
    ['Número de Pago:', paymentNumber],
    ['Agente:', agentName],
  ];

  const backgroundStyle = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: 'linear-gradient(180deg, #1565a8 0%, #2980b9 25%, #3498db 45%, #5dade2 65%, #48c9b0 80%, #d4a76a 90%, #e8c98a 100%)',
      };

  // QR Code element - either real QR or placeholder
  const qrCodeElement = qrCodeDataUrl
    ? {
        type: 'img',
        props: {
          src: qrCodeDataUrl,
          width: 220,
          height: 220,
          style: {
            borderRadius: '8px',
          },
        },
      }
    : {
        type: 'div',
        props: {
          style: {
            width: '220px',
            height: '220px',
            background: '#f5f5f5',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          children: {
            type: 'div',
            props: {
              style: {
                fontSize: '16px',
                color: '#aaaaaa',
                fontFamily: 'Inter',
              },
              children: 'QR CODE',
            },
          },
        },
      };

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...backgroundStyle,
      },
      children: [
        // Spacer for header area
        {
          type: 'div',
          props: {
            style: {
              height: '450px',
              display: 'flex',
            },
          },
        },

        // Card
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              paddingLeft: '45px',
              paddingRight: '45px',
            },
            children: {
              type: 'div',
              props: {
                style: {
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.75)',
                  borderRadius: '28px',
                  padding: '35px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  display: 'flex',
                  flexDirection: 'row',
                },
                children: [
                  // Left side - Fields
                  {
                    type: 'div',
                    props: {
                      style: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                      },
                      children: fields.map(([label, value]) => ({
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '12px',
                          },
                          children: [
                            {
                              type: 'div',
                              props: {
                                style: {
                                  fontSize: '36px',
                                  fontWeight: 700,
                                  fontFamily: 'Inter',
                                  color: '#1a5a96',
                                },
                                children: label,
                              },
                            },
                            {
                              type: 'div',
                              props: {
                                style: {
                                  fontSize: '36px',
                                  fontWeight: 400,
                                  fontFamily: 'Inter',
                                  color: '#333333',
                                },
                                children: value,
                              },
                            },
                          ],
                        },
                      })),
                    },
                  },
                  // Right side - QR Code
                  {
                    type: 'div',
                    props: {
                      style: {
                        width: '240px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                      },
                      children: qrCodeElement,
                    },
                  },
                ],
              },
            },
          },
        },

        // Spacer
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
            },
          },
        },
      ],
    },
  };
}

/**
 * Main generation function
 */
async function main() {
  console.log('🎨 Mikro Receipt Generator');
  console.log('==========================\n');
  
  // Get loan file path from command-line arguments
  const loanFilePath = process.argv[2];
  if (!loanFilePath) {
    console.error('❌ Error: Loan file path is required!');
    console.error('\n   Usage: node src/generate.js <path-to-loan.json>');
    console.error('   Example: node src/generate.js loans/10001.json\n');
    process.exit(1);
  }
  
  // Load loan data
  console.log('📄 Loading loan data...');
  const loanData = loadLoanData(loanFilePath);
  console.log(`✅ Loan data loaded from ${loanFilePath}\n`);
  console.log('   Loan #:', loanData.loanNumber);
  console.log('   Name:', loanData.firstName, loanData.lastName);
  console.log('   Amount:', loanData.amountPaid, '\n');
  
  // Load private key and create JWT
  console.log('🔐 Loading private key...');
  const privateKey = loadPrivateKey();
  console.log('✅ Private key loaded\n');
  
  console.log('📝 Creating signed JWT...');
  const token = createSignedToken(loanData, privateKey);
  console.log('✅ JWT created');
  console.log(`   Token length: ${token.length} characters\n`);
  
  // Save token to file for verification
  const tokenPath = join(OUTPUT_DIR, 'token.jwt');
  writeFileSync(tokenPath, token);
  console.log(`   Token saved: ${tokenPath}\n`);
  
  // Generate QR code
  console.log('📱 Generating QR code...');
  const qrCodeDataUrl = await generateQRCode(token);
  console.log('✅ QR code generated\n');
  
  // Load fonts
  console.log('📦 Loading fonts...');
  const fonts = await loadFonts();
  console.log('✅ Fonts loaded\n');
  
  // Load background
  console.log('🖼️  Loading background...');
  const backgroundImage = loadBackgroundImage();
  if (backgroundImage) {
    console.log('✅ Background loaded\n');
  } else {
    console.log('ℹ️  Using gradient fallback\n');
  }
  
  // Create layout
  console.log('🖼️  Creating receipt layout...');
  const layout = createReceiptLayout(loanData, qrCodeDataUrl, backgroundImage);
  
  // Generate SVG
  console.log('📝 Generating SVG...');
  const svg = await satori(layout, {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });
  
  const svgPath = join(OUTPUT_DIR, 'receipt.svg');
  writeFileSync(svgPath, svg);
  console.log(`✅ SVG saved: ${svgPath}\n`);
  
  // Convert to PNG
  console.log('🖼️  Converting to PNG...');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH * 2 },
  });
  const png = resvg.render().asPng();
  const pngPath = join(OUTPUT_DIR, 'receipt.png');
  writeFileSync(pngPath, png);
  console.log(`✅ PNG saved: ${pngPath}\n`);
  
  console.log('🎉 Done! Check the output folder for your receipt.');
  console.log('\n📋 Generated files:');
  console.log(`   - ${pngPath}`);
  console.log(`   - ${svgPath}`);
  console.log(`   - ${tokenPath}`);
}

main().catch(console.error);
