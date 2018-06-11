const pm2 = require('pm2');
let isConnected = true;
pm2.connect((err)=>{
    if(err){
        isConnected = false;
        console.error('Failed to connect to pm2');
    }
});

function stopApp(options){
    return new Promise((resolve,reject)=>{
        pm2.stop(typeof options == 'string'?options:options.name,(err,s)=>{
            if(err){
                reject(err);
            }else{
                resolve(s);
            }
        });
    });
}

/**
 * Determines if an app is already running using pm2
 * 
 * @param {String} name Name of the app to look for
 * @param {Function} cb A callback function that takes a boolean value indicating whether or not an app is running
 */
function isAppRunning(name,cb){
    pm2.list((err,apps)=>{
        let appIsRunning = false;
        let requestedApp = apps.find(e=>e.name == name);
        if(requestedApp) {
            appIsRunning = true;
        }
        cb(appIsRunning);
    });
}

/**
 * Daemonize a new app 
 * @param  {String} options.script The script that will be daemonized 
 * @param {String} options.name The name of the app
 * @param {String} options.max_memory_restart The max memory size for an app before it restarts
 * @returns Promise 
 */
const daemonizeApp = (options)=>{
    return new Promise((res,rej)=>{
        let appName = options.name ;
        isAppRunning(appName,(running)=>{
            if(running){
                //Don't try to start an app if it is already running
                let e = new Error("App is already running");
                rej(e);
            }else{
                pm2.start(options,(err,proc)=>{
                    if(err){
                        rej(err);
                    }else{
                        res(proc);
                    }
                });
            }
        });
        
    });
};


module.exports = exports ={
    isConnected,
    daemonizeApp,
    pm2
};