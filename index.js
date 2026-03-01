require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType
} = require("discord.js");

const fs = require("fs");

// =============================
// CLIENT
// =============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// =============================
// DATABASE SYSTEM (JSON)
// =============================

const guildsPath = "./guilds.json";
const ticketsPath = "./tickets.json";

if (!fs.existsSync(guildsPath)) fs.writeFileSync(guildsPath, JSON.stringify({}));
if (!fs.existsSync(ticketsPath)) fs.writeFileSync(ticketsPath, JSON.stringify({}));

let guildsDB = JSON.parse(fs.readFileSync(guildsPath));
let ticketsDB = JSON.parse(fs.readFileSync(ticketsPath));

function saveGuilds() {
    fs.writeFileSync(guildsPath, JSON.stringify(guildsDB, null, 2));
}

function saveTickets() {
    fs.writeFileSync(ticketsPath, JSON.stringify(ticketsDB, null, 2));
}

// =============================
// READY EVENT
// =============================

client.once("ready", async () => {
    console.log(`✅ Bot online como ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName("setup")
            .setDescription("Configurar sistema de tickets")
            .addChannelOption(option =>
                option.setName("categoria")
                    .setDescription("Categoria dos tickets")
                    .setRequired(true)
            )
            .addRoleOption(option =>
                option.setName("staff")
                    .setDescription("Cargo da staff")
                    .setRequired(true)
            )
            .addChannelOption(option =>
                option.setName("logs")
                    .setDescription("Canal de logs")
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName("limite")
                    .setDescription("Limite de tickets por usuário")
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("painel")
            .setDescription("Criar painel de tickets")
    ].map(cmd => cmd.toJSON());

    await client.application.commands.set(commands);
});

// =============================
// INTERACTION CREATE
// =============================

client.on("interactionCreate", async (interaction) => {

    // =============================
    // SLASH: SETUP
    // =============================

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "setup") {

            const categoria = interaction.options.getChannel("categoria");
            const staff = interaction.options.getRole("staff");
            const logs = interaction.options.getChannel("logs");
            const limite = interaction.options.getInteger("limite");

            guildsDB[interaction.guild.id] = {
                categoriaId: categoria.id,
                staffRoleId: staff.id,
                logsChannelId: logs.id,
                limite
            };

            saveGuilds();

            return interaction.reply({
                content: "✅ Sistema configurado com sucesso!",
                ephemeral: true
            });
        }

        // =============================
    // BOTÕES
    // =============================

    if (interaction.isButton()) {

        const guildConfig = guildsDB[interaction.guild.id];
        if (!guildConfig) return;

        // =============================
        // ABRIR TICKET
        // =============================

        if (interaction.customId === "abrir_ticket") {

            const userTickets = Object.values(ticketsDB)
                .filter(t => t.guildId === interaction.guild.id && t.userId === interaction.user.id && t.aberto);

            if (userTickets.length >= guildConfig.limite) {
                return interaction.reply({
                    content: "❌ Você atingiu o limite de tickets abertos.",
                    ephemeral: true
                });
            }

            const canal = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: guildConfig.categoriaId,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    },
                    {
                        id: guildConfig.staffRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    }
                ]
            });

            ticketsDB[canal.id] = {
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                canalId: canal.id,
                aberto: true,
                staff: null
            };

            saveTickets();

            const embed = new EmbedBuilder()
                .setTitle("🎫 Ticket Aberto")
                .setDescription("Aguarde um membro da equipe.\n\nUse os botões abaixo para gerenciar.")
                .setColor("Blue");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("assumir_ticket")
                    .setLabel("Assumir")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("fechar_ticket")
                    .setLabel("Fechar")
                    .setStyle(ButtonStyle.Danger)
            );

            await canal.send({
                content: `<@${interaction.user.id}>`,
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: `✅ Ticket criado: ${canal}`,
                ephemeral: true
            });
        }

        // =============================
        // ASSUMIR TICKET
        // =============================

        if (interaction.customId === "assumir_ticket") {

            const ticket = ticketsDB[interaction.channel.id];
            if (!ticket) return;

            ticket.staff = interaction.user.id;
            saveTickets();

            return interaction.reply({
                content: `👨‍💻 Ticket assumido por ${interaction.user}.`,
                ephemeral: false
            });
        }

        // =============================
        // FECHAR TICKET
        // =============================

        if (interaction.customId === "fechar_ticket") {

            const ticket = ticketsDB[interaction.channel.id];
            if (!ticket) return;

            const modal = new ModalBuilder()
                .setCustomId("avaliacao_modal")
                .setTitle("Avaliação do Atendimento");

            const notaInput = new TextInputBuilder()
                .setCustomId("nota")
                .setLabel("Nota de 1 a 5")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(notaInput);
            modal.addComponents(row);

            return interaction.showModal(modal);
        }
    }

    // =============================
    // MODAL AVALIAÇÃO
    // =============================

    if (interaction.type === InteractionType.ModalSubmit) {

        if (interaction.customId === "avaliacao_modal") {

            const nota = interaction.fields.getTextInputValue("nota");
            const ticket = ticketsDB[interaction.channel.id];
            if (!ticket) return;

            ticket.aberto = false;
            ticket.avaliacao = nota;
            ticket.fechadoEm = Date.now();

            saveTickets();

            const guildConfig = guildsDB[interaction.guild.id];

            // =============================
            // LOG
            // =============================

            const logChannel = interaction.guild.channels.cache.get(guildConfig.logsChannelId);

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📁 Ticket Fechado")
                    .addFields(
                        { name: "Usuário", value: `<@${ticket.userId}>`, inline: true },
                        { name: "Staff", value: ticket.staff ? `<@${ticket.staff}>` : "Não assumido", inline: true },
                        { name: "Nota", value: `${nota}/5`, inline: true }
                    )
                    .setColor("Red")
                    .setTimestamp();

                logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.reply({
                content: "✅ Ticket fechado com sucesso!",
                ephemeral: true
            });

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
                }

        // =============================
        // SLASH: PAINEL
        // =============================

        if (interaction.commandName === "painel") {

            if (!guildsDB[interaction.guild.id]) {
                return interaction.reply({
                    content: "❌ Este servidor não está configurado.",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("🎫 Sistema de Tickets")
                .setDescription("Clique no botão abaixo para abrir um ticket.")
                .setColor("Green");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("abrir_ticket")
                    .setLabel("Abrir Ticket")
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: "✅ Painel criado com sucesso!",
                ephemeral: true
            });
        }
    }

});
    
client.login(process.env.TOKEN);
