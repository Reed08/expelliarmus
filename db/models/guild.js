const { DataTypes } = require('sequelize');
const sequelize = require('../database.js');

const Guild = sequelize.define('guild', {
	guildId: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true,
	},
	previousMessages: DataTypes.JSON,
	previousTimeouts: DataTypes.JSON,
	spamDetectionStrictness: {
		type: DataTypes.FLOAT,
		allowNull: false,
		defaultValue: 1000,
	},
	spamPenalty: {
		type: DataTypes.FLOAT,
		allowNull: false,
		defaultValue: 60,
	},
});

Guild.sync();
// Guild.sync({ force: true });

module.exports = Guild;
