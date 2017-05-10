const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;


let commentSchema = mongoose.Schema({

    text: {type: String, required: true},
    points: {type: Number},
    author: {type: ObjectId, required: true, ref: 'User'},
    date: {type: Date, default:Date.now()},

});
const Comment=mongoose.model('Comment', commentSchema);

module.exports=Problem;
