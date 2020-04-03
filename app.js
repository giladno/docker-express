'use strict';
require('express-async-errors');
const express = require('express');
const path = require('path');
const log = require('loglevel');
const requireAll = require('require-all');
const Sequelize = require('sequelize');

const __DEV__ = process.env.NODE_ENV == 'development';

log.setLevel(process.env.LOG_LEVEL || 'warn');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: false,
    define: {charset: 'utf8'},
});

Object.values(requireAll({dirname: path.resolve(__dirname, './models')})).forEach(model => model(sequelize, Sequelize));

Object.values(sequelize.models)
    .filter(({associate}) => associate)
    .forEach(model => model.associate(sequelize.models));

const app = express();
app.set('view engine', 'hbs');
app.set('trust proxy', true);
app.set('views', path.resolve(__dirname, './views'));

app.use(
    require('cookie-session')({
        name: 'docker-express',
        keys: [process.env.COOKIE_SECRET],
        maxAge: Number(process.env.COOKIE_AGE) || 30 * 86400000,
        secure: !__DEV__,
    })
);
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true}));

app.use('/static', express.static(path.resolve(__dirname, './static'), {redirect: false, index: false}));

app.get('/health', (req, res) => res.status(204).end());

if (__DEV__) {
    require('longjohn');
    app.use(require('morgan')('dev'));
    app.use(async (req, res, next) => {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        await sequelize.sync();
        next();
    });
}

app.use(async (req, res, next) => {
    try {
        const {id, timestamp = 0} = req.session;
        if (!id) return;
        const user = await sequelize.models.User.findOne({where: {id}});
        if (!user || timestamp < Number(user.loggedOutAt)) return delete req.session.id;
        req.user = user;
    } catch (err) {
        log.error(err);
    } finally {
        next();
    }
});

for (const [name, controller] of Object.entries(requireAll({dirname: path.resolve(__dirname, './controllers')}))) {
    log.info(`Registering controller /${name}`);
    const router = express.Router();
    const opt = controller(router, {Sequelize, sequelize, ...sequelize.models}) || {};
    app.use(
        `/${name}`,
        (req, res, next) => {
            if (opt.guest || req.user) return next();
            res.redirect('/login');
        },
        router
    );
}

app.get('/', (req, res) => {
    if (req.user) return res.render('index');
    res.redirect('/login');
});

app.use((req, res) => res.status(404).render('404', {url: req.url}));

app.use((err, req, res, next) => {
    log.error(err);
    //if (__DEV__) return res.status(500).send(err);
    res.status(500).render('500', {message: 'Server Error'});
    next;
});

module.exports = app;
