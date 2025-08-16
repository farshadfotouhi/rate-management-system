import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Create a test PDF contract
const doc = new PDFDocument();
const outputPath = path.join(__dirname, '../../../../test-contract.pdf');

doc.pipe(fs.createWriteStream(outputPath));

// Add content to PDF
doc.fontSize(16).text('FREIGHT RATE CONTRACT', { align: 'center' });
doc.moveDown();

doc.fontSize(12);
doc.text('Carrier: Maersk Line');
doc.text('Contract Period: January 1, 2024 - December 31, 2024');
doc.moveDown();

doc.fontSize(14).text('RATES FROM ASIA TO US WEST COAST:', { underline: true });
doc.moveDown();

doc.fontSize(11);
doc.text('Shanghai, China (CNSHA) to Los Angeles, USA (USLAX):');
doc.text('• 20ft Container: $2,500 USD', { indent: 20 });
doc.text('• 40ft Container: $3,800 USD', { indent: 20 });
doc.text('• 40ft HC Container: $4,200 USD', { indent: 20 });
doc.moveDown();

doc.text('Shanghai, China (CNSHA) to Oakland, USA (USOAK):');
doc.text('• 20ft Container: $2,600 USD', { indent: 20 });
doc.text('• 40ft Container: $3,900 USD', { indent: 20 });
doc.text('• 40ft HC Container: $4,300 USD', { indent: 20 });
doc.moveDown();

doc.text('Shenzhen, China (CNSZX) to Los Angeles, USA (USLAX):');
doc.text('• 20ft Container: $2,450 USD', { indent: 20 });
doc.text('• 40ft Container: $3,750 USD', { indent: 20 });
doc.text('• 40ft HC Container: $4,150 USD', { indent: 20 });
doc.moveDown();

doc.fontSize(14).text('RATES FROM ASIA TO US EAST COAST:', { underline: true });
doc.moveDown();

doc.fontSize(11);
doc.text('Shanghai, China (CNSHA) to New York, USA (USNYC):');
doc.text('• 20ft Container: $3,800 USD', { indent: 20 });
doc.text('• 40ft Container: $5,200 USD', { indent: 20 });
doc.text('• 40ft HC Container: $5,600 USD', { indent: 20 });
doc.moveDown();

doc.fontSize(12).text('Transit Times:', { underline: true });
doc.fontSize(11);
doc.text('• Asia to US West Coast: 14-18 days');
doc.text('• Asia to US East Coast: 28-32 days');
doc.moveDown();

doc.fontSize(12).text('Special Terms:', { underline: true });
doc.fontSize(11);
doc.text('• Fuel surcharge included');
doc.text('• Free detention: 5 days at destination');
doc.text('• Hazardous cargo: +25% surcharge');
doc.text('• Reefer containers: +$800 USD per container');
doc.moveDown();

doc.text('Minimum Volume Commitment: 500 TEU per month');

doc.end();

console.log(`✅ Test PDF contract created at: ${outputPath}`);