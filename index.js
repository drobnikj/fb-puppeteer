const Apify = require('apify')
const ApifyClient = require('apify-client')
const path = require('path')
const fs = require('fs')
const jsonfile = require('jsonfile')
const Promise = require('bluebird');
const {token} = require('./credentials')

apifyClient = new ApifyClient({
    token
})

// utility function to insert code in puppeteer
const injectFile = async (page, filePath) => {
    const contents = await new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    });

    return page.evaluate(contents);
};

const humanDelay = async (time) => new Promise(resolve=>setTimeout(resolve,time*(1+Math.random())))

Apify.main(async () => {
      
    const browser = await Apify.launchPuppeteer({ args: ['--no-sandbox', '--disable-web-security'], }); // Must run in SANDBOX!!!
    const page = await browser.newPage();
    await page.goto('https://facebook.com');
    
    // LOGIN
    await page.evaluate(async()=>{
        document.getElementById('email').value = 'lukas@apify.com'
        document.getElementById('pass').value = 'scraper1'
        
    })

    await humanDelay(2000)

    await page.click('#loginbutton input')

    await humanDelay(10000)

    // We redirect to desired page
    await page.goto('https://www.facebook.com/AcornsGrow/?brand_redir=325174677683004');

    await humanDelay(5000)
    
    // scrolling down with delay
    await page.evaluate(async()=>{    
        window.scrollBy(0, 10000);
        await new Promise(resolve=>setTimeout(resolve,2000*(1+Math.random())))
    })

    
    for(let i =0; i<3;i++){
        await page.evaluate(async()=>{    
            window.scrollBy(0, 10000);
        })
        await humanDelay(5000)
    }
    
    const injectJQueryScript = async (page) => {
        const jQueryPath = path.resolve(path.join(__dirname, './node_modules/jquery/dist/jquery.js'));
        await injectFile(page, jQueryPath);
        await page.evaluate(() => {
            console.log('Injecting jQuery');
            window.APIFY_CONTEXT = window.APIFY_CONTEXT || {};
            window.APIFY_CONTEXT.jQuery = jQuery.noConflict(true);
        });
    };
    // injecting jquery
    await injectJQueryScript(page)

    await humanDelay(3000)

    // getting selectors for clicking on more comments
    const selectors = await page.evaluate(async()=>{
        // assigning jQuery
        const $ = window.APIFY_CONTEXT.jQuery;

        const findUniqueSelector = (item, parentSelector = '') => {
            let uniqueSelector = '';
            const pSelector = parentSelector ? `${parentSelector} > ` : '';
            if (item.attr('id')) {
                uniqueSelector = `${pSelector}${item.get(0).tagName}[id='${item.attr('id')}']`;
                return uniqueSelector;
            }
            let localSelector = '';
            let classes = item.attr('class') || null;
            if (classes) {
                classes = classes.split(' ').filter(stepClass => stepClass.trim() !== '');
                classes.forEach((stepClass) => {
                    if (uniqueSelector) return;
                    localSelector = `${pSelector}${item.get(0).tagName}${stepClass ? `.${stepClass}` : ''}`;
                    console.log('localSelector', localSelector);
                    if ($(localSelector).length === 1) {
                        uniqueSelector = localSelector;
                    }
                });
                if (uniqueSelector) return uniqueSelector;
                const joinedClasses = classes.join('.');
                localSelector = `${pSelector}${item.get(0).tagName}${joinedClasses ? `.${joinedClasses}` : ''}`;
                if ($(localSelector).length === 1) return localSelector;
            }
            return false;
        };
        
        function createFullSelector(item) {
            const completePath = item.parentsUntil('body');
            const pathTillUnique = [];
            let foundUnique = false;
            completePath.each(function () {
                if (foundUnique) return;
                const step = $(this);
                pathTillUnique.push(step);
                foundUnique = findUniqueSelector(step);
            }, []);
            pathTillUnique.unshift(item);
            const path = pathTillUnique.reverse().reduce((partialPath, step, index) => {
                if (index === 0 && foundUnique) {
                    return foundUnique;
                } else if (index === 0) {
                    return step.get(0).tagName;
                }
                const uniquePath = findUniqueSelector(step, partialPath);
                if (uniquePath) return uniquePath;
                return `${partialPath} > ${step.get(0).tagName}`;
            }, '');
            return path;
        }
        const posts = $('.userContentWrapper');
        const selectors = [];
        posts.each(function (elem) {
            $(this).find('.UFIPagerLink').each(function() {
                selectors.push(createFullSelector($(this)));
            });
        });
        return selectors;
    });

    // clicking on selectors for more comments
    await Promise.mapSeries(selectors, async (selector) => {
        try{await page.click(selector);}
        catch(e){console.log(e)}
        
        await humanDelay(3000);
    });
    
    // TODO: this is duplicate, refactor
    // this for selector on truncated comments
    const selectorsTruncComment = await page.evaluate(async()=>{
        const $ = window.APIFY_CONTEXT.jQuery;

        const findUniqueSelector = (item, parentSelector = '') => {
            let uniqueSelector = '';
            const pSelector = parentSelector ? `${parentSelector} > ` : '';
            if (item.attr('id')) {
                uniqueSelector = `${pSelector}${item.get(0).tagName}[id='${item.attr('id')}']`;
                return uniqueSelector;
            }
            let localSelector = '';
            let classes = item.attr('class') || null;
            if (classes) {
                classes = classes.split(' ').filter(stepClass => stepClass.trim() !== '');
                classes.forEach((stepClass) => {
                    if (uniqueSelector) return;
                    localSelector = `${pSelector}${item.get(0).tagName}${stepClass ? `.${stepClass}` : ''}`;
                    console.log('localSelector', localSelector);
                    if ($(localSelector).length === 1) {
                        uniqueSelector = localSelector;
                    }
                });
                if (uniqueSelector) return uniqueSelector;
                const joinedClasses = classes.join('.');
                localSelector = `${pSelector}${item.get(0).tagName}${joinedClasses ? `.${joinedClasses}` : ''}`;
                if ($(localSelector).length === 1) return localSelector;
            }
            return false;
        };
        
        function createFullSelector(item) {
            const completePath = item.parentsUntil('body');
            const pathTillUnique = [];
            let foundUnique = false;
            completePath.each(function () {
                if (foundUnique) return;
                const step = $(this);
                pathTillUnique.push(step);
                foundUnique = findUniqueSelector(step);
            }, []);
            pathTillUnique.unshift(item);
            const path = pathTillUnique.reverse().reduce((partialPath, step, index) => {
                if (index === 0 && foundUnique) {
                    return foundUnique;
                } else if (index === 0) {
                    return step.get(0).tagName;
                }
                const uniquePath = findUniqueSelector(step, partialPath);
                if (uniquePath) return uniquePath;
                return `${partialPath} > ${step.get(0).tagName}`;
            }, '');
            return path;
        }
        const posts = $('.userContentWrapper');
        const selectors = [];
        posts.each(function (elem) {
            $(this).find('.fss').each(function() {
                selectors.push(createFullSelector($(this)));
            });
        });
        return selectors;
    });
    
    // clicking on selector for truncated comments
    console.log(selectorsTruncComment);
    await Promise.mapSeries(selectorsTruncComment, async (selector) => {
        try{await page.click(selector);}
        catch(e){console.log(e)}
        await humanDelay(3000);
    });

    // we have the page ready to scrape
    const result = await page.evaluate(async()=>{

        const $ = window.APIFY_CONTEXT.jQuery;
        let state = {
            users: {},
            posts: {}
        }
        $('.userContentWrapper').each(function(i){
            state.posts[i] = $(this).find('.userContent').text()   

            $(this).find('.UFICommentActorAndBody').each(function(){
                const author = $(this).find('.UFICommentActorName').text()
                const text = $(this).find('.UFICommentBody').text()
                
                if(!state[author]) {
                    state[author] = {
                        comments:[],
                        emoticons:{}
                    }
                } 
                state[author].comments.push({
                    post: i.toString(),
                    text
                })      
            })
        })

        console.log(state)
        return new Promise(resolve => resolve(state))
    })

    // saving to kv store
    await apifyClient.keyValueStores.putRecord({
        body: JSON.stringify(result),
        key: 'fb-test',
        storeId: 'KPNXNq9iR5FrG4zCy'
    })

    await humanDelay(5000)
    await browser.close();
    
  });