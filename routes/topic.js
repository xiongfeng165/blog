var Topic = require('../proxy').Topic;
var validator = require('validator');
var tools = require('../common/tools');
var config = require('../config');
var mcache = require('memory-cache');
var eventproxy = require('eventproxy');

//show
exports.showCreate = function(req, res) {
    res.render('topic/create', {
        user: req.session.user,
        success: req.flash('success').toString(),
        error: req.flash('error').toString()
    });
};

//create
exports.create = function(req, res) {
    var title = validator.trim(req.body.title);
    var category = req.body.category;
    var tag = req.body.tag;
    var content = req.body.content;
    // 验证
    var editError;
    if (title === '') {
        editError = '标题不能是空的。';
    } else if (title.length < 2 || title.length > 100) {
        editError = '标题字数太多或太少。';
    } else if (!category) {
        editError = '必须选择一个版块。';
    }
    // END 验证
    if (editError) {
        return res.render('topic/create', {
            error: editError,
            title: title,
            content: content,
            category: category,
            tag: tag
        });
    }

    Topic.newAndSave(title, category, tag, content, req.session.user._id, function(err, topic) {
        if (err) {
            return res.render('topic/create', {
                error: err,
                title: title,
                content: content,
                tag: tag
            });
        }

        req.flash('success', '记录成功!');
        res.redirect('/#/topic/' + topic._id);
    });
};

//showEdit
exports.showEdit = function(req, res) {
    var topic_id = req.params.tid;
    if (topic_id.length !== 24) {
        req.flash('error', '此话题不存在或已被删除。')
        return res.redirect('/');
    }
    Topic.getTopicById(topic_id, function(error, topic) {
        if (error) {
            req.flash('error', '此话题不存在或已被删除。')
            return res.redirect('/');
        }

        if (req.session.user._id != topic.author_id) {
            req.flash('error', '无权限');
            return res.redirect('/topic/' + topic._id);
        }

        res.render('topic/create', {
            action: "edit",
            title: topic.title,
            content: topic.content,
            category: topic.category,
            tag: topic.tag,
            id: topic._id
        });
    });
};

//edit
exports.edit = function(req, res) {
    var title = validator.trim(req.body.title);
    var category = req.body.category;
    var tag = req.body.tag;
    var content = req.body.content;
    var topic_id = req.params.tid;
    // 验证
    var editError;
    if (title === '') {
        editError = '标题不能是空的。';
    } else if (title.length < 2 || title.length > 100) {
        editError = '标题字数太多或太少。';
    } else if (!category) {
        editError = '必须选择一个版块。';
    }
    // END 验证
    if (editError) {
        return res.render('topic/create', {
            error: editError,
            title: title,
            content: content,
            category: category,
            tag: tag,
            id: topic_id
        });
    }

    Topic.getTopicById(topic_id, function(err, topic) {
        if (err) {
            return res.render('topic/create', {
                error: err,
                title: title,
                content: content,
                category: category,
                tag: tag,
                id: topic_id
            });
        }

        if (req.session.user._id != topic.author_id) {
            req.flash('error', '无权限');
            return res.redirect('/topic/' + topic._id);
        }

        topic.title = title;
        topic.category = category;
        topic.tag = tag;
        topic.content = content;
        topic.save();

        req.flash('success', '修改成功!');
        res.redirect('/#/topic/' + topic._id);
    });
};

//delete
exports.delete = function(req, res) {
    var topic_id = req.params.tid;

    Topic.getTopicById(topic_id, function(err, topic) {
        if (err) {
            req.flash('error', '此话题不存在或已被删除!');
            return res.redirect('/');
        }

        if (req.session.user._id != topic.author_id) {
            req.flash('error', '无权限');
            return res.redirect('/');
        }

        topic.remove(function(err) {
            if (err) {
                req.flash('error', err);
                return res.redirect('/');
            }
            req.flash('success', '删除成功!');
            res.redirect('/m/');
        });
    });
};

//latest info
exports.latest = function(req, res) {
    Topic.getLatestTopic(function(error, topic) {
        if (topic) {
            topic.visit_count += 1;
            topic.save();

            // format date
            var topicJson = topic.toJSON();
            topicJson.friendly_create_at = tools.formatDate(topicJson.create_at, true);
            topicJson.friendly_update_at = tools.formatDate(topicJson.update_at, true);
            res.send(topicJson);
        } else {
            return res.send(null);
        }
    });
};

