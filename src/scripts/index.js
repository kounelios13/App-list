const mongoose = require('mongoose');
const pm2 = require('pm2');
const path = require('path');
pm2.connect((err, _) => {
    if (err) {
        console.log('error', err)
    } else {
        console.log('Connected to pm2 daemon')
    }
});
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
    hostname: 'mkcodergr'
});

function daemonizeApp(options){
    return new Promise((resolve,reject)=>{
        pm2.start(options,(err,apps)=>{
            if(err){
                reject(err)
            }else{
                resolve(apps)
            }
        });
    });
    
}

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
                                <div class='btn btn-warning btn-edit'>Edit</div>
                                <div class='btn btn-primary btn-start'>Start</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>    
        `;
        $("#apps").append(markup);
    });
}

$(document).ready(() => {
    App.getApps((err, data) => {
        if (err) {
            dialogs.alert(err)
        } else {
            createAppList(data);
        }
    });
    $("#create-new-app").click(function (e) {
        dialogs.prompt("Enter app name", "Foo", (name) => {
            if (name) {
                dialog.showOpenDialog({
                        title: 'Select app directory',
                        properties: ['openDirectory']
                    }

                    ,
                    function (fileNames) {
                        console.log(fileNames)
                        if (!!fileNames[0]) {
                            let dir = fileNames[0];
                            let app = new App();
                            app.name = name;
                            app.location = dir;


                            App.addApp(app, (err, _) => {
                                if (!err) {
                                    dialog.alert("Success")
                                } else {
                                    dialogs.alert('Failed to save new app');
                                }
                            });
                        } else {
                            console.log('Failed')
                        }
                    });
            }
        });
    });
    $("#apps").on("click", ".btn-start", function (e) {
        console.log($(this))
        let id = $(this).parent().parent().data("id");
        App.findById(id, (err, app) => {
            let packageFile = null;
            try {
                packageFile = require(`${app.location}/package.json`);
            } catch (e) {
                dialogs.alert("Folder doesn't contain a package.json file");
            } finally {
                if (packageFile && packageFile.main) {
                    let appFile = path.join(app.location,packageFile.main);
                    daemonizeApp({
                        script:appFile,
                        name:app.name,
                        max_memory_restart:'100M'
                    }).then(e=>{
                        dialogs.alert("App has been daemonized");
                    }).catch(e=>{
                        dialogs.alert(e.toString());
                    });
                }
            }
        });
    });
});