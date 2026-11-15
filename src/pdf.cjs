const PDF = require('pdfkit');
const QR = require('qrcode');
const bwip = require('bwip-js');
const layouts = {detailed:'A4',standard:'A4',compact:'A5',thermal:[226.77,595.28]};

async function print(res, document, format, inline) {
  const barcode = await bwip.toBuffer({bcid:'code128',text:document.reference,scale:2,height:12});
  const qr = await QR.toBuffer(document.reference,{margin:4,errorCorrectionLevel:'M'});
  const thermal = format === 'thermal';
  const doc = new PDF({size:layouts[format],margin:thermal?14:32});
  const s = document.snapshot;
  res.set('Content-Type','application/pdf').set('Content-Disposition',(inline?'inline':'attachment')+'; filename='+document.number+'.pdf');
  doc.pipe(res);
  doc.fontSize(thermal?12:20).fillColor('#14284d').text(document.type.replaceAll('_',' ').toUpperCase());
  doc.fontSize(10).fillColor('black').text(s.branchName).text(document.number).text(new Date(document.created_at).toISOString());
  doc.moveDown(.5);
  const left=doc.x;
  const top=doc.y;
  const width=thermal?190:300;
  const height=width*barcode.readUInt32BE(20)/barcode.readUInt32BE(16);
  doc.image(barcode,left,top,{width});
  const qrTop=top+height+8;
  doc.image(qr,left,qrTop,{width:88});
  doc.y=qrTop+92;
  doc.fontSize(8).text(document.reference).moveDown().fontSize(10);
  for (const field of ['customerName','design','dueDate','validUntil','terms','method','reference','runningAdvance','remainingBalance']) {
    if (typeof s[field] === 'string') doc.text(field.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+s[field]);
  }
  for (const item of s.price?.items ?? []) {
    doc.moveDown(.5).font('Helvetica-Bold').text(item.name).font('Helvetica')
      .text(item.metal+' '+item.purity+' | Gross '+item.gross+' g | Net '+item.net+' g')
      .text('Stones '+item.stoneWeight+' g | Line INR '+item.taxable);
    if (format==='detailed') {
      doc.text('Metal '+item.metalValue+' | Making '+item.makingValue+' | Wastage '+item.wastage+' | Hallmarking '+item.hallmarking+' | Discount '+item.discount);
      for (const stone of item.stones) doc.text(stone.name+' · '+stone.pieces+' pcs · '+stone.weight+' '+stone.unit+' · INR '+stone.amount);
    }
  }
  if (s.price) {
    doc.moveDown().text('Subtotal INR '+s.price.subtotal);
    for (const tax of s.price.taxes) doc.text(tax.name+' · '+tax.value+(tax.mode==='percentage'?'%':' fixed')+' · base INR '+tax.base+' · INR '+tax.amount);
  }
  if (document.amount !== '0.00' || s.price) doc.font('Helvetica-Bold').text('Total INR '+document.amount).font('Helvetica');
  for (const advance of s.advances ?? []) doc.text(advance.number+' · INR '+advance.amount);
  if (s.balance !== undefined) doc.text('Balance INR '+s.balance);
  if (s.customerMaterials?.length) {
    doc.moveDown().font('Helvetica-Bold').text('Customer material reconciliation').font('Helvetica');
    for (const row of s.customerMaterials) doc.text(row.code+' · issued '+row.issued+' g · used '+row.used+' g · returned by karigar '+row.returned+' g · loss '+row.lost+' g');
  }
  if (s.rows) {
    for (const row of s.rows) {
      doc.moveDown(.5).text(row.code+' · '+row.owner);
      if (row.weight !== undefined) doc.text('Issued '+row.weight+' g · '+row.pieces+' pieces');
      if (row.used !== undefined) doc.text('Used '+row.used+' g · Returned '+row.returned+' g · Lost '+row.lost+' g');
    }
  }
  doc.end();
}
module.exports = {print,layouts};