//info
exports.infoJson = function(req, res) {
    var topic_id = req.params.tid;
    Topic.getTopicById(topic_id, function(error, topic) {
        if (topic) {
            topic.visit_count += 1;
            topic.save();

            // format date
            var topicJson = topic.toJSON();
            topicJson.friendly_create_at = tools.formatDate(topicJson.create_at, true);
            topicJson.friendly_update_at = tools.formatDate(topicJson.update_at, true);
            res.send(topicJson);
        } else {
            return res.send(null);
        }
    });
};

//info
exports.info = function(req, res) {
    var topic_id = req.params.tid;
    if (topic_id.length !== 24) {
        req.flash('error', '此话题不存在或已被删除。')
        return res.redirect('/');
    }
    Topic.getTopicById(topic_id, function(error, topic) {
        if (error) {
            req.flash('error', '此话题不存在或已被删除。')
            return res.redirect('/');
        }
        topic.visit_count += 1;
        topic.save();

        // format date
        topic.friendly_create_at = tools.formatDate(topic.create_at, true);
        topic.friendly_update_at = tools.formatDate(topic.update_at, true);

        res.render('topic/info', {
            topic: topic,
            user: req.session.user,
            success: req.flash('success').toString(),
            error: req.flash('error').toString()
        });
    });
};

// 主页的缓存工作。主页是需要主动缓存的\
setInterval(function() {
    // 只缓存第一页, page = 1。options 之所以每次都生成是因为 mongoose 查询时，
    // 会改动它
    var limit = config.list_topic_count;
    var query = {};
    var options = {
        skip: (1 - 1) * limit,
        limit: limit,
        sort: '-top -update_at'
    };
    var optionsStr = JSON.stringify(query) + JSON.stringify(options);
    Topic.getTopicsByQuery(query, options, function(err, topics) {
        mcache.put(optionsStr, topics);
        return topics;
    });
}, 1000 * 120); // 五秒更新一次
// END 主页的缓存工作

var paginateTopicsByQuery = function(req, res, query) {
    var page = parseInt(req.query.page, 10) || 1;
    page = page > 0 ? page : 1;
    var limit = config.list_topic_count;

    var proxy = eventproxy.create('topics', 'pages',
        function(topics, pages) {
            res.render('index', {
                topics: topics,
                current_page: page,
                list_topic_count: limit,
                pages: pages,
                user: req.session.user,
                success: req.flash('success').toString(),
                error: req.flash('error').toString()
            });
        });

    // 取主题
    var options = {
        skip: (page - 1) * limit,
        limit: limit,
        sort: '-top -last_reply_at'
    };
    var optionsStr = JSON.stringify(query) + JSON.stringify(options);
    if (mcache.get(optionsStr)) {
        proxy.emit('topics', mcache.get(optionsStr));
    } else {
        Topic.getTopicsByQuery(query, options, proxy.done('topics', function(topics) {
            return topics;
        }));
    }
    // END 取主题

    // 取分页数据
    if (mcache.get('pages')) {
        proxy.emit('pages', mcache.get('pages'));
    } else {
        Topic.getCountByQuery(query, proxy.done(function(all_topics_count) {
            var pages = Math.ceil(all_topics_count / limit);
            mcache.put(JSON.stringify(query) + 'pages', pages, 1000 * 60 * 1);
            proxy.emit('pages', pages);
        }));
    }
}

exports.list = function(req, res) {
    paginateTopicsByQuery(req, res, {});
};

var getNavs = function(callback) {
    var navs = {};
    var ep = eventproxy.create("categories", "tags", function(categories, tags) {
        navs.categories = categories;
        navs.tags = tags;
        callback(navs)
    });
    Topic.groupByTag(function(err, results) {
        var tags = [];
        if (results) {
            results.forEach(function(result) {
                var record = {};
                record.name = result._id;
                record.count = result.count;
                record.topics = result.topics;
                tags.push(record);
            })
        }

        ep.emit("tags", tags);
    });

    Topic.groupByCategory(function(err, results) {
        var categories = [];
        if (results) {
            results.forEach(function(result) {
                var record = {};
                record.name = result._id;
                record.count = result.count;
                record.topics = result.topics.reverse();
                categories.push(record);
            })
        }
        ep.emit("categories", categories);
    });
};

exports.setNavs = function(app) {
    if (mcache.get('navs')) {
        app.locals.navs = mcache.get('navs')
    } else {
        getNavs(function(navs) {
            navs.config_categories = config.categories;
            app.locals.navs = navs;
        });
    }
};

exports.getNavs = function(req, res) {
    getNavs(function(navs) {
        navs.config_categories = config.categories;
        res.send(navs);
    });
}
