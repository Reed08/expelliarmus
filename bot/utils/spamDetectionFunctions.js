async function handleSpamDetection(message) {
	const Guild = require('../../db/models/Guild.js');

	try {
		let guildData = await Guild.findOne({
			where: { guildId: message.guild.id },
		});

		guildData =
			guildData || (await Guild.create({ guildId: message.guild.id }));

		await addMessageToPreviousMessages(guildData, message.author.id, message);
		await removeOldMessages(guildData, message.author.id);
		const spamScore = await calculateSpamScore(guildData, message.author.id);

		if (spamScore > guildData.spamDetectionStrictness) {
			await timeoutUser(guildData, message);
		}
	} catch (err) {
		console.log(`Error handling spam detection: ${err}`);
	}
}

async function addMessageToPreviousMessages(guildData, userId, message) {
	guildData.previousMessages = guildData.previousMessages || {};
	guildData.previousMessages[userId] = guildData.previousMessages[userId] || [];

	guildData.previousMessages[userId].push(message);

	guildData.changed('previousMessages', true);
	await guildData.save();
}

async function removeOldMessages(guildData, userId) {
	const thirtySecondsAgo = Date.now() - 30000;

	guildData.previousMessages[userId] = guildData.previousMessages[
		userId
	].filter((message) => message.createdTimestamp > thirtySecondsAgo);

	guildData.changed('previousMessages', true);
	await guildData.save();
}

async function calculateSpamScore(guildData, userId) {
	const { encode } = require('gpt-tokenizer');

	const now = Date.now();
	let spamScore = 0;

	const messages = guildData.previousMessages[userId];

	const encodings = messages.flatMap((message) => {
		const messageEncodings = encode(message.content);
		spamScore +=
			(message.content.length + 100 * message.content.split('\n').length) *
			Math.pow(0.95, (now - message.createdTimestamp) / 1000);
		return messageEncodings;
	});

	const uniqueTokens = new Set(encodings);

	let messageSimilarityMultiplier;
	if (uniqueTokens.size === 0) {
		messageSimilarityMultiplier = 1;
	} else {
		messageSimilarityMultiplier =
			2 - 2 * (uniqueTokens.size / encodings.length);
	}

	return spamScore * Math.min(Math.max(messageSimilarityMultiplier, 0.8), 2);
}

async function timeoutUser(guildData, message) {
	const previousMessages = guildData.previousMessages[message.author.id];
	guildData.previousMessages[message.author.id] = [];
	guildData.changed('previousMessages', true);
	await guildData.save();

	if (guildData.previousTimeouts === null) {
		guildData.previousTimeouts = {};
	}

	if (guildData.previousTimeouts[message.author.id] == null) {
		guildData.previousTimeouts[message.author.id] = 0;
	}

	if (!message.member.moderatable) return;

	await message.member.timeout(guildData.spamPenalty * 1000);
	guildData.previousTimeouts[message.author.id] += 1;

	guildData.changed('previousTimeouts', true);
	await guildData.save();

	const numMessagesDeleted = await deleteMessages(
		guildData,
		message,
		previousMessages
	);

	message.channel.send(
		`Timed out <@${message.author.id}> for **${
			guildData.spamPenalty
		}** seconds for spamming. **${numMessagesDeleted}** spam message(s) deleted. <@${
			message.author.id
		}> has been timed out for spamming **${
			guildData.previousTimeouts[message.author.id]
		}** time(s) in this server so far, including this time.`
	);
}

async function deleteMessages(guildData, message, previousMessages) {
	let messageIds = [];

	const fetches = previousMessages.map(async (spamMessage) => {
		const fetchedMessage = await message.client.channels.cache
			.get(message.channelId)
			.messages.fetch(spamMessage.id);

		if (fetchedMessage.deletable) {
			messageIds.push(spamMessage.id);
		}
	});

	await Promise.all(fetches);

	const channel = await message.client.channels.cache.get(message.channelId);
	channel.bulkDelete(messageIds);

	guildData.previousMessages[message.author.id] = [];
	guildData.changed('previousMessages', true);
	await guildData.save();

	return messageIds.length;
}

module.exports = {
	handleSpamDetection,
};
