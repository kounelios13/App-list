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
                        <div class='btn btn-warning btn-restart'>Restart</div>
                        <div class='btn btn-success btn-launch'>Open in browser</div>
                    </div>
                </div>
            </div>
        </div>
    </div>    
        `;
//let boot = require('bootbox');
const {
    daemonizeApp,
    pm2
} = require('./scripts/pm2-functions');
const bootbox_dialogs = require('./scripts/bootbox-dialogs');
const error_d = bootbox_dialogs.default.err;
const success = bootbox_dialogs.default.success;
mongoose.connect('mongodb://localhost/applist').catch(e => {
    console.error('Failed to connect to database');
});
const App = require('./scripts/models/App');
const {
    dialog,shell
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
                                    let markup = app_markup.replace('$$$name',name)
                                    .replace('$$$location',location)
                                    .replace('$$$id',_id);
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
function startApp(id) {
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
                        max_memory_restart: '150M',
                        env: {
                            "PORT": app.port,
                            "NODE_ENV": "production"
                        }
                    });
                    let currentApp = dApp[0];

                    let pid =currentApp.process.pid;
                    let query = {
                        _id: id
                    };
                    let update = {
                        $set: {
                            is_daemonized: true,
                            pid: pid
                        }
                    };
                    let options = {};
                    App.update(query, update, options, (err, data) => {
                        if (err) {
                            console.error(err)
                        } else {
                            console.log("Updated data")
                        }
                    });
                    success("App has been daemonized.Running on port " + app.port);
                } catch (e) {
                    console.error(e)
                    error_d(e.toString());
                }

            }
        }
    });
}

function restartApp(id) {
    return Promise.resolve(null);
}

async function editApp(id) {
    let app = null;
    try {
        app = await App.findAppById(id);
    } catch (e) {
        bootbox.alert({
            title: "Failed to retrieve app",
            message: e.getMessage()
        })
    } finally {
        if (app != null) {
            let {
                name,
                port,
                pid,
                is_daemonized
            } = app;
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
            bootbox.alert({
                title: "Edit " + name,
                message: markup
            });
        }
    }
}

/**
 * Launches an app in browser
 * @param {String} id
 */
function launchInBrowser(id){
    App.findAppById(id)
        .then(app=>{
            let {port} = app;
            let url = `http://localhost:${port}`;
            shell.openExternal(url);
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
        createNewApp();
    });
    $("#apps").on("click", ".btn-start", function (e) {
        let id = $(this).parent().parent().data("id");
        startApp(id);
    }).on("click", ".btn-stop", function (e) {
        let id = $(this).parent().parent().data("id");
        stopApp(id);
    }).on("click", ".btn-restart", function (e) {
        let id = $(this).parent().parent().data("id");
        restartApp(id)
            .then(e => {})
            .catch(e => {});
    }).on("click", ".btn-edit", function (e) {
        let id = $(this).parent().parent().data("id");
        //editApp(id);
    }).on("click",".btn-launch",function(e){
        let id = $(this).parent().parent().data("id");
        launchInBrowser(id);
    });
});