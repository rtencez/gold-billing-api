const assert=require('node:assert/strict');
async function verifyBrowser(url,login,invoice) {
  const {chromium}=require(process.env.SDJ_PLAYWRIGHT_MODULE || 'playwright');
  const alternate=process.env.SDJ_CHROME_PACKAGE ? require(process.env.SDJ_CHROME_PACKAGE).default : null;
  const browser=await chromium.launch({headless:true,executablePath:alternate?await alternate.executablePath():process.env.SDJ_CHROMIUM || undefined,args:alternate?alternate.args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:850}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.getByLabel(/company slug/i).fill(login.company);
    await page.getByLabel('Email',{exact:true}).fill(login.email);
    await page.getByLabel('Password',{exact:true}).fill(login.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Custom ornament orders'}).waitFor();
    await page.getByRole('button',{name:'New order'}).click();
    await page.getByRole('button',{name:'Add ornament'}).click();
    await page.getByLabel('Ornament name').fill('Browser test ring');
    await page.getByLabel('Gross weight (g)',{exact:true}).fill('10');
    await page.getByRole('button',{name:'Add stone'}).click();
    await page.getByLabel('Stone type').fill('Ruby');
    await page.getByLabel('Design / description').fill('Browser design');
    await page.getByLabel('Promised date').fill('2026-12-12');
    await page.getByLabel('Rate terms').fill('Fixed');
    await page.getByLabel('Customer',{exact:true}).click();
    await page.getByText('Sample customer',{exact:true}).last().click();
    await page.getByRole('button',{name:'Save document'}).click();
    await page.getByRole('button',{name:'Create quotation'}).waitFor({timeout:7000});
    await page.getByRole('button',{name:'Create quotation'}).click();
    await page.getByLabel('Valid until').fill('2026-12-12');
    await page.getByRole('button',{name:'Save document'}).click();
    await page.getByRole('button',{name:/QUOTE-\d+/}).last().waitFor({timeout:7000});
    await page.getByRole('menuitem',{name:'Scan documents'}).click();
    await page.getByLabel('Document ID or number').fill(invoice.number);
    await page.getByRole('button',{name:'Find',exact:true}).click();
    await page.getByRole('button',{name:'Open order timeline'}).waitFor({timeout:7000});
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    await page.locator('iframe[title^="Preview of"]').waitFor();
    await page.getByRole('button',{name:'Open order timeline'}).click();
    await page.getByText(/Karigar Karigar A/).waitFor();
    const checked=[];
    for(const width of [360,390,768,1024,1280,1440,1920,2560]){
      await page.setViewportSize({width,height:850});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Horizontal overflow at '+width);
      assert.ok(await page.getByRole('button',{name:'Back to orders'}).isVisible());
      checked.push(width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Open navigation'}).click();
    await page.getByRole('menuitem',{name:'Scan documents'}).last().click();
    await page.getByRole('heading',{name:'Scan or find document'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('Browser smoke test passed at widths '+checked.join(', '));
  } finally { await browser.close(); }
}
module.exports={verifyBrowser};
