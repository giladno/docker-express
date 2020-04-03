'use strict';

module.exports = (app, {User}) => {
    app.get('/', (req, res) => res.render('login'));

    app.post('/', async (req, res) => {
        const user = await User.findOne({
            attributes: ['id', 'password_digest', 'salt'],
            where: {email: String(req.body.email)},
        });
        if (user && (await user.authenticate(req.body.password))) {
            Object.assign(req.session, {id: user.id, timestamp: Date.now()});
            return res.redirect('/');
        }
        res.render('login', {error: 'Invalid credentials'});
    });

    return {guest: true};
};
