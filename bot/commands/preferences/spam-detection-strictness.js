const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../../db/models/guild.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('spam-detection-strictness')
		.setDescription('A lower number is more strict.')
		.addNumberOption((option) =>
			option
				.setName('strictness')
				.setDescription('The new spam detection strictness value.')
				.setMaxValue(100000)
				.setMinValue(0)
				.setRequired(true)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		await interaction.deferReply();

		const strictness = interaction.options.getNumber('strictness');

		const guildData = await Guild.findOne({
			where: { guildId: interaction.guild.id },
		});

		if (guildData) {
			await guildData.update({ spamDetectionStrictness: strictness });
			await interaction.editReply(
				`Successfully set spam detection strictness for **${interaction.guild.name}** to **${strictness}**!`
			);
		} else {
			await Guild.create({
				guildId: interaction.guild.id,
				spamDetectionStrictness: strictness,
			});
			await interaction.editReply(
				`Successfully set spam detection strictness for **${interaction.guild.name}** to **${strictness}**!`
			);
		}
	},
};
