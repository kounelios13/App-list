const mongoose = require('mongoose');

const AppSchema = mongoose.Schema({
    name: {
        type: String
    },
    location: {
        type: String
    },
    port:{
        type:Number,
        default:3000
    },
    is_daemonized:{
        type:Boolean,
        default:false
    },
    pid:{
        type:Number,
        default:0
    }

});


const App = module.exports = mongoose.model('App', AppSchema);

module.exports.getApps = (cb, limit) => {
    App.find(cb).limit(limit).sort([
        ['title', 'ascending']
    ]);
};


module.exports.addApp = (app, cb) => {
   
    App.create(app, cb);
};

module.exports.updateApp = (query, update, options, cb) => {
    App.findOneAndUpdate(query, update, options, cb);
};

module.exports.findAppById = (id, cb)=>{
    App.findById(id,cb);
};

module.exports.removeApp = (query, cb)=>{
    App.remove(query,cb);
};