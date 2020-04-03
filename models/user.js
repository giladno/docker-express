'use strict';
const util = require('util');
const crypto = require('crypto');

const SCRYPT_SALT_SIZE = 10;
const SCRYPT_ROUNDS = 8;
const SCRYPT_MEM_COST = 14;

const randomBytes = util.promisify(crypto.randomBytes);
const scrypt = util.promisify(crypto.scrypt);

async function calculateDigest(password, salt) {
    const cipher = crypto.createCipheriv(
        'aes-256-ctr',
        await scrypt(
            password,
            Buffer.concat([Buffer.from(salt, 'base64'), Buffer.from(process.env.SALT_SEPARATOR, 'base64')]),
            32,
            {N: 1 << SCRYPT_MEM_COST, p: 1, r: SCRYPT_ROUNDS}
        ),
        Buffer.alloc(16, 0)
    );
    return cipher.update(process.env.SIGNER_KEY, 'base64', 'base64') + cipher.final('base64');
}

module.exports = (sequelize, Sequelize) => {
    const model = sequelize.define(
        'User',
        {
            email: {type: Sequelize.STRING, allowNull: false, validate: {isEmail: true}},
            password: Sequelize.VIRTUAL,
            password_digest: Sequelize.STRING,
            salt: Sequelize.STRING,
            loggedOutAt: Sequelize.DATE,
        },
        {
            hooks: {
                async beforeCreate(user) {
                    if (!user.password) return;
                    user.salt = (await randomBytes(SCRYPT_SALT_SIZE)).toString('base64');
                    user.set('password_digest', await calculateDigest(user.password, user.salt));
                },
                async beforeUpdate(user) {
                    if (!user.password) return;
                    user.salt = (await randomBytes(SCRYPT_SALT_SIZE)).toString('base64');
                    user.set('password_digest', await calculateDigest(user.password, user.salt));
                },
            },
            indexes: [{fields: ['email'], unique: true}],
            defaultScope: {attributes: {exclude: ['digest', 'salt']}},
        }
    );

    model.prototype.authenticate = async function (password) {
        return this.password_digest && this.password_digest === (await calculateDigest(String(password), this.salt));
    };

    model.associate = function () {};
};
