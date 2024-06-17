const { Events } = require('discord.js');
const { handleSpamDetection } = require('../utils/spamDetectionFunctions.js');

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) return;

		await handleSpamDetection(message);
	},
};
