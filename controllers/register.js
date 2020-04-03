'use strict';

module.exports = (app, {User}) => {
    app.get('/', (req, res) => res.render('register'));

    app.post('/', async (req, res) => {
        try {
            await User.create({email: String(req.body.email), password: String(req.body.password)});
        } catch (err) {
            if (err.name == 'SequelizeUniqueConstraintError')
                return res.render('register', {error: 'Already registered'});
            throw err;
        }
        return res.redirect('/login');
    });

    return {guest: true};
};
