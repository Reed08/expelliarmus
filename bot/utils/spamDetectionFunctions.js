async function handleSpamDetection(message) {
	const Guild = require('../../db/models/Guild.js');

	try {
		let guildData = await Guild.findOne({
			where: { guildId: message.guild.id },
		});

		if (guildData == null) {
			guildData = await Guild.create({
				guildId: message.guild.id,
			});
		}

		await addMessageToPreviousMessages(guildData, message.author.id, message);
		await removeOldMessages(guildData, message.author.id);
		const spamScore = await calculateSpamScore(guildData, message.author.id);

		if (spamScore > guildData.spamDetectionStrictness) {
			await timeoutUser(guildData, message);
		}
	} catch (err) {
		console.log(`Error in spam detection: ${err}`);
	}
}

async function addMessageToPreviousMessages(guildData, userId, message) {
	if (guildData.previousMessages === null) {
		guildData.previousMessages = {};
	}

	if (guildData.previousMessages[userId] == null) {
		guildData.previousMessages[userId] = [message];
	} else {
		guildData.previousMessages[userId].push(message);
	}

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

	const encodings = [];
	const messages = guildData.previousMessages[userId];

	messages.forEach((message) => {
		const messageEncodings = encode(message.content);
		encodings.push(...messageEncodings);
		spamScore +=
			(message.content.length + 100 * message.content.split('\n').length) *
			Math.pow(0.95, (now - message.createdTimestamp) / 1000);
	});

	const uniqueTokens = [];
	encodings.forEach((encoding) => {
		if (!uniqueTokens.includes(encoding)) {
			uniqueTokens.push(encoding);
		}
	});

	let messageSimilarityMultiplier;
	if (uniqueTokens.length === 0) {
		messageSimilarityMultiplier = 1;
	} else {
		messageSimilarityMultiplier =
			2 - 2 * (uniqueTokens.length / encodings.length);
	}

	return spamScore * Math.min(Math.max(messageSimilarityMultiplier, 0.8), 2);
}

async function timeoutUser(guildData, message) {
	if (guildData.previousTimeouts === null) {
		guildData.previousTimeouts = {};
	}

	if (guildData.previousTimeouts[message.author.id] == null) {
		guildData.previousTimeouts[message.author.id] = 0;
	}

	if (!message.member.moderatable)
		return message.channel.send(
			`<@531286082831253515>, <@${message.author.id}> must be timed out for **${
				guildData.spamPenalty
			}** seconds for spamming. **${
				guildData.previousMessages[message.author.id].length
			}** spam message(s) were detected. <@${
				message.author.id
			}> has previously been timed out for spamming **${
				guildData.previousTimeouts[message.author.id]
			}** time(s) in this server.`
		);

	await message.member.timeout(guildData.spamPenalty * 1000);
	guildData.previousTimeouts[message.author.id] += 1;

	guildData.changed('previousTimeouts', true);
	await guildData.save();

	const numMessagesDeleted = await deleteMessages(guildData, message.author.id);

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

async function deleteMessages(guildData, userId) {
	const messages = guildData.previousMessages[userId];
	let numMessagesDeleted = 0;

	for (const message of messages) {
		if (message.deletable) {
			await message.delete();
			numMessagesDeleted += 1;
		}
	}

	guildData.previousMessages[userId] = [];
	guildData.changed('previousMessages', true);
	await guildData.save();

	return numMessagesDeleted;
}

module.exports = {
	handleSpamDetection,
};
