"""Real browser QA. Requires Python playwright and installed Chromium."""
import os, pathlib
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MARKET_URL','http://127.0.0.1:3000')
OUT=pathlib.Path('artifacts/screenshots')/os.environ.get('BROWSER_ENGINE','chromium');OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    engine=os.environ.get('BROWSER_ENGINE','chromium')
    browser=getattr(p,engine).launch(**({'executable_path':os.environ['CHROMIUM_PATH']} if engine=='chromium' and os.environ.get('CHROMIUM_PATH') else {}))
    errors=[]
    for w,h in [(320,568),(360,740),(375,667),(390,844),(430,932),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={'width':w,'height':h});page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:errors.append(f'HTTP {r.status} {r.url}') if r.status>=400 and r.url.startswith(BASE) else None)
        page.on('console',lambda m:errors.append(f'Console {m.text}') if m.type=='error' and m.location.get('url','').startswith(BASE) else None)
        # External SDKs are excluded from local UI QA, not simulated as connected.
        page.route('https://**/*',lambda route:route.abort())
        for asset,mime in [('/splash.webp','image/webp'),('/minion-logo.webp','image/webp'),('/banner-gift.webp','image/webp'),('/gram.svg','image/svg+xml'),('/fonts/manrope-cyrillic.woff2','font/woff2'),('/fonts/manrope-latin.woff2','font/woff2')]:
            response=page.request.get(BASE+asset)
            assert response.ok and response.headers['content-type']==mime, f'{asset}: {response.status} {response.headers}'
        assert '#30A1F5' in page.request.get(BASE+'/gram.svg').text()
        page.goto(BASE,wait_until='domcontentloaded');page.locator('.reference-banner').wait_for()
        page.locator('#splash').wait_for(state='detached')
        page.evaluate("async()=>{await document.fonts.ready;await document.fonts.load('600 16px Manrope Variable')}")
        assert page.evaluate("document.fonts.check('600 16px Manrope Variable')")
        page.wait_for_function("()=>['.reference-brand-logo','.banner-gift','.reference-balance .gram-icon'].every(s=>{const e=document.querySelector(s);return e?.complete&&e.naturalWidth>0})")
        assert page.locator('.reference-brand-logo').evaluate('(e)=>e.complete&&e.naturalWidth>0')
        assert page.locator('.banner-gift').evaluate('(e)=>e.complete&&e.naturalWidth>0')
        assert page.locator('.reference-balance .gram-icon').evaluate('(e)=>e.complete&&e.naturalWidth>0')
        assert page.locator('.reference-brand>span').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'), f'Brand clipped at {w}'
        overflow = page.evaluate("""() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('#app *')].filter(e => {const r=e.getBoundingClientRect();return r.right>innerWidth+1 && getComputedStyle(e).position!=='absolute'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.getAttribute('class'),right:e.getBoundingClientRect().right}))})""")
        banner = page.locator('.reference-banner').bounding_box()
        shell = page.locator('.reference-shell').bounding_box()
        assert banner['x'] >= shell['x'] and banner['x'] + banner['width'] <= shell['x'] + shell['width'] + 1, f'Banner exceeds shell at {w}: {banner}'
        assert overflow['scrollWidth'] <= w, f'Home horizontal overflow {w}: {overflow}'
        assert page.locator('.account-summary').count()==0
        assert page.locator('.storefront-grid .gift').count()>0
        assert page.locator('.home-actions button').count()==2
        assert page.locator('.reference-nav button').count()==4
        assert page.locator('.reference-nav span').evaluate_all('(els)=>els.every(e=>getComputedStyle(e).whiteSpace === "nowrap" && e.scrollWidth <= e.parentElement.clientWidth+1)')
        assert page.locator('.reference-shell').evaluate('(e)=>parseFloat(getComputedStyle(e).paddingBottom)>=90')
        page.screenshot(path=OUT/f'home-{w}.png',full_page=True)
        if w==390:
            page.locator('.home-actions [data-action="deposit-gift"]').click()
            page.locator('dialog[open] #gift-link').wait_for()
            assert page.get_by_role('dialog').get_attribute('aria-labelledby') == 'sheet-title'
            assert page.locator('dialog').evaluate('(e) => getComputedStyle(e).animationName') == 'minion-sheet-in'
            page.emulate_media(reduced_motion='reduce')
            assert page.locator('dialog').evaluate('(e) => getComputedStyle(e).animationName') == 'none'
            assert page.locator('.reference-nav button').first.evaluate('(e) => getComputedStyle(e).transitionDuration') == '0s'
            page.emulate_media(reduced_motion='no-preference')
            page.locator('dialog [data-action="close"]').click()
            page.locator('dialog').wait_for(state='hidden')
            for method in ['escape','backdrop','swipe']:
                page.locator('.home-actions [data-action="deposit-gift"]').click()
                page.locator('dialog[open]').wait_for()
                if method=='escape': page.keyboard.press('Escape')
                elif method=='backdrop': page.mouse.click(8,8)
                else:
                    handle=page.locator('.sheet-head').bounding_box()
                    page.mouse.move(handle['x']+handle['width']/2,handle['y']+20)
                    page.mouse.down();page.mouse.move(handle['x']+handle['width']/2,handle['y']+150,steps=6);page.mouse.up()
                page.locator('dialog').wait_for(state='hidden')
            page.locator('.reference-nav [data-id="sales"]').click()
            page.get_by_role('heading',name='Мои продажи').wait_for()
            assert page.get_by_role('navigation',name='Основная навигация').locator('[aria-current=page]').get_attribute('data-id') == 'sales'
            page.locator('.reference-nav [data-id="home"]').click()
        page.locator('.reference-shortcuts [data-id="market"]').click()
        page.locator('.gift').first.wait_for()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Horizontal overflow {w}'
        page.screenshot(path=OUT/f'market-{w}.png',full_page=True)
        if w==390:
            def click(action):page.locator(f'[data-action="{action}"]').first.click()
            def shot(name):
                # Capture the settled UI, not a translucent entrance-animation frame.
                page.wait_for_timeout(350)
                page.evaluate('scrollTo(0,0)')
                modal_open=page.locator('dialog[open]').count()>0
                page.screenshot(path=OUT/f'{name}-390.png',full_page=not modal_open)
                if page.locator('.reference-brand>span').count():
                    assert page.locator('.reference-brand>span').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            for action,name in [('filters','filters'),('detail','gift-details'),('buy','buy'),('sweep','sweep'),('cart','cart'),('wallet','wallet')]:
                click(action);page.locator('dialog[open]').wait_for();shot(name);click('close');page.locator('dialog').wait_for(state='hidden')
            for tab in ['collections','offers','bundles']:
                page.locator(f'.tabs [data-action="tab"][data-id="{tab}"]').click();shot(tab)
            for section in ['activity','inventory','giveaways','profile']:
                if section=='giveaways':
                    page.locator('.reference-nav [data-id="home"]').click()
                    page.locator('.reference-shortcuts [data-id="giveaways"]').click()
                elif section in ['inventory','profile']: page.locator(f'.reference-nav [data-id="{section}"]').click()
                else:
                    page.locator('.reference-nav [data-id="profile"]').click()
                    page.locator('.profile-stats [data-id="activity"]').click()
                page.locator(f'.page-{section}').wait_for();shot(section)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),section
                if section=='activity':
                    page.evaluate("""()=>{window.qaActivity=state.activity;state.activity=[{type:'sold',collection:'QA',number:1,created:Date.now(),price:'1000000000'},{type:'listed',collection:'QA',number:2,created:Date.now(),price:'1000000000'},{type:'sold',collection:'QA',number:3,created:Date.now()-10*86400000,price:'1000000000'}];render()}""")
                    assert page.locator('.activity-total').inner_text()=='1'
                    assert page.locator('.activity-day').count()==7
                    page.locator('[data-action="activity-filter"][data-id="sold"]').click()
                    assert page.locator('.activity-tabs + .panel .row').count()==2
                    page.evaluate("()=>{state.activity=window.qaActivity;state.activityFilter='all';render()}")
                if section=='inventory':
                    assert page.locator('.inventory-tabs').count()==1
                    assert page.get_by_text('Доступный баланс',exact=True).count()==0
                    assert page.locator('.reference-shortcuts').count()==0
                    # Boundary coverage for the supported private reference limit.
                    for count in [0,1,20,100]:
                        page.evaluate("""count=>{state.personalGifts=Array.from({length:count},(_,i)=>({slug:'Scale-'+(i+1),number:i+1,collection:'QA Scale',model:'Fixture',checkedAt:i+1,status:'observed',tradable:false}));state.inventoryFilter='telegram';state.inventoryQuery='';state.inventoryTraits={};state.inventoryLimit=24;state.inventoryView='grid';render()}""",count)
                        assert page.locator('.personal-inventory-card').count()==min(count,24)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                        page.screenshot(path=OUT/f'inventory-{count}-390.png')
                        for _ in range(max(0,(count-1)//24)):
                            page.locator('[data-action="inventory-more-items"]').click()
                        assert page.locator('.personal-inventory-card').count()==count
                        if count:
                            page.locator('[data-action="inventory-select-mode"]').click()
                            page.locator('[data-action="inventory-select-visible"]').click()
                            assert page.locator('#inventory-selection strong').inner_text()==f'Выбрано: {count}'
                            page.locator('#inventory-search').fill('no-match-qa')
                            assert page.locator('.personal-inventory-card').count()==0
                            assert page.locator('#inventory-selection strong').inner_text()==f'Выбрано: {count}'
                            page.locator('[data-action="inventory-select-mode"]').click()
                    page.evaluate("()=>{state.inventoryQuery='';state.inventoryLimit=24;render()}")
                    # Explicit test-only references, not production catalog.
                    page.evaluate("""()=>{state.personalGifts=Array.from({length:30},(_,i)=>({slug:'Fixture-'+(i+1),number:i+1,collection:'QA Gift',model:'Fixture model',backdrop:i%2?'Blue':'Gold',symbol:'Wolf',checkedAt:1,modelRarity:15,status:'observed',tradable:false}));state.inventoryFilter='telegram';render()}""")
                    assert page.locator('.personal-inventory-card').count()==24
                    page.locator('[data-action="inventory-more-items"]').click()
                    assert page.locator('.personal-inventory-card').count()==30
                    page.evaluate("()=>window.qaCard=document.querySelector('[data-inventory-key=Fixture-30]')")
                    page.locator('#inventory-search').fill('#30')
                    assert page.locator('.personal-inventory-card').count()==1
                    assert page.locator('#inventory-search').evaluate('(e)=>document.activeElement===e')
                    assert page.evaluate("()=>window.qaCard===document.querySelector('[data-inventory-key=Fixture-30]')")
                    page.locator('[data-action="inventory-traits"]').click()
                    page.locator('#inv-backdrop').select_option('Gold')
                    page.locator('[data-action="inventory-traits-apply"]').click()
                    assert page.locator('.personal-inventory-card').count()==0
                    page.locator('[data-action="inventory-reset"]').click()
                    page.locator('#inventory-search').fill('#30')
                    page.locator('[data-action="inventory-view"][data-id="list"]').click()
                    assert page.locator('.view-list .personal-inventory-card').count()==1
                    page.locator('.card-hit').click(position={'x':30,'y':30})
                    assert page.get_by_text('1,5%',exact=True).count()==1
                    assert page.locator('.personal-detail .personal-preview').count()==1
                    page.locator('dialog [data-action="personal-menu"]').click()
                    page.locator('dialog [data-action="personal-remove-confirm"]').click()
                    assert page.get_by_text('Убрать ссылку?',exact=True).count()==1
                    page.locator('dialog [data-action="close"]').click()
                    page.locator('[data-action="inventory-select-mode"]').click()
                    page.locator('.card-hit').click(position={'x':30,'y':30})
                    assert page.locator('.card-hit').get_attribute('aria-pressed')=='true'
                    assert page.locator('#inventory-selection strong').inner_text()=='Выбрано: 1'
                    page.locator('[data-action="inventory-batch-confirm"]').click()
                    assert page.get_by_text('Убрать выбранные ссылки?',exact=True).count()==1
                    page.locator('dialog [data-action="close"]').first.click()
                    page.locator('[data-action="inventory-select-mode"]').click()
                    assert page.locator('.card-hit').get_attribute('aria-pressed') is None
                    page.evaluate("()=>{state.personalGifts=[];state.inventoryQuery='';state.inventoryFilter='all';state.inventoryView='grid';render()}")

            page.goto(BASE+'/admin');page.get_by_text('Диагностика интеграций').wait_for();shot('admin')
        # Capture every primary screen at every supported viewport, not just 390px.
        if w!=390:
            for section in ['inventory','sales','activity','profile','giveaways']:
                page.locator('.reference-nav [data-id="home"]').click()
                if section=='giveaways': page.locator('.reference-shortcuts [data-id="giveaways"]').click()
                elif section=='activity':
                    page.locator('.reference-nav [data-id="profile"]').click()
                    page.locator('.profile-stats [data-id="activity"]').click()
                else: page.locator(f'.reference-nav [data-id="{section}"]').click()
                page.locator(f'.page-{section}').wait_for()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'{section} overflow at {w}'
                page.screenshot(path=OUT/f'{section}-{w}.png',full_page=True)
        page.close()
    browser.close();assert not errors,errors
print(engine+' UI checks passed')
