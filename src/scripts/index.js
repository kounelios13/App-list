const mongoose = require('mongoose');
const path = require('path');
const pm2_base_options = {
    max_memory_restart: '150M',
    env: {
        NODE_ENV: "production"
    }
};

const app_markup = `
    <div class='row '>
        <div class='col-lg-12 col-md-12 col-sm-12'>
            <div class='text-success bg-success mb-3'>
                <div class='card app-card' data-id='$$$id'>
                    <div class='card-header'>$$$name</div>
                    <div class='card-body'>
                        <div class='card-text'>
                            $$$location                                 
                        </div>
                        <div class='btn btn-secondary btn-edit disabled'>Edit</div>
                        <div class='btn btn-primary btn-start'>Start</div>
                        <div class='btn btn-danger btn-stop'>Stop</div>
                        <div class='btn btn-warning btn-restart'>Restart</div>
                        <div class='btn btn-success btn-launch'>Open in browser</div>
                    </div>
                </div>
            </div>
        </div>
    </div>    
        `;

const {
    daemonizeApp,
    stopApp,
    pm2,
    restartApp
} = require('./scripts/pm2-functions');
const bootbox_dialogs = require('./scripts/bootbox-dialogs');
const error_d = bootbox_dialogs.default.err;
const success = bootbox_dialogs.default.success;
mongoose.connect('mongodb://localhost/applist').catch(e => {
    console.error('Failed to connect to database');
});
const App = require('./scripts/models/App');
const {
    dialog,
    shell
} = require('electron').remote;
const {
    ipcRenderer
} = require('electron');

function createAppList(apps) {
    apps.forEach(app => {
        let {
            _id,
            name,
            location
        } = app;
        let markup =
            app_markup.replace('$$$id', _id)
            .replace('$$$name', name)
            .replace('$$$location', location);
        $("#apps").append(markup);
    });
}

function createNewApp() {
    let markup = `
        <form>
            <div class='form-group'>
                <label for='app-name'>Enter app name</label>
                <input type='text' name='app-name' id='app-name'required class='form-control'>
            </div>
            <div class='form-group'>
                <label for='app-port'>Port</label>
                <input type='number' min=0 required id='app-port' class='form-control'>
            </div> 
        </form>
    `;
    bootbox.dialog({
        title: "Enter app info",
        message: markup,
        buttons: {
            ok: {
                label: "Add new app and select folder",
                callback: () => {
                    let appName = $("#app-name").val();
                    let port = $("#app-port").val();
                    if (!appName.length || !port) {
                        error_d("Specify app name and port");
                        return false;
                    }
                    let open_dialog_options = {
                        title: "Select app directory",
                        properties: ['openDirectory']
                    };
                    let app = new App();
                    let dialog_callback = (files) => {
                        let app_path = files[0];
                        if (app_path) {
                            app.name = appName;
                            app.location = app_path;
                            app.port = Number(port);
                            App.addApp(app, (err, proc) => {
                                if (err) {
                                    error_d(err.getMessage());
                                } else {
                                    let {
                                        _id,
                                        name,
                                        location
                                    } = proc;
                                    success("App has been added");
                                    let markup = app_markup.replace('$$$name', name)
                                        .replace('$$$location', location)
                                        .replace('$$$id', _id);
                                    $("#apps").append(markup);
                                }
                            });
                        } else {
                            //User didn't provide a file path
                            error_d("You didn't specify the path for your app");
                        }
                    };
                    dialog.showOpenDialog(open_dialog_options, dialog_callback);


                }
            },
            cancel: {
                callback: () => bootbox.hideAll()
            }
        }


    })
}


/**
 * Starts an app as a background process using pm2
 * @param {String} id The id of the app(as registerd to database)
 */
async function startApp(id) {
    let app = null;
    let packageFile = null;
    try {
        app = await App.findAppById(id);
        console.log(app)
        packageFile = require(`${app.location}/package.json`);
        let options = Object.assign({
            name: app.name,
            script: path.join(app.location,packageFile.main)
        }, pm2_base_options);
        let daemonizedApp = (await daemonizeApp(options)).pop();
        console.log(daemonizedApp)
        let pid = daemonizedApp.process.pid;
        let query = {
            _id: id
        };
        let update = {
            $set: {
                is_daemonized: true,
                pid: pid
            }
        };
        App.update(app,update,{},(error,app)=>{
            if(error){
                console.log(error);
            }else{
                console.log('Updated app metadata');
            }
        });
        success("App has been daemonized.Running on port " + app.port);
    } catch (e) {
        console.error(e)
        error_d(e.toString());
    }
}


async function editApp(id){
    try{
        let appToEdit = await App.findAppById(id);
        let {name,port,is_daemonized,pid} = appToEdit;
        let markup = `
                <form>
                    <div class='form-group'>
                        <label for='aname'>App name</label>
                        <input type='text' name='aname' class='form-control' id='aname' value='${name}'>
                    </div>
                    <div class='form-group'>
                        <label for='apid'>App pid</label>
                        <input type='text' disabled class='form-control' value='${pid}'>
                    </div>
                    <div class='form-group'>
                        <label for='app-port'>Application port</label>
                        <input type='number' name='app-port' class='form-control' id='app-port' value='${port}'>
                    </div>
                </form>
            `;
        bootbox.dialog({
            title: "Edit " + name,
            message: markup,
            buttons:{
                cancel:{
                    label:"Cancel",
                    callback:()=>{
                        bootbox.hideAll();
                    }
                },
                delete:{
                    label:'Remove and delete',
                    callback:()=>{

                    },
                    className:'btn-danger'

                },
                update:{
                    label:'Update',
                    className:'btn-success',
                    callback:()=>{

                    }
                }
            }
        });
    }catch(e){
        error_d(e.toString());
    }
}
/**
 * Launches an app in browser
 * @param {String} id
 */
async function launchInBrowser(id) {
    let app = await App.findAppById(id);
    let {
        port
    } = app;
    let url = `http://localhost:${port}`;
    shell.openExternal(url);

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
        createNewApp();
    });
    $("#apps").on("click", ".btn-start", function (e) {
        let id = $(this).parent().parent().data("id");
        startApp(id);
    }).on("click", ".btn-stop", async function (e) {
        let id = $(this).parent().parent().data("id");
        let app = null;
        try {
            app = await App.findAppById(id);
            let stoppedApp = await stopApp(app.name);
            success("App has been stopped");
        } catch (e) {
            error_d(e.toString());
        }

    }).on("click", ".btn-restart", async function (e) {
        let id = $(this).parent().parent().data("id");
        let foundApp = null;
        try {
            foundApp = await App.findAppById(id);
            let restartedApp = await restartApp(foundApp.name);
            success("App has been restarted");
        } catch (e) {
            let msg = e.toString();
            if (msg.indexOf('name not found') != -1) {
                d_error("The process you selected has not been started using pm2 thus cannot be restarted");
            } else {
                error_d(msg);
            }
        }
    }).on("click", ".btn-edit", function (e) {
        let id = $(this).parent().parent().data("id");
        editApp(id);
    }).on("click", ".btn-launch", function (e) {
        let id = $(this).parent().parent().data("id");
        launchInBrowser(id);
    });
});