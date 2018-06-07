const mongoose = require('mongoose');
const path = require('path');
const {
    daemonizeApp,pm2
} = require('./scripts/pm2-functions');
mongoose.connect('mongodb://localhost/applist').catch(e => {
    console.error('Failed to connect to database');
});
const App = require('./scripts/models/App');
const {
    dialog
} = require('electron').remote;
const {
    ipcRenderer
} = require('electron');


const dialogs = require('dialogs')({
    hostname: 'App lister'
});


function createAppList(apps) {
    apps.forEach(app => {
        let {
            _id,
            name,
            location
        } = app;
        let markup = `
            <div class='row '>
                <div class='col-lg-12 col-md-12 col-sm-12'>
                    <div class='text-success bg-success mb-3'>
                        <div class='card app-card' data-id='${_id}'>
                            <div class='card-header'>${name}</div>
                            <div class='card-body'>

                                <div class='card-text'>
                                ${location}
                                    
                                </div>
                                <div class='btn btn-warning btn-secondary'>Edit</div>
                                <div class='btn btn-primary btn-start'>Start</div>
                                <div class='btn btn-warning btn-restart'>Restart</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>    
        `;
        $("#apps").append(markup);
    });
}


function addNewApp() {
    dialogs.prompt("Enter app name", "Foo", (name) => {
        if (name) {
            dialog.showOpenDialog({
                    title: 'Select app directory',
                    properties: ['openDirectory']
                },
                function (fileNames) {
                    if (!!fileNames[0]) {
                        dialogs.prompt("Set a port", "3000", (port) => {
                            if (port) {

                                let dir = fileNames[0];
                                let app = new App();
                                app.name = name;
                                app.location = dir;

                                app.port = parseInt(port);
                                App.addApp(app, (err, _) => {
                                    if (!err) {
                                        dialogs.alert("Success")
                                    } else {
                                        dialogs.alert('Failed to save new app');
                                    }
                                });
                            }
                        });

                    } else {
                        console.log('Failed')
                    }
                });
        }
    });
}

/**
 * Starts an app as a background process using pm2
 * @param {String} id The id of the app(as registerd to database)
 */
function startApp(id){
    App.findById(id, async (err, app) => {
        let packageFile = null;
        try {
            packageFile = require(`${app.location}/package.json`);
        } catch (e) {
            dialogs.alert("Folder doesn't contain a package.json file");
        } finally {
            if (packageFile && packageFile.main) {
                let dApp = null;
                let appFile = path.join(app.location, packageFile.main);
                try {
                    dApp = await daemonizeApp({
                        script: appFile,
                        name: app.name,
                        max_memory_restart: '10M',
                        env: {
                            "PORT": app.port
                        }
                    });
                    console.log(dApp)
                    //dApp is an array of objects
                    let pid = dApp[0].process.pid;
                    let query = {
                        _id:id
                    };
                    let update = {
                        $set:{
                            is_daemonized:true,
                            pid:pid
                        }
                    };
                    let options = {};
                    App.update(query,update,options,(err,data)=>{
                        if(err){
                            console.error(err)
                        }else{
                            console.log("Updated data")
                        }
                    });
                    dialogs.alert("App has been daemonized.Running on port " + app.port);
                } catch (e) {
                    dialogs.alert(e.toString());
                }

            }
        }
    });
}

function restartApp(id){
    return new Promise((res,rej)=>{
        App.getAppById(id,(err,proc)=>{
            if(err){
                rej(err);
            }else{
                
            }
        });
    }); 
}
function 
$(document).ready(() => {
    App.getApps((err, data) => {
        if (err) {
            dialogs.alert(err)
        } else {
            createAppList(data);
        }
    });
    $("#create-new-app").click(function (e) {
        createNewApp();
    });
    $("#apps").on("click", ".btn-start", function (e) {
        let id = $(this).parent().parent().data("id");
        startApp(id);
    }).on("click",".btn-stop",function(e){
        let id = $(this).parent().parent().data("id");
        stopApp(id);
    });
});