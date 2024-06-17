const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	PermissionFlagsBits,
} = require('discord.js');
const Guild = require('../../../db/models/guild.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('reset-preferences')
		.setDescription('Resets the preferences for this guild to default values.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		const confirmation = await interaction.reply({
			content: 'Are you sure you want to reset preferences for this guild?',
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId('yes')
						.setLabel('Yes')
						.setStyle('Success'),
					new ButtonBuilder()
						.setCustomId('no')
						.setLabel('No')
						.setStyle('Danger')
				),
			],
		});

		let replied = false;

		const filter = (i) => i.user.id === interaction.user.id;
		const collector = confirmation.createMessageComponentCollector({
			filter,
			time: 15000,
		});

		collector.on('collect', async (i) => {
			if (i.customId === 'yes') {
				const guildData = await Guild.findOne({
					where: { guildId: interaction.guild.id },
				});

				if (
					guildData &&
					(guildData.spamDetectionStrictness !== 1000 ||
						guildData.spamPenalty !== 60)
				) {
					await guildData.update({
						spamDetectionStrictness: 1000,
						spamPenalty: 60,
					});
					await interaction.editReply({
						content: `Successfully reset preferences for **${interaction.guild.name}** to default values!`,
						components: [],
					});
				} else {
					await interaction.editReply({
						content: `No preferences to reset for **${interaction.guild.name}**!`,
						components: [],
					});
				}

				replied = true;
			} else {
				await interaction.editReply({
					content: 'Reset preferences cancelled.',
					components: [],
				});

				replied = true;
			}
		});

		collector.on('end', async (collected, reason) => {
			if (reason === 'time' && !replied) {
				await interaction.editReply('Reset preferences timed out.');
			}
		});
	},
};
