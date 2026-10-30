const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',testMatch:'browser.spec.cjs',timeout:30000,fullyParallel:false,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173/S/',trace:'retain-on-failure'},
  webServer:{command:'node tests/server.cjs',url:'http://127.0.0.1:4173/S/',reuseExistingServer:!process.env.CI},
  projects:[
    {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}},
    {name:'iphone-chromium',use:{...devices['iPhone 13'],browserName:'chromium',defaultBrowserType:'chromium',launchOptions:process.env.PACER_CHROMIUM_PATH?{executablePath:process.env.PACER_CHROMIUM_PATH,args:['--no-sandbox']}:undefined}}
  ]
});
