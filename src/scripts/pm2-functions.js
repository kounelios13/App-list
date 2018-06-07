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
        pm2.stop(options.name,(err,s)=>{
            if(err){
                reject(err);
            }
        });
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
        pm2.start(options,(err,proc)=>{
            if(err){
                rej(err);
            }else{
                res(proc);
            }
        });
    });
};
module.exports = exports ={
    isConnected,
    daemonizeApp,
    pm2
};