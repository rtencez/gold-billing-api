const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader,Code128Reader}=require('@zxing/library');

const directory=process.argv[2];
if(!directory) throw new Error('Pass the path to the SDJ_PDF_OUTPUT fixture directory');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'sdj-pdf-'));
const results=[];
try{
 for(const file of fs.readdirSync(directory).filter(file=>file.endsWith('.pdf')).sort()){
  const uuid=file.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/)[0];
  const prefix=path.join(output,'page');
  execFileSync('pdftoppm',['-r','300','-f','1','-l','1','-singlefile','-gray',path.join(directory,file),prefix]);
  const pgm=fs.readFileSync(prefix+'.pgm');
  const header=pgm.toString('ascii',0,60).match(/^P5\s+(\d+)\s+(\d+)\s+255\n/);
  const [width,height]=header.slice(1).map(Number);
  const source=new RGBLuminanceSource(Uint8ClampedArray.from(pgm.subarray(header[0].length)),width,height);
  const barcode=new BinaryBitmap(new HybridBinarizer(source.crop(0,0,width,Math.round(166*300/72))));
  const px=point=>Math.round(point*300/72);
  const qr=new BinaryBitmap(new HybridBinarizer(source.crop(0,px(file.includes('-thermal-')?68:92),px(132),px(166))));
  assert.equal(new Code128Reader().decode(barcode).getText(),uuid,file+' barcode');
  assert.equal(new QRCodeReader().decode(qr).getText(),uuid,file+' QR');
  results.push(file.split('-').slice(0,2).join(' '));
 }
 assert.ok(results.length,'No PDF samples found');
 console.log('Decoded both codes on '+results.length+' rendered first pages: '+results.join(', '));
}finally{fs.rmSync(output,{recursive:true,force:true});}
