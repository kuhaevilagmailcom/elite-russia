"""Real browser QA. Requires Python playwright and installed Chromium."""
import os, pathlib
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MARKET_URL','http://127.0.0.1:3000')
OUT=pathlib.Path('artifacts/screenshots');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
    errors=[]
    for w,h in [(320,568),(375,667),(390,844),(430,932),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h});page.on('pageerror',lambda e:errors.append(str(e)))
        # External SDKs are excluded from local UI QA, not simulated as connected.
        page.route('https://**/*',lambda route:route.abort())
        page.goto(BASE,wait_until='domcontentloaded');page.locator('.reference-banner').wait_for()
        overflow = page.evaluate("""() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('#app *')].filter(e => {const r=e.getBoundingClientRect();return r.right>innerWidth+1 && getComputedStyle(e).position!=='absolute'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.getAttribute('class'),right:e.getBoundingClientRect().right}))})""")
        banner = page.locator('.reference-banner').bounding_box()
        shell = page.locator('.reference-shell').bounding_box()
        assert banner['x'] >= shell['x'] and banner['x'] + banner['width'] <= shell['x'] + shell['width'] + 1, f'Banner exceeds shell at {w}: {banner}'
        assert overflow['scrollWidth'] <= w, f'Home horizontal overflow {w}: {overflow}'
        assert page.locator('.account-summary').count()==1
        assert page.locator('.home-actions button').count()==2
        page.screenshot(path=OUT/f'home-{w}.png',full_page=True)
        if w==390:
            page.locator('.home-actions [data-action="deposit-gift"]').click()
            page.locator('dialog[open] #gift-link').wait_for()
            page.locator('dialog [data-action="close"]').click()
            page.locator('.reference-nav [data-id="sales"]').click()
            page.get_by_role('heading',name='Мои продажи').wait_for()
        page.locator('.reference-shortcuts [data-id="market"]').click()
        page.locator('.gift').first.wait_for()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Horizontal overflow {w}'
        page.screenshot(path=OUT/f'market-{w}.png',full_page=True)
        if w==390:
            def click(action):page.locator(f'[data-action="{action}"]').first.click()
            def shot(name):page.screenshot(path=OUT/f'{name}-390.png')
            for action,name in [('filters','filters'),('detail','gift-details'),('buy','buy'),('sweep','sweep'),('cart','cart'),('wallet','wallet')]:
                click(action);page.locator('dialog[open]').wait_for();shot(name);click('close')
            for tab in ['collections','offers','bundles']:
                page.locator(f'.tabs [data-action="tab"][data-id="{tab}"]').click();shot(tab)
            for section in ['activity','inventory','giveaways','profile']:
                page.locator(f'[data-action="nav"][data-id="{section}"]').first.click();shot(section)
            page.goto(BASE+'/admin');page.get_by_text('Диагностика интеграций').wait_for();shot('admin')
        page.close()
    browser.close();assert not errors,errors
print('Chromium UI checks passed')
