'use strict';

module.exports = (app, {sequelize}) => {
    app.get('/', async (req, res) => {
        delete req.session.id;
        await req.user.update({loggedOutAt: sequelize.fn('NOW')});
        res.redirect('/');
    });
};
