const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../../db/models/guild.js');

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('spam-penalty')
		.setDescription('How long (seconds) to timeout spammers for.')
		.addNumberOption((option) =>
			option
				.setName('penalty')
				.setDescription('The new spam penalty value.')
				.setMaxValue(100000)
				.setMinValue(0)
				.setRequired(true)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
	async execute(interaction) {
		await interaction.deferReply();

		const penalty = interaction.options.getNumber('penalty');

		const guild = await Guild.findOne({
			where: { guildId: interaction.guild.id },
		});

		if (guild) {
			await guild.update({ spamPenalty: penalty });
			await interaction.editReply(
				`Successfully set spam penalty for **${interaction.guild.name}** to **${penalty}** second(s)!`
			);
		} else {
			await Guild.create({
				guildId: interaction.guild.id,
				spamPenalty: penalty,
			});
			await interaction.editReply(
				`Successfully set spam penalty for **${interaction.guild.name}** to **${penalty}** second(s)!`
			);
		}
	},
};
