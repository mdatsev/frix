const User = require('mongoose').model('User');
const Problem = require('mongoose').model('Prob');
const Comment = require('mongoose').model('Comment');
const Tags = require('mongoose').model('Tags');

function vote(req, res, amount) {
    Problem.findOneAndUpdate({ _id: req.params.id }, { $inc: { points: amount } }, { new: true }, function (err, prob) {
        if (prob != null) {
            console.log(prob.points);
            res.json(prob.points);
        }
    });
    Problem.findOne({
        solutions:
        {
            $elemMatch:
            {
                _id: req.params.id
            }
        }
    }, (err, prob) => {
        if (prob != null) {
            prob.solutions[prob.solutions.indexOf(prob.solutions.filter(i => i._id == req.params.id)[0])].points += amount;
            prob.save(() => {
                res.json(prob.solutions.filter(i => i._id == req.params.id)[0].points);
            });
        }
    });
}

module.exports = {
    createGet: (req, res) => {
        Tags.find({}).then(tags => {
            res.render('problem/create', { tags });
        })

    },
    createPost: (req, res) => {
        let parts = req.body;
        let errorMsg = '';
        if (!req.isAuthenticated()) {
            errorMsg = 'Sorry you must be logged in!';
        }
        else if (!req.body.description) {
            errorMsg = 'Content is required';
        }
        else if (!req.files.image) {
            errorMsg = 'Picture is required';
        }
        if (errorMsg) {
            res.render('problem/create', {
                error: errorMsg
            });
            return;
        }
        parts.author = req.user.id;
        let image = req.files.image;
        let filenameAndExt = image.name;

        let filename = filenameAndExt.substr(0, filenameAndExt.lastIndexOf('.'));
        let exten = filenameAndExt.substr(filenameAndExt.lastIndexOf('.') + 1);

        let rnd = require('./../utilities/encryption').generateSalt().substr(0, 5).replace(/\//g, 'x');
        let finalname = `${filename}_${rnd}.${exten}`;



        image.mv(`./public/problempictures/${finalname}`, err => {
            if (err) {
                console.log(err.message);
            }
        });
        parts.points = 0;
        parts.picture = `/problempictures/${finalname}`;
        parts.lng = req.body.lng;
        parts.lat = req.body.lat;
        parts.formattedDate = "test";

        Problem.create(parts).then(problem => {
            let formattedDate = problem.date.toString();
            formattedDate = formattedDate.substr(0, formattedDate.indexOf("GMT"));
            Problem.update({ _id: problem.id }, {
                $set: {
                    formattedDate: formattedDate
                }
            }, (e, p) => {
            });

            req.user.problems.push(problem.id);
            req.user.save(err => {
                if (err) {
                    res.render('problem/create', {
                        error: err.message
                    });
                }
                else {
                    res.redirect('/');
                }
            })
        })

    },
    probleminfoGet: (req, res) => {
        Problem.find({}).populate('author').then(problems => {
            res.json(problems);
        })
    },
    listproblemsGet: (req, res) => {
        res.render('problem/listproblems');
    },
    detailsGet: (req, res) => {
        let id = req.params.id;
        Problem.findById(id).populate('comments').populate('solutions.author').populate('author').then(problem => {
            //console.log(problem.solutions[0].author);

            User.findById(problem.author).then(problemauthor => {
                let isAuthenticated = false;
                if (req.user && problem.author.id == req.user.id) {
                    isAuthenticated = true; 
                }

                if (problem.comments.length == 0) {
                    res.render('details', { problem, author: problemauthor, solutions: problem.solutions, isAuthenticated });
                }

                problem.comments.forEach(function (comment, idx, array) {
                    User.findById(comment.author).then(commentauthor => {
                        comment.author = commentauthor;
                        comment.formattedDate = comment.date.toString();
                        comment.formattedDate = comment.formattedDate.substr(0, comment.formattedDate.indexOf("GMT"));
                        if (idx === array.length - 1) {
                            problem.comments.reverse();
                            if(problem.solutions.length != 0)
                            {
                                                            problem.solutions.sort((a, b) => b.points - a.points);
                            //let temp = problem.solutions[problem.solutions.indexOf(problem.solutions.filter(i => i.accpted == 1)[0])];
                            //problem.solutions.splice(problem.solutions.indexOf(problem.solutions.filter(i => i.accpted == 1)[0]), 1);
                            //problem.solutions.unshift(temp);
                            
                            }
                            res.render('details', { problem, author: problemauthor, solutions: problem.solutions, isAuthenticated });
                        }
                    });
                }, this);
            });
        });

    },
    detailsPost: (req, res) => {

        let com = {};
        com.author = req.user.id;
        com.points = 0;
        com.text = req.body.comment;
        com.post = req.params.id;
        Comment.create(com).then(com => {
            req.user.comments.push(com);
            Problem.update({ _id: req.params.id }, {
                $push:
                {
                    comments: com.id
                }
            }).then(res.redirect(`../details/${req.params.id}`));

        });


    },
    upvote: (req, res) => {
        if (req.user === undefined) {
            res.json("not logged!");
            return;
        }
        User.findById(req.user.id).then(user => {
            if (user.downvotes.indexOf(req.params.id) > -1) {
                let index = user.downvotes.indexOf(req.params.id);
                user.downvotes.splice(index, 1);
                user.save(err => {
                    if (err) {
                        console.log(err.message);
                    }
                });
                vote(req, res, 2);
            }
            else if (user.downvotes.indexOf(req.params.id) === -1 && user.upvotes.indexOf(req.params.id) === -1) {
                vote(req, res, 1);
            }
            else {
                vote(req, res, 0);
            }
            if (user.upvotes.indexOf(req.params.id) === -1) {
                User.update({ _id: req.user.id }, {
                    $push:
                    {
                        upvotes: req.params.id
                    }
                }).exec();
            }
        });
    },
    downvote: (req, res) => {
        if (req.user === undefined) {
            res.json("not logged!");
            return;
        }
        User.findById(req.user.id).then(user => {
            if (user.upvotes.indexOf(req.params.id) > -1) {
                let index = user.upvotes.indexOf(req.params.id);
                user.upvotes.splice(index, 1);
                user.save(err => {
                    if (err) {
                        console.log(err.message);
                    }
                });
                vote(req, res, -2);
            }
            else if (user.downvotes.indexOf(req.params.id) === -1 && user.upvotes.indexOf(req.params.id) === -1) {
                vote(req, res, -1);
            }
            else {
                vote(req, res, 0);
            }
            if (user.downvotes.indexOf(req.params.id) === -1) {
                User.update({ _id: req.user.id }, {
                    $push:
                    {
                        downvotes: req.params.id
                    }
                }).exec();
            }
        });
    },
    resetvote: (req, res) => {
        if (req.user === undefined) {
            res.json("not logged!");
            return;
        }
        User.findById(req.user.id).then(user => {
            if (user.downvotes.indexOf(req.params.id) > -1) {
                let index = user.downvotes.indexOf(req.params.id);
                user.downvotes.splice(index, 1);
                user.save(err => {
                    if (err) {
                        console.log(err.message);
                    }
                });
                vote(req, res, 1);
            }
            else if (user.upvotes.indexOf(req.params.id) > -1) {
                let index = user.upvotes.indexOf(req.params.id);
                user.upvotes.splice(index, 1);
                user.save(err => {
                    if (err) {
                        console.log(err.message);
                    }
                });
                vote(req, res, -1);
            }
            else {
                vote(req, res, 0);
            }
        });
    },
    allproblemsGet: (req, res) => {


        Problem.find({}).sort({ points: 'desc' }).then(problems => {
            Tags.find({}).then(tags => {
                res.render('problem/allproblems', { problems, tags });
            });
        })
    },

    sortedPost: (req, res) => {
        var hack = false;
        if (typeof req.body.tag == "string") {
            req.body.tag = [req.body.tag];
        }
        if (typeof req.body.tag != "object") {
            Problem.find({}).then(problems => {
                Tags.find({}).then(tags => {
                    res.render('problem/allproblems', { problems, tags });
                });
            })

        }
        else {
            req.body.tag.forEach((tag) => { });
            let filtered = new Array();
            if (req.body.tag.length == 0) {
                filtered = filtered.concat(problems);
            }
            req.body.tag.forEach((tag, idx, array) => {
                Problem.find({ tag: tag }).then(problems => {
                    filtered = filtered.concat(problems);
                    if (idx === array.length - 1) {
                        Tags.find({}).then(tags => {
                            res.render('problem/allproblems', { problems: filtered, tags });
                        });
                    }
                })

            });
        }

    },
    addSolutionGet: (req, res) => {
        res.render("problem/addsolution", { id: req.params.id });
    },
    addSolutionPost: (req, res) => {
        let parts = req.body;
        let errorMsg = '';
        if (!req.isAuthenticated()) {
            errorMsg = 'Sorry you must be logged in!';
        }
        else if (!req.body.description) {
            errorMsg = 'Content is required';
        }
        else if (!req.files.image) {
            errorMsg = 'Picture is required';
        }
        if (errorMsg) {
            res.render('problem/create', {
                error: errorMsg
            });
            return;
        }
        parts.author = req.user.id;
        let image = req.files.image;
        let filenameAndExt = image.name;

        let filename = filenameAndExt.substr(0, filenameAndExt.lastIndexOf('.'));
        let exten = filenameAndExt.substr(filenameAndExt.lastIndexOf('.') + 1);

        let rnd = require('./../utilities/encryption').generateSalt().substr(0, 5).replace('/\//g', 'x');
        let finalname = `${filename}_${rnd}.${exten}`;

        image.mv(`./public/solutionpictures/${finalname}`, err => {
            if (err) {
                console.log(err.message);
            }
        });
        parts.points = 0;
        parts.picture = `/solutionpictures/${finalname}`;
        parts.formattedDate = "test";

        Problem.findById(req.params.id).then(problem => {

            let formattedDate = (new Date().toString());
            formattedDate = formattedDate.substr(0, formattedDate.indexOf("GMT"));
            parts.formattedDate = formattedDate;
            problem.solutions.push(parts);
            problem.save(err => {
                if (err) {
                    res.render(`/problem/solution/${req.params.id}`, {
                        error: err.message
                    });
                }
                else {
                    res.redirect(`/details/${req.params.id}`);
                }
            })
        })
    },
    acceptSolutionPost: (req, res) => {

        Problem.findOne({
            solutions:
            {
                $elemMatch:
                {
                    _id: req.params.id
                }
            }
        }, (err, prob) => {
            if (prob != null) {
                prob.solutions[prob.solutions.indexOf(prob.solutions.filter(i => i._id == req.params.id)[0])].accpted = 1;
                prob.save();
                res.redirect(`/details/${prob.id}`);
            }
        });
    }
};