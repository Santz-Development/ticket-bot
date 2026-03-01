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
