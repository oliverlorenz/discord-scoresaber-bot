import WebSocket from "ws";
import { AnyChannel, Client, MessageEmbed } from "discord.js";
import { load } from "ts-dotenv";

const env = load({
  STEAM_USER_IDS: {
    type: String,
    default: "",
  },
  DISCORD_TOKEN: String,
  DISCORD_CHANNEL_ID: String,
  LOG_INTERVAL_MS: {
    type: Number,
    default: 1000 * 60 * 15, // 15 Minutes
  },
});

const steamUserIdsToWatch: string[] = env.STEAM_USER_IDS
  ? env.STEAM_USER_IDS.split(",").map((rawSteamUserId) => rawSteamUserId.trim())
  : [];

const discordConnectPromise = new Promise(
  (resolve: (value: AnyChannel) => void) => {
    const client = new Client({
      intents: ["GUILD_MESSAGES", "GUILDS"],
    });

    client.on("ready", async (asd) => {
      const channel = client.channels.cache.get(env.DISCORD_CHANNEL_ID);
      if (channel) {
        console.log("connected to discord");
        return resolve(channel);
      }
    });

    client.login(env.DISCORD_TOKEN);
  }
);

const scoresaberConnectPromise = new Promise(
  (resolve: (value: WebSocket) => void) => {
    const ws = new WebSocket("wss://scoresaber.com/ws");
    ws.on("open", function open() {
      console.log("connected to scoresaber.com");
      resolve(ws);
    });
  }
);

(async () => {
  const [channel, ws] = await Promise.all([
    discordConnectPromise,
    scoresaberConnectPromise,
  ]);
  console.log("start watching");

  let messagesSeenCount = 0;
  let relevantMessagesSeenCount = 0;

  setInterval(() => {
    console.log(
      `${new Date().toISOString()}: seen ${messagesSeenCount} scores (${relevantMessagesSeenCount} were relevant)`
    );
  }, env.LOG_INTERVAL_MS);

  ws.on("message", function message(data) {
    messagesSeenCount++;
    try {
      const json = JSON.parse(data.toString());
      const entry = {
        player: {
          steamId: json.commandData.score.leaderboardPlayerInfo.id,
          name: json.commandData.score.leaderboardPlayerInfo.name,
          profilePicture:
            json.commandData.score.leaderboardPlayerInfo.profilePicture,
          at: new Date(json.commandData.score.timeSet),
        },
        song: {
          hash: json.commandData.leaderboard.songHash,
          name: json.commandData.leaderboard.songName,
          author: json.commandData.leaderboard.songAuthorName,
          mapper: json.commandData.leaderboard.levelAuthorName,
          difficulty: json.commandData.leaderboard.difficulty.difficultyRaw,
          coverImage: json.commandData.leaderboard.coverImage,
          scoresaberLink: `https://scoresaber.com/leaderboard/${json.commandData.leaderboard.id}`,
        },
        score: {
          modifiedScore: json.commandData.score.modifiedScore,
          maxCombo: json.commandData.score.maxCombo,
          missedNotes: json.commandData.score.missedNotes,
          fullCombo: json.commandData.score.fullCombo,
          badCuts: json.commandData.score.badCuts,
        },
      };

      const hasConfiguredSteamUsers = steamUserIdsToWatch.length !== 0;
      const isSteamUserToWatch = steamUserIdsToWatch.includes(
        entry.player.steamId
      );

      if (!hasConfiguredSteamUsers || isSteamUserToWatch) {
        const exampleEmbed = new MessageEmbed()
          .setAuthor({
            name: `${entry.player.name}`,
            iconURL: `${entry.player.profilePicture}`,
            url: `https://scoresaber.com/u/${entry.player.steamId}`,
          })
          .setTimestamp()
          .setImage(entry.song.coverImage)
          .addFields([
            {
              name: entry.song.name,
              value: entry.song.author,
            },
            {
              name: "bsaber.org Link",
              value: `https://bsaber.org/?search=${entry.song.hash}`,
            },
            {
              name: "Leaderboard Link",
              value: entry.song.scoresaberLink,
            },
          ]);
        // @ts-ignore
        channel.send({ embeds: [exampleEmbed] });
        relevantMessagesSeenCount++;
        if (isSteamUserToWatch) {
          console.log(
            `${new Date().toISOString()}: ${entry.player.name} scored!`
          );
        }
      }

      // channel.send(
      //   `**${entry.player.name}** hat ["${entry.song.name}" von "${
      //     entry.song.author
      //   }"](http://google,de) auf ${
      //     entry.song.difficulty.split("_")[1]
      //   } gespielt`
      // );
    } catch {}
  });
})();
